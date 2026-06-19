# Technical Requirements Document (TRD)

**Hackathon:** KLEOS 2026
**Domain:** 04 — AI/ML
**Problem Statement:** D4-PS1 — "The CA in Your Pocket That Does Not Exist"
**Team project name:** TBD

> **Note on source state:** This TRD is derived from the project's living ideation document (Session 1). Nothing in that document has been marked `[VALIDATED]`. The recommendations below represent the most recent, most-refined council direction at the time of writing, but several are explicitly **not yet agreed by the user** — most critically the native-app vs. web-app decision in Section 3 and Section 11. This TRD should be revised once those items are resolved.

---

## 1. Technical Overview

The product is a GST reconciliation and Input Tax Credit (ITC) diagnosis tool built **for the trader directly** (e.g. a kirana store owner), not for a CA managing multiple clients. It addresses a documented gap: GST-registered MSMEs receive 500–2,000 invoices/month in mixed formats (WhatsApp images, printed/digital invoices, machine-generated receipts, scanned PDFs), pay a CA ₹15,000–₹40,000/month largely for manual data entry, and have no tool that explains *why* an invoice fails reconciliation or *what to do about it* in plain language.

The system ingests a trader's GST data (via a simulated GSTR-2B/2A/IMS-status dataset, per the problem statement's Simulation Clause) and the trader's own invoices, performs OCR and reconciliation, and produces a per-invoice **recommendation** — Accept / Reject / Hold, mapped to the mandatory Invoice Management System (IMS) introduced April 1, 2026 — in plain, multilingual language, with a one-line reason and the ₹ ITC impact. The system is explicitly framed as a **recommendation engine, not an auto-filing system**; the trader takes the final action.

Two distinct surfaces exist:
- **Landing page** — a hackathon presentation surface for judges only (screenshots, install CTA, feature highlights). It is not the trader's entry point and must not influence UX/architecture decisions.
- **Trader-facing app** — where invoice capture, diagnosis, and verdict review actually happen.

---

## 2. System Architecture

### 2.1 Core pipeline (MVP)

```
[0] Dummy GSTR-2B/2A/IMS-status dataset import (per Simulation Clause)
        ↓
[1] Trader invoice capture (in-app camera/upload — input-source-agnostic backend)
        ↓
[2] OCR + structured extraction of the trader's invoices
    → also extract Place-of-Supply field + supplier-GSTIN state
      code (PoS Mismatch Detector, F12)
    → detect Section 17(5) blocked categories from invoice
      content — restaurant, motor vehicle, club, etc. (F13)
        ↓
[3] Matching/reconciliation against the imported GST dataset
    → PoS Mismatch Detector (F12): supplier & PoS same State
      but recipient in another State/UT ⇒ ITC blocked
    → root-cause classification of supplier mismatches feeds
      the Supplier-Fix Message Generator (F14)
        ↓
[4] IMS Action Recommendation engine
    → per invoice: Accept / Reject / Hold, plain non-jargon language,
      one-line reason, ₹ ITC impact
    → Permanent vs Recoverable ITC Classifier (F11): tag each
      blocked/reversed rupee as "lost forever" vs "recoverable"
    → Section 17(5) hits surface as a Reject/don't-claim reason (F13)
    → Supplier-Fix Message Generator (F14): drafts a supplier
      message for the trader to review + send (never auto-sent)
        ↓
[5] Verdict screen
    → single-invoice view first, then a simple monthly summary view
        ↓
[6] Multilingual layer (Bhashini)
    → applied after English content is locked, with a verification
      pass on GST-specific terminology
        ↓
[7] Trust/explainability affordances
    → "I don't understand / disagree" per recommendation
    → explicit "this is a recommendation, not an automatic filing
      action" framing (UI + judge-facing presentation)
    → small, explicitly-demoed mini-walkthrough for the 3 possible
      IMS actions (not a full portal tutorial)
```

Step [0] currently has **no owner or build slot** and everything downstream depends on it existing first — flagged by the council as the single most foundational unbuilt piece.

### 2.2 Stretch components (hard-gated, only after MVP core is fully working and tested on multiple invoices)

