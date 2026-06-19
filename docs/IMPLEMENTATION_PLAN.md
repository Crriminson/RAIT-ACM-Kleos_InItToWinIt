# IMPLEMENTATION_PLAN.md — KLEOS 2026 · D4-PS1
*"The CA in Your Pocket That Does Not Exist"*

> This plan is ordered by dependency, not by feature desirability.
> Nothing in Phase N starts until Phase N-1's Definition of Done is met.
> Stretch features do not exist until the 70% Checkpoint is formally passed.

---

## Quick Reference

| Phase | Name | Gate |
|---|---|---|
| **Phase 0** | Pre-Build: Resolve Blockers | No code written until this is done |
| **Phase 1** | Foundation: Scaffold + Dummy Dataset | Planted dataset exists before any pipeline code |
| **Phase 2** | Core Pipeline: OCR → Extract → Match → Recommend | Integration Checkpoint A |
| **Phase 3** | Trader UI: Capture → Verdict → Summary | Integration Checkpoint B |
| **Phase 4** | Multilingual Layer (Bhashini) | Integration Checkpoint C |
| **Phase 5** | Landing Page | Structure/copy independent of Phases 1–4; real screenshots require Phase 3 (and Phase 4 for the Hindi screenshot) |
| **Phase 6** | Hardening, Validation, Demo Prep | 70% Checkpoint Assessment |
| **Stretch** | GSTR-2A Early Warning + WhatsApp Bot Stub | Only if 70% Checkpoint passes |

---

## Milestones

| # | Milestone | Signals |
|---|---|---|
| M1 | **Pre-Build Complete** | All blockers resolved, dummy dataset designed, verdict screen mocked, tech decisions recorded |
| M2 | **Pipeline Complete** | All 10–15 planted invoice cases produce the expected action + reason code |
| M3 | **Trader App Complete** | Full end-to-end flow works on mobile browser: capture → upload → verdict screen with all mandatory fields |
| M4 | **Multilingual Complete** | Hindi + English fully tested; GST-specific terms manually verified; language switch persists |
| M5 | **Demo Ready** | Landing page deployed; demo rehearsal complete; fallback plan documented |
| M6 *(stretch)* | **Stretch Features Complete** | Only if 70% Checkpoint passed; WhatsApp stub disclosed correctly |

---

## Phase 0 — Pre-Build: Resolve Blockers

> **Rule:** No implementation code — frontend or backend — is written until every task in this phase is done and the decision recorded in writing (a commit to the repo or an update to `CLAUDE.md`).

### Tasks

| ID | Task | Owner | Blocks |
|---|---|---|---|
| P0.1 | **Resolve native app vs responsive web app (PWA).** This is the single most urgent open item from Thread 010. The tech stack, landing page install-flow story, and distribution all depend on this one call. Document the decision and the rationale. | Team lead | All frontend work |
| P0.2 | **Assign the dummy GSTR-2B dataset build to one specific person.** Council flagged this as having no owner. Everything in Phase 2 depends on this artifact existing. | Team | Phase 1 P1.5 |
| P0.3 | **Design the verdict screen before writing any other screen.** Paper sketch or low-fidelity Figma — layout of: supplier name, invoice number, action badge (Accept/Reject/Hold), ₹ ITC impact, one-line reason, advisory disclaimer, disagree affordance. Council flagged this as priority #1 twice. | Designer / team | Phase 3 P3.1 |
| P0.4 | **Set the 70% checkpoint in clock time**, not percentage. The total window is confirmed as 24 hours (KLEOS Round 2, June 19–20, 2026) — convert "70% of build time" into an actual date/time once the exact start time is known. Write this down. Whoever owns the WhatsApp bot watches this clock. | Team | Phase 6 checkpoint |
| P0.5 | **Confirm OCR engine choice: PaddleOCR or vision-capable LLM API.** Both are viable per Thread 010. Decision can be based on team familiarity. Record the choice. | Team | Phase 2 P2.1 |
| P0.6 | **Confirm team's tech stack familiarity.** The council's recommendation (Python + FastAPI + Responsive PWA) reverses Thread 001's native-app framing. If the team is stronger in another backend language, this is the moment to say so — not mid-build. | Team | All |
| P0.7 | **Set up monorepo and branch structure.** `backend/`, `frontend/`, `landing/`, `docs/`. Initialize git, confirm deployment targets (Render/Railway), set environment variable conventions. | Team | Phase 1 |

