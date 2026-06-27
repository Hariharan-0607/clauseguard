"""Application settings, loaded from environment variables.

All AI runs free: AI_PROVIDER=ollama locally, AI_PROVIDER=groq when deployed.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- AI provider switch (both free) ---
    ai_provider: str = "ollama"          # "ollama" (local) | "groq" (deployed)
    groq_api_key: str = ""
    groq_model: str = "llama-3.1-8b-instant"
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3"

    # --- Vector store (ChromaDB) — powers RAG / Personal Legal Agent ---
    # When unset, the app falls back to an in-memory stub so tests/MVP keep working.
    chroma_url: str = ""                  # e.g. "http://localhost:8001"
    chroma_collection_prefix: str = "justiceai"
    embedding_provider: str = "auto"      # auto | ollama | hash (hash = dep-free fallback)

    # --- Database (Postgres in Docker; sqlite for local/tests) ---
    database_url: str = "sqlite:///./clauseguard.db"

    # --- Auth ---
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"

    # --- CORS ---
    frontend_origin: str = "*"

    # When true, ai.py returns deterministic stub output (used by tests / offline demo)
    ai_mock: bool = False


settings = Settings()
