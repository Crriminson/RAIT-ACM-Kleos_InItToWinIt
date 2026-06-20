"""
api/routes/ai.py — LLM-backed advisory endpoints (app-compatible).

These mirror the four conversational endpoints the React Native app calls
(see app/src/api/ai.ts).  Each one tries Gemini first and falls back to an
offline, deterministic response when no key is configured or the API fails —
so the demo never hard-fails:

    POST /api/gst-doubt        — Ask-a-CA Q&A
    POST /api/ai-advice        — consolidated ITC advisory (EN + HI)
    POST /api/tax-planning     — 3 tax-saving strategies
    POST /api/compare-invoices — side-by-side invoice comparison

Response envelope matches the Node server:
    { "success": true, "method": "gemini" | "fallback", "warning"?: str, ... }
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from core import gemini

log = logging.getLogger(__name__)

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(tags=["ai"])


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class GstDoubtRequest(BaseModel):
    question: str
    lang: str = "en"


class AiAdviceRequest(BaseModel):
    results: list[Any] = []
    invoices: list[Any] = []


class TaxPlanningRequest(BaseModel):
    totalBlockedAmt: float = 0
    mismatchesCount: int = 0
    invoiceCount: int = 0
    lang: str = "en"


class CompareInvoicesRequest(BaseModel):
    invoiceA: dict[str, Any]
    invoiceB: dict[str, Any]
    lang: str = "en"


class EInvoiceAlertRequest(BaseModel):
    gstin: str
    trader_name: str
    reported_annual_turnover_inr: float | None = None
    estimated_turnover_from_invoices_inr: float | None = None
    invoice_count_this_month: int = 0
    ui_language: str = "hi"
    user_asked_about_einvoicing: bool = False


class PosInvoicePayload(BaseModel):
    invoice_number: str
    invoice_date: str
    supplier_name: str
    supplier_gstin: str
    place_of_supply_raw: str | None = None
    tax_type: str  # "CGST_SGST" | "IGST" | "UTGST" | "UNKNOWN"
    cgst_amount: float
    sgst_amount: float
    igst_amount: float
    taxable_value: float
    total_itc_value: float

class PosTraderPayload(BaseModel):
    gstin: str
    registered_state_code: str

class PosMismatchBatchRequest(BaseModel):
    invoices: list[PosInvoicePayload]
    trader: PosTraderPayload
    ui_language: str = "hi"

class F13LineItem(BaseModel):
    description: str
    hsn_sac: str | None = None
    amount: float

class F13InvoicePayload(BaseModel):
    invoice_number: str
    invoice_date: str
    supplier_name: str
    supplier_gstin: str | None = None
    hsn_sac_codes: list[str]
    line_items: list[F13LineItem]
    total_itc_value: float
    ocr_raw_text: str

class F13TraderPayload(BaseModel):
    gstin: str
    business_description: str | None = None

class F13Request(BaseModel):
    invoice: F13InvoicePayload
    trader: F13TraderPayload
    ui_language: str = "hi"



# ---------------------------------------------------------------------------
# 1. Ask-a-CA Q&A
# ---------------------------------------------------------------------------

@router.post("/api/gst-doubt")
@limiter.limit("10/minute")
async def gst_doubt(request: Request, body: GstDoubtRequest) -> dict:
    question = (body.question or "").strip()
    if not question:
        return {"success": False, "error": "Please provide a valid question."}

    is_hindi = body.lang == "hi"
    prompt = (
        "You are an expert Indian Chartered Accountant (CA) specializing in GST, "
        "GSTR-2B reconciliation, CGST Section 16 eligibility and Section 17(5) blocked credits.\n"
        f'Answer this small-merchant query clearly: "{question}"\n'
        "Format guidelines:\n"
        f"- Answer in {'Hindi (Devanagari script, simple everyday words)' if is_hindi else 'simple English'}.\n"
        "- Use short headings and bullet points so a Class-10-educated shopkeeper can follow.\n"
        "- Reference CGST sections (16(2), 16(4), 17(5)) only when helpful, explained simply.\n"
        "- End with a one-sentence recommendation.\n"
        "- Plain text with light Markdown."
    )
    try:
        answer = gemini.generate_text(prompt)
        return {"success": True, "method": gemini.last_method(), "answer": answer}
    except Exception as exc:  # noqa: BLE001
        return {
            "success": True,
            "method": "fallback",
            "warning": str(exc),
            "answer": _faq_fallback(question, is_hindi),
        }


# ---------------------------------------------------------------------------
# 2. Consolidated AI advisory (EN + HI)
# ---------------------------------------------------------------------------

@router.post("/api/ai-advice")
@limiter.limit("10/minute")
async def ai_advice(request: Request, body: AiAdviceRequest) -> dict:
    results = body.results or []
    prompt = (
        "You are an expert Indian CA specializing in GST reconciliation, GSTR-2B "
        "compliance, Section 16 eligibility and Section 17(5) blocked credits.\n"
        "Analyze these reconciliation mismatches and physical invoices:\n"
        f"Mismatches: {json.dumps(results)}\n"
        f"Invoices: {json.dumps(body.invoices or [])}\n"
        "Provide a consolidated audit advisory in BOTH English and Hindi. Explain exactly "
        "why specific ITC is blocked/pending (name the suppliers), and give concrete "
        "actionable steps (withhold payments, send supplier reminders, request GSTR-1 "
        "Table 9 amendments). Use clean Markdown.\n"
        'Output PURE JSON (no code fences) with exactly two keys: "adviceEn" and "adviceHi".'
    )
    try:
        data = gemini.generate_json(prompt)
        if "adviceEn" not in data or "adviceHi" not in data:
            raise RuntimeError("Advice JSON missing required keys.")
        return {"success": True, "method": "gemini", "data": data}
    except Exception as exc:  # noqa: BLE001
        return {
            "success": True,
            "method": "fallback",
            "warning": str(exc),
            "data": _advice_fallback(results),
        }


# ---------------------------------------------------------------------------
# 3. Tax-saving strategies
# ---------------------------------------------------------------------------

@router.post("/api/tax-planning")
@limiter.limit("10/minute")
async def tax_planning(request: Request, body: TaxPlanningRequest) -> dict:
    is_hindi = body.lang == "hi"
    blocked = f"{body.totalBlockedAmt:,.0f}"
    prompt = (
        "You are an expert Indian CA specializing in GST compliance and MSME financial optimization.\n"
        f"Merchant's current month: Invoices tracked: {body.invoiceCount or 0}; "
        f"GSTR-2B mismatches/blocked: {body.mismatchesCount or 0}; "
        f"Cash-at-risk / blocked ITC: ₹{blocked}.\n"
        "Give exactly 3 practical, compliant tax-planning strategies to recover locked cash, "
        "reverse blocked credits, prioritize suppliers or avoid penalties (Section 16(4) "
        "deadlines, Rule 37 reversals).\n"
        'Output PURE JSON (no code fences): {"strategies":[{"title":"...","subtitle":"...",'
        '"description":"..."}]} with exactly 3 items, all text in '
        f"{'Hindi (Devanagari)' if is_hindi else 'English'}."
    )
    try:
        data = gemini.generate_json(prompt)
        strategies = data.get("strategies") if isinstance(data, dict) else None
        if not isinstance(strategies, list) or not strategies:
            raise RuntimeError("Invalid strategy response.")
        return {"success": True, "method": "gemini", "strategies": strategies}
    except Exception as exc:  # noqa: BLE001
        return {
            "success": True,
            "method": "fallback",
            "warning": str(exc),
            "strategies": _strategy_fallback(is_hindi),
        }


# ---------------------------------------------------------------------------
# 4. Compare two invoices
# ---------------------------------------------------------------------------

@router.post("/api/compare-invoices")
async def compare_invoices(body: CompareInvoicesRequest) -> dict:
    is_hindi = body.lang == "hi"
    a, b = body.invoiceA, body.invoiceB
    if not a or not b:
        return {"success": False, "error": "Missing invoice records"}

    lang_word = "Hindi Devanagari" if is_hindi else "English"
    prompt = (
        "You are an expert Indian CA and tax auditor. Compare these two GST invoices:\n"
        f"Invoice A: {json.dumps(a)}\n"
        f"Invoice B: {json.dumps(b)}\n"
        "Check: same supplier? duplicate invoice number? same date/amount? line-item, HSN, "
        "taxable value or tax-rate differences? Flag GSTR-2B / compliance concerns.\n"
        "Output PURE JSON (no code fences):\n"
        f'{{"summary":"...({lang_word})","hasDiscrepancies":true/false,'
        '"comparisonList":[{"aspect":"...","invoiceAVal":"...","invoiceBVal":"...",'
        '"status":"Match|Mismatch|Warning"}],'
        f'"auditObservations":"...({lang_word})"}}'
    )
    try:
        data = gemini.generate_json(prompt)
        return {"success": True, "method": "gemini", "data": data}
    except Exception as exc:  # noqa: BLE001
        return {
            "success": True,
            "method": "fallback",
            "warning": str(exc),
            "data": _compare_fallback(a, b, is_hindi),
        }


# ---------------------------------------------------------------------------
# 5. E-Invoice Eligibility Alert
# ---------------------------------------------------------------------------

@router.post("/api/einvoice-alert")
async def einvoice_alert(body: EInvoiceAlertRequest) -> dict:
    prompt = f"""You are the AI engine behind a GST compliance assistant for small Indian traders — kirana store owners and similar MSMEs with limited English and limited GST-portal literacy.