### Definition of Done — Phase 0

- [ ] Native vs PWA decision documented and committed.
- [ ] Dummy dataset has a named owner and a slot in the build schedule.
- [ ] Verdict screen has a low-fidelity mockup that all teammates have seen.
- [ ] 70% Checkpoint has a specific clock time written down.
- [ ] OCR engine choice is recorded.
- [ ] Monorepo initialized with correct folder structure.

---

## Phase 1 — Foundation: Scaffold + Dummy Dataset

> **Rule:** The dummy dataset (P1.5 + P1.6) must exist before any pipeline code in Phase 2 is written. This is not a "build in parallel" item.

### Backend Scaffold

| ID | Task | Depends On | Notes |
|---|---|---|---|
| P1.1 | Initialize FastAPI project. `main.py`, `api/`, `core/`, `models/`, `db/`, `tests/`. Install dependencies: `fastapi`, `uvicorn`, `sqlalchemy`, `alembic`, `psycopg2`, `python-dotenv`, `pillow`. | P0.6 | |
| P1.2 | Configure PostgreSQL connection and Alembic. `db/session.py`, `alembic.ini`, initial migration. SQLite as local fallback if Postgres not available in dev. | P1.1 | |
| P1.3 | Define database schemas and run initial migration. Three tables: `invoices`, `gstr2b_records`, `verdicts`. See schema below. | P1.2 | Schema must be agreed before any OCR or matching code is written |
| P1.4 | Health check endpoint: `GET /api/v1/health`. Returns app status, DB connectivity, and OCR engine availability. | P1.2 | Used to confirm deploy works before demo |

#### Database Schema (Phase 1 target)

```sql
-- invoices: raw trader invoice uploads
invoices (
    id UUID PRIMARY KEY,
    uploaded_at TIMESTAMP,
    source TEXT,              -- 'camera', 'upload', 'whatsapp_stub'
    raw_image_path TEXT,
    ocr_raw_output JSONB,     -- raw OCR text, for debugging
    extracted_fields JSONB,   -- structured extraction result
    extraction_status TEXT,   -- 'success', 'partial', 'failed'
    extraction_error TEXT
)

-- gstr2b_records: the dummy GSTR-2B dataset
gstr2b_records (
    id UUID PRIMARY KEY,
    supplier_gstin TEXT NOT NULL,
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    taxable_value NUMERIC,
    cgst NUMERIC,
    sgst NUMERIC,
    igst NUMERIC,
    total_tax NUMERIC,
    hsn_codes TEXT[],
    ims_status TEXT,          -- 'pending', 'accepted', 'rejected', 'held'
    source_file TEXT          -- which dummy dataset file this came from
)

-- verdicts: IMS recommendation output
verdicts (
    id UUID PRIMARY KEY,
    invoice_id UUID REFERENCES invoices(id),
    gstr2b_record_id UUID REFERENCES gstr2b_records(id),
    created_at TIMESTAMP,
    action TEXT NOT NULL,     -- 'ACCEPT', 'REJECT', 'HOLD'
    reason_code TEXT NOT NULL,
    reason_text_en TEXT NOT NULL,
    reason_text_hi TEXT,      -- populated in Phase 4
    itc_impact_inr NUMERIC NOT NULL,
    confidence NUMERIC,
    match_status TEXT         -- 'matched', 'unmatched', 'partial'
)
```

### Dummy Dataset Build (Critical Path)

| ID | Task | Depends On | Notes |
|---|---|---|---|
| P1.5 | **Build dummy GSTR-2B CSV / seed data.** 15 records minimum. Must include: 5 clean matches, 5 GSTIN or invoice number mismatches, 3 HSN code mismatches, 2 tax amount delta cases. Each record must have a pre-assigned expected verdict (`ACCEPT`/`REJECT`/`HOLD`) and expected reason code. Document these in `docs/planted-cases.md`. | P0.2 | **This is the single most important Phase 1 deliverable. Nothing in Phase 2 starts without it.** |
| P1.6 | **Build corresponding dummy invoice images.** For each of the 15 GSTR-2B records, create a matching (or deliberately mismatching) invoice image: printed invoice, WhatsApp-style image, scanned PDF. Use realistic Indian invoice formats (GST-compliant layout). | P1.5 | Images can be created in any tool — they just need to be realistic enough for OCR |
| P1.7 | Data loader script: `python scripts/load_dummy_dataset.py` — seeds `gstr2b_records` table from the CSV. Idempotent (re-running does not duplicate). | P1.3, P1.5 | |
| P1.8 | `docs/planted-cases.md` — table of all 15 cases: case ID, invoice image filename, GSTR-2B record ID, planted mismatch type, expected action, expected reason code, expected ITC impact. | P1.5, P1.6 | This is the test oracle for the entire Phase 2 validation |

