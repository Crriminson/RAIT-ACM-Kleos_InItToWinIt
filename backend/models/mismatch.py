"""Mismatch reason types for the reconciliation engine."""
from enum import Enum


class MismatchType(str, Enum):
    """
    Possible outcomes when matching an extracted invoice against GSTR-2B.

    These must stay in exact parity with the TypeScript enum in
    app/src/data/matching-engine.ts.  If you change one, change both.
    """
    MISSING_TRANSACTION = "MISSING_TRANSACTION"  # no GSTIN+invoice match in 2B
    POS_MISMATCH        = "POS_MISMATCH"         # Place of Supply mismatch
    HSN_MISMATCH        = "HSN_MISMATCH"         # HSN code sets differ
    RATE_MISMATCH       = "RATE_MISMATCH"         # tax rate differs
    TAX_AMOUNT_DELTA    = "TAX_AMOUNT_DELTA"      # tax amounts differ > 1%
    BLOCKED_CREDIT_17_5 = "BLOCKED_CREDIT_17_5"   # Section 17(5) blocked credit (e.g. motor vehicles)
    CLEAN_MATCH         = "CLEAN_MATCH"           # all checks pass