Your persona is a knowledgeable, plain-spoken local CA who happens to speak Hindi fluently. You do NOT use legal jargon. You translate compliance obligations into concrete rupee impacts and one-sentence actions.

Hard rules:
- Never auto-file, auto-generate, or auto-submit anything. You recommend and explain. The trader acts.
- Every ₹ amount uses Indian formatting: ₹1,00,000 not ₹100,000.
- Hindi is the default language. English is available on request.
- When in doubt, recommend consulting a CA. Never assert legal certainty on edge cases.
- Keep every message short enough to read on a mid-range Android phone in 30 seconds.

Context you will receive:
{json.dumps(body.dict())}

Your task: Decide whether to surface an e-invoice eligibility alert, and if so, produce the exact UI content for it.

Decision logic:
Show the alert if ANY of the following is true:
- reported_annual_turnover_inr >= 40000000 (₹4 crore — approaching the ₹5 crore threshold)
- estimated_turnover_from_invoices_inr annualised >= 40000000
- user_asked_about_einvoicing is true (always show, regardless of turnover)

Do not show the alert if both turnover signals are below ₹4 crore AND the user did not explicitly ask.
Threshold awareness:
- Below ₹4 crore: no alert.
- ₹4 crore to just under ₹5 crore: "approaching" framing — advisory, not urgent.
- ₹5 crore or above: "applies_now" framing — clear, calm urgency.

What the alert must convey:
- What e-invoicing is — one plain sentence.
- Whether it applies to them now, or soon.
- What they need to do next — one concrete action ending with the official portal URL: https://einvoice1.gst.gov.in
- Consult a CA — a brief, non-alarming nudge.
- What you will NOT do — confirm the app does not generate e-invoices.

