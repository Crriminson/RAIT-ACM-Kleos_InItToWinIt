# SUPERSEDED — planted-cases.md

> **This file is stale and has been retired.**

The planted-case test scenarios described here were part of early ideation and are no longer maintained.

**Ground truth for test data:**
- Sample invoice images: `backend/tests/test-images/`
- GSTR-2B test CSV files: `app/test-csv/`
- Backend test suite: `backend/tests/test_ocr.py`, `backend/tests/test_extractor.py`

Do not add new test cases here. Add them to the backend test fixtures or the app's mock data in
`app/src/data/mock-invoices.ts` and `app/src/data/mock-gstr2b.ts`.
