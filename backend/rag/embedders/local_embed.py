import asyncio

from .base import BaseEmbedder, EmbeddingResponse


class LocalEmbedder(BaseEmbedder):

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        from sentence_transformers import SentenceTransformer

        self._model = SentenceTransformer(model_name)
        self._dim = self._model.get_sentence_embedding_dimension()

    async def embed(self, text: str) -> EmbeddingResponse:
        loop = asyncio.get_event_loop()
        vec = await loop.run_in_executor(
            None, lambda: self._model.encode(text).tolist()
        )
        return EmbeddingResponse(vector=vec, model="all-MiniLM-L6-v2")

    @property
    def dimension(self) -> int:
        return self._dim