### Frontend Scaffold

| ID | Task | Depends On | Notes |
|---|---|---|---|
| P1.9 | Initialize frontend project. React + Vite. Configure as PWA if PWA decision was made in P0.1. Install: `axios`, `react-router-dom`, `i18next` (or Bhashini integration stub). | P0.1 | If native was chosen instead, this task changes entirely |
| P1.10 | Set up folder structure: `pages/`, `components/`, `api/`, `i18n/`. Create stub pages for Upload, Verdict, Summary. | P1.9 | |

### Definition of Done — Phase 1

- [ ] `GET /api/v1/health` returns 200 with DB connected.
- [ ] Alembic migration runs cleanly from scratch on a fresh database.
- [ ] Dummy dataset loaded: 15 records in `gstr2b_records`, confirmed via DB query.
- [ ] 15 dummy invoice images exist in `backend/data/test_invoices/`.
- [ ] `docs/planted-cases.md` complete with expected outcomes for all 15 cases.
- [ ] Frontend renders a blank stub page without console errors.
- [ ] `load_dummy_dataset.py` is idempotent.

---

## Phase 2 — Core Pipeline: OCR → Extract → Match → Recommend

> **Rule:** Write tests for each module against the planted cases *before* finalising the module's logic. Red tests first, then make them green. Any planted case that produces the wrong action or reason code is a P0 bug — fix before proceeding.

### OCR Layer

| ID | Task | Depends On | Notes |
|---|---|---|---|
| P2.1 | **OCR engine wrapper** (`core/ocr.py`). Single function: `extract_text(image_source) -> RawOCRResult`. `image_source` accepts: file path (JPEG/PNG/PDF), bytes, base64 string. The source type must never affect downstream logic — the wrapper normalises all inputs. | P0.5, P1.1 | This is the input-source-agnostic requirement |
| P2.2 | Write OCR unit tests against 5 of the 15 planted invoice images. Confirm raw text output contains GSTIN, invoice number, and at least one HSN code for each. | P2.1, P1.6 | Tests must pass before moving to extraction |

### Extraction Layer

| ID | Task | Depends On | Notes |
|---|---|---|---|
| P2.3 | **Field extractor** (`core/extractor.py`). Input: `RawOCRResult`. Output: `ExtractedInvoice` (structured) or `ExtractionError` (typed). Required fields: `supplier_gstin`, `invoice_number`, `invoice_date`, `taxable_value`, `cgst`, `sgst`, `igst`, `hsn_codes[]`. If any required field is missing, return `ExtractionError` with field name and confidence score. Never pass nulls to the matcher. | P2.1 | |
| P2.4 | Define all error and result types (`models/extraction.py`). `ExtractionError`, `ExtractedInvoice`, `RawOCRResult`, confidence enum. | P2.3 | Agree types before writing extractor logic |
| P2.5 | Write extraction unit tests against all 15 planted invoice images. Assert all required fields are present and correctly parsed for the 5 clean-match cases. Assert `ExtractionError` is returned (not an exception raised) for any deliberately corrupted test image. | P2.3, P1.6 | |

### Matching / Reconciliation Layer

| ID | Task | Depends On | Notes |
|---|---|---|---|
| P2.6 | Define mismatch reason types (`models/mismatch.py`). Enum: `GSTIN_MISMATCH`, `INVOICE_NUMBER_MISMATCH`, `DATE_MISMATCH`, `HSN_NOT_FOUND`, `TAX_AMOUNT_DELTA`, `RECORD_NOT_FOUND`, `CLEAN_MATCH`. | P2.4 | Types are defined before matching logic — the recommender depends on these exact codes |
| P2.7 | **Reconciliation engine** (`core/matcher.py`). Input: `ExtractedInvoice`. Queries `gstr2b_records`. Primary match key: `supplier_gstin` + `invoice_number` + `invoice_date` (± 1 day tolerance). On match: compare HSN codes and tax amounts (configurable delta threshold, default ±₹1). Returns: `MatchResult` with `match_status`, `gstr2b_record_id`, and list of `MismatchReason` codes. | P2.6, P1.3 | |
| P2.8 | Write reconciliation unit tests against all 15 planted cases. Each test: input the planted `ExtractedInvoice`, assert the correct `MismatchReason` codes are returned. This is the first time the planted-cases oracle is formally exercised. | P2.7, P1.8 | |

