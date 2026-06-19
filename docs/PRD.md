# PRD.md

**Source:** Derived from the KLEOS 2026 · D4-PS1 Living Ideation Document.
**Status key used throughout this document:**
- `[CONFIRMED]` — settled fact or agreed principle in the source document
- `[COUNCIL REC – NOT VALIDATED]` — recommended by the ideation process but not yet agreed by the user/team
- `[OPEN]` — unresolved question
- `[OPEN – BLOCKING]` — unresolved and explicitly flagged as blocking other decisions

---

## 1. Project Overview

- **Hackathon:** KLEOS 2026
- **Domain:** 04 — AI/ML
- **Problem Statement:** D4-PS1 — "The CA in Your Pocket That Does Not Exist"
- **Team project name:** TBD `[OPEN]`

**One-line framing:** A plain-language GST reconciliation and IMS-action advisor that gives a GST-registered trader the same day-to-day diagnostic value a Chartered Accountant (CA) currently provides — without auto-filing anything on the trader's behalf.

---

## 2. Problem Statement

- India has **1.4 crore GST-registered MSMEs**.
- Persona example: a kirana store owner (e.g. in Lucknow) receives **500–2,000 invoices/month** via WhatsApp images, printed/digital invoices, machine-generated receipts, and scanned PDFs.
- The trader currently pays **₹15,000–₹40,000/month** to a CA for what is largely manual data entry.
- The CA's real value is knowing **why** an invoice is wrong and **what action to take** — e.g. a wrong HSN code blocking ₹2,400 in Input Tax Credit (ITC).
- The GST portal has **no diagnostic tool** that explains mismatches in plain language.
- **Regulatory context that raises the stakes:** since **April 1, 2026**, the Invoice Management System (IMS) is mandatory for every regular GST-registered taxpayer filing GSTR-3B. Every supplier-reported invoice lands on the recipient's IMS dashboard; the recipient must actively **Accept, Reject, or Hold** each one. No action taken = deemed acceptance, correct or not. ITC on any invoice not reflected in GSTR-2B is now **hard-blocked**, not merely delayed. Most businesses reportedly don't know IMS exists or are misusing it.

---

## 3. Goals

- Give the trader a **plain-language, multilingual** explanation of every GST/IMS mismatch: what's wrong, why, and what it costs in ITC.
- **Recommend** (never execute) an IMS action — Accept / Reject / Hold — per invoice, with a one-line reason.
- Make the product legible to a **low-English-proficiency, low-portal-literacy** trader, not a CA or accountant.
- Build a hackathon-credible MVP centered on a single, tightly-designed **verdict screen** first, with everything else built outward from it.

---

## 4. Non-Goals (for this build)

- Not building live WhatsApp Business API infrastructure as a **core** deliverable — it is a gated stretch goal only `[COUNCIL REC – NOT VALIDATED]`.
- Not auto-filing or auto-executing any IMS action — recommendation only, always.
- Not building Supplier Risk Scoring, Auto-Dispute Generation, Cashflow Forecasting, ERP Connectors, or Bank Feed/Account Aggregator integrations.
- Not a full offline-first architecture — simplified to "queue capture, send when network returns."
- Not building a live GSP-sandbox integration for the hackathon itself (roadmap/pitch mention only).
- Not serving a CA managing multiple client businesses.
- **Not submitting e-invoices / generating IRNs on the trader's behalf** — confirmed out of scope after research (Session 1): both the direct-IRP-API path and the GSP-API path require the taxpayer's own registered credentials and a per-session OTP, so the app cannot silently submit on a trader's behalf regardless of architecture. Only an **eligibility alert + educational guide + deep-link to the official IRP** is in scope. `[CONFIRMED]`

---

## 5. Target Users

**Primary user:** A GST-registered MSME trader/owner (e.g. a kirana store owner) who currently outsources GST filing to a CA. `[CONFIRMED]`

Characteristics:
- Receives a high volume (500–2,000/month) of invoices across mixed formats (WhatsApp images, printed/digital invoices, machine-generated receipts, scanned PDFs).
- Limited English proficiency; limited GST-portal literacy.
- Cares about concrete rupee impact ("you are losing ₹2,400 this month") far more than technical/legal jargon.

