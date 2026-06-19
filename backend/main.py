import logging

from dotenv import load_dotenv

# Load backend/.env (GEMINI_API_KEY, etc.) before any module reads os.environ.
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import invoices as invoices_router
from api.routes import analyze_compat
from api.routes import ai as ai_router
from core import gemini
from db.session import Base, engine

logging.basicConfig(level=logging.INFO)

# Create DB tables on startup (Alembic handles migrations in prod;
# this is a convenience for the hackathon SQLite dev environment).
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="KLEOS D4-PS1 Backend",
    description=(
        "OCR → extraction → reconciliation pipeline for "
        '"CA in Your Pocket" — KLEOS 2026 hackathon.'
    ),
    version="1.0.0",
)

# CORS — open for hackathon/development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(invoices_router.router, prefix="/api/v1")
app.include_router(analyze_compat.router)  # app-compatible JSON endpoint at /api/analyze-invoice
app.include_router(ai_router.router)       # app-compatible AI endpoints (gst-doubt, ai-advice, ...)





@app.get("/api/health", tags=["meta"])
async def health_check_alias():
    """Alias for /api/v1/health — the RN app calls /api/health."""
    return {"status": "ok", "service": "kleos-backend", "version": "1.0.0",
            "ok": True, "model": gemini.MODEL, "geminiConfigured": gemini.has_key()}


@app.get("/api/v1/health", tags=["meta"])
async def health_check():
    return {
        "status": "ok",
        "service": "kleos-backend",
        "version": "1.0.0",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
