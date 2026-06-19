from .base import BaseEmbedder, EmbeddingResponse


class ChromaDefaultEmbedder(BaseEmbedder):

    def __init__(self):
        from chromadb.utils.embedding_functions import DefaultEmbeddingFunction
        self._fn = DefaultEmbeddingFunction()
        self._dim = 384

    async def embed(self, text: str) -> EmbeddingResponse:
        vecs = self._fn([text])
        return EmbeddingResponse(vector=[float(v) for v in vecs[0]], model="all-MiniLM-L6-v2")

    @property
    def dimension(self) -> int:
        return self._dim