### IMS Recommendation Engine

| ID | Task | Depends On | Notes |
|---|---|---|---|
| P2.9 | **Reason text library** (`core/reason_texts.py`). For each `MismatchReason` code: one plain-language English string written for a kirana store owner. No GST jargon without a Hinglish gloss. Strings must be under 120 characters (fits a mobile screen without truncation). | P2.6 | Write these with a non-technical reader in mind. Have at least one teammate who is not the author read each string cold. |
| P2.10 | **IMS recommendation engine** (`core/recommender.py`). Input: `MatchResult`. Output: `Verdict` (action, reason_code, reason_text_en, itc_impact_inr, confidence). Decision rules: `CLEAN_MATCH` → `ACCEPT`; `RECORD_NOT_FOUND` or `GSTIN_MISMATCH` → `REJECT`; `TAX_AMOUNT_DELTA` or `HSN_NOT_FOUND` → `HOLD`; `DATE_MISMATCH` → context-dependent (HOLD unless delta > 30 days → REJECT). | P2.9, P2.7 | ITC impact calculation: delta between invoice tax claim and GSTR-2B recorded tax |
| P2.11 | Write recommender unit tests against all 15 planted cases. Assert: correct action, correct reason code, non-empty reason text, non-zero ITC impact where applicable. | P2.10, P1.8 | |

### API Routes (Phase 2)

| ID | Task | Depends On | Notes |
|---|---|---|---|
| P2.12 | `POST /api/v1/invoices/upload` — accepts multipart image, runs full pipeline (OCR → extract → match → recommend), stores results, returns `verdict_id`. | P2.10, P1.3 | |
| P2.13 | `GET /api/v1/verdicts/{invoice_id}` — returns full verdict for a given invoice. | P2.12 | |
| P2.14 | `GET /api/v1/summary` — returns monthly summary: total invoices processed, breakdown by action (Accept/Reject/Hold), total ₹ ITC claimable, total ₹ ITC at risk. | P2.12 | |

---

### 🔴 Integration Checkpoint A — Full Pipeline Test

> **Gate:** Phase 3 does not start until this checkpoint passes.

Run the full pipeline (`POST /api/v1/invoices/upload`) on each of the 15 planted invoice images. Compare actual verdicts against `docs/planted-cases.md`.

| Criterion | Pass Condition |
|---|---|
| Coverage | All 15 cases processed without an unhandled exception |
| Accuracy — action | ≥ 13/15 correct actions (ACCEPT/REJECT/HOLD) |
| Accuracy — reason code | ≥ 13/15 correct reason codes |
| ITC impact | Non-zero and correctly signed for all non-CLEAN_MATCH cases |
| Error handling | All `ExtractionError` cases return a structured error response, not a 500 |
| No null propagation | Zero null fields in any `Verdict` record in the database |

**If checkpoint fails:** Fix the failing planted cases. Do not proceed to Phase 3. Re-run all 15 cases after each fix.

### Definition of Done — Phase 2

- [ ] Integration Checkpoint A passes.
- [ ] All unit tests (OCR, extraction, matching, recommendation) pass.
- [ ] All three API routes return correct responses for the planted dataset.
- [ ] `docs/planted-cases.md` updated with actual vs expected results for all 15 cases.
- [ ] No `print()` debug statements left in pipeline code.

---

## Phase 3 — Trader UI: Capture → Verdict → Summary

> **Rule:** Build Verdict screen first (P3.1–P3.5). It is the product's core screen and everything else frames it.

### Verdict Screen (Build First)

