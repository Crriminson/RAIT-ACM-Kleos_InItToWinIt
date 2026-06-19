from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from rag.config import get_llm, get_embedder, get_vectorstore
from rag.pipeline import RAGPipeline

router = APIRouter(prefix="/api/rag", tags=["RAG"])


class QueryRequest(BaseModel):
    question: str
    top_k: int = 5


class IngestRequest(BaseModel):
    text: str
    doc_id: str
    source: str = "unknown"


class IngestDocumentRequest(BaseModel):
    text: str
    source: str
    chunk_size: int = 500
    overlap: int = 50


@router.post("/query")
async def query(req: QueryRequest):
    pipeline = RAGPipeline(get_llm(), get_embedder(), get_vectorstore())
    try:
        result = await pipeline.query(req.question, top_k=req.top_k)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ingest")
async def ingest(req: IngestRequest):
    pipeline = RAGPipeline(get_llm(), get_embedder(), get_vectorstore())
    try:
        await pipeline.ingest_text(
            text=req.text,
            doc_id=req.doc_id,
            metadata={"source": req.source},
        )
        return {"status": "ingested", "doc_id": req.doc_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ingest-document")
async def ingest_document(req: IngestDocumentRequest):
    pipeline = RAGPipeline(get_llm(), get_embedder(), get_vectorstore())
    try:
        result = await pipeline.ingest_document(
            text=req.text,
            source=req.source,
            chunk_size=req.chunk_size,
            overlap=req.overlap,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def rag_health():
    llm = get_llm()
    ok = await llm.health_check()
    store = get_vectorstore()
    return {
        "llm_provider": type(llm).__name__,
        "healthy": ok,
        "docs_indexed": store.count(),
    }
