from __future__ import annotations

from .providers.base import BaseLLMProvider
from .embedders.base import BaseEmbedder
from .vectorstore import VectorStore
from .ingestion import chunk_text

SYSTEM_PROMPT = (
    "You are a helpful GST compliance assistant for the KLEOS app — "
    "\"CA in Your Pocket\" for Indian kirana store owners. "
    "Answer questions based ONLY on the provided context. "
    "If the context doesn't contain the answer, say "
    "\"I don't have enough information about that.\" "
    "Be concise, accurate, and use simple Hindi/English that a shop owner can understand."
)


class RAGPipeline:
    def __init__(self, llm: BaseLLMProvider, embedder: BaseEmbedder, store: VectorStore):
        self.llm = llm
        self.embedder = embedder
        self.store = store

    async def query(self, user_question: str, top_k: int = 5) -> dict:
        q_embedding = await self.embedder.embed(user_question)
        chunks = self.store.search(q_embedding.vector, top_k=top_k)

        if not chunks:
            context = "No specific context found."
        else:
            context = "\n\n---\n\n".join(
                f"[Source: {c['metadata'].get('source', 'unknown')}]\n{c['text']}"
                for c in chunks
            )

        prompt = f"""Context:
{context}

Question: {user_question}

Answer based on the context above:"""

        response = await self.llm.complete(
            prompt=prompt,
            system_prompt=SYSTEM_PROMPT,
            max_tokens=512,
            temperature=0.2,
        )

        return {
            "answer": response.text,
            "sources": [c["metadata"].get("source") for c in chunks],
            "model": response.model,
            "tokens": response.tokens_used,
            "chunks_retrieved": len(chunks),
        }

    async def ingest_text(self, text: str, doc_id: str, metadata: dict | None = None):
        embedding = await self.embedder.embed(text)
        self.store.upsert(
            doc_id=doc_id,
            text=text,
            embedding=embedding.vector,
            metadata=metadata or {},
        )

    async def ingest_document(self, text: str, source: str, chunk_size: int = 500, overlap: int = 50):
        chunks = chunk_text(text, chunk_size=chunk_size, overlap=overlap)
        for i, chunk in enumerate(chunks):
            doc_id = f"{source}::chunk_{i}"
            await self.ingest_text(
                text=chunk,
                doc_id=doc_id,
                metadata={"source": source, "chunk_index": i},
            )
        return {"chunks_ingested": len(chunks), "source": source}