| ID | Task | Depends On | Notes |
|---|---|---|---|
| P3.1 | **Verdict screen** (`pages/Verdict.jsx`). Fetches verdict by `invoice_id`. Displays all mandatory fields: supplier name, invoice number, action badge, ₹ ITC impact, one-line reason (English), advisory disclaimer. Matches the P0.3 mockup exactly. | P0.3, P2.13, P1.9 | |
| P3.2 | **ActionBadge component** (`components/ActionBadge.jsx`). Three states: ACCEPT (green), REJECT (red), HOLD (amber). Must be legible on a small mobile screen (minimum 44px tap target). | P3.1 | |
| P3.3 | **ITCImpact component** (`components/ITCImpact.jsx`). Displays ₹ amount with sign — green positive (claimable), red negative (at risk). | P3.1 | |
| P3.4 | **Advisory disclaimer component** (`components/AdvisoryDisclaimer.jsx`). Text: "This is a recommendation. Do not file on the GST portal until you verify." Rendered on every verdict screen load — not a tooltip, not a modal, not a help page. | P3.1 | Non-negotiable per Thread 009 |
| P3.5 | **DisagreeFeedback component** (`components/DisagreeFeedback.jsx`). Single tap — no modal confirmation. Sends `POST /api/v1/verdicts/{id}/feedback` with `{ understood: false }`. Visual confirmation: brief "Noted" message inline. | P3.1, P3.1 | |
| P3.6 | `POST /api/v1/verdicts/{id}/feedback` backend route. Stores feedback flag on the verdict record. No complex logic needed — just record it. | P2.12 | |

### Capture Flow

| ID | Task | Depends On | Notes |
|---|---|---|---|
| P3.7 | **Upload page** (`pages/Upload.jsx`). Two input modes: camera capture (mobile browser `input[capture]`) and file upload (JPEG, PNG, PDF). On submit: calls `POST /api/v1/invoices/upload`, shows a loading state, navigates to Verdict screen on success, shows a typed error message on `ExtractionError`. | P2.12, P1.9 | Camera capture works natively in mobile browsers without native app. Test on actual mobile Chrome. |
| P3.8 | Loading state component. Upload + processing can take 3–10 seconds (OCR is slow). Show a progress indicator — not a spinner that offers no feedback. Text like "Reading your invoice…" is fine. | P3.7 | |
| P3.9 | Error state handling on Upload page. Three distinct error states: (a) OCR failed — "We couldn't read this image. Try a clearer photo." (b) No match found — "This invoice wasn't found in your GST data. It may need to be reviewed manually." (c) Network error — "Upload failed. Try again." Each state shown inline, not as an alert. | P3.7 | |

### Monthly Summary

| ID | Task | Depends On | Notes |
|---|---|---|---|
| P3.10 | **Summary page** (`pages/Summary.jsx`). Calls `GET /api/v1/summary`. Displays: total invoices processed, count by action (Accept/Reject/Hold), total ₹ ITC claimable, total ₹ ITC at risk. Simple card layout — no charts needed for MVP. | P2.14, P1.9 | |
| P3.11 | Navigation between Upload → Verdict → Summary. Simple bottom nav or header links. No auth flow needed for MVP. | P3.7, P3.1, P3.10 | |

---

### 🟡 Integration Checkpoint B — End-to-End Flow on Mobile

> **Gate:** Phase 4 does not start until this checkpoint passes.

| Criterion | Pass Condition |
|---|---|
| Upload → Verdict | Capture an invoice image on a real mobile device (Android Chrome). Full pipeline completes. Verdict screen renders all mandatory fields. |
| Advisory disclaimer | Present on every verdict screen render without user action |
| Error states | All three error states (P3.9) render correctly with appropriate messaging |
| Disagree affordance | Tap sends feedback, shows "Noted" inline, no crash |
| Summary | Summary page renders correct aggregates after processing multiple invoices |
| Responsiveness | No horizontal scroll on 375px viewport (iPhone SE baseline) |

**If checkpoint fails:** Fix failing criteria before Phase 4. Do not proceed with multilingual work on broken English UX.

### Definition of Done — Phase 3

- [ ] Integration Checkpoint B passes on a real mobile device.
- [ ] All mandatory verdict fields present on every verdict render.
- [ ] Advisory disclaimer present on every verdict render.
- [ ] Upload works for JPEG, PNG, and PDF inputs.
- [ ] All error states render without console errors.
- [ ] Summary page correctly aggregates across all planted test invoices.

---

## Phase 4 — Multilingual Layer (Bhashini)

> **Rule:** English content must be fully locked before this phase starts. Do not translate incrementally. Bhashini is a single pass applied to finalised English strings.

### Preparation

