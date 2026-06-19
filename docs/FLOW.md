# FLOW.md — KLEOS 2026 · D4-PS1
# "The CA in Your Pocket That Does Not Exist"

---

## Table of Contents

1. [Document Purpose](#1-document-purpose)
1A. [Status Update — Build Phase](#1a-status-update--build-phase-post-session-1)
2. [Assumptions](#2-assumptions)
3. [Actors and Surfaces](#3-actors-and-surfaces)
4. [System States](#4-system-states)
5. [End-to-End Flow Overview](#5-end-to-end-flow-overview)
6. [Surface A — Landing Page (Judge / Demo Surface)](#6-surface-a--landing-page-judge--demo-surface)
7. [Surface B — Trader App (Core Surface)](#7-surface-b--trader-app-core-surface)
   - [7.1 Onboarding Flow](#71-onboarding-flow)
   - [7.2 GSTR-2B Import Flow](#72-gstr-2b-import-flow)
   - [7.3 Invoice Capture Flow](#73-invoice-capture-flow)
   - [7.4 OCR and Structured Extraction Flow](#74-ocr-and-structured-extraction-flow)
   - [7.5 Reconciliation and IMS Recommendation Flow](#75-reconciliation-and-ims-recommendation-flow)
   - [7.6 Verdict Screen Flow (Single Invoice)](#76-verdict-screen-flow-single-invoice)
   - [7.7 Monthly Summary Flow](#77-monthly-summary-flow)
   - [7.8 IMS Action Walkthrough Flow](#78-ims-action-walkthrough-flow)
   - [7.9 Returning User (Month-End Batch) Flow](#79-returning-user-month-end-batch-flow)
   - [7.10 E-Invoice Eligibility Alert Flow](#710-e-invoice-eligibility-alert-flow)
   - [7.11 Regulatory Diagnostic Features (F11–F14)](#711-regulatory-diagnostic-features-f11f14)
8. [Happy Path](#8-happy-path)
9. [Edge Cases](#9-edge-cases)
10. [Failure States](#10-failure-states)
11. [Stretch Flows (Gated at 70% Build Checkpoint)](#11-stretch-flows-gated-at-70-build-checkpoint)
12. [Cut and Out-of-Scope Flows](#12-cut-and-out-of-scope-flows)

---

## 1. Document Purpose

This document describes the complete product flow for KLEOS 2026 D4-PS1 — an AI-powered GST compliance assistant for small traders (kirana store owners and similar MSMEs). It covers the end-to-end user journey from onboarding through invoice reconciliation and IMS action recommendation, including edge cases and failure states.

This is a **flow design document, not an implementation spec**. No code decisions are finalised here. All items marked [VALIDATED] in the ideation document are treated as settled; all open items are flagged.

---

## 1A. Status Update — Build Phase (Post-Session 1)

> This section records decisions made and features committed **after** the Session-1 ideation snapshot. The original Session-1 flows below are preserved (this document is *updated, not overwritten*); this section layers the resolved decisions on top. Where a Session-1 assumption is now resolved, it is noted inline in Section 2.

### Resolved decisions

- **Stack (resolves A1 / the blocking native-vs-web question):** Built as an **Expo / React Native app** — it runs natively on a phone (Expo Go or a dev build) **and** has a **web build** used for the laptop/judge demo. Decision: *native-first, with a web build for demo safety.*
- **OCR engine (resolves A10):** **PaddleOCR (offline, on the backend) as primary**, with a **Gemini vision-LLM fallback** when the offline read is low-confidence or unavailable. The pipeline is input-source-agnostic (camera, upload, WhatsApp all share it).
- **Multilingual — Bhashini CONFIRMED:** Bhashini is the multilingual layer. English content is locked first, then Bhashini translates it (with a manual GST-term verification pass), and Bhashini TTS powers read-aloud. Hindi + English are the rigorously tested languages; one regional language remains a stretch demo moment.

### Features now committed (previously council-rec / stretch)

| Ref | Feature | Where it lives in this flow |
|---|---|---|
| **F11** | Permanent vs Recoverable ITC Classifier | §7.5 (engine), §7.6 (verdict), §7.7 (summary), §7.11 |
| **F12** | Place-of-Supply Mismatch Detector | §7.4 (new OCR fields), §7.5, §7.11 |
| **F13** | Section 17(5) Blocked-Credit Detector (*flag-for-review, never assert*) | §7.4, §7.6, §7.11 |
| **F14** | Supplier-Fix Message Generator (*drafts only, never auto-sends*) | §7.5, §7.6, §7.11 |
| — | **Editable Recognition Review** (trader corrects OCR fields before matching) | §7.4 |
| — | **🔊 Read-aloud (Bhashini TTS)** on every verdict (low-literacy accessibility — distinct from the cut Voice/IVR assistant) | §7.6 |
| — | **Section 16(4) ITC-claim deadline** surfaced per invoice | §7.6 |
| — | **GSTR-2A supplier non-filing early warning** (now committed, was stretch) | §11.1 |
| — | **E-invoice eligibility alert + guide** (turnover-based, informational only) | §7.10 |

### Already built

- **WhatsApp bot stub** (§11.2) — one invoice routed through the real OCR → match → verdict pipeline and answered in a WhatsApp-style chat, disclosed as a channel prototype. The §11 build-checkpoint gate has been **passed**, so this is now a built feature, not a gated stretch.

---

## 2. Assumptions

The following assumptions were made where the ideation document leaves items open. Each must be validated by the team before development begins.

| # | Assumption | Basis |
|---|-----------|-------|
| A1 | ~~The trader-facing surface is a **responsive mobile web app** (not a native install)~~ → **RESOLVED (build phase):** built as an **Expo / React Native app** (native-first) with a **web build** for the demo. See §1A. | Council recommendation in Thread 010 was web-app; the build went native-first via Expo (which also yields a web build), resolving the contradiction in favour of both surfaces from one codebase |
| A2 | Authentication is minimal — phone number or GSTIN-based onboarding; no full account system for MVP | Inferred from low-literacy persona and hackathon scope; not discussed in document |
| A3 | The GSTR-2B dummy dataset (Simulation Clause) is pre-loaded and treated as the live data source for the hackathon demo | Explicitly stated in Thread 009 |
| A4 | Invoice processing is **batch-oriented** — trader uploads invoices at or near month-end; the system is not designed around real-time per-invoice interruption | Supported by GSTR-2B being a monthly snapshot (~14th of each month) and trader engagement being realistically month-end (Thread 003) |
| A5 | The "I don't understand / disagree" affordance **logs the trader's reaction** but does not change the recommendation | Inferred from the advisory framing requirement and audit trail feature |
| A6 | The IMS action mini-walkthrough uses **annotated static screenshots** of the IMS portal — not a live portal integration | Based on Thread 010 council recommendation; GSTN portal is not integrable by third-party developers |
| A7 | Hindi + English are the two rigorously tested languages; one additional regional language is a stretch demo moment | Explicitly stated in Thread 010 |
| A8 | The app is built **for the trader directly** — there is no CA-facing interface or multi-client management dashboard | Explicitly stated in the ideation document |
| A9 | Offline handling is simplified to **queue capture locally, upload when network returns** — not full offline-first architecture | Explicitly stated in Thread 009 (CUT section) |
| A10 | ~~OCR is handled by PaddleOCR or a vision-capable LLM API~~ → **RESOLVED (build phase):** **PaddleOCR offline as primary + Gemini vision-LLM fallback.** See §1A. | Both options were on the table; the build uses PaddleOCR on the backend for an offline-capable default and Gemini vision as a higher-accuracy fallback |
| A11 | The IMS recommendation logic (which scenario maps to Accept / Reject / Hold) is derived from IMS rules described in Thread 008 and standard GST reconciliation rules — the exact business logic rules need a domain/CA review pass before build | Partially inferred; document does not spell out the full decision table |
| A12 | Verdict screen orders invoices by **₹ ITC impact, highest first**, to surface the most financially significant actions to the trader first | Not stated in document; reasonable UX assumption |

---

## 3. Actors and Surfaces

### Actors

| Actor | Description | Primary Surface |
|-------|-------------|-----------------|
| **Trader** | Kirana store owner or similar MSME operator. Low English literacy, low GST portal literacy. Receives 500–2,000 purchase invoices/month via WhatsApp images, printed/digital invoices, machine-generated receipts, and scanned PDFs. Primary product user. | Trader App (Surface B) |
| **Judge / Demo Viewer** | Hackathon evaluator or demo audience. Not a product user — evaluates the product via the landing page and demo walkthrough. | Landing Page (Surface A) |

> ⚠️ There is **no CA role** in this product. The product replaces the CA's diagnostic function for the trader directly. It does not target CAs managing multiple clients.

### Surfaces

| Surface | Purpose | Entry Point |
|---------|---------|-------------|
| **Surface A — Landing Page** | Hackathon presentation surface only. Shows product screenshots, key feature highlights, and install CTA. For judges, not traders. Must not drive UX or architecture decisions for the actual product. | Public URL |
| **Surface B — Trader App** | The actual product. Full invoice capture → reconciliation → verdict flow. The trader's real entry point. | App URL / installed PWA (or native app, pending resolution of A1) |

---

## 4. System States

The trader app moves through the following states in sequence each month. A trader can re-enter at any state if they return mid-session.

```
ONBOARDING → IMPORT → CAPTURE → PROCESSING → RECONCILIATION → VERDICT → SUMMARY → ACTION
```

| State | Description | Entry Condition |
|-------|-------------|-----------------|
| **ONBOARDING** | First-time setup: language selection, GSTIN entry, brief product orientation | First app launch only |
| **IMPORT** | Trader imports (or app loads) the GSTR-2B data for the current month | Start of each monthly cycle (after ~14th of month) |
| **CAPTURE** | Trader photographs or uploads purchase invoices | After import; can be done incrementally throughout the month |
| **PROCESSING** | OCR extraction of structured data from invoice images | After trader confirms capture batch is complete |
| **RECONCILIATION** | Matching extracted invoice data against GSTR-2B; mismatch detection; ITC impact calculation | Automatic, after processing completes |
| **VERDICT** | Per-invoice recommendation screen: Accept / Reject / Hold with plain-language reason and ₹ ITC impact | After reconciliation; one invoice at a time |
| **SUMMARY** | Monthly aggregate view: all invoices, total ITC at stake, action breakdown | After all verdict screens are reviewed, or accessible at any time |
| **ACTION** | Trader is guided via mini-walkthrough to take recommended actions manually on the GST IMS portal | After summary review; trader-initiated |

---

## 5. End-to-End Flow Overview

```
[Trader]
    │
    ▼
Opens App (Surface B)
    │
    ├── First Visit ──────────► Onboarding (language selection, GSTIN entry)
    │
    └── Returning Visit ───────► Home dashboard → jump to Import or Capture
    │
    ▼
GSTR-2B Import
    │   Hackathon: pre-loaded dummy CSV auto-loads
    │   Real use: trader downloads from GST portal, uploads to app
    │   Confirmation: "X invoices found in your GSTR-2B for [Month Year]"
    │
    ▼
Invoice Capture (batch, multiple invoices)
    │   In-app camera or file upload
    │   Supported: WhatsApp images, photos of printed invoices,
    │              digital/PDF invoices, machine-generated receipts
    │   Offline: images queued locally if no network
    │
    ▼
OCR + Structured Extraction
    │   Per invoice: extract GSTIN, invoice number, date,
    │                HSN/SAC codes, tax breakdown, totals
    │   Low confidence → re-capture prompt
    │   Complete failure → skip with flag
    │
    ▼
Reconciliation Engine
    │   Match each captured invoice against GSTR-2B records
    │   Detect: missing entries, amount mismatches,
    │           HSN mismatches, GSTIN errors
    │   Calculate: ₹ ITC impact per invoice
    │
    ▼
IMS Recommendation Engine
    │   Per invoice: Accept / Reject / Hold
    │   Plain-language reason (one line, in trader's selected language via Bhashini)
    │   ₹ ITC impact shown
    │
    ▼
Verdict Screen (per invoice, highest ITC impact first)
    │   Clear recommendation + one-line reason + ₹ amount
    │   Explicit advisory: "This is a recommendation — not an automatic filing action"
    │   "I don't understand" and "I disagree" affordances available
    │   Trader navigates invoice by invoice
    │
    ▼
Monthly Summary View
    │   All invoices with statuses and aggregate ITC figures
    │   Counts: Accept / Reject / Hold / Unreadable
    │   Total ITC at risk vs. safe
    │
    ▼
IMS Action Walkthrough
        Mini-walkthrough showing how to take each action on the GST IMS portal
        Screenshots / annotated steps for Accept / Reject / Hold
        Reminder: "If you do nothing, the system auto-accepts — Reject/Hold items
                   need your action before the GSTR-3B deadline"
        Trader acts manually — app does NOT auto-file anything
```

---

## 6. Surface A — Landing Page (Judge / Demo Surface)

> **Critical note:** The landing page is a **hackathon presentation surface only**. Its design must not drive UX or architecture decisions for the trader product. The trader's real entry point is the app (Surface B).

### Flow

```
Judge / Demo Viewer arrives at landing page URL
    │
    ▼
Hero section
    - Product name and tagline
    - Problem framing: kirana owner, 500–2,000 invoices/month,
      ₹15,000–₹40,000/month CA cost, ITC being silently lost
    - Core value proposition: plain-language GST diagnosis in the trader's own language
    │
    ▼
Feature highlights
    - Invoice OCR (photo → structured data)
    - GSTR-2B reconciliation
    - IMS action recommendation (Accept / Reject / Hold)
    - Multilingual output: Hindi + English + one regional language
    - Audit trail and explainability
    │
    ▼
Product screenshots / demo flow
    - Verdict screen mockup (single mismatched invoice)
    - Monthly summary mockup
    - IMS walkthrough screenshot
    │
    ▼
Install / Try CTA
    - "Install App" / "Open App" button
    - Links to trader-facing app (Surface B)
    │
    ▼
Roadmap section (optional, if time allows)
    - Future: GSP auto-fetch of GSTR-2B (no manual portal download)
    - Future: WhatsApp bot ingestion channel
    - Future: GSTR-2A supplier non-filing early warning
    - Future: GSP sandbox integration for production-grade data access
```

> ~~⚠️ The install CTA depends on resolution of the PWA vs. native app decision (Assumption A1). Do not finalise the landing page CTA until that decision is made.~~ **A1 RESOLVED:** CTA links to both the Expo Go / native install and the web build URL.

---

## 7. Surface B — Trader App (Core Surface)

---

### 7.1 Onboarding Flow

**Trigger:** First time the trader opens the app.

```
App opens for the first time
    │
    ▼
Language Selection Screen
    - Options displayed in their own script:
      हिंदी (Hindi) / English / [one regional language — stretch]
    - Bhashini translation applied to all subsequent screens
    once selection is confirmed
    │
    ▼
GSTIN Entry Screen
    - "Apna GSTIN darj karein" / "Enter your GSTIN"
    - 15-character input field
    - Basic format validation (alphanumeric, correct length)
    - No live GSTN lookup (portal APIs unavailable to third-party developers)
    - Error state: "GSTIN format sahi nahi hai — dobara check karein"
    │
    ▼
Brief Product Orientation (1–2 screens, skippable on return)
    Screen 1:
        "Yeh app aapke GST invoices samajhne mein madad karta hai."
        ("This app helps you understand your GST invoices.")
    Screen 2:
        "Yeh app kuch file nahi karta — sirf batata hai kya karna chahiye."
        ("This app does not file anything — it only tells you what to do.")
    │
    ▼
→ Proceeds to GSTR-2B Import Flow (Section 7.2)
```

**Edge cases:**
- Invalid GSTIN format → inline error, trader prompted to re-enter before proceeding
- Trader skips GSTIN (if permitted) → warn that reconciliation will not be possible; allow capture-only mode with a persistent banner reminding them to add their GSTIN

---

### 7.2 GSTR-2B Import Flow

**Trigger:** After onboarding (first use), or at the start of a new monthly cycle (after approximately the 14th of each month when GSTR-2B is generated by the GST portal).

**What GSTR-2B is:** A monthly snapshot of all purchase invoices as reported by the trader's suppliers to the GST portal. It is a locked document — it is generated once per month and does not update continuously.

```
GSTR-2B Import Screen
    │
    ├── HACKATHON / DEMO PATH
    │       Pre-loaded dummy GSTR-2B dataset is auto-loaded silently
    │       Screen confirms:
    │           "Aapka GST data load ho gaya — [Month Year]"
    │           "X invoices found | Total ITC available: ₹Y"
    │       → Proceed to Invoice Capture (Section 7.3)
    │
    └── REAL-USE PATH (post-hackathon reference)
            Instruction screen:
                "Pehle apna GSTR-2B GST portal se download karein"
                Step-by-step annotated guide for portal download
                    (gst.gov.in → Services → Returns → GSTR-2B)
                │
                ▼
            Upload interface
                - File picker: CSV / Excel / PDF formats accepted
                │
                ▼
            File validation
                ├── Valid format + parseable
                │       → Parse silently
                │       → Confirmation: "X invoices found for [Month Year]"
                │       → "Total ITC in your GSTR-2B: ₹Y"
                │       → Proceed to Invoice Capture
                │
                ├── Unrecognised format
                │       → "Yeh file format support nahi karta. CSV ya Excel upload karein."
                │       → Retry button
                │
                └── File from wrong month detected
                        → Warning: "Yeh [different month] ka file lagta hai. Sahi file hai?"
                        → Confirm or re-upload
```

**Edge cases:**
- GSTR-2B not yet available (request before ~14th of month) → inform: "Is mahine ka GSTR-2B [expected date] ke baad available hoga." Allow proceeding to invoice capture in the meantime; reconciliation will run once import is completed later.
- GSTR-2B has zero records → inform trader; allow proceeding — zero matches will be expected at reconciliation.

---

### 7.3 Invoice Capture Flow

**Trigger:** After GSTR-2B is imported (or in parallel if GSTR-2B is pending). Can be done incrementally throughout the month or in a single batch.

**Supported input formats:** Photos of printed invoices, WhatsApp-forwarded invoice images, digital PDF invoices, machine-generated receipts, scanned documents.

```
Invoice Capture Screen
    │
    ▼
Capture Method Selection
    ┌──────────────────┬──────────────────────┐
    │   📷 Take Photo  │   📁 Upload File      │
    │  (in-app camera) │  (gallery / files)    │
    └──────────────────┴──────────────────────┘
    │
    ▼
[Camera path]                     [Upload path]
Trader photographs invoice        Trader selects image or PDF
    │                                  │
    └──────────────┬────────────────────┘
                   │
                   ▼
            Preview Screen
                - Show captured image / uploaded file at full size
                - "Theek lag raha hai?" / "Looks good?"
                ┌─────────────────┬───────────────────────┐
                │  ✅ Confirm     │  🔄 Retake / Re-upload │
                └─────────────────┴───────────────────────┘
                   │
              [Confirmed]
                   │
                   ▼
            Multi-page Check
                - "Kya yeh invoice ek se zyada page ka hai?"
                  ("Is this invoice more than one page?")
                ┌──────────┬──────────┐
                │  Yes     │   No     │
                └──────────┴──────────┘
                    │            │
               Add more      Continue
               pages to
               same invoice
                   │
                   ▼
            Invoice added to processing queue
                - Queue counter: "X invoices added"
                ┌────────────────────┬─────────────────────┐
                │  ➕ Add another    │  ✅ Done, process all│
                └────────────────────┴─────────────────────┘
                    │                       │
               Back to                 Proceed to OCR
               Capture                 & Extraction Flow
               Method                  (Section 7.4)
```

**Offline handling (Assumption A9):**
- If no network when trader taps "Done, process all": images saved locally with status "Queued — waiting for internet"
- Persistent banner: "3 invoices queued — will upload automatically when connected"
- On network return: auto-upload and process without trader re-doing anything

**Edge cases:**
- Duplicate detected (same file or near-identical image): "Yeh invoice pehle se add hai — phir se add karein?" Require explicit confirmation before proceeding.
- File too large or corrupted: "Yeh file open nahi ho raha — dobara try karein."

---

### 7.4 OCR and Structured Extraction Flow

**Trigger:** Trader confirms "Done, process all" from the capture queue.

**Fields extracted per invoice:**

| Field | Purpose |
|-------|---------|
| Supplier GSTIN | Primary match key for reconciliation |
| Invoice number | Primary match key for reconciliation |
| Invoice date | Match key; used for HOLD recommendations |
| HSN / SAC codes | Mismatch detection; ITC eligibility |
| Taxable value | Mismatch detection |
| CGST / SGST / IGST amounts | Mismatch detection; ITC impact calculation |
| Total invoice amount | Cross-check |
| **Place of Supply (PoS) field** *(F12)* | Place-of-Supply mismatch detection |
| **Supplier-GSTIN state code** *(F12)* | Derived from first 2 digits of supplier GSTIN; PoS mismatch detection |
| **Invoice category signal** *(F13)* | Section 17(5) blocked-credit detection (e.g. restaurant, motor vehicle, club) — classified from invoice content, *flagged for review, never asserted* |

```
Processing Screen
    "Aapke invoices pad rahe hain... thoda wait karein."
    ("Reading your invoices... just a moment.")
    Progress: "3 / 12 invoices processed"
    │
    ▼ (per invoice)
    │
    ├── HIGH CONFIDENCE EXTRACTION
    │       All key fields extracted cleanly
    │       → Queued silently for reconciliation
    │       → No trader action needed
    │
    ├── LOW CONFIDENCE EXTRACTION (one or more fields uncertain)
    │       Specific fields highlighted with uncertainty markers
    │       "Hum iss invoice ke kuch details clearly nahi pad paye."
    │       ("We couldn't clearly read some details on this invoice.")
    │       Show what was extracted; highlight uncertain fields
    │       ┌──────────────────────┬──────────────────┐
    │       │ 🔄 Retake / Re-upload│  ➡️ Skip invoice  │
    │       └──────────────────────┴──────────────────┘
    │       (Skipped → marked "Unreadable" in monthly summary)
    │
    └── COMPLETE EXTRACTION FAILURE
            "Hum yeh invoice nahi pad paye."
            ("We couldn't read this invoice.")
            ┌──────────────────────┬──────────────────┐
            │ 🔄 Retake / Re-upload│  ➡️ Skip invoice  │
            └──────────────────────┴──────────────────┘
    │
    ▼
Recognition Review (EDITABLE — build-phase addition)
    "Humne yeh details padhi — sahi hain?"
    ("We read these details — are they correct?")
    - Shows every extracted field in an editable form
    - Low-confidence fields are highlighted for the trader to check first
    - Trader can correct any field (GSTIN, invoice #, HSN, amounts, PoS)
      before matching runs — this is the product's accuracy guarantee
      (see CLAUDE.md §16, "Is this actually accurate enough to trust?")
    - GSTIN is re-validated on edit (15-char structure + state code)
    ┌──────────────────────┬──────────────────────┐
    │  ✅ Confirm & match  │  ✏️ Edit a field      │
    └──────────────────────┴──────────────────────┘
    │
    ▼
All invoices processed (or skipped) and confirmed
    Transition: "Aapke invoices ready hain — ab comparison ho raha hai."
    ("Invoices ready — now comparing with your GST data.")
    → Auto-proceeds to Reconciliation (Section 7.5)
```

> **Build-phase additions in this stage:**
> - **Editable Recognition Review** — the trader confirms/corrects OCR output before matching. Turns OCR error from a silent failure into a one-tap fix.
> - **F12 inputs captured here:** Place-of-Supply field + supplier-GSTIN state code (used by the PoS Mismatch Detector at reconciliation).
> - **F13 runs here:** the invoice category is classified to detect Section 17(5) blocked-credit cases — surfaced later as a *flag-for-review* caution, never a hard "blocked" assertion.

---

### 7.5 Reconciliation and IMS Recommendation Flow

**Trigger:** All invoices have been extracted (or skipped) and confirmed via the Recognition Review (§7.4).

**What the engine does:**

1. For each extracted invoice, searches the GSTR-2B dataset using the match key: Supplier GSTIN + Invoice Number + Invoice Date.
2. On match found: compares taxable value, CGST/SGST/IGST amounts, HSN codes, and **Place of Supply** field by field.
3. On match not found: checks if the invoice date is recent enough that the supplier may still file.
4. **F11 — Permanent vs Recoverable ITC classification:** For every mismatch, classifies the ITC loss as *permanent* (supplier cannot correct after filing window) or *recoverable* (supplier can amend and re-file). This drives the urgency displayed on the verdict screen.
5. **F12 — Place-of-Supply mismatch detection:** Compares the PoS field extracted from the invoice (§7.4) against the PoS in GSTR-2B. A mismatch triggers a separate REJECT reason (IGST vs CGST+SGST confusion is a common, high-₹-impact error).
6. **F14 — Supplier-Fix Message Generator:** For every REJECT recommendation, drafts a plain-language WhatsApp/SMS-style message the trader can forward to the supplier explaining what needs to be corrected. *Drafts only — never auto-sends.*
7. Generates per-invoice: recommended IMS action, one-line plain-language reason, ₹ ITC impact, F11 classification, and (if applicable) F14 supplier-fix draft.

**IMS Action Decision Logic** *(Assumption A11 — needs domain/CA review before build)*

| Scenario | Recommended Action | F11 Classification | Plain-Language Reason (English) |
|----------|--------------------|--------------------|---------------------------------|
| Invoice found in GSTR-2B; all fields match | **ACCEPT** | — | "Supplier has filed correctly — your ITC is safe." |
| Invoice found in GSTR-2B; amount or tax discrepancy | **REJECT** | Recoverable (if within amendment window) or Permanent | "Supplier reported a different [tax / amount] — ITC may be blocked or wrong." |
| Invoice found in GSTR-2B; HSN code mismatch | **REJECT** | Recoverable / Permanent | "Wrong HSN code reported by supplier — ITC cannot be claimed." |
| Invoice found in GSTR-2B; supplier GSTIN mismatch | **REJECT** | Permanent | "Supplier GSTIN doesn't match your invoice — verify with supplier." |
| Invoice found in GSTR-2B; **Place of Supply mismatch** *(F12)* | **REJECT** | Recoverable / Permanent | "Wrong place-of-supply reported — IGST/CGST+SGST split is incorrect. ITC at risk." |
| Invoice not found in GSTR-2B (supplier not filed yet) | **HOLD** | — (pending) | "Supplier hasn't filed yet — wait and check after the 14th." |

> ⚠️ Since April 1, 2026, IMS is mandatory. "No action" on the IMS portal = deemed acceptance. For invoices recommended as REJECT or HOLD, inaction can result in hard-blocked ITC or incorrect ITC claims. This urgency must be reflected in the recommendation language.

```
Reconciliation Engine runs (backend, no trader input needed)
    - Processes N extracted invoices against GSTR-2B records
    - Field-by-field comparison: amounts, HSN, PoS (F12)
    - F11: classifies every mismatch as Permanent or Recoverable ITC loss
    - F14: for each REJECT, drafts a supplier-fix message (stored, never auto-sent)
    - Computes per-invoice: action, reason, ₹ ITC impact, F11 tag
    - Sorts results by ₹ ITC impact (highest first — Assumption A12)
    │
    ▼
"Aapke results tayar hain!" / "Your results are ready!"
    → Auto-proceeds to Verdict Screen (Section 7.6)
```

> **Build-phase additions in this stage:**
> - **F11** classifies ITC losses so the trader understands urgency ("permanent — act now" vs "recoverable — supplier can fix").
> - **F12** catches PoS mismatches — a common, high-₹-impact error that the base reconciliation would have missed.
> - **F14** drafts supplier-fix messages so the trader can forward them to the supplier without needing to compose them. *Drafts only, never auto-sends.*

---

### 7.6 Verdict Screen Flow (Single Invoice)

**Trigger:** Reconciliation complete. Trader is shown one invoice at a time.

**This screen is the core output of the product.** It is flagged in the ideation document as the highest design priority — described as "the actual screen the trader reads showing one mismatched invoice, in plain language and their own language, with the ITC impact and what to do next."

> ⚠️ The verdict screen layout has not been designed yet as of the end of Session 1. This section describes functional requirements and flow — not visual layout.

**Screen content (per invoice):**

- Supplier name (if extractable) or Supplier GSTIN
- Invoice number and date
- Recommended IMS action: **ACCEPT** / **REJECT** / **HOLD** (displayed prominently)
- **F11 — Permanent / Recoverable tag** (on REJECT / HOLD only):
  - Permanent: *"Yeh ITC wapas nahi aa sakti — supplier ki filing window nikal chuki hai."* / *"This ITC cannot be recovered — the supplier's filing window has closed."*
  - Recoverable: *"Supplier abhi bhi theek kar sakta hai — unse contact karein."* / *"Supplier can still amend — contact them."*
- One plain-language reason line in trader's selected language (via Bhashini)
  - Hindi example: *"Supplier ne galat tax amount report kiya hai — ₹2,400 ka ITC block ho sakta hai."*
  - English example: *"Your supplier reported a different tax amount — ₹2,400 ITC may be blocked."*
- **F13 — Section 17(5) blocked-credit caution** (when applicable, flag-for-review only):
  - *"⚠️ Yeh invoice ek restricted category (e.g., restaurant / motor vehicle) lagti hai — Section 17(5) ke under ITC blocked ho sakti hai. Apne CA se verify karein."*
  - *"⚠️ This invoice appears to be in a restricted category — ITC may be blocked under Section 17(5). Verify with your CA."*
  - Never asserts "blocked" — always "may be blocked, verify."
- ₹ ITC impact: e.g., "₹2,400 khatre mein hai" / "₹2,400 at risk" — or "₹4,800 safe hai" / "₹4,800 safe"
- **Section 16(4) ITC-claim deadline** per invoice:
  - *"ITC claim ki last date: [date] (Section 16(4))"*
  - Calculated from the invoice date + the statutory deadline (earlier of the annual return or GSTR-3B for September of the following year)
- Explicit advisory notice: *"Yeh sirf recommendation hai — aapko yeh action IMS portal par khud lena hoga."* / *"This is a recommendation. You must take this action yourself on the IMS portal."*
- **🔊 Read-aloud button (Bhashini TTS):** Every verdict card has a speaker icon. Tapping it reads the recommendation, reason, and ₹ impact aloud in the trader's selected language via Bhashini TTS — a core low-literacy accessibility feature (distinct from the CUT Voice/IVR assistant).

```
Verdict Screen — Invoice [N] of [Total]
    │
    ▼
Trader reads recommendation (or taps 🔊 for Bhashini TTS read-aloud)
    │
    ├── Trader taps "Samajh nahi aaya" / "I don't understand"
    │       → Show slightly expanded plain-language explanation
    │         (still simple; no GST jargon)
    │       → Log interaction to audit trail
    │       → Stay on same verdict screen
    │
    ├── Trader taps "Mujhe sahi nahi lagta" / "I disagree"
    │       → Brief confirmation:
    │         "Note kar liya — yeh recommendation flag ki gayi hai."
    │         ("Noted — this recommendation has been flagged.")
    │       → Log interaction to audit trail
    │       → Recommendation is NOT changed; still displayed to trader
    │       → Stay on same verdict screen
    │
    ├── Trader taps "📤 Supplier ko bhejein" / "Send to supplier" (F14, REJECT only)
    │       → Opens pre-drafted message (F14 output from §7.5):
    │         "[Supplier], aapke invoice [#] mein [field] galat hai.
    │          Sahi amount ₹X hai. Kripya amend karein."
    │       → Share via WhatsApp / SMS (system share sheet)
    │       → Draft only — trader reviews and sends manually
    │       → Log share action to audit trail
    │
    └── Trader taps "Agla →" / "Next →" (or swipes)
            → Show Verdict Screen for next invoice
            → Repeat until all invoices reviewed
    │
    ▼
All invoices reviewed
    → Proceed to Monthly Summary Flow (Section 7.7)
    (Trader can also jump to summary at any point)
```

> **Build-phase additions in this stage:**
> - **F11 tag** — trader immediately sees if ITC loss is permanent (act now) or recoverable (supplier can fix). Drives urgency without adding jargon.
> - **F13 caution** — Section 17(5) blocked-credit flag. Advisory only, never asserts. Tells the trader to verify with their CA.
> - **F14 button** — one-tap supplier-fix message forwarding. Reduces friction from "you should contact your supplier" to actually doing it.
> - **🔊 Bhashini TTS** — core accessibility for low-literacy traders. Reads the verdict aloud.
> - **Section 16(4) deadline** — tells the trader *when* they must claim ITC, not just *whether* they should.

---

### 7.7 Monthly Summary Flow

**Trigger:** Trader has reviewed all individual verdict screens, or taps "Summary" from any point in the flow.

```
Monthly Summary Screen
    │
    ▼
Header
    "📣 [Month Year] — GST Summary"  (🔊 tap to hear via Bhashini TTS)
    "Kul processed invoices: N" / "Total invoices processed: N"
    "Kul ITC khatre mein: ₹X" / "Total ITC at risk: ₹X"
    │
    ▼
Action breakdown
    ✅  Accept recommended: N invoices  (₹X ITC safe)
    ❌  Reject recommended: N invoices  (₹Y ITC at risk)
    ⏸️  Hold recommended:   N invoices  (₹Z ITC uncertain)
    ⚠️  Unreadable / skipped: N invoices
    │
    ▼
F11 — ITC risk breakdown (build-phase addition)
    🔴 Permanent ITC loss:   ₹P  (N invoices — supplier cannot amend)
    🟡 Recoverable ITC loss: ₹R  (N invoices — supplier can still fix)
    This split tells the trader which ₹ is truly at risk vs which can be saved
    by contacting the supplier (see F14).
    │
    ▼
F13 — Section 17(5) flagged invoices (build-phase addition, if any)
    ⚠️ N invoices flagged for possible blocked credit (Section 17(5))
    "Yeh invoices restricted categories mein ho sakti hain — CA se verify karein."
    ("These invoices may be in restricted categories — verify with your CA.")
    Tapping → opens filtered list of flagged invoices
    │
    ▼
Invoice list (scrollable)
    Each row:
        [Supplier GSTIN] | [Invoice #] | [ACCEPT / REJECT / HOLD] | [₹ ITC]
        + F11 badge: 🔴 Permanent / 🟡 Recoverable (on REJECT rows)
        + F13 flag: ⚠️ (if Section 17(5) flagged)
    Tapping any row → opens that invoice's Verdict Screen
    │
    ▼
Audit Trail note (visible, not buried)
    "Aapne [N] invoices par 'samajh nahi aaya' tap kiya."
    ("You flagged [N] invoices as unclear.")
    Previous months accessible in read-only audit trail view
    │
    ▼
Primary CTA
    "Ab kya karein?" / "What do I do next?"
    → Proceeds to IMS Action Walkthrough (Section 7.8)
```

> **Build-phase additions in this stage:**
> - **F11 breakdown** — splits ITC at risk into permanent (no action possible) vs recoverable (contact supplier). Trader sees where effort is worth it.
> - **F13 flagged count** — surfaces Section 17(5) caution invoices as a separate row so they're not buried in the invoice list.

---

### 7.8 IMS Action Walkthrough Flow

**Trigger:** Trader taps "What do I do next?" from monthly summary, or taps "How do I do this?" from any individual verdict screen.

**Context:** Since April 1, 2026, IMS is a mandatory monthly step. Every supplier-reported invoice lands on the trader's IMS dashboard; the trader must actively Accept, Reject, or Hold each one before the GSTR-3B filing deadline. The app guides them through this — it does not do it for them.

> ⚠️ The walkthrough uses **annotated static screenshots** of the IMS portal. The team must confirm hands-on familiarity with the live IMS portal screens before building these steps — flagged in Thread 010 as a required real-world research task.

```
IMS Action Walkthrough Screen
    │
    ▼
Brief context (plain language)
    "IMS ek GST portal ka page hai jahan aap invoices Accept, Reject,
     ya Hold kar sakte hain. Yeh aapko khud karna hota hai — iss app
     se automatically nahi hoga."

    ("IMS is a page on the GST portal where you Accept, Reject, or Hold
     invoices. You must do this yourself — this app cannot do it automatically.")
    │
    ▼
Step-by-step walkthrough (annotated screenshots, 5 steps)
    Step 1: "gst.gov.in par jayein aur login karein"
            ("Go to gst.gov.in and log in")
    Step 2: "Services → Returns → Invoice Management System"
    Step 3: "Invoice [Invoice # highlighted] dhundein —
             supplier: [Supplier GSTIN]"
            ("Find invoice [#] from supplier [GSTIN]")
    Step 4: "Humari recommendation ke hisaab se
             [ACCEPT / REJECT / HOLD] tap karein"
            ("Tap [ACCEPT / REJECT / HOLD] as recommended by this app")
    Step 5: "Confirm karein"
            ("Confirm your action")
    │
    ▼
Deadline reminder
    "Agar aap kuch nahi karte, system automatically Accept kar leta hai.
     Reject/Hold karne wale invoices ke liye inaction se ₹X ITC ja
     sakti hai — GSTR-3B deadline se pehle yeh zaroor karein."

    ("If you do nothing, the system auto-accepts. For Reject/Hold invoices,
     inaction may cost you ₹X ITC — complete these before the GSTR-3B deadline.")
    │
    ▼
Done button
    → Returns to Monthly Summary Screen
```

---

### 7.9 Returning User (Month-End Batch) Flow

**Trigger:** A trader who has used the app before opens it at the start of a new month.

```
App opens
    │
    ▼
Home / Dashboard Screen
    Shows last month's status:
        "June 2026 — 142 invoices processed ✅"
        "Total ITC actioned: ₹18,400"
    │
    ├── GSTR-2B not yet available for current month (before ~14th)
    │       Banner: "July 2026 ka GSTR-2B [date] ke baad available hoga."
    │       Option available: "Invoices abhi bhi capture kar sakte hain"
    │       → Invoice Capture Flow (processing will run once import is done)
    │
    └── GSTR-2B available for current month (after ~14th)
            Prompt: "July 2026 ka GSTR-2B import karein"
            → GSTR-2B Import Flow (Section 7.2)
            → Invoice Capture Flow (Section 7.3)
            → ... full monthly cycle continues
    │
    ▼
Previous months accessible (read-only audit trail)
    - Tap any past month → see verdict screen history and summary
    - "I disagree" flags from past months visible here
```

---

### 7.10 E-Invoice Eligibility Alert Flow

**Trigger:** During onboarding or when the trader enters/updates their GSTIN, the app checks the trader's declared turnover bracket against the current e-invoicing threshold (currently ₹5 crore aggregate turnover).

**What it does:** Informational only — tells the trader whether they are likely subject to e-invoicing requirements. Does not generate e-invoices; does not integrate with the IRP (Invoice Registration Portal).

```
After GSTIN entry / profile update
    │
    ▼
Turnover Check
    ├── Below threshold (most kirana owners)
    │       No alert — proceed normally
    │
    └── At or above threshold
            │
            ▼
        E-Invoice Alert Card (dismissible, persists in profile)
            "Aapka turnover ₹5 crore se zyada hai — aapko e-invoice
             banana zaroori hai har B2B invoice ke liye."
            ("Your turnover is above ₹5 crore — you are required to generate
             e-invoices for every B2B invoice.")
            │
            ▼
        Brief Guide (expandable)
            - What is e-invoice? (one-line: "IRP portal se invoice register karna")
            - Why does it matter? ("Non-compliance penalty: ₹10,000 per invoice or 100% tax")
            - How to do it? ("IRP portal: einvoice1.gst.gov.in — login → generate IRN")
            │
            ▼
        Dismiss / "Mujhe yaad mat dilaao" (suppress for this session)
        Alert re-surfaces next month if still above threshold
```

> **Design note:** This is a lightweight informational feature. It requires no OCR, no matching engine, and no new backend infrastructure — just a turnover-bracket check against a known threshold. It demonstrates awareness of the full GST compliance landscape beyond reconciliation.

---

### 7.11 Regulatory Diagnostic Features (F11–F14)

> This section consolidates the four regulatory diagnostic features committed in §1A. Each feature is integrated into the main flow at the stages noted below — this section provides a single-reference view of their logic, inputs, outputs, and design constraints.

---

#### F11 — Permanent vs Recoverable ITC Classifier

**Where it runs:** §7.5 (engine classification), §7.6 (verdict tag), §7.7 (summary breakdown)

**Logic:**
- For every REJECT recommendation, check if the supplier's amendment window is still open:
  - Amendment window = GSTR-1 can be amended until the GSTR-3B filing deadline for that return period, or via subsequent period corrections before the annual return deadline.
  - **Recoverable:** Amendment window is still open → supplier *can* file a correction → "Contact your supplier."
  - **Permanent:** Amendment window has closed → supplier *cannot* correct → "This ITC is lost."
- For HOLD recommendations: classification is "Pending" — will resolve once the supplier files or the window closes.

**Output:** A tag on every mismatch: `🔴 Permanent` / `🟡 Recoverable` / `⏳ Pending`

**Design constraint:** The classifier must be conservative — if the window status is ambiguous, default to "Recoverable" (i.e., give the trader hope and a reason to act, rather than prematurely declaring loss).

---

#### F12 — Place-of-Supply Mismatch Detector

**Where it runs:** §7.4 (PoS field extraction), §7.5 (comparison against GSTR-2B PoS)

**Logic:**
- Extract Place of Supply from the invoice (state code or state name).
- Extract supplier-GSTIN state code (first 2 digits of GSTIN).
- Compare against the PoS recorded in GSTR-2B for the same invoice.
- Mismatch triggers: REJECT with a specific PoS-mismatch reason.
  - Common pattern: supplier reports intra-state (CGST+SGST) but the actual supply is inter-state (IGST), or vice versa. This affects which tax heads the ITC is claimed under.

**Output:** A PoS-mismatch flag + specific reason line on the verdict screen.

**Design constraint:** PoS determination in GST is complex (location of supplier, recipient, and place of delivery all matter). The detector flags mismatches between the invoice and GSTR-2B — it does not attempt to determine the *correct* PoS. The trader or their CA makes that call.

---

#### F13 — Section 17(5) Blocked-Credit Detector

**Where it runs:** §7.4 (invoice category classification), §7.6 (caution flag), §7.7 (flagged count)

**Logic:**
- During OCR extraction, classify the invoice category from content signals:
  - Supplier name / description containing keywords: "restaurant", "hotel", "motor vehicle", "club", "membership", "beauty", "health club", "travel agent"
  - HSN/SAC codes associated with Section 17(5) blocked categories
- If a blocked-credit category is detected → flag the invoice for review.

**Output:** A caution banner on the verdict screen: *"This invoice may be in a restricted category under Section 17(5). Verify with your CA."*

**Design constraint — CRITICAL:** This feature **flags for review — it never asserts**. Section 17(5) has exceptions and nuances that depend on the trader's specific business context (e.g., a hotel invoice *can* be eligible for ITC if the travel is for business purposes and the traveller is not the trader themselves). The app lacks the context to make this determination. The flag says "check this" — it does not say "this is blocked."

---

#### F14 — Supplier-Fix Message Generator

**Where it runs:** §7.5 (draft generation), §7.6 (share button on verdict screen)

**Logic:**
- For every REJECT recommendation, generate a plain-language message template:
  - Template: *"[Supplier name], aapke invoice [invoice #] dated [date] mein [mismatched field] galat hai. Aapne [incorrect value] report kiya, lekin sahi value [correct value] hona chahiye. Kripya apna GSTR-1 amend karein. — [Trader name]"*
  - English version also generated (trader's language preference determines which is shown first).
- The message is stored as a draft attached to the invoice verdict.

**Output:** A "📤 Supplier ko bhejein" button on REJECT verdict screens → opens system share sheet (WhatsApp, SMS, etc.) with the pre-filled message.

**Design constraint — CRITICAL:** The app **drafts only — never auto-sends**. The trader must:
1. Tap the share button
2. Review the message in the share sheet
3. Choose the recipient and send manually

This ensures the trader retains full control over supplier communication. Auto-sending would be a trust violation and could damage supplier relationships.

---

## 8. Happy Path

The complete, no-errors run-through of the product for a single monthly cycle:

```
 1. Trader opens app for the first time
 2. Selects "हिंदी" as language
 3. Enters GSTIN correctly on first attempt
 4. Reads 2-screen orientation; taps "Shuru karein" ("Let's start")
 5. App auto-loads pre-populated GSTR-2B dummy dataset
    → Screen: "142 invoices aapke GSTR-2B mein hain — June 2026"
 6. Trader taps "Take Photo" → photographs 5 purchase invoices
    All 5 are clear images with legible text
 7. Taps "Done, process all"
 8. All 5 invoices extracted with high confidence — no re-capture needed
 9. Reconciliation runs silently
10. Verdict Screen — Invoice 1 of 5 (highest ITC impact):
    ┌──────────────────────────────────────────────┐
    │  ❌ REJECT                                    │
    │  Supplier: 29XXXXX                            │
    │  Invoice #: INV-2024                          │
    │                                               │
    │  "Supplier ne galat tax amount report kiya — │
    │   ₹2,400 ka ITC block ho sakti hai."          │
    │                                               │
    │  ⚠️ Yeh sirf recommendation hai.              │
    └──────────────────────────────────────────────┘
    Trader taps "Agla →"
11. Verdict Screen 2 of 5:
    → ACCEPT — "₹4,800 ITC safe hai"
    Trader taps "Agla →"
12. Verdict Screens 3–5: all ACCEPT
    Trader taps "Agla →" through each
13. Monthly Summary:
    "5 invoices: 4 Accept ✅, 1 Reject ❌"
    "₹2,400 khatre mein | ₹14,400 safe"
14. Trader taps "Ab kya karein?"
15. IMS Walkthrough shown — 5 annotated steps for Reject action
16. Trader goes to GST portal and takes the Reject action manually
17. Returns to app → taps "Done" → back to dashboard ✅
```

---

## 9. Edge Cases

### EC-01: Supplier has not filed GSTR-1 yet (invoice not in GSTR-2B)
**Scenario:** Trader has a purchase invoice from a supplier who has not yet filed their GSTR-1, so no matching record exists in GSTR-2B.
**Handling:** Recommend **HOLD**. Reason: *"Aapka supplier abhi tak file nahi kiya hai — 14 tarikh ke baad check karein."* ITC impact shown as: *"₹X uncertain — depends on whether supplier files."*

---

### EC-02: GSTR-2B requested before the 14th of the month
**Scenario:** Trader opens the app early in the month before GSTR-2B is generated by the portal.
**Handling:** Inform trader of expected availability date. Allow invoice capture to proceed normally. Reconciliation deferred until GSTR-2B is available. A pending banner is shown: *"GSTR-2B [date] ke baad import karein — invoices abhi add kar sakte hain."*

---

### EC-03: OCR low-confidence extraction
**Scenario:** Invoice image is blurry, poorly lit, on coloured paper, or hand-written.
**Handling:** Specific uncertain fields are highlighted. Trader offered retake option. If skipped, invoice marked "Unreadable" in monthly summary with the captured image preserved for reference.

---

### EC-04: HSN code mismatch between invoice and GSTR-2B
**Scenario:** Trader's invoice shows HSN 2106 but supplier filed HSN 2105 in GSTR-2B for the same invoice.
**Handling:** Recommend **REJECT**. Reason: *"Supplier ne galat HSN code file kiya hai — iss invoice par ITC claim nahi hogi."* ₹ ITC impact shown as blocked.

---

### EC-05: Tax amount discrepancy
**Scenario:** Trader's invoice shows ₹480 IGST; GSTR-2B shows ₹380 IGST for the same invoice number and supplier.
**Handling:** Recommend **REJECT**. Reason: *"Tax amount mismatch — ₹100 ka farq hai. Supplier se correct invoice maangein."* Specific mismatched field highlighted.

---

### EC-06: Duplicate invoice upload detected
**Scenario:** Trader photographs or uploads the same invoice twice, either in the same session or across sessions.
**Handling:** Detect during capture (image similarity) or during extraction (same invoice number + supplier GSTIN combination). Warn: *"Yeh invoice pehle se add kiya hua hai — phir se add karein?"* Require explicit confirmation before allowing duplicate.

---

### EC-07: Multi-page invoice
**Scenario:** A single purchase invoice spans 2–3 pages (e.g., itemised bill with continuation sheet).
**Handling:** Prompt during capture: *"Kya yeh invoice ek se zyada page ka hai?"* If yes, allow additional pages to be added to the same invoice entry before submitting for extraction.

---

### EC-08: Trader disagrees with a recommendation
**Scenario:** Trader believes the app's Reject recommendation is wrong (e.g., they believe the supplier will correct the filing).
**Handling:** Tap "I disagree" → acknowledged and logged to audit trail. Recommendation is not changed — it remains visible as the app's assessment. Trader retains full choice over what action they take on the IMS portal.

---

### EC-09: Supplier GSTIN on invoice does not match any GSTR-2B record
**Scenario:** OCR extracts a GSTIN that has no entry in GSTR-2B — either the supplier GSTIN is misprinted on the invoice or the supplier filed under a different GSTIN.
**Handling:** Flag as "GSTIN not found in your GSTR-2B." Recommend **REJECT**. Reason: *"Supplier ka GSTIN GSTR-2B mein nahi mila — invoice verify karein aur supplier se contact karein."*

---

### EC-10: Invoice in an unsupported regional script
**Scenario:** Invoice is printed in Gujarati, Tamil, Telugu, or another script.
**Handling:** If Bhashini OCR supports the script → process normally. If extraction fails → prompt retake with a note: *"Hum iss language mein invoice nahi pad paye — clear photo lein."* If still fails → mark unreadable; log for audit trail.

---

### EC-11: Network loss during or after capture
**Scenario:** Trader's internet connection drops while invoices are queued for processing.
**Handling:** Captured images saved locally. Banner shown: *"Internet nahi hai — X invoices upload hone ki wait mein hain."* Auto-resume and process when connectivity returns without any trader action required.

---

### EC-12: GSTR-2B contains far more records than invoices captured
**Scenario:** GSTR-2B has 142 supplier-reported invoices; trader has only captured 8 of their own invoices this session.
**Handling:** Normal behaviour — trader may not have captured all invoices yet, or may be doing a partial batch. App processes only the captured 8. Monthly summary note: *"8 invoices reviewed — aapke GSTR-2B mein 142 records hain. Baaki invoices add kar sakte hain."* No false flags on the 134 unreviewed records.

---

### EC-13: Invoice with zero ITC impact
**Scenario:** A mismatched invoice covers an exempt supply category or an ineligible purchase (e.g., personal expenses billed to business), making ITC not claimable regardless.
**Handling:** Show verdict normally. ITC impact displayed as: *"₹0 — iss invoice par ITC applicable nahi hai."* Recommendation may still be REJECT to maintain accurate records, but urgency is lower.

---

## 10. Failure States

### FS-01: GSTR-2B Load / Upload Failure
**Trigger:** Dummy dataset fails to auto-load (demo environment issue), or uploaded file is corrupt, password-protected, or in an unsupported format.
**Message:** *"GST data load nahi ho saka. Dobara try karein."* / *"We couldn't load your GST data. Please try again."*
**Recovery:** Retry button. File picker to re-upload. If persistent in demo environment, surface a clear error so the team can diagnose it before the presentation.

---

### FS-02: OCR Service Failure (all invoices)
**Trigger:** Backend OCR service is unreachable, returns a 5xx error, or all invoices return zero extraction confidence in a batch.
**Message:** *"Invoices abhi nahi pad pa rahe. Thodi der baad try karein."* / *"Couldn't read invoices right now. Please try again in a moment."*
**Recovery:** Retry option presented. Captured images are preserved — trader does not need to re-photograph anything.

---

### FS-03: Reconciliation Engine Failure
**Trigger:** Matching or scoring engine crashes, returns empty results, or returns a processing error.
**Message:** *"Comparison mein kuch gadbad aayi. Thodi der mein theek ho jayega."* / *"Something went wrong during comparison. It should be fixed shortly."*
**Recovery:** Auto-retry once silently. If second attempt also fails, show error state with a "Try again" button. Preserve all extracted invoice data — do not require re-capture.

---

### FS-04: Bhashini Translation Service Failure
**Trigger:** Bhashini API is unreachable or returns an error for one or more UI strings.
**Handling:** Fall back to English for affected strings. Do not crash the app. Show a non-intrusive banner: *"Translation service temporarily unavailable — showing content in English."* Log the failure. Resume translated output as soon as Bhashini responds.

---

### FS-05: Persistent Network Loss
**Trigger:** No internet connection for an extended period; local capture queue accumulates.
**Message:** *"Internet nahi hai. Jab connection aaye, automatically process hoga."* / *"No internet. Will process automatically when you reconnect."*
**Handling:** Invoice capture still works (save locally). Processing and reconciliation deferred. Trader notified when back online and auto-processing resumes. No data lost.

---

### FS-06: Validation Bug Found Close to Demo Deadline (Build-Time Failure)
**Trigger:** During pre-demo testing with dummy invoices, a known-outcome invoice returns the wrong recommendation.
**Handling (build-time protocol):**
- Treat as **highest-priority bug** — address immediately.
- If unfixable before demo: **exclude that specific test case from the live demo** — do not hide the exclusion.
- Disclose explicitly: *"This edge case is known and under investigation — we excluded it from the demo to show you a reliable core flow."*
- Decide this fallback plan now, calmly — not under deadline pressure.
- Pre-decide which team member owns the go/no-go call on demo test cases.

*(Flagged as a required pre-decision in Thread 010.)*

---

## 11. Stretch Flows (Gated at 70% Build Checkpoint)

> **Build-phase update:** The 70% checkpoint has been **passed**. The core MVP flow is working end-to-end. Both items below have been promoted from stretch to committed/built.
>
> ~~These flows are built **only if** the core MVP flow is fully working, tested on multiple dummy invoices with known outcomes, and the team explicitly agrees the 70% checkpoint has been passed.~~
>
> ~~If the checkpoint is not met → these become **roadmap slides only**, decided in advance and not improvised under deadline pressure.~~

---

### 11.1 GSTR-2A Supplier Non-Filing Early Warning

> **Status: COMMITTED** (promoted from stretch — see §1A)

**What it does:** Before the GSTR-2B is locked on the ~14th, checks GSTR-2A data (real-time view of suppliers' outbound filings) against the trader's supplier list. Flags suppliers who have not yet filed their GSTR-1, warning the trader that ITC from those suppliers may be blocked.

**Why it's committed:** Reuses data already ingested for reconciliation. No OCR or bot infrastructure needed. Directly on-thesis for the PS's "proactive insight" angle. Demoable as a single added screen. The 70% gate has been passed, so this is no longer gated.

```
After GSTR-2B / 2A data import:
    │
    ▼
Supplier Filing Check Screen
    Header: "Kuch suppliers ne abhi tak file nahi kiya"
            ("Some suppliers haven't filed yet")
    │
    ▼
Per-unfiled supplier:
    [Supplier GSTIN] — "File nahi kiya" — "₹X ITC at risk if not resolved by 14th"
    │
    ▼
Summary line:
    "3 suppliers haven't filed — could block ₹X ITC if unresolved by [date]"
    │
    ▼
Trader notes which suppliers to follow up with manually
    (App does NOT contact suppliers —
     Proactive Supplier Outreach feature is CUT from all scopes)
```

---

### 11.2 WhatsApp Bot Stub ~~(Hard-Gated Stretch)~~ → BUILT

> **Status: BUILT** (gate passed, prototype working — see §1A)

**What it does:** A single hardcoded test case demonstrating that an invoice image sent to a specific WhatsApp contact number can be routed through the real processing pipeline and return a verdict reply.

**~~Gate condition~~:** ~~Core flow must be fully working and tested on multiple invoices before this is attempted. If gate is not passed → roadmap slide only.~~ **Gate passed.** Core flow is working. This stub is built and routes through the real OCR → match → verdict pipeline.

**Disclosure requirement:** Must be framed explicitly in the demo as *"a working prototype of the WhatsApp ingestion channel"* — not implied to be a full WhatsApp Business API deployment. If probed by judges, be transparent about scope.

```
[Demo: one hardcoded test contact sends invoice image to bot number]
    │
    ▼
Bot receives image via WhatsApp Business API (sandbox / test number)
    │
    ▼
Image routed through the same OCR + reconciliation pipeline
    (identical backend to the in-app camera path)
    │
    ▼
Bot replies to the WhatsApp message:
    "Invoice [#] — REJECT — ₹2,400 ITC at risk.
     Supplier ne galat tax amount report kiya.
     IMS portal par Reject karein — gst.gov.in"
    │
    ▼
Demo narration:
    "This is a working prototype of the WhatsApp ingestion channel —
     the same pipeline processes the invoice regardless of how it arrives."
```

---

## 12. Cut and Out-of-Scope Flows

The following flows were considered and explicitly cut during ideation. They are documented here to prevent scope creep in future sessions.

| Feature | Decision | Reason |
|---------|----------|--------|
| **Proactive Supplier Outreach** | Cut (or reframe as future) | Trader may not understand why the app is messaging their supplier; scope risk; not trader-legible |
| **Supplier Risk Scoring** | Cut | Too abstract for a kirana owner; not actionable |
| **Auto-Dispute Generation** | Cut (CA-only, future roadmap) | Requires understanding of "dispute" in GST context; not trader-legible |
| **Cashflow Forecasting** | Cut | Out of PS scope entirely; different product |
| **Voice / IVR Assistant** | Deferred | Valid for low-literacy users but significant scope risk; not in MVP |
| **Bank Feed / Account Aggregator** | Cut | Out of PS scope; bank transactions lack invoice-level fields (GSTIN, HSN, tax breakdown) needed for GST reconciliation — cannot substitute invoice capture |
| **ERP Connectors** | Cut | Kirana owner has no ERP |
| **Full Offline-First Architecture** | Simplified | Reduced to queue-capture-send-when-connected; full offline-first build cut for hackathon scope |
| **Live GSP-Sandbox Integration** | Roadmap-only | Credible production-path mention in pitch; not a hackathon build item |
| **CA-Facing Dashboard (multi-client)** | Out of scope | Product is built for the trader directly — no CA interface |
| **Auto-Filing / Auto-Submission to IMS** | Permanently excluded | Stakes are real (mandatory since April 2026); all IMS actions must be trader-initiated; auto-filing introduces unacceptable liability and trust risk |
| **Transaction Monitoring via Bank / Payment Data** | Cut | Bank/payment transaction data (amount, payer, payee, timing) does not carry invoice-level fields needed for GST reconciliation (GSTIN, HSN codes, tax breakdown, invoice number) — cannot replace invoice capture |

---

## Appendix: Open Items ~~Before Development Starts~~ — Build-Phase Tracker

> Updated from the Session-1 snapshot. Resolved items are struck through; new build-phase items are added.

| Priority | Item | Status | Who |
|----------|------|--------|-----|
| ~~🔴 Urgent~~ | ~~PWA vs. native app~~ | ✅ **RESOLVED** — Expo / React Native (native-first + web build). See §1A. | — |
| 🟡 Open | Verdict screen layout and content design — requirements expanded (F11 tag, F13 caution, F14 button, TTS, 16(4) deadline) | In progress — functional spec is in §7.6; visual layout not yet designed | Design task |
| ~~🟡 Open~~ | ~~Total hackathon build-time window~~ | ✅ **RESOLVED** — 70% checkpoint passed; stretch items promoted | — |
| ~~🟡 Open~~ | ~~Team's existing tech stack knowledge~~ | ✅ **RESOLVED** — Expo / React Native + Python backend confirmed | — |
| 🟡 Open | Hands-on familiarity with live IMS portal screens — required to build accurate walkthrough steps | Still open | Real-world research task |
| ~~🟡 Open~~ | ~~Who on the team owns monitoring the 70% build checkpoint~~ | ✅ **RESOLVED** — checkpoint passed | — |
| 🟡 Open | Monetisation / pricing narrative for the landing page | Still open | Team |
| 🟡 **New** | Bhashini API integration — key management, latency testing, GST-term verification pass for Hindi translations | Open | Backend + content |
| 🟡 **New** | F11 amendment-window logic — exact date thresholds for Permanent vs Recoverable classification need CA review | Open | Domain / CA |
| 🟡 **New** | F13 keyword/HSN list for Section 17(5) blocked categories — needs domain validation | Open | Domain / CA |
| 🟡 **New** | F14 supplier-fix message templates — tone and content need review ("too aggressive" risk) | Open | Content / UX |
| 🟡 **New** | Section 16(4) deadline calculation logic — edge cases around annual return vs September GSTR-3B | Open | Domain / CA |

---

*This document reflects the state of the project through the build phase of KLEOS 2026 D4-PS1. Session-1 flows are preserved; build-phase decisions and committed features are layered on top (see §1A). This document is updated — not overwritten — as decisions are made and validated.*