- **GSTR-2A-based supplier non-filing early warning** — reuses data already ingested for reconciliation (comparing purchase-register dates against supplier 2A filing dates); no new OCR or bot infrastructure required.
- **WhatsApp bot stub** — one hardcoded test contact/image routed through the real, working pipeline live in the demo, explicitly disclosed as a working prototype of the ingestion channel rather than a complete integration. Gated at a build-time checkpoint (conceptually ~70%, not yet converted to a clock time — see Section 11).
- **E-invoice eligibility alert + guide** — fires when the trader's tracked/self-reported turnover crosses ₹5 crore. Unlocks a short, static walkthrough (list of the 6 authorized IRPs, registration steps, deep-link to einvoice.gst.gov.in). Explicitly **does not** submit, register, or generate an IRN on the trader's behalf — researched and confirmed (Session 1) that both direct-IRP-API and GSP-API paths require the taxpayer's own credentials and a per-session OTP, making silent/automated submission infeasible regardless of app architecture.

### 2.3 Explicitly out of scope (cut or roadmap-only)

Supplier risk scoring, auto-dispute generation, cashflow forecasting, ERP connectors, bank feed/Account Aggregator integration, voice/IVR assistant, full offline-first architecture (simplified instead to a basic "queue capture, send when network returns" mechanism), and live GSP-sandbox integration (kept only as a roadmap/pitch narrative, not a hackathon build item).

### 2.4 Unresolved architectural contradiction — flag prominently

The original framing (Thread 001) proposed an **installable native or PWA mobile app** for the trader, accessed via camera + on-device OCR/TFLite. A later council pass (Thread 010), prioritizing demo safety, recommended a **responsive mobile-web app** instead — directly reversing the earlier framing. This contradiction was surfaced only in the final audit and is **unresolved**. It determines the tech stack, the landing page's actual purpose (PWA install CTA vs. a plain web link), and the install-flow story told to judges. It must be decided explicitly by the team before further architecture or stack work proceeds.

---

## 3. Tech Stack

> Status: **proposed, pending team sign-off** (per Thread 010). Recommendations were made without confirming what the team already knows — treat the below as a starting point, not a final decision.

| Layer | Proposed choice | Notes |
|---|---|---|
| Trader-facing frontend | Responsive mobile-web app | Supersedes the earlier native-app (Flutter/React Native) framing from Thread 001. **Conflicts with Section 2.4 — unresolved.** |
| Backend | Python + FastAPI | — |
| OCR | PaddleOCR or a vision-capable LLM API | Both options open; no decision made between self-hosted OCR vs. API-based extraction. |
| Storage | Postgres or SQLite | — |
| Hosting | Fast-deploy host (Render/Railway-style) | — |
| Multilingual | Bhashini API (MeitY, National Language Translation Mission) | Free, government-backed, covers translation/STT/TTS/OCR across 22 official Indian languages; confirmed available for individual/small developers. |
| Landing page | Not specified in source | Treated as a separate, simple judge-facing artifact; tech choice TBD. |

**Alternative considered and not resolved:** a PWA installed directly from the landing page (no Play Store friction, but limited on-device OCR) vs. a native app (full camera + TFLite access, but added distribution overhead). This was the original Thread 001 framing and has not been explicitly reconciled with the Thread 010 web-app recommendation.

---

## 4. Key Components