| ID | Task | Depends On | Notes |
|---|---|---|---|
| P4.1 | **English content audit.** Extract every user-facing string in the frontend to `src/i18n/en.json`. Includes: UI labels, action badge text, reason texts, error messages, advisory disclaimer, feedback affordance text, summary labels. Nothing hardcoded in JSX. | Phase 3 complete | |
| P4.2 | **GST terms review list.** Create `docs/gst-terms-review.md`. List every GST-specific term in `en.json`: ITC, GSTR-2B, GSTR-2A, IMS, HSN, GSTIN, CGST, SGST, IGST. These terms will need manual verification in Hindi output — Bhashini may transliterate or translate incorrectly. | P4.1 | |

### Bhashini Integration

| ID | Task | Depends On | Notes |
|---|---|---|---|
| P4.3 | **Bhashini API client** (`core/bhashini.py` / `src/i18n/bhashini.js`). Set up API credentials (free for individual/small developers). Test translation endpoint with one sentence. | P0.7 | Register at bhashini.gov.in |
| P4.4 | Language switching mechanism in frontend. User can switch between English and Hindi. Preference stored in `localStorage`. Applied globally — every string, every page, every error message. | P4.1, P4.3 | |
| P4.5 | **Hindi translation pass.** Run all strings in `en.json` through Bhashini. Store output in `src/i18n/hi.json`. | P4.1, P4.3 | |
| P4.6 | **Manual GST terms verification.** Using `docs/gst-terms-review.md`, manually review every GST-specific term in `hi.json`. Fix any incorrect translations. Hinglish (transliteration) is acceptable and often preferable for terms like ITC, GSTIN, HSN. Log every correction with the reason. | P4.5 | At least one Hindi-literate teammate must do this review — not an automated check |
| P4.7 | Apply Hindi translations to: reason texts in backend (store in `reason_text_hi` column), all frontend i18n strings, error messages, advisory disclaimer. | P4.5, P4.6, P3.6 | The advisory disclaimer must appear correctly in Hindi |
| P4.8 | *(Stretch within Phase 4)* One additional regional language (e.g., Marathi or Kannada) — single translation pass, no manual term review required. Demo moment only. | P4.5 | Only if P4.7 is fully done and time allows |

---

### 🟢 Integration Checkpoint C — Multilingual End-to-End

> **Gate:** Phase 5 and Phase 6 depend on this being done, but they can run in parallel with each other after this checkpoint.

| Criterion | Pass Condition |
|---|---|
| Language switch | Switching between English and Hindi updates all strings on all pages without page reload |
| Persistence | Language preference survives page refresh |
| Hindi verdict | All mandatory verdict fields display correctly in Hindi |
| Advisory disclaimer | Appears in Hindi when Hindi is selected |
| Error messages | All three error states (P3.9) render in Hindi |
| GST terms | All terms in `docs/gst-terms-review.md` verified as correct or deliberately transliterated |
| Summary | Monthly summary page renders correctly in Hindi |

### Definition of Done — Phase 4

- [ ] Integration Checkpoint C passes.
- [ ] `src/i18n/en.json` and `src/i18n/hi.json` contain all user-facing strings.
- [ ] `docs/gst-terms-review.md` completed with verification status per term.
- [ ] No hardcoded English strings remain in any JSX component.
- [ ] `reason_text_hi` populated in all 15 planted-case verdict records.

---

## Phase 5 — Landing Page

> **Rule:** The landing page is a completely separate surface from the trader app. It is the judge/demo surface. Keep it in `landing/` with its own deployment. Do not share components, styles, or build config with `frontend/`.

| ID | Task | Depends On | Notes |
|---|---|---|---|
| P5.1 | Set up `landing/` as a standalone static site (plain HTML/CSS or lightweight SSG). Separate deploy from the trader app. | P0.7 | |
| P5.2 | Take screenshots of the trader app: Upload page, Verdict screen (showing real planted-case output), Summary view, and the Hindi language mode. | Phase 3 complete | Take screenshots after Integration Checkpoint B, not before |
| P5.3 | Write feature highlight copy for judges. Cover: IMS action engine, OCR invoice parsing, plain-language Hindi output, ₹ ITC impact surfacing. Match the PS framing ("CA in Your Pocket"). | P5.2 | |
| P5.4 | Install / try CTA. Links to the trader app deploy. If PWA: "Add to Home Screen" flow. If web: direct link. | P0.1 resolved, P5.1 | |
| P5.5 | Roadmap section. Describe as future items (not MVP): GSP API partnership for automatic GSTR-2B fetch, WhatsApp ingestion channel, CA dashboard view. Frame these as product vision, not hackathon deliverables. | P5.3 | |
| P5.6 | IMS context explainer for judges. One section explaining that IMS became mandatory April 1, 2026 — this is the real-world problem the product solves right now, not a hypothetical. | P5.3 | |
| P5.7 | Deploy landing page to a stable URL. Test on mobile and desktop. | P5.1–P5.6 | |