**Explicitly not the target user:** A CA or accountant managing multiple client businesses. `[CONFIRMED]` — the product is built for the trader directly.

---

## 6. Core Features

### Must-Have / High Priority (MVP, in build order)

| # | Feature | Why it matters |
|---|---|---|
| 1 | Dummy GSTR-2B/2A/IMS-status dataset import (Simulation Clause baseline) | Everything downstream depends on this existing first |
| 2 | Trader invoice capture via in-app camera/upload (input-source-agnostic backend) | Core capture path for the MVP `[COUNCIL REC – NOT VALIDATED]` |
| 3 | OCR + structured extraction of the trader's own invoices | Converts photos into matchable data |
| 4 | Matching/reconciliation against the imported GST dataset | Detects mismatches and ITC risk |
| 5 | IMS Action Recommendation engine — per invoice Accept/Reject/Hold, plain non-jargon language, one-line reason, ₹ ITC impact | This **is** the product |
| 6 | Verdict screen — single-invoice view first, then a simple monthly summary view | Flagged by the council as priority #1, still undesigned |
| 7 | Multilingual layer via Bhashini — Hindi + English tested rigorously; one more regional language as a lighter stretch | Hard PS constraint |
| 8 | Lightweight "I don't understand / disagree" affordance per recommendation | Builds trust, surfaces low-confidence cases |
| 9 | Explicit "this is a recommendation, not an automatic filing action" framing in the UI and in how it's presented to judges | Stakes are real post-April 2026 — must not imply auto-filing |
| 10 | One honest line of "why" per recommendation | Explainability, at the lighter end of effort |

### Stretch (gated — only attempted after MVP core passes a defined build-time checkpoint)

- GSTR-2A-based supplier non-filing early warning (low build cost — reuses already-ingested data).
- WhatsApp bot stub: a single hardcoded test case (one pre-set contact/image) routed through the real, working pipeline, clearly disclosed as a working prototype of the channel — not implied as a complete integration.
- **E-Invoice eligibility alert + guide:** when a trader's tracked/self-reported turnover crosses ₹5 crore (the notified e-invoicing threshold), proactively surface an alert plus a short walkthrough (the 6 IRPs, how to register, deep-link to einvoice.gst.gov.in). No live submission, no IRN generation by the app — informational only. `[COUNCIL REC – NOT VALIDATED]`

### Cut / Roadmap-Only (reconfirmed across multiple council passes)

Supplier Risk Scoring, Auto-Dispute Generation (or CA-only, later), Cashflow Forecasting, ERP Connectors, Bank Feed/Account Aggregator integration, Voice/IVR Assistant (deferred, not necessarily permanently cut), full offline-first architecture, live GSP-sandbox integration, Proactive Supplier Outreach (reframe-or-cut).

---

## 7. User Stories

- As a trader, I want to upload a photo of an invoice so the app can tell me if it has a problem, without me needing to understand GST jargon.
- As a trader, I want to see, in my own language, exactly how much money (₹) I stand to gain or lose from a given invoice mismatch.
- As a trader, I want a one-line plain explanation of why an invoice is flagged, so I can trust the recommendation.
- As a trader, I want the app to tell me whether to Accept, Reject, or Hold an invoice in IMS, with a reason — but I want to make the final call myself; I don't want the app filing anything automatically.
- As a trader, I want a monthly summary so I can see, at a glance, how much ITC I'm at risk of losing across all my invoices.
- As a trader, if I don't understand or disagree with a recommendation, I want an easy way to flag that.
- As a judge, I want to see a polished landing page and a credible working pipeline (including, if achieved, a believable WhatsApp capture moment) without the demo overstating what's actually built.
- As a trader whose turnover crosses ₹5 crore, I want to be alerted that e-invoicing now applies to me and shown how to get started — without the app filing or submitting anything to the government on my behalf.

---

## 8. Success Criteria

