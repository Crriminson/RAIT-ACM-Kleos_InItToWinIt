# Security Controls & Guardrails

This document describes the security measures implemented in the Kleos backend.
Each control was identified through manual review and implemented before demo.

---

## 1. API Key Authentication

**File:** `backend/api/auth.py`

All pipeline and data-mutation endpoints require a valid `X-API-Key` header.

| Endpoint group | Auth required | Mechanism |
|---|---|---|
| `/api/v1/invoices/*` | Yes | `X-API-Key` header |
| `/api/analyze-invoice` | Yes | `X-API-Key` header |
| `/api/gst-doubt`, `/api/ai-advice`, `/api/tax-planning` | Yes | `X-API-Key` header |
| `/api/v1/reconciliation/*`, `/api/v1/verdicts/*`, `/api/v1/summary/*` | Yes | `X-API-Key` header |
| `/api/v1/early-warning` | Yes | `X-API-Key` header |
| `/api/rag/*` | Yes | `X-API-Key` header |
| `/api/v1/webhooks/whatsapp` | No (uses HMAC) | `X-Hub-Signature-256` |
| `/api/health`, `/api/v1/health` | No | Public |

**Key management:**
- Set `KLEOS_API_KEY` in `backend/.env` for a persistent key.
- If unset, a random key is generated per session and printed to console — local dev works with zero config, but nothing is silently open.
- The app sends the key via the `EXPO_PUBLIC_API_KEY` env var in `app/.env`.
- Unauthenticated requests receive `401 Missing or invalid API key`.

---

## 2. CORS Origin Allowlist

**File:** `backend/main.py`

CORS is restricted to known development origins instead of `allow_origins=["*"]`.

**Default allowlist:**
```
http://localhost:8081      # Expo web (metro)
http://localhost:19006     # Expo web alt port
http://localhost:3000      # Landing page dev server
http://192.168.5.93:8081   # LAN dev device
```

**Configurable:** set `KLEOS_CORS_ORIGINS` (comma-separated) in `backend/.env` for deployment.

**Restricted methods/headers:** only `GET, POST, PUT, DELETE` and `Content-Type, X-API-Key, Authorization` — not `["*"]`.

---

## 3. WhatsApp Webhook Signature Verification

**File:** `backend/api/routes/webhooks.py`

### HMAC-SHA256 verification
- Every `POST /webhooks/whatsapp` verifies the `X-Hub-Signature-256` header against the request body using `WHATSAPP_APP_SECRET`.
- Uses `hmac.compare_digest()` for constant-time comparison (no timing attacks).
- When `WHATSAPP_APP_SECRET` is not set (local dev), verification is skipped but a warning is logged — never silently open in production.

### media_url domain validation
- Before fetching any image, the `media_url` hostname is checked against a known allowlist:
  - `lookaside.fbsbx.com`, `scontent.whatsapp.net`, `mmg.whatsapp.net` (Meta CDN)
  - `localhost`, `127.0.0.1` (local dev only)
- Requests with unknown hosts are rejected with `400` — prevents SSRF attacks.

### Hub verification (GET)
- `GET /webhooks/whatsapp` handles Meta's subscription challenge (`hub.mode=subscribe`).
- Validates `hub.verify_token` against `WHATSAPP_VERIFY_TOKEN` env var before echoing the challenge.

---

## 4. Upload Size Cap

**Files:** `backend/api/routes/invoices.py`, `backend/api/routes/analyze_compat.py`

All image upload paths reject payloads over **10 MB** before they reach the OCR pipeline.

- `POST /api/v1/invoices/analyze` — reads at most `10 MB + 1 byte`; rejects with `413 file_too_large` if exceeded.
- `POST /api/analyze-invoice` (base64 JSON) — decodes then checks decoded byte length against the same 10 MB cap.

This prevents accidental or adversarial large uploads from consuming memory and CPU in the OCR step.

---

## 5. Rate Limiting (per-IP)

**Library:** `slowapi` (built on `limits`)

Rate limits are applied to **paid-API paths** — endpoints that call Gemini or run the OCR pipeline — not to free local endpoints like health checks.

| Endpoint | Limit | Rationale |
|---|---|---|
| `POST /api/gst-doubt` | 10/min per IP | Gemini API call per request |
| `POST /api/ai-advice` | 10/min per IP | Gemini API call per request |
| `POST /api/tax-planning` | 10/min per IP | Gemini API call per request |
| `POST /api/v1/invoices/analyze` | 20/min per IP | OCR + Gemini fallback |
| `POST /api/analyze-invoice` | 20/min per IP | OCR + Gemini fallback |
| All other endpoints | No limit | Local computation only |

**Framing:** "We rate-limit the paid-API paths, not the free local ones" — ties into cost control.

Exceeded limits return `429 Too Many Requests` with a `Retry-After` header.

---

## 6. Secrets Management

- `.env` and `.env*.local` are in `.gitignore` — verified, no secrets in git history.
- Backend secrets: `GEMINI_API_KEY`, `KLEOS_API_KEY`, `WHATSAPP_APP_SECRET` — all read from env vars.
- App secrets: `EXPO_PUBLIC_API_KEY` — read from `app/.env`, never bundled into the JS build in production (Expo strips `EXPO_PUBLIC_*` vars in EAS builds unless explicitly configured).

---

## Environment Variables Reference

| Variable | Where | Purpose | Required |
|---|---|---|---|
| `KLEOS_API_KEY` | `backend/.env` | API key for all authenticated endpoints | No (auto-generated if unset) |
| `WHATSAPP_APP_SECRET` | `backend/.env` | HMAC key for webhook signature verification | No (skipped if unset, logs warning) |
| `WHATSAPP_VERIFY_TOKEN` | `backend/.env` | Token for Meta's hub verification handshake | No (default: `kleos-webhook-verify-2026`) |
| `KLEOS_CORS_ORIGINS` | `backend/.env` | Comma-separated allowed CORS origins | No (defaults to dev origins) |
| `GEMINI_API_KEY` | `backend/.env` | Google Gemini API key for LLM features | Yes (for AI features) |
| `EXPO_PUBLIC_API_KEY` | `app/.env` | API key sent with every app→backend request | No (requests sent without key if unset) |
| `EXPO_PUBLIC_AI_API_URL` | `app/.env` | Backend URL override | No (auto-derived from dev host) |

---

## What a Judge Sees

If asked "what guardrails do you have?", the answer is:

1. **Every endpoint is authenticated** — API key on pipeline routes, HMAC signature on webhooks, only health checks are public.
2. **CORS is locked to known origins** — not `*`.
3. **Webhook payloads are signature-verified** and media URLs are domain-validated against Meta's CDN — we don't fetch arbitrary URLs.
4. **Uploads are capped at 10 MB** before they hit the OCR pipeline — oversized files get `413`, not OOM.
5. **Paid-API paths are rate-limited** (10–20 req/min per IP) — cost control on Gemini and OCR, free local endpoints are unrestricted.
6. **No secrets in git** — all credentials are env vars, `.env` is gitignored.
