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
- If unset, a random key is generated per session and printed to console.
- The app sends the key via the `EXPO_PUBLIC_API_KEY` env var in `app/.env`.
- Unauthenticated requests receive `401 Missing or invalid API key`.

---

## 2. CORS Origin Allowlist

**File:** `backend/main.py`

CORS is restricted to known development origins instead of `allow_origins=["*"]`.

**Default allowlist:** `localhost:8081`, `localhost:8082`, `localhost:19006`, `localhost:3000`, and LAN IP variants.

**Configurable:** set `KLEOS_CORS_ORIGINS` (comma-separated) in `backend/.env` for deployment.

**Restricted methods/headers:** only `GET, POST, PUT, DELETE` and `Content-Type, X-API-Key, Authorization`.

---

## 3. WhatsApp Webhook Signature Verification

**File:** `backend/api/routes/webhooks.py`

- HMAC-SHA256 verification of `X-Hub-Signature-256` header using `WHATSAPP_APP_SECRET`.
- Uses `hmac.compare_digest()` for constant-time comparison.
- When `WHATSAPP_APP_SECRET` is not set (local dev), verification is skipped but a warning is logged.
- Hub verification (GET) validates `hub.verify_token` before echoing the challenge.
- Media downloaded only via authenticated Graph API calls (bearer token), not arbitrary URLs.

---

## 4. Upload Size Cap

**Files:** `backend/api/routes/invoices.py`, `backend/api/routes/analyze_compat.py`

All image upload paths reject payloads over **10 MB** before they reach the OCR pipeline.
Returns `413 file_too_large` if exceeded.

---

## 5. Rate Limiting (per-IP)

**Library:** `slowapi` (built on `limits`)

| Endpoint | Limit | Rationale |
|---|---|---|
| `POST /api/gst-doubt` | 10/min per IP | Gemini API call per request |
| `POST /api/ai-advice` | 10/min per IP | Gemini API call per request |
| `POST /api/tax-planning` | 10/min per IP | Gemini API call per request |
| `POST /api/v1/invoices/analyze` | 20/min per IP | OCR + Gemini fallback |
| `POST /api/analyze-invoice` | 20/min per IP | OCR + Gemini fallback |
| All other endpoints | No limit | Local computation only |

Exceeded limits return `429 Too Many Requests` with a `Retry-After` header.

---

## 6. Secrets Management

- `.env` and `.env*.local` are in `.gitignore` — verified, no secrets in git history.
- Backend secrets: `GEMINI_API_KEY`, `KLEOS_API_KEY`, `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN` — all read from env vars.
- App secrets: `EXPO_PUBLIC_API_KEY`, `EXPO_PUBLIC_SARVAM_KEY` — read from `app/.env`.

---

## 7. LLM Fallback Chain

**Files:** `backend/core/gemini.py`, `backend/core/local_llm.py`

- **Primary:** Gemini Cloud API (fast, high quality)
- **Fallback:** Local Qwen3 4B via Ollama (zero cloud dependency, works offline)
- **Last resort:** Hardcoded deterministic responses (demo never dies)
- Health endpoint reports both: `geminiConfigured`, `localLlmAvailable`
- Every API response includes `method` field (`"gemini"`, `"local_llm"`, or `"fallback"`)

---

## Environment Variables Reference

| Variable | Where | Purpose |
|---|---|---|
| `KLEOS_API_KEY` | `backend/.env` | API key for authenticated endpoints |
| `WHATSAPP_ACCESS_TOKEN` | `backend/.env` | Meta Graph API bearer token |
| `WHATSAPP_PHONE_ID` | `backend/.env` | WhatsApp Business phone number ID |
| `WHATSAPP_APP_SECRET` | `backend/.env` | HMAC key for webhook verification |
| `WHATSAPP_VERIFY_TOKEN` | `backend/.env` | Hub verification handshake token |
| `KLEOS_CORS_ORIGINS` | `backend/.env` | Comma-separated allowed CORS origins |
| `GEMINI_API_KEY` | `backend/.env` | Google Gemini API key |
| `OLLAMA_URL` | `backend/.env` | Ollama server URL (default: localhost:11434) |
| `OLLAMA_MODEL` | `backend/.env` | Local LLM model (default: qwen3:4b) |
| `EXPO_PUBLIC_API_KEY` | `app/.env` | API key sent with every app request |
| `EXPO_PUBLIC_SARVAM_KEY` | `app/.env` | Sarvam AI key for STT + translation |