1. **Dummy GST dataset importer** — loads the simulated GSTR-2B/2A/IMS-status data per the problem statement's Simulation Clause.
2. **Invoice capture module** — in-app camera/upload, designed input-source-agnostic so other channels (e.g. WhatsApp) can be added later without rework.
3. **OCR/structured extraction module** — converts trader invoice images into structured fields (GSTIN, HSN code, tax breakdown, invoice number, amounts, etc.).
4. **Matching/reconciliation engine** — compares extracted invoice data against the imported GST dataset.
5. **IMS Action Recommendation engine** — generates per-invoice Accept/Reject/Hold recommendations with plain-language reasoning and ₹ ITC impact.
6. **Verdict screen** — the core trader-facing UI: single-invoice view plus a monthly summary view. **Not yet designed** — flagged twice by the council as the top priority and still completely undesigned.
7. **Multilingual layer** — Bhashini-based translation applied to locked English content, with a verification pass for GST-specific terms. Hindi + English are the rigorously tested languages; one additional regional language is a lighter stretch demo moment.
8. **Explainability/trust layer** — the "I don't understand/disagree" affordance, the one-line "why" per recommendation, and the explicit "recommendation, not auto-filing" framing.
9. **Action-execution mini-walkthrough** — a small, explicitly-demoed walkthrough (screenshots or short voice narration) for the 3 possible IMS actions only, framed in the pitch as a deliberate choice not to auto-file (since ITC stakes are real and hard-blocked as of April 2026), not as a hidden limitation.
10. **Validation harness** — 10–15 dummy invoices with deliberately planted, known outcomes, built before the matching logic is written, with expected-vs-actual tracking; any mismatch on a planted case is treated as the highest-priority bug.
11. **Permanent vs Recoverable ITC Classifier** — for each blocked/reversed line, tags it "lost forever" (GSTR-3B Table 4B(1): s.17(5), rules 38/42/43) or "recoverable" (Table 4B(2): rule 37 180-day non-payment, s.16(2)(b) goods not received, s.16(2)(c) supplier hasn't paid tax — reclaimable later via Table 4A(5)). Feeds both the per-invoice verdict and the monthly summary. Low marginal cost once reconciliation exists.
12. **Place-of-Supply (PoS) Mismatch Detector** — at OCR/reconciliation time, compares supplier-GSTIN state code, the invoice PoS field, and the trader's registered state; flags the "supplier & PoS in same State, recipient in another State/UT ⇒ ITC blocked" case (GSTR-2B Table 4 / GSTR-3B Table 4D(2)). Requires the OCR module to extract two fields it otherwise might not (PoS, supplier state) — a new extraction requirement.
13. **Section 17(5) Blocked-Credit Detector** — at OCR time, classifies whether an invoice falls in a statutorily blocked category (food & beverage/restaurant, motor vehicles, club/gym membership, works-contract/construction for own premises, etc., per flyer §F / CGST Act s.17(5)) and warns the trader before they claim. **Must flag for review, not assert** — several categories have "except under specified circumstances" carve-outs, so a hard "blocked" verdict risks steering the trader away from credit they're entitled to. Best implemented as an LLM/category classifier over OCR'd content (on-domain for D4); feeds the recommendation engine as a Reject/don't-claim reason. (See Section 10, risk 10.)
14. **Supplier-Fix Message Generator** — when reconciliation attributes a missing/mismatched invoice to the supplier, classifies the root cause (supplier filed 3B not GSTR-1; filed GSTR-1 but omitted the invoice; declared B2B as B2C; wrong recipient GSTIN — Circular 183 §3 taxonomy) and **drafts** a ready-to-send plain-language message asking the supplier to file/amend. Output is a draft only — the trader reviews and sends it; the app never auto-sends. Reuses only the forward-applicable root-cause taxonomy, not the historical certificate/UDIN logic. LLM-generation component; pairs with the WhatsApp stretch channel but degrades gracefully to copy-to-clipboard. (See Section 10, risk 11.)
15. *(Stretch)* **GSTR-2A early-warning module** and **WhatsApp bot stub**, as described in Section 2.2.
16. *(Stretch)* **E-invoice eligibility alert + guide module** — compares tracked/self-reported turnover against the ₹5 crore threshold; on crossing, surfaces an alert and a static informational walkthrough (IRP list, registration steps, deep-link out). No submission/IRN-generation logic — purely informational, no live GST integration. Depends on a turnover-tracking mechanism not yet chosen (see Section 11).

---

## 5. Data Flow

1. **Input — GST dataset:** a simulated GSTR-2B/2A/IMS-status export (per the Simulation Clause), format described generically in the source as "a PDF/spreadsheet downloadable from the portal" — exact schema not yet pinned down (see Assumptions).
2. **Input — invoices:** trader-submitted images via in-app camera/upload (WhatsApp images, printed/digital invoices, machine-generated receipts, scanned PDFs are the formats named in the problem statement, though only camera/upload is in the MVP capture path; WhatsApp ingestion is stretch-only).
3. **Transform — OCR extraction:** raw invoice images → structured invoice records (GSTIN, HSN code, tax breakdown, invoice number, amounts). For the PoS Mismatch Detector (F12), extraction must also capture the **Place-of-Supply field** and the **supplier-GSTIN state code** — confirm both are reliably present/extractable across the heterogeneous formats. The **Section 17(5) Blocked-Credit Detector (F13)** also runs here, classifying the invoice's category from its content.
4. **Transform — reconciliation:** structured invoice records matched against the imported GST dataset to identify mismatches (e.g., HSN code errors blocking ITC). This stage also runs the **PoS mismatch check (F12)** and, for each blocked/reversed line, the **permanent-vs-recoverable classification (F11)**. Where a mismatch is attributed to the supplier, the **root cause is classified (F14)** to drive the message draft.
5. **Transform — recommendation generation:** matched/mismatched results → per-invoice Accept/Reject/Hold recommendation, one-line reason, ₹ ITC impact, in English first. A Section 17(5) hit (F13) surfaces here as a Reject/don't-claim reason; a supplier-attributed mismatch additionally produces a **draft supplier message (F14)** for the trader to review and send.
6. **Transform — localization:** English recommendation content → Bhashini-translated output in the trader's language, verified for GST-specific terms.
7. **Output — verdict screen:** single-invoice view and monthly summary view, presented to the trader with the explainability/trust affordances attached.
8. **Output — audit trail:** every recommendation decision (and any trader disagreement/override flag) logged for traceability.

**Note on timing:** the dataset is a **locked monthly snapshot** (GSTR-2B is generated ~14th of each month on the real portal), not a live feed. The build should treat ingestion as a diagnosis-and-explanation layer on top of a periodic import — not a real-time/live ingestion pipeline. Live, per-invoice trader engagement (e.g., instant push notifications as issues are detected) was considered but is not part of the MVP; it is conflated with — but distinct from — real-time backend processing, and the team chose not to build live bot infrastructure as a core deliverable.

---

## 6. APIs / Integrations

| Integration | Status | Notes |
|---|---|---|
| Bhashini API | **In use (MVP)** | Free, government-backed multilingual translation/OCR platform; satisfies the multilingual requirement without a custom translation layer. |
| GST portal backend APIs | **Not available** | Confirmed hard constraint — third-party developers cannot reach GSTN directly. |
| GSP (GST Suvidha Provider) sandbox APIs, e.g. WhiteBooks, MasterGST | **Roadmap/pitch only — not a hackathon build item** | Free sandbox credentials exist for GSTR-2B/ITC reconciliation building; this is the legitimate production path for the future, not used during the hackathon (Simulation Clause is used instead). **Researched (Session 1):** even in production, GSP submission requires OAuth2 + the taxpayer's own GSTIN credentials and a per-session OTP sent to the registered mobile/email — there is no mode where the app submits silently on the trader's behalf. Direct-to-IRP access (bypassing a GSP) is gated by a turnover threshold reported inconsistently across sources (₹5 crore per ClearTax vs. ₹100 crore per Masters India) and still requires the taxpayer's own portal registration. |
| Turnover lookup by GSTIN | **Not available, free or official** | **Researched (Session 1):** the public GST portal's "Search Taxpayer by GSTIN" does not expose turnover — only filing status. Actual turnover is only visible to the taxpayer themselves via their filed GSTR-9. Third-party "turnover lookup" APIs exist but are unofficial, paid, scraping-based, and of unverified accuracy — not suitable as a trigger for a compliance alert. |
| OCR engine (PaddleOCR or vision-capable LLM API) | **Open decision** | Either self-hosted OCR or an external LLM vision API; not yet chosen. |
| WhatsApp Business API | **Stretch-only, stubbed** | If attempted: a single hardcoded test contact/image routed through the real pipeline, not a production-approved business account. Not a core integration. |

---

## 7. Database / Storage Considerations

Proposed storage: Postgres or SQLite (decision open, pending hosting/team-skill confirmation). Suggested entities, based on the components above:

- **GST dataset snapshot** — the imported dummy GSTR-2B/2A/IMS-status data (one import per simulation run).
- **Trader invoice records** — raw image reference + OCR-extracted structured fields (GSTIN, HSN code, tax breakdown, invoice number, amounts, **Place-of-Supply, supplier-GSTIN state code** — the latter two added for the PoS Mismatch Detector, F12), plus a **17(5) blocked-category flag** (F13).
- **Reconciliation/matching results** — per-invoice match/mismatch status against the GST dataset snapshot, including a **PoS-mismatch flag (F12)**, a **reversal-bucket tag** ("permanent" / "recoverable", F11) where credit is blocked/reversed, and a **supplier root-cause classification** where the mismatch is supplier-attributed (F14).
- **Supplier-message drafts** — generated draft text per supplier-attributed mismatch (F14), with a sent/not-sent status; never auto-dispatched.
- **Recommendation records** — per-invoice Accept/Reject/Hold decision, one-line reason, ₹ ITC impact, language variants.
- **Audit trail log** — every recommendation decision and any trader override/disagreement (via the "I don't understand/disagree" affordance).
- **Validation/test fixtures** — the 10–15 planted dummy invoices with known expected outcomes, plus expected-vs-actual tracking for the validation harness.

No specific schema, field types, or storage volumes were defined in the source material; the above is a structural starting point only.

---

## 8. Security / Privacy Considerations

- GST invoice data inherently includes sensitive financial and tax-identifying information (GSTIN, invoice amounts, tax breakdowns). For the hackathon, all data is simulated/dummy per the Simulation Clause, so no real taxpayer data is processed or stored.
- A future production version would require a GSP partnership to fetch real 2A/2B data on the trader's behalf — this would introduce real consent, credential-handling, and data-protection requirements that are out of scope for the hackathon build but should be flagged on the roadmap.
- The explicit "this is a recommendation, not an automatic filing action" framing is a deliberate safety/liability boundary: the system never executes an IMS action (Accept/Reject/Hold) on the trader's behalf — the trader always takes the final action manually. This reduces compliance and liability exposure given that ITC is now hard-blocked (not just delayed) on unaccepted invoices since April 2026.
- If the WhatsApp bot stub is attempted, it touches only a single hardcoded test contact and image — not real trader data — and must be disclosed clearly as a working prototype of the channel to avoid implying a level of integration that doesn't exist.
- No live GST portal credentials are used or stored in the hackathon build.

---

## 9. Scalability Considerations

- Real-world target load per trader is 500–2,000 invoices/month; the hackathon validation scope is intentionally much smaller (10–15 planted dummy invoices), so OCR/matching throughput at production scale has not been tested or designed for.
- Multilingual scope for the hackathon is Hindi + English tested rigorously, with one additional regional language as a lighter stretch demo moment — not the full 22-language Bhashini coverage, even though that coverage exists and could be leveraged later.
- Components explicitly deferred from the hackathon build because of their scaling/infrastructure cost include: live WhatsApp bot infrastructure (beyond a single stubbed test case), full offline-first sync architecture (simplified to a basic queue-and-resend mechanism), and live GSP-sandbox integration (consent flows, real GSTN load) — all kept as roadmap items rather than hackathon deliverables.

---

## 10. Technical Risks

1. **Unresolved native-app-vs-web-app contradiction** — blocks final decisions on stack, landing page purpose, and install-flow story. Highest-priority risk; see Section 2.4.
2. **OCR accuracy across heterogeneous invoice formats** (WhatsApp photos, printed/digital invoices, scanned PDFs) — no finalized accuracy validation methodology beyond the proposed 10–15 planted invoices.
3. **Stack recommendations made blind to team skill** — all current tech stack choices (Section 3) were proposed without confirming what languages/frameworks the team already knows; could be a poor fit in practice.
4. **No confirmed hands-on familiarity with the live IMS portal** — needed to build an accurate 3-action mini-walkthrough; this is a real-world research gap that ideation alone cannot resolve.
5. **No fallback plan for a validation failure close to the deadline** — if a planted test case reveals a real bug late in the build, there is no defined process (e.g., exclude the case vs. fix it).
6. **WhatsApp bot stub reputational risk** — if judges probe the stub and discover it isn't a full integration, it could undermine trust in the rest of the demo unless clearly disclosed upfront; the disclosure script is not yet written.
7. **Undefined checkpoint mechanics** — the ~70% build-time gate for attempting the WhatsApp stub has not been converted into an actual clock time, and no one has been assigned to own/monitor it.
8. **Foundational dataset has no owner** — the dummy GSTR-2B/2A/IMS-status dataset (Section 2.1, step [0]) is unbuilt and unassigned, despite every downstream component depending on it.
9. **Multilingual quality for domain-specific terms** — Bhashini's general-purpose translation quality for GST-specific jargon has not been verified; a dedicated verification pass is planned but not yet executed.
10. **Section 17(5) false-positive risk (F13)** — many blocked categories have "except under specified circumstances" exceptions (motor vehicles for further supply, obligatory insurance, works-contract as input to further works-contract, etc.). A detector that asserts "blocked" with certainty could steer a trader away from ITC they're legally entitled to. Must present a *flag-for-review* with the relevant carve-out noted, not a hard verdict; classifier accuracy on edge categories is unverified.
11. **Supplier-message accuracy / relationship risk (F14)** — a mis-classified root cause could generate a message that blames the wrong party (e.g., chasing a supplier when the gap is the trader's own data error) or asks for the wrong correction, damaging trader–supplier relationships or sending incorrect information. The draft must always be trader-reviewed before sending (never auto-dispatched), and root-cause classification reliability needs validation against the planted test cases.

---

## 11. Open Technical Questions

- **Native app vs. responsive web app** — must be resolved explicitly by the user/team before any further architecture, stack, or landing-page work proceeds. (Most urgent open item.)
- **Verdict screen design** — exact content, layout, and language for a single mismatched invoice. Flagged as priority #1 by the council twice; not yet started.
- **What tech stack/languages the team already knows** — needed to validate or override the Section 3 proposal.
- **Hands-on familiarity with the live IMS portal screens** — needed to build an accurate action-execution walkthrough; not resolvable through ideation alone.
- **Total hackathon build-time window** — needed to convert the ~70% WhatsApp-stub checkpoint into a concrete clock time.
- **Checkpoint ownership** — who on the team is responsible for monitoring and enforcing that checkpoint during the build.
- **Monetisation/pricing narrative for the landing page** — unresolved; affects landing page content though not core product architecture.
- **Final accuracy-validation methodology** — beyond the 10–15 planted dummy invoices, how mismatches/edge cases will be scored and what threshold constitutes "passing."
- **Exact format/schema of the Simulation Clause dataset** — referenced only generically as "a PDF/spreadsheet downloadable from the portal"; specific fields and file format are not pinned down.
- **OCR engine choice** — self-hosted (PaddleOCR) vs. vision-capable LLM API; both proposed, no decision made.
- **Reliable extraction of PoS + supplier-state fields (F12), and 17(5) category classification (F13)** — whether the chosen OCR path can dependably read the PoS/supplier-state fields and infer the blocked-credit category across WhatsApp photos, scanned PDFs, and machine receipts, or whether some must be inferred from the matched GST dataset instead.
- **Whether features 11–14 are MVP or deferred.** Working recommendation: F11 (Permanent vs Recoverable) and F12 (PoS Mismatch) into the core engine; F13 (17(5) Detector) core-adjacent, gated on classifier accuracy; F14 (Supplier-Fix Message Generator) ships as a copy-to-clipboard draft in the MVP and graduates to one-tap send if the WhatsApp stretch channel lands.
- **Turnover-tracking mechanism for the e-invoice eligibility alert** — self-reported at onboarding vs. a running total computed from ingested invoices vs. both; not yet chosen. No free/official GSTIN→turnover lookup exists (confirmed via research, Session 1), so this cannot be solved by an external API call.

---

## 12. Assumptions Made in This Document

The following assumptions were necessary to make this TRD actionable, since the source ideation document leaves them implicit or unresolved. They should be confirmed or corrected by the team:

- The "verdict screen" applies to one invoice at a time, with a separate, simpler monthly summary view layered on top — based on the Thread 008 clarification of the term, though no actual design exists yet.
- The dummy GSTR-2B/2A/IMS-status dataset will be manually constructed/simulated by the team (per the Simulation Clause) rather than pulled from any live source, since direct GST portal backend access is confirmed unavailable to third-party developers.
- The researched Accept/Reject/Hold IMS workflow maps directly and accurately to the real, live April 2026 IMS requirement — the team has not yet confirmed hands-on familiarity with the actual portal screens, so this is treated as a working assumption pending verification.
- If attempted, the WhatsApp bot stub will use a sandbox/test-mode WhatsApp Business API setup rather than a production-approved business account, given hackathon time constraints.
- "Offline-first" for the hackathon build means a basic local queue-and-resend-on-reconnect mechanism, not a full offline-first sync architecture, per the explicit cut/roadmap note in the source document.
- The landing page is a separate, lightweight artifact (likely static or simple web page) distinct from the trader-facing app's tech stack; the source document does not specify its implementation.
- This TRD will require a revision pass once the native-app-vs-web-app decision (Section 2.4 / Section 11) is made, since it affects the stack, the landing page's purpose, and the install-flow narrative throughout this document.