### Definition of Done — Phase 5

- [ ] Landing page deployed at a stable URL.
- [ ] Screenshots reflect actual working app output (not mockups).
- [ ] Roadmap clearly distinguishes MVP features from future items.
- [ ] IMS context included.
- [ ] Landing page renders correctly on mobile (375px) and desktop.

---

## Phase 6 — Hardening, Validation, Demo Prep

### Regression Suite

| ID | Task | Depends On | Notes |
|---|---|---|---|
| P6.1 | **Full planted-invoice regression run.** Run all 15 cases through the complete deployed stack (not localhost). Compare actual vs expected from `docs/planted-cases.md`. Update the table with pass/fail for each case. | Phase 3, Phase 4 complete | |
| P6.2 | **Bug triage.** Any planted case that fails gets a P0 label. Fix before anything else. Any case that fails close to the deadline: make the explicit call (in writing) to either fix it or exclude it from the live demo. Do not leave this decision implicit. | P6.1 | |
| P6.3 | Performance check. Measure: upload → verdict latency on a real mobile device on a real network (not localhost). Target: under 10 seconds for the OCR + pipeline. If significantly over, profile the OCR step first. | Phase 3 deployed | |
| P6.4 | Final mobile responsiveness pass. Test on: Android Chrome (375px), iOS Safari (390px). Check: no horizontal scroll, no overlapping elements, all tap targets ≥ 44px, Hindi text wraps correctly. | Phase 3, Phase 4 deployed | |

### Demo Prep

| ID | Task | Depends On | Notes |
|---|---|---|---|
| P6.5 | **Write the demo script.** Structure: (1) problem setup — kirana owner, 2,000 invoices, IMS mandatory from April 2026; (2) live demo — upload one invoice, show verdict screen; (3) switch to Hindi; (4) show monthly summary; (5) roadmap mention of WhatsApp channel and GSP API. Script must include the "this is a recommendation, not auto-filing" framing as a feature, not an apology. | All phases done | |
| P6.6 | **Prepare the fallback demo path.** Identify 3 invoices from the planted set that reliably produce clean, demo-worthy verdicts. Pre-load these in the deployed database. If the live upload fails during the demo, fall back to `GET /api/v1/verdicts/{pre_loaded_id}` directly. | P6.1 | |
| P6.7 | **Demo rehearsal — full run.** At least one complete run-through with the entire team, on the actual device that will be used in the presentation, against the deployed app (not localhost). Identify anything that looks broken or confusing. Fix or script around it. | P6.5, P6.6 | |

---

### 🔵 70% Checkpoint Assessment

> **Assess at the pre-agreed clock time set in P0.4. This is a binary decision.**

| Criterion | Required |
|---|---|
| Core pipeline (OCR → extract → match → recommend) | Fully working on all planted cases |
| Trader UI (Upload → Verdict → Summary) | Fully working on mobile browser |
| Bhashini integration | Hindi rendering passes Integration Checkpoint C |
| Fallback demo path | Confirmed working |

**If all criteria met → attempt Stretch Phase.**  
**If any criterion not met → skip Stretch entirely. All remaining time goes to hardening and rehearsal.**

This decision is made calmly against the criteria above, not under deadline pressure. It was decided in advance.

### Definition of Done — Phase 6

- [ ] All 15 planted cases pass (or failing cases explicitly excluded from demo with written note).
- [ ] Upload → Verdict latency measured and acceptable.
- [ ] Fallback demo path tested and confirmed.
- [ ] Demo rehearsal complete.
- [ ] Demo script written and reviewed by team.
- [ ] Landing page URL included in demo slide.

---

## Stretch Phase — GSTR-2A Early Warning + WhatsApp Bot Stub

> **Only entered if the 70% Checkpoint passes. If not entered, these items become roadmap slides.**

### GSTR-2A Early Warning Screen

