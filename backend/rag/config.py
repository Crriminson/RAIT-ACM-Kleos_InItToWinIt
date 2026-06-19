import os

from .providers.gemini import GeminiProvider
from .providers.groq_provider import GroqProvider
from .providers.ollama import OllamaProvider
from .providers.openai_compat import OpenAICompatProvider
from .embedders.chroma_default import ChromaDefaultEmbedder
from .embedders.gemini_embed import GeminiEmbedder
from .embedders.local_embed import LocalEmbedder
from .vectorstore import VectorStore

LLM_PROVIDER = os.getenv("RAG_LLM_PROVIDER", "gemini")
EMBEDDER_PROVIDER = os.getenv("RAG_EMBEDDER_PROVIDER", "chroma")


def get_llm():
    match LLM_PROVIDER:
        case "gemini":
            return GeminiProvider(model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"))
        case "groq":
            return GroqProvider(model="llama-3.1-8b-instant")
        case "ollama":
            return OllamaProvider(
                base_url=os.getenv("OLLAMA_HOST", "http://localhost:11434"),
                model="llama3.2:3b",
            )
        case "openai":
            return OpenAICompatProvider()
        case _:
            raise ValueError(f"Unknown RAG LLM provider: {LLM_PROVIDER}")


def get_embedder():
    match EMBEDDER_PROVIDER:
        case "chroma":
            return ChromaDefaultEmbedder()
        case "gemini":
            return GeminiEmbedder()
        case "local":
            return LocalEmbedder()
        case _:
            raise ValueError(f"Unknown RAG embedder: {EMBEDDER_PROVIDER}")


def get_vectorstore():
    return VectorStore()
