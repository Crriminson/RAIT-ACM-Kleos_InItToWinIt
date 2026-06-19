"""
core/reason_texts.py — Centralized Rationale & Action Text Library

Provides Hindi and English strings for the various mismatch scenarios,
along with mock TTS audio URLs.
"""
from __future__ import annotations

from dataclasses import dataclass
from core.matcher import MatchResult
from models.extraction import ExtractedInvoice
from models.mismatch import MismatchType
from core.bhashini import generate_tts, translate_en_to_hi

@dataclass
class Rationale:
    reason_en: str
    reason_hi: str
    action_en: str
    action_hi: str
    tts_url_en: str
    tts_url_hi: str

def get_rationale(match: MatchResult, invoice: ExtractedInvoice) -> Rationale:
    mt = match.mismatch_type
    supplier = invoice.supplier_name or invoice.supplier_gstin
    itc_formatted = f"₹{match.itc_at_risk:,.0f}"

    if mt == MismatchType.MISSING_TRANSACTION:
        reason_en = f"{supplier} has not filed this invoice (#{invoice.invoice_number}) in their GSTR-1, so it does not appear in your GSTR-2B. ITC of {itc_formatted} is blocked."
        reason_hi = f"{supplier} ने यह invoice (#{invoice.invoice_number}) अभी तक GST portal पर file नहीं की है। {itc_formatted} की ITC अटकी हुई है।"
        action_en = "Contact your supplier — they haven't filed this invoice yet."
        action_hi = "अपने supplier से संपर्क करें — उन्होंने यह invoice अभी तक file नहीं की है।"
        
    elif mt == MismatchType.HSN_MISMATCH:
        reason_en = f"The HSN code on your invoice from {supplier} does not match what they reported in GSTR-2B. {itc_formatted} ITC is blocked until corrected."
        reason_hi = f"{supplier} ने गलत HSN कोड लगाया है। {itc_formatted} की ITC इसकी वजह से अटकी है।"
        action_en = "Ask your supplier to correct the HSN code and file an amendment."
        action_hi = "अपने supplier से HSN कोड सही करवाकर amended return file करवाएं।"

    elif mt == MismatchType.RATE_MISMATCH:
        detail = f" ({match.delta_detail})" if match.delta_detail else ""
        reason_en = f"Tax rate differs between your invoice and GSTR-2B for {supplier}{detail}. {itc_formatted} ITC is at risk — hold and request an amendment."
        reason_hi = f"{supplier} के invoice में tax rate में फ़र्क दिख रहा है। {itc_formatted} ITC पर असर है।"
        action_en = "Verify the rate with your supplier."
        action_hi = "Supplier से invoice verify करवाएं और सही rate confirm करें।"

    elif mt == MismatchType.TAX_AMOUNT_DELTA:
        detail = f" ({match.delta_detail})" if match.delta_detail else ""
        reason_en = f"Tax amounts differ by more than 1% between your invoice and GSTR-2B for {supplier}{detail}. {itc_formatted} ITC is at risk."
        reason_hi = f"{supplier} के invoice और GSTR-2B में tax amount मेल ক্যাম नहीं खा रहा है। {itc_formatted} ITC पर असर है।"
        action_en = "Re-check the tax calculation with the supplier."
        action_hi = "Supplier के साथ tax calculation दोबारा चेक करें।"

    elif mt == MismatchType.POS_MISMATCH:
        reason_en = f"Place of Supply mismatch — the state code on the invoice from {supplier} does not match what they filed in GSTR-2B. {itc_formatted} ITC is blocked until amended."
        reason_hi = f"{supplier} के invoice का Place of Supply गलत file हुआ है। {itc_formatted} की ITC अटकी है।"
        action_en = "Ask the supplier to correct the Place of Supply."
        action_hi = "Supplier से Place of Supply सही करवाएं।"

    elif mt == MismatchType.BLOCKED_CREDIT_17_5:
        reason_en = f"This invoice from {supplier} appears to be a blocked credit under Section 17(5) (e.g., motor vehicles/food). Consult your CA before claiming this {itc_formatted} ITC."
        reason_hi = f"यह invoice Section 17(5) के तहत blocked credit की तरह लग रही है। {itc_formatted} ITC क्लेम करने से पहले CA से बात करें।"
        action_en = "Consult your CA before claiming this ITC."
        action_hi = "Claim करने से पहले अपने CA से सलाह लें।"

    else:
        # CLEAN_MATCH
        reason_en = f"Invoice #{invoice.invoice_number} from {supplier} matches GSTR-2B exactly. ITC is claimable."
        reason_hi = f"{supplier} की invoice (#{invoice.invoice_number}) सही match हो गई है। ITC क्लेम कर सकते हैं।"
        action_en = "No action needed — ITC is safe. Accept on IMS portal."
        action_hi = "कोई कार्रवाई नहीं — ITC सुरक्षित है। IMS पोर्टल पर Accept करें।"

    return Rationale(
        reason_en=reason_en,
        reason_hi=reason_hi,
        action_en=action_en,
        action_hi=action_hi,
        tts_url_en=generate_tts(reason_en, "en"),
        tts_url_hi=generate_tts(reason_hi, "hi"),
    )