| ID | Task | Depends On | Notes |
|---|---|---|---|
| S1.1 | Extend dummy dataset: add GSTR-2A records representing supplier filing dates. Identify 3 suppliers who have not yet filed by the mock "14th of the month" boundary. | Checkpoint passed | Reuses existing DB infrastructure |
| S1.2 | `GET /api/v1/early-warning` endpoint. Compares trader's purchase register dates against supplier GSTR-2A filing dates. Returns: list of suppliers not yet filed, estimated ITC at risk per supplier. | S1.1 | No new OCR needed — pure data comparison |
| S1.3 | Early Warning screen in frontend. Simple list: "3 suppliers haven't filed yet — ₹X could be blocked if unresolved by the 14th." One card per supplier. No action button needed (this is an informational screen). | S1.2, Phase 3 | |

### WhatsApp Bot Stub

| ID | Task | Depends On | Notes |
|---|---|---|---|
| S2.1 | One hardcoded test case: a specific pre-set contact and invoice image, routed through the real pipeline via a webhook endpoint. | Checkpoint passed | This is a stub — one contact, one image, one hardcoded route |
| S2.2 | `POST /api/v1/webhooks/whatsapp` endpoint. Accepts the stub payload, runs the real OCR → extract → match → recommend pipeline, returns a formatted text verdict. | S2.1, Phase 2 | |
| S2.3 | Prepare the verbal disclosure for the demo: "This is a working prototype of the WhatsApp ingestion channel — one hardcoded test case routed through the real pipeline." Do not imply it is a fully deployed WhatsApp Business API integration. | S2.2 | Non-negotiable — reputational risk if framed incorrectly |

---

## Dependency Graph (Summary)

```
P0 (all blockers)
  └── P1.1–P1.4 (backend scaffold)
  └── P1.9–P1.10 (frontend scaffold)
  └── P1.5 (dummy GSTR-2B dataset) ← P0.2 MUST be assigned
       └── P1.6 (dummy invoice images)
            └── P1.7 (data loader)
            └── P1.8 (planted-cases.md — test oracle)
                 └── P2.1 (OCR wrapper)
                      └── P2.3 (field extractor)
                           └── P2.7 (reconciliation engine)
                                └── P2.10 (recommendation engine)
                                     └── P2.12–P2.14 (API routes)
                                          ├── [Checkpoint A]
                                          └── P3.1–P3.11 (Trader UI)
                                               ├── [Checkpoint B]
                                               └── P4.1–P4.7 (Bhashini)
                                                    └── [Checkpoint C]
                                                         └── P6 (hardening)
                                                              └── [70% Checkpoint]
                                                                   └── Stretch (if passed)

P5 (Landing page structure/copy) — parallel to P1–P4; real screenshots in P5.2 depend on Phase 3 complete (and Phase 4 for the Hindi-mode screenshot)
```

---

## Assumptions

The ideation document did not specify the following. These are reasonable assumptions — flag and correct if wrong.

1. **React + Vite** is the frontend framework. Ideation does not specify; this is a generic fast-to-scaffold default, not informed by any confirmed team history. Override in P0.6 if team prefers otherwise.
2. **Total hackathon build window is 24 hours.** This is no longer a guess: KLEOS (RAIT, Navi Mumbai) Round 2 is a confirmed 24-hour offline hackathon held June 19–20, 2026. Given the current date, this window starts imminently — treat Phase 0 as urgent and set the 70% checkpoint clock time (P0.4) directly off this 24-hour figure once the exact start time is known.
3. **Team size is 2–4 members**, per KLEOS's published eligibility rules (undergraduate teams of 2–4). The specific roster is not specified anywhere in the ideation document — a name list appeared in an earlier draft of this file but was not supported by the source material and has been removed. Confirm the actual roster and reassign owners in P0.2 and P0.4 accordingly.
4. **Alembic** is used for DB migrations (standard FastAPI + PostgreSQL convention).
5. **The dummy dataset images** can be digitally generated (e.g., a script that produces realistic GST invoice PDFs) rather than photographed physical invoices. Either is acceptable.
6. **PaddleOCR** is the assumed OCR choice if the team has not already picked the LLM API option. It runs locally, requires no API key, and has good Hindi/multilingual support. Resolve in P0.5.
7. **No authentication** is required for the hackathon MVP. The trader app has no login flow.
8. **`i18next`** is used for frontend i18n string management, with Bhashini providing the translation values rather than real-time API calls per render.