- A single, fully designed and working **verdict screen** for one mismatched invoice exists, in plain language, in at least Hindi + English.
- A complete end-to-end flow works and is demoable on multiple invoices: dummy GST data import → invoice capture → OCR → reconciliation → IMS recommendation → verdict screen.
- 10–15 planted-outcome dummy invoices are used to validate matching/recommendation logic, with **zero unresolved mismatches** on planted cases at demo time.
- If attempted, the WhatsApp bot stub is clearly disclosed to judges as a working prototype, not implied as production-complete.
- The "recommendation, not auto-filing action" framing is visibly present in the product and explicitly stated in the pitch.

---

## 9. Constraints

- GST portal backend APIs are **not available to third-party developers** (hard PS constraint) — GSTR-2B/2A data must be simulated via a pre-loaded dummy dataset for the hackathon (the "Simulation Clause").
- GSTR-2B is a **locked monthly snapshot** (generated ~14th of each month), not a live feed.
- IMS, effective **April 1, 2026**, requires an explicit per-invoice Accept/Reject/Hold action; no action = deemed acceptance; ITC on invoices not reflected in GSTR-2B is hard-blocked.
- Target persona has limited English proficiency and limited GST-portal literacy — UI and language design must account for this.
- Hackathon time constraints — exact total build-time window is not yet known `[OPEN]`.

---

## 10. Open Questions

- `[OPEN – BLOCKING]` **Native installable app vs. responsive web app.** The original plan (native, via Flutter/React Native, for camera + on-device OCR access) directly contradicts a later council recommendation (responsive web app, for demo safety and faster build). This determines the tech stack, the landing page's actual purpose, and the install-flow story. Must be resolved explicitly by the user/team before development starts — not silently picked by an AI assistant.
- `[OPEN]` Whether "real-time" in the product means silent continuous backend processing, active push-notification interruption for the trader, or both — not formally disambiguated.
- `[OPEN]` Exact pass/fail criteria for the WhatsApp-bot-stub build-time checkpoint. A ~70% threshold is referenced ("if fail at 70%, skip the bot entirely"), but the full criteria are not completely captured in the source ideation document.
- `[OPEN]` Fallback plan if a real bug is found in matching/reconciliation logic close to the deadline — not yet defined.
- `[OPEN]` Whether in-app camera capture as the core MVP path is formally agreed by the user — currently it is Claude's recommendation within the ideation process, not yet user-validated.
- `[OPEN]` Friction of WhatsApp-forwarding at scale (500–2,000 messages/month per trader) — flagged but not resolved.
- `[OPEN]` Team's existing tech stack/language familiarity — unknown.
- `[OPEN]` Whether anyone on the team has hands-on familiarity with the live IMS portal screens (needed for an accurate 3-action walkthrough) — unknown.
- `[OPEN]` Total hackathon build-time window — unknown.
- `[OPEN]` Who on the team owns watching the build-time checkpoint — unknown.
- `[OPEN]` Monetisation/pricing narrative for the landing page — unknown.
- `[OPEN]` Verdict screen content/layout — completely undesigned; flagged twice by the council as priority #1 and not yet started.
- `[OPEN]` **Turnover determination method for the e-invoice eligibility alert.** Confirmed via research (Session 1): there is no free/official way to look up a business's turnover from its GSTIN — the public GST portal's GSTIN search does not expose turnover, and third-party "turnover lookup" APIs are unofficial, paid, and of unverified accuracy. The alert must therefore rely on either (a) self-reported turnover at onboarding, or (b) a running total computed from the trader's own ingested invoices — mechanism not yet chosen.

---

## 11. Assumptions Made (for this document)

- No team/project name was invented; "TBD" is preserved as-is.
- The Thread 002 feature-priority table and the reconstructed Thread 009 final feature list were treated as the authoritative current feature scope, since no later contradicting list exists in the source document.
- In-app camera capture was treated as the working default MVP capture mechanism (over WhatsApp-forward or transaction monitoring), since it is the most recent explicit recommendation in the source document and no later thread overturns it — though it is not formally marked `[VALIDATED]`.
- The council's synthesis that the **core build** should center on a simulated monthly GST data import + OCR + reconciliation + verdict screen (rather than live WhatsApp ingestion) was treated as the working baseline scope, since every later thread builds on top of it without contradicting it.