Output format:
Respond with a JSON object only. No preamble, no explanation, no markdown fences.
{{
  "show_alert": true | false,
  "alert": {{
    "severity": "approaching" | "applies_now" | "informational",
    "headline_hi": "...",
    "headline_en": "...",
    "body_hi": "...",
    "body_en": "...",
    "action_label_hi": "...",
    "action_label_en": "...",
    "action_url": "https://einvoice1.gst.gov.in",
    "ca_nudge_hi": "...",
    "ca_nudge_en": "...",
    "disclaimer_hi": "...",
    "disclaimer_en": "..."
  }}
}}
If show_alert is false, return "alert": null.
"""
    try:
        data = gemini.generate_json(prompt)
        return {"success": True, "method": "gemini", "data": data}
    except Exception as exc:  # noqa: BLE001
        return {
            "success": True,
            "method": "fallback",
            "warning": str(exc),
            "data": _einvoice_fallback(body),
        }


# ===========================================================================
# Offline fallbacks (ported from the earlier Node/Express AI server)
# ===========================================================================

def _pick(en: str, hi: str, is_hindi: bool) -> str:
    return hi if is_hindi else en


def _rupee(n: Any) -> str:
    try:
        return "₹" + f"{float(n or 0):,.0f}"
    except (TypeError, ValueError):
        return "₹0"


def _faq_fallback(question: str, is_hindi: bool) -> str:
    q = question.lower()
    if re.search(r"(time|limit|expire|deadline|कब तक|सीमा)", q):
        return _pick(
            "**ITC time limit (Section 16(4))**\n- The last date to claim ITC on an invoice is "
            "**30 November** of the next financial year, or the date of filing GSTR-9 — whichever "
            "is earlier.\n- After that, unclaimed credit expires permanently. Reconcile early.",
            "**ITC की समय सीमा (धारा 16(4))**\n- किसी बिल पर क्रेडिट का दावा अगले वित्तीय वर्ष की "
            "**30 नवंबर** तक या GSTR-9 दाखिल करने की तिथि (जो पहले हो) तक किया जा सकता है।\n- इसके बाद "
            "बचा क्रेडिट हमेशा के लिए समाप्त हो जाता है। समय पर मिलान करें।",
            is_hindi,
        )
    if re.search(r"(not show|missing|gayab|दिखाई|लापता)", q):
        return _pick(
            "**Invoice not in GSTR-2B?** Check:\n1. **Wrong GSTIN** — supplier filed it under a "
            "different buyer.\n2. **Late filing** — filed after the 11th slides into next month's "
            "2B.\n3. **Draft only** — supplier saved GSTR-1 but did not submit it.",
            "**बिल GSTR-2B में नहीं?** जांचें:\n1. **गलत GSTIN** — सप्लायर ने किसी और के नंबर पर चढ़ा "
            "दिया।\n2. **देर से फाइलिंग** — 11 तारीख के बाद भरा बिल अगले महीने के 2B में जाता है।\n"
            "3. **केवल ड्राफ्ट** — सप्लायर ने GSTR-1 सेव किया पर सबमिट नहीं किया।",
            is_hindi,
        )
    if re.search(r"(block|17\(5\)|car|vehicle|food|भोजन|गाड़ी|अवरुद्ध)", q):
        return _pick(
            "**Blocked credits (Section 17(5))** — ITC cannot be claimed on:\n- Passenger vehicles "
            "(unless for transport/resale)\n- Food, beverages & catering (unless part of your "
            "supply)\n- Personal/health expenses (gym, life insurance)\n- Lost, stolen or free-gift "
            "inventory (ITC must be reversed).",
            "**अवरुद्ध क्रेडिट (धारा 17(5))** — इन पर ITC नहीं मिलता:\n- यात्री वाहन (परिवहन/रीसेल को "
            "छोड़कर)\n- भोजन, पेय व कैटरिंग (जब तक आपके व्यवसाय का हिस्सा न हो)\n- व्यक्तिगत/स्वास्थ्य "
            "खर्च (जिम, जीवन बीमा)\n- खोया/चोरी/मुफ्त दिया सामान (ITC रिवर्स करना होगा)।",
            is_hindi,
        )
    if re.search(r"(2a|2b|difference|अंतर)", q):
        return _pick(
            "**GSTR-2A vs 2B**\n- **2A is dynamic** — updates in real time as suppliers file.\n"
            "- **2B is static** — generated on the **14th** each month and locked. Claim ITC "
            "strictly from 2B.",
            "**GSTR-2A बनाम 2B**\n- **2A गतिशील है** — सप्लायर के भरते ही रीयल-टाइम अपडेट होता है।\n"
            "- **2B स्थिर है** — हर महीने की **14 तारीख** को बनता है और लॉक हो जाता है। ITC का दावा 2B "
            "से ही करें।",
            is_hindi,
        )
    return _pick(
        "**ITC good practices**\n- Match physical invoices to GSTR-2B to the rupee.\n- Pay "
        "suppliers within 180 days (Rule 37) or reverse the credit.\n- Keep GSTR-3B records "
        "aligned with your reconciliation.",
        "**ITC के लिए अच्छी आदतें**\n- भौतिक बिलों का GSTR-2B से पैसे-पैसे मिलान करें।\n- सप्लायर को "
        "180 दिनों में भुगतान करें (नियम 37) वरना क्रेडिट रिवर्स होगा।\n- GSTR-3B रिकॉर्ड को मिलान "
        "रिपोर्ट के साथ रखें।",
        is_hindi,
    )


def _advice_fallback(results: list[Any]) -> dict:
    def _has(*keys: str) -> bool:
        for r in results:
            if not isinstance(r, dict):
                continue
            for k in keys:
                v = str(r.get("mismatchType") or r.get("type") or r.get("severity") or "")
                if k in v:
                    return True
        return False

    has_missing = _has("missing", "missing_transaction")
    has_hsn = _has("hsn_mismatch", "blocked")
    has_rate = _has("rate_mismatch")

    en = "### \U0001f4cb GST ITC Advisory Report\n\n#### Issues identified\n"
    hi = "### \U0001f4cb जीएसटी ITC सलाह रिपोर्ट\n\n#### पहचानी गई समस्याएं\n"
    if has_missing:
        en += ("- **Missing vendor filings**: some invoices are absent from GSTR-2B. Under Section "
               "16(2)(aa), 100% of that ITC is blocked until the supplier uploads the matching "
               "invoice.\n")
        hi += ("- **लापता फाइलिंग**: कुछ बिल GSTR-2B में नहीं हैं। धारा 16(2)(aa) के तहत, जब तक "
               "सप्लायर बिल अपलोड नहीं करता, उस ITC का 100% अवरुद्ध रहता है।\n")
    if has_hsn:
        en += ("- **Wrong HSN classification**: a supplier filed under an ineligible HSN, blocking "
               "credit. Ask for an amended return with the correct HSN.\n")
        hi += ("- **गलत HSN वर्गीकरण**: सप्लायर ने गलत HSN पर फाइल किया, जिससे क्रेडिट अवरुद्ध है। "
               "सही HSN के साथ संशोधित रिटर्न मांगें।\n")
    if has_rate:
        en += ("- **Rate/value mismatch**: portal filing differs from your bill; you can only claim "
               "the amount the supplier actually reported.\n")
        hi += ("- **दर/मूल्य विसंगति**: पोर्टल फाइलिंग आपके बिल से अलग है; आप केवल सप्लायर द्वारा "
               "रिपोर्ट की गई राशि का दावा कर सकते हैं।\n")
    en += ("\n#### Action steps\n1. Hold the GST component of payment until the supplier amends "
           "GSTR-1.\n2. Send the ready WhatsApp reminder to each supplier.\n3. Request a GSTR-1 "
           "Table 9 amendment in writing.")
    hi += ("\n#### कदम\n1. जब तक सप्लायर GSTR-1 ठीक न करे, भुगतान का GST हिस्सा रोकें।\n2. हर सप्लायर "
           "को तैयार WhatsApp संदेश भेजें।\n3. लिखित में GSTR-1 तालिका 9 संशोधन की मांग करें।")
    return {"adviceEn": en, "adviceHi": hi}


def _strategy_fallback(is_hindi: bool) -> list[dict]:
    if is_hindi:
        return [
            {"title": "मासिक GSTR-1 फाइलिंग पर ज़ोर दें", "subtitle": "क्रेडिट दिखने में देरी कम करें",
             "description": "तिमाही (QRMP) फाइल करने वाले सप्लायर्स के कारण आपके 2B में देरी होती है। "
                            "ज़रूरी सप्लायर्स से मासिक फाइलिंग कराएं या मासिक फाइल करने वालों को प्राथमिकता दें।"},
            {"title": "180-दिन भुगतान व होल्डबैक नियम", "subtitle": "नियम 37 के दंड से बचें",
             "description": "बिल तिथि से 180 दिनों में भुगतान न करने पर ब्याज सहित ITC रिवर्स होता है। "
                            "विवादित सप्लायर्स को 10% टैक्स-बफर रोकें जब तक वे फाइलिंग ठीक न करें।"},
            {"title": "हर 14 तारीख से पहले मिलान", "subtitle": "100% अनुपालन क्रेडिट का दावा",
             "description": "GSTR-2B 14 तारीख को लॉक होता है। 10 तारीख को जांच करके आप सप्लायर को 11 "
                            "तारीख की समय सीमा से पहले सचेत कर सकते हैं।"},
        ]
    return [
        {"title": "Push suppliers to monthly GSTR-1", "subtitle": "Cut the credit-visibility lag",
         "description": "Suppliers on quarterly QRMP filing delay your 2B. Urge key suppliers to "
                        "file monthly, or prioritise buying from monthly filers to keep ITC flowing."},
        {"title": "Automate the 180-day payment rule", "subtitle": "Avoid Rule 37 reversals",
         "description": "Under Rule 37 you must reverse ITC with interest if a supplier isn't paid "
                        "within 180 days. Hold a 10% tax-buffer on disputed suppliers until they fix "
                        "their filings."},
        {"title": "Reconcile before the 14th", "subtitle": "Claim 100% compliant credit",
         "description": "GSTR-2B locks on the 14th. Checking on the 10th lets you flag missing "
                        "uploads to suppliers before their 11th-of-month GSTR-1 window closes."},
    ]


def _compare_fallback(a: dict, b: dict, is_hindi: bool) -> dict:
    rows: list[dict] = []
    disc = False

    def add(aspect: str, av: Any, bv: Any, status: str) -> None:
        rows.append({"aspect": aspect, "invoiceAVal": str(av), "invoiceBVal": str(bv), "status": status})

    name_match = str(a.get("supplierName", "")).strip().lower() == str(b.get("supplierName", "")).strip().lower()
    add(_pick("Supplier Name", "सप्लायर का नाम", is_hindi), a.get("supplierName"), b.get("supplierName"),
        "Match" if name_match else "Mismatch")
    disc = disc or not name_match

    gstin_match = str(a.get("supplierGSTIN", "")).strip().upper() == str(b.get("supplierGSTIN", "")).strip().upper()
    add("GSTIN", a.get("supplierGSTIN"), b.get("supplierGSTIN"), "Match" if gstin_match else "Mismatch")
    disc = disc or not gstin_match

    inv_dup = str(a.get("invoiceNumber", "")).strip() == str(b.get("invoiceNumber", "")).strip()
    add(_pick("Invoice Number", "इनवॉइस नंबर", is_hindi), a.get("invoiceNumber"), b.get("invoiceNumber"),
        "Warning" if inv_dup else "Match")
    disc = disc or inv_dup

    val_match = float(a.get("taxableValue", 0) or 0) == float(b.get("taxableValue", 0) or 0)
    add(_pick("Taxable Value", "कर योग्य मूल्य", is_hindi), _rupee(a.get("taxableValue")), _rupee(b.get("taxableValue")),
        "Match" if val_match else "Mismatch")
    disc = disc or not val_match

    tax_match = float(a.get("totalTax", 0) or 0) == float(b.get("totalTax", 0) or 0)
    add(_pick("Total Tax", "कुल टैक्स", is_hindi), _rupee(a.get("totalTax")), _rupee(b.get("totalTax")),
        "Match" if tax_match else "Mismatch")
    disc = disc or not tax_match

    summary = _pick(
        f"Comparison complete. {'Discrepancies found.' if disc else 'Both invoices align across key fields.'}",
        f"तुलना पूरी। {'कुछ विसंगतियाँ मिलीं।' if disc else 'दोनों बिल का मिलान सही है।'}",
        is_hindi,
    )
    audit = _pick(
        f"{'Warning: identical invoice numbers — possible duplicate filing.' if inv_dup else 'Distinct invoice numbers.'} "
        f"{'Taxable value and tax match exactly — no leakage.' if val_match and tax_match else 'Value/tax differs — may affect ITC.'}",
        f"{'चेतावनी: दोनों का बिल नंबर एक ही है — संभावित डुप्लिकेट।' if inv_dup else 'बिल नंबर अलग हैं।'} "
        f"{'मूल्य व टैक्स में पूर्ण मिलान — कोई नुकसान नहीं।' if val_match and tax_match else 'मूल्य/टैक्स में अंतर — ITC पर असर हो सकता है।'}",
        is_hindi,
    )
    return {"summary": summary, "hasDiscrepancies": disc, "comparisonList": rows, "auditObservations": audit}


def _einvoice_fallback(body: EInvoiceAlertRequest) -> dict:
    t1 = body.reported_annual_turnover_inr or 0
    t2 = body.estimated_turnover_from_invoices_inr or 0
    max_turnover = max(t1, t2)
    asked = body.user_asked_about_einvoicing

    if max_turnover >= 50000000:
        return {
            "show_alert": True,
            "alert": {
                "severity": "applies_now",
                "headline_hi": "आपको अभी e-invoice बनानी चाहिए",
                "headline_en": "E-invoicing applies to you now",
                "body_hi": "आपका turnover ₹5 करोड़ से ऊपर है, इसलिए हर B2B invoice सरकार के e-invoice portal पर register करनी जरूरी है। बिना registration के बनाई invoice को ITC के लिए valid नहीं माना जाएगा।",
                "body_en": "Your turnover is above ₹5 crore, so every B2B invoice must be registered on the government's e-invoice portal. Invoices issued without that registration are not valid for ITC claims.",
                "action_label_hi": "E-Invoice portal पर जाएं",
                "action_label_en": "Go to e-Invoice portal",
                "action_url": "https://einvoice1.gst.gov.in",
                "ca_nudge_hi": "अपने CA से कहें कि वो आपको e-invoice setup में मदद करें।",
                "ca_nudge_en": "Ask your CA to help you set up e-invoicing.",
                "disclaimer_hi": "यह app आपकी तरफ से e-invoice submit नहीं करती — portal पर जाना आपको खुद पड़ेगा।",
                "disclaimer_en": "This app does not submit e-invoices on your behalf — you'll need to register them on the portal yourself."
            }
        }
    elif max_turnover >= 40000000:
        return {
            "show_alert": True,
            "alert": {
                "severity": "approaching",
                "headline_hi": "E-Invoice की जरूरत जल्द हो सकती है",
                "headline_en": "E-invoicing may apply to you soon",
                "body_hi": "आपका सालाना turnover ₹5 करोड़ की सीमा के करीब है। अगर यह सीमा पार हुई, तो हर invoice सरकार के portal पर electronically दर्ज करनी होगी। अभी से तैयारी करना आसान रहेगा।",
                "body_en": "Your annual turnover is close to the ₹5 crore e-invoicing threshold. If you cross it, every invoice must be registered electronically on the government portal. Getting ready now will be easier than rushing later.",
                "action_label_hi": "E-Invoice portal देखें",
                "action_label_en": "Visit e-Invoice portal",
                "action_url": "https://einvoice1.gst.gov.in",
                "ca_nudge_hi": "एक बार अपने CA से बात कर लें — वो बता सकते हैं कि आपको कब से शुरू करना होगा।",
                "ca_nudge_en": "Talk to your CA — they can confirm exactly when this applies to you.",
                "disclaimer_hi": "यह app आपके लिए e-invoice नहीं बनाती — यह सिर्फ आपको सही जानकारी देती है।",
                "disclaimer_en": "This app does not generate e-invoices for you — it only helps you understand what applies to you."
            }
        }
    elif asked:
        return {
            "show_alert": True,
            "alert": {
                "severity": "informational",
                "headline_hi": "E-Invoice अभी आप पर लागू नहीं होती",
                "headline_en": "E-invoicing doesn't apply to you yet",
                "body_hi": "E-invoice वो system है जहाँ ₹5 करोड़ से ऊपर turnover वाले कारोबारियों को हर B2B invoice सरकार के portal पर electronically दर्ज करनी होती है। फिलहाल यह जरूरी नहीं है।",
                "body_en": "E-invoicing is a system where businesses with turnover above ₹5 crore must register every B2B invoice electronically with the government. It doesn't apply to you right now.",
                "action_label_hi": "E-Invoice portal देखें",
                "action_label_en": "Learn more on portal",
                "action_url": "https://einvoice1.gst.gov.in",
                "ca_nudge_hi": "अगर आप चाहते हैं तो CA से पूछ सकते हैं कि भविष्य में कब लागू होगी।",
                "ca_nudge_en": "Your CA can tell you when this might apply to you in the future.",
                "disclaimer_hi": "यह app e-invoice नहीं बनाती — सिर्फ जानकारी देती है।",
                "disclaimer_en": "This app does not generate e-invoices — it only provides information."
            }
        }
    
    return {"show_alert": False, "alert": None}


# ---------------------------------------------------------------------------
# 6. Place-of-Supply Mismatch Detector (F12)
# ---------------------------------------------------------------------------

STATE_CODES = {
    "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
    "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
    "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
    "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
    "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "26": "Dadra & Nagar Haveli", "27": "Maharashtra", "28": "Andhra Pradesh", "29": "Karnataka",
    "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
    "35": "Andaman & Nicobar", "36": "Telangana", "37": "Andhra Pradesh (New)", "38": "Ladakh",
    "97": "Other Territory"
}
UT_CODES = {"04", "26", "31", "34", "35", "38"}

def normalize_state_code(raw: str | None) -> str | None:
    if not raw:
        return None
    raw = raw.strip().upper()
    if len(raw) >= 2 and raw[:2].isdigit():
        code = raw[:2]
        if code in STATE_CODES:
            return code
    raw_lower = raw.lower()
    for code, name in STATE_CODES.items():
        if name.lower() in raw_lower or raw_lower in name.lower():
            return code
    return None

def _pos_fallback(invoice: PosInvoicePayload, trader: PosTraderPayload) -> dict:
    supplier_gstin = invoice.supplier_gstin or ""
    supplier_state = supplier_gstin[:2] if len(supplier_gstin) >= 2 else "unknown"
    trader_state = trader.registered_state_code
    pos_raw = invoice.place_of_supply_raw
    pos_resolved = normalize_state_code(pos_raw)
    actual_tax = invoice.tax_type
    total_itc = invoice.total_itc_value
    
    if not pos_resolved:
        return {
            "invoice_number": invoice.invoice_number,
            "pos_status": "unreadable",
            "supplier_state_code": supplier_state,
            "pos_resolved": None,
            "trader_state_code": trader_state,
            "expected_tax_type": "UNKNOWN",
            "actual_tax_type": actual_tax,
            "mismatch_result": "POS_UNREADABLE",
            "itc_at_risk_inr": total_itc,
            "verdict": {
                "ims_action": "VERIFY",
                "is_recoverable": None,
                "headline_hi": f"{invoice.supplier_name} — Place of Supply पढ़ नहीं पाए",
                "headline_en": f"{invoice.supplier_name} — couldn't read Place of Supply",
                "reason_hi": "Supplier और आपका state अलग है — tax type verify करना जरूरी है। Bill में 'Place of Supply' clearly नहीं लिखा था।",
                "reason_en": "Supplier and your state differ — tax type needs verification. The Place of Supply field wasn't clearly readable on the invoice.",
                "action_instruction_hi": "Invoice देखें — अगर 'Place of Supply' आपके state में है तो IGST होनी चाहिए थी।",
                "action_instruction_en": "Check the invoice — if Place of Supply is your state, IGST should have been charged.",
                "supplier_message_draft_hi": None,
                "supplier_message_draft_en": None
            }
        }
    
    expected_tax = "UNKNOWN"
    if supplier_state == pos_resolved == trader_state:
        expected_tax = "CGST_UTGST" if pos_resolved in UT_CODES else "CGST_SGST"
    elif supplier_state == pos_resolved and trader_state != pos_resolved:
        expected_tax = "IGST"
    else:
        expected_tax = "IGST"
        
    mismatch_result = "MATCH"
    if expected_tax == actual_tax:
        mismatch_result = "MATCH"
    elif expected_tax == "IGST" and actual_tax in ("CGST_SGST", "CGST_UTGST"):
        mismatch_result = "MISMATCH_NEEDS_IGST"
    elif expected_tax in ("CGST_SGST", "CGST_UTGST") and actual_tax == "IGST":
        mismatch_result = "MISMATCH_NEEDS_CGST_SGST"
    elif actual_tax == "UNKNOWN":
        mismatch_result = "TAX_TYPE_UNKNOWN"

    if mismatch_result == "MATCH":
        return {
            "invoice_number": invoice.invoice_number,
            "pos_status": "resolved",
            "supplier_state_code": supplier_state,
            "pos_resolved": pos_resolved,
            "trader_state_code": trader_state,
            "expected_tax_type": expected_tax,
            "actual_tax_type": actual_tax,
            "mismatch_result": mismatch_result,
            "itc_at_risk_inr": 0,
            "verdict": {
                "ims_action": "ACCEPT",
                "is_recoverable": None,
                "headline_hi": f"{invoice.supplier_name} — tax सही है",
                "headline_en": f"{invoice.supplier_name} — tax type is correct",
                "reason_hi": "Supplier और आपके state के हिसाब से tax type सही है। ITC claim कर सकते हैं।",
                "reason_en": "Tax type is correct based on the states. You can claim this ITC.",
                "action_instruction_hi": "IMS portal पर Accept करें।",
                "action_instruction_en": "Accept this invoice on the IMS portal.",
                "supplier_message_draft_hi": None,
                "supplier_message_draft_en": None
            }
        }
    elif mismatch_result == "MISMATCH_NEEDS_IGST":
        return {
            "invoice_number": invoice.invoice_number,
            "pos_status": "resolved",
            "supplier_state_code": supplier_state,
            "pos_resolved": pos_resolved,
            "trader_state_code": trader_state,
            "expected_tax_type": expected_tax,
            "actual_tax_type": actual_tax,
            "mismatch_result": mismatch_result,
            "itc_at_risk_inr": total_itc,
            "verdict": {
                "ims_action": "REJECT",
                "is_recoverable": True,
                "headline_hi": f"{invoice.supplier_name} ने गलत tax लगाया है",
                "headline_en": f"{invoice.supplier_name} charged the wrong tax type",
                "reason_hi": f"यह bill {STATE_CODES.get(supplier_state, 'दूसरे state')} से आई है, लेकिन आपका business {STATE_CODES.get(trader_state, 'आपके state')} में है — इस पर IGST होना चाहिए था, CGST+SGST नहीं। ₹{total_itc:,.0f} की ITC claim नहीं होगी।",
                "reason_en": f"This invoice came from {STATE_CODES.get(supplier_state, 'another state')}, but your business is in {STATE_CODES.get(trader_state, 'your state')} — it should have been charged IGST. ₹{total_itc:,.0f} of ITC will be blocked.",
                "action_instruction_hi": f"{invoice.supplier_name} से कहें कि IGST वाली amended invoice भेजें।",
                "action_instruction_en": f"Ask {invoice.supplier_name} to issue an amended invoice with IGST.",
                "supplier_message_draft_hi": f"नमस्ते, Invoice {invoice.invoice_number} में CGST+SGST लगाया है, लेकिन हमारा business {STATE_CODES.get(trader_state, '')} में है और supply {STATE_CODES.get(pos_resolved, '')} से आई है — यहाँ IGST लगनी चाहिए थी। क्या आप amended invoice भेज सकते हैं? हमारी ₹{total_itc:,.0f} की ITC इस पर depend करती है। धन्यवाद।",
                "supplier_message_draft_en": f"Hello, Invoice {invoice.invoice_number} has CGST+SGST applied, but our business is in {STATE_CODES.get(trader_state, '')} and the supply came from {STATE_CODES.get(pos_resolved, '')} — IGST should have been charged. Could you please issue an amended invoice? ₹{total_itc:,.0f} of our ITC depends on this. Thank you."
            }
        }
    elif mismatch_result == "MISMATCH_NEEDS_CGST_SGST":
        return {
            "invoice_number": invoice.invoice_number,
            "pos_status": "resolved",
            "supplier_state_code": supplier_state,
            "pos_resolved": pos_resolved,
            "trader_state_code": trader_state,
            "expected_tax_type": expected_tax,
            "actual_tax_type": actual_tax,
            "mismatch_result": mismatch_result,
            "itc_at_risk_inr": total_itc,
            "verdict": {
                "ims_action": "REJECT",
                "is_recoverable": True,
                "headline_hi": f"{invoice.supplier_name} ने गलत tax लगाया है",
                "headline_en": f"{invoice.supplier_name} charged the wrong tax type",
                "reason_hi": f"यह supply {STATE_CODES.get(pos_resolved, 'state')} के अंदर ही हुई है — इस पर CGST+SGST होना चाहिए था, IGST नहीं। ₹{total_itc:,.0f} की ITC claim नहीं होगी।",
                "reason_en": f"This is an intra-state supply within {STATE_CODES.get(pos_resolved, 'the state')}. It should have been charged CGST+SGST, not IGST. ₹{total_itc:,.0f} of ITC will be blocked.",
                "action_instruction_hi": f"{invoice.supplier_name} से कहें कि CGST+SGST वाली amended invoice भेजें।",
                "action_instruction_en": f"Ask {invoice.supplier_name} to issue an amended invoice with CGST+SGST.",
                "supplier_message_draft_hi": f"नमस्ते, Invoice {invoice.invoice_number} में IGST लगाया है, लेकिन यह supply {STATE_CODES.get(supplier_state, '')} के अंदर ही हुई है — CGST+SGST लगनी चाहिए थी। क्या आप amended invoice भेज सकते हैं? हमारी ₹{total_itc:,.0f} की ITC इस पर depend करती है। धन्यवाद।",
                "supplier_message_draft_en": f"Hello, Invoice {invoice.invoice_number} has IGST applied, but this is an intra-state supply within {STATE_CODES.get(supplier_state, '')} — CGST+SGST should have been charged. Could you please issue an amended invoice? ₹{total_itc:,.0f} of our ITC depends on this. Thank you."
            }
        }
    
    return {} # TAX_TYPE_UNKNOWN or fallback

@router.post("/api/pos-mismatch-batch")
async def pos_mismatch_batch(body: PosMismatchBatchRequest) -> dict:
    results = []
    # For the hackathon, we use the deterministic offline fallback directly as it handles state code mapping reliably.
    for invoice in body.invoices:
        res = _pos_fallback(invoice, body.trader)
        if res:
            results.append(res)
            
    return {
        "success": True,
        "method": "fallback",
        "results": results
    }

# ---------------------------------------------------------------------------
# F13: Section 17(5) Blocked-Credit Detector
# ---------------------------------------------------------------------------

def _f13_fallback(invoice: F13InvoicePayload, trader: F13TraderPayload, lang: str = "hi") -> dict:
    import re
    # HSN and keyword matching
    is_hi = lang == "hi"
    
    # 1. Gather all texts
    text_corpus = (
        f"{invoice.ocr_raw_text} "
        f"{' '.join(item.description for item in invoice.line_items)} "
        f"{invoice.supplier_name}"
    ).lower()
    
    hsn_codes = set(invoice.hsn_sac_codes)
    for item in invoice.line_items:
        if item.hsn_sac:
            hsn_codes.add(item.hsn_sac)
            
    trader_biz = (trader.business_description or "").lower()
    
    # Check Food & Beverage
    if any(hsn.startswith("9963") for hsn in hsn_codes) or any(k in text_corpus for k in ["restaurant", "dhaba", "food", "meal", "catering", "lunch", "dinner", "snacks", "refreshment"]):
        # It could be accommodation if 9963, but let's check keywords for accommodation
        if "room" in text_corpus and "meal" in text_corpus:
            return {
                "invoice_number": invoice.invoice_number,
                "s17_5_flag": "FLAGGED",
                "category": "Hotel — Room + Meals (mixed, meals portion may be blocked)",
                "category_code": "FOOD_BEVERAGE",
                "confidence": "LOW",
                "carve_out_possible": True,
                "carve_out_reason": "Hotel accommodation itself is not a blocked category under Section 17(5). Only the food and beverage portion is blocked.",
                "total_itc_at_question_inr": invoice.total_itc_value,
                "verdict_copy": {
                    "caution_strip_hi": f"⚠️ ₹{invoice.total_itc_value:,.0f} की ITC — hotel के इस bill पर CA से check करें",
                    "caution_strip_en": f"⚠️ ₹{invoice.total_itc_value:,.0f} ITC on this hotel bill — check with CA",
                    "expanded_explanation_hi": "इस hotel bill में room और meals दोनों एक साथ हैं। Room पर ITC मिल सकती है — लेकिन खाने वाले हिस्से पर Section 17(5) के under ITC blocked हो सकती है।",
                    "expanded_explanation_en": "This hotel invoice bundles accommodation and meals together. ITC on the room itself may be claimable, but the food and beverage portion is likely blocked under Section 17(5).",
                    "ca_verify_prompt_hi": "CA से पूछें: इस combined room+meals bill पर कितनी ITC safely claim हो सकती है?",
                    "ca_verify_prompt_en": "Ask your CA: How much ITC can safely be claimed on this invoice that bundles room and meal charges together?"
                }
            }
        
        carve_out = any(k in trader_biz for k in ["restaurant", "canteen", "catering", "food", "hotel"])
        return {
            "invoice_number": invoice.invoice_number,
            "s17_5_flag": "FLAGGED",
            "category": "Restaurant / Food & Beverage",
            "category_code": "FOOD_BEVERAGE",
            "confidence": "MEDIUM" if carve_out or not trader_biz else "HIGH",
            "carve_out_possible": carve_out or not trader_biz,
            "carve_out_reason": "If your business itself provides outdoor catering services, ITC may be claimable." if (carve_out or not trader_biz) else None,
            "total_itc_at_question_inr": invoice.total_itc_value,
            "verdict_copy": {
                "caution_strip_hi": f"⚠️ ₹{invoice.total_itc_value:,.0f} की ITC इस restaurant/food bill पर शायद नहीं मिलेगी",
                "caution_strip_en": f"⚠️ ₹{invoice.total_itc_value:,.0f} ITC on this restaurant/food bill is likely blocked",
                "expanded_explanation_hi": f"खाने-पीने के bills पर ITC Section 17(5) के under blocked होती है। इस पर ₹{invoice.total_itc_value:,.0f} की ITC आपको नहीं मिलेगी, जब तक कि आपका खुद का food business न हो।",
                "expanded_explanation_en": f"ITC on food and beverage services is blocked under Section 17(5). The ₹{invoice.total_itc_value:,.0f} ITC on it is not claimable unless your business provides food services.",
                "ca_verify_prompt_hi": "CA से पूछें: क्या मेरे business को food/restaurant bills पर ITC मिल सकती है?",
                "ca_verify_prompt_en": "Ask your CA: Can my business claim ITC on restaurant and food bills like this one?"
            }
        }
        
    # Check Motor Vehicle
    if any(hsn.startswith(("8703", "8711")) for hsn in hsn_codes) or any(k in text_corpus for k in ["car", "vehicle", "suv", "sedan", "bike", "scooter", "two-wheeler"]):
        carve_out = any(k in trader_biz for k in ["transport", "logistics", "cab", "dealer", "school", "driving"])
        return {
            "invoice_number": invoice.invoice_number,
            "s17_5_flag": "FLAGGED",
            "category": "Motor Vehicle",
            "category_code": "MOTOR_VEHICLE",
            "confidence": "MEDIUM" if carve_out or not trader_biz else "HIGH",
            "carve_out_possible": True,
            "carve_out_reason": "If the trader's business involves further supply of vehicles, transportation of persons/goods, or driving training, ITC may be claimable.",
            "total_itc_at_question_inr": invoice.total_itc_value,
            "verdict_copy": {
                "caution_strip_hi": f"⚠️ ₹{invoice.total_itc_value:,.0f} की ITC — vehicle/car के bills पर CA से confirm करें",
                "caution_strip_en": f"⚠️ ₹{invoice.total_itc_value:,.0f} ITC on this vehicle — verify with CA before claiming",
                "expanded_explanation_hi": "गाड़ियों पर ITC Section 17(5) के under आमतौर पर नहीं मिलती। लेकिन अगर आप गाड़ियाँ बेचते हैं, transport business चलाते हैं, या driving school चलाते हैं — तो ITC मिल सकती है।",
                "expanded_explanation_en": "ITC on motor vehicles is generally blocked under Section 17(5). However, if your business involves selling vehicles, transporting goods/passengers, or running a driving school, the block does not apply.",
                "ca_verify_prompt_hi": f"CA से पूछें: मेरे business में खरीदी गाड़ी पर ₹{invoice.total_itc_value:,.0f} की ITC मिल सकती है?",
                "ca_verify_prompt_en": f"Ask your CA: Can I claim ₹{invoice.total_itc_value:,.0f} ITC on this vehicle purchase, given my business type?"
            }
        }
        
    # Check Gym/Club
    if any(k in text_corpus for k in ["gym", "fitness", "club membership", "health club", "sports club"]):
        return {
            "invoice_number": invoice.invoice_number,
            "s17_5_flag": "FLAGGED",
            "category": "Club / Fitness Centre Membership",
            "category_code": "CLUB_MEMBERSHIP",
            "confidence": "HIGH",
            "carve_out_possible": False,
            "carve_out_reason": None,
            "total_itc_at_question_inr": invoice.total_itc_value,
            "verdict_copy": {
                "caution_strip_hi": f"⚠️ ₹{invoice.total_itc_value:,.0f} की ITC इस gym/club membership पर नहीं मिलेगी",
                "caution_strip_en": f"⚠️ ₹{invoice.total_itc_value:,.0f} ITC on this gym/club membership is blocked",
                "expanded_explanation_hi": "Club, gym, और fitness centre की membership पर ITC Section 17(5) के under पूरी तरह blocked है — इसमें कोई exception नहीं है।",
                "expanded_explanation_en": "ITC on club and fitness centre memberships is completely blocked under Section 17(5) — there are no exceptions to this rule.",
                "ca_verify_prompt_hi": "CA से पूछें: Gym/club membership fee को business expense दिखाया जा सकता है, भले ही ITC न मिले?",
                "ca_verify_prompt_en": "Ask your CA: Can the gym/club membership be recorded as a business expense even if ITC cannot be claimed?"
            }
        }
        
    # Rent a cab
    if any(k in text_corpus for k in ["cab", "taxi", "ola", "uber", "rent-a-cab"]):
        return {
            "invoice_number": invoice.invoice_number,
            "s17_5_flag": "FLAGGED",
            "category": "Rent-a-Cab Service",
            "category_code": "RENT_A_CAB",
            "confidence": "HIGH",
            "carve_out_possible": True,
            "carve_out_reason": "If obligatory under any law or if business is rent-a-cab.",
            "total_itc_at_question_inr": invoice.total_itc_value,
            "verdict_copy": {
                "caution_strip_hi": f"⚠️ ₹{invoice.total_itc_value:,.0f} की ITC taxi/cab service पर नहीं मिलेगी",
                "caution_strip_en": f"⚠️ ₹{invoice.total_itc_value:,.0f} ITC on this cab service is blocked",
                "expanded_explanation_hi": "Taxi और rent-a-cab services पर ITC Section 17(5) के under blocked होती है, जब तक कि यह किसी कानून के तहत अनिवार्य न हो।",
                "expanded_explanation_en": "ITC on rent-a-cab services is blocked under Section 17(5) unless it is obligatory under any law.",
                "ca_verify_prompt_hi": "CA से पूछें: क्या cab/taxi service पर ITC claim हो सकती है?",
                "ca_verify_prompt_en": "Ask your CA: Can I claim ITC on this cab service?"
            }
        }

    return {
        "invoice_number": invoice.invoice_number,
        "s17_5_flag": "NONE",
        "category": None,
        "category_code": None,
        "confidence": None,
        "carve_out_possible": None,
        "carve_out_reason": None,
        "total_itc_at_question_inr": None,
        "verdict_copy": {
            "caution_strip_hi": None,
            "caution_strip_en": None,
            "expanded_explanation_hi": None,
            "expanded_explanation_en": None,
            "ca_verify_prompt_hi": None,
            "ca_verify_prompt_en": None
        }
    }


@router.post("/api/blocked-credit")
async def check_blocked_credit(body: F13Request) -> dict:
    # Use fallback logic which evaluates rules
    res = _f13_fallback(body.invoice, body.trader, body.ui_language)
    return {
        "success": True,
        "method": "fallback",
        "data": res
    }
