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


# ---------------------------------------------------------------------------
# 1. Ask-a-CA Q&A
# ---------------------------------------------------------------------------

@router.post("/api/gst-doubt")
async def gst_doubt(body: GstDoubtRequest) -> dict:
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
        return {"success": True, "method": "gemini", "answer": answer}
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
async def ai_advice(body: AiAdviceRequest) -> dict:
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
async def tax_planning(body: TaxPlanningRequest) -> dict:
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
