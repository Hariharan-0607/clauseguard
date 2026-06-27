"""Vector store abstraction over ChromaDB (powers RAG for the Personal Legal Agent).

Design goals:
  - Real ChromaDB when CHROMA_URL is set (Docker / deployed).
  - A deterministic in-memory cosine-similarity fallback when it isn't, so tests
    and the offline MVP keep working with zero external services.
  - Embeddings: Ollama if available, else a dependency-free hashing embedder
    (good enough for retrieval smoke tests; swap for a real model in prod).

The public API (`add`, `query`, `delete_namespace`) is stable across backends.
"""
from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass
from typing import Optional

import requests

from app.config import settings

_EMBED_DIM = 256


# --------------------------------------------------------------------------- #
#  Embeddings
# --------------------------------------------------------------------------- #
def _hash_embed(text: str) -> list[float]:
    """Cheap, deterministic embedding: token hashing into a fixed vector.

    Not semantically strong, but stable and dependency-free — used as a fallback
    so RAG plumbing is testable without a model server.
    """
    vec = [0.0] * _EMBED_DIM
    for tok in text.lower().split():
        h = int(hashlib.md5(tok.encode()).hexdigest(), 16)
        vec[h % _EMBED_DIM] += 1.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def _ollama_embed(text: str) -> Optional[list[float]]:
    try:
        r = requests.post(
            f"{settings.ollama_url}/api/embeddings",
            json={"model": settings.ollama_model, "prompt": text},
            timeout=30,
        )
        r.raise_for_status()
        emb = r.json().get("embedding")
        return emb if emb else None
    except Exception:  # noqa: BLE001 - fall back silently to hash embedder
        return None


def embed(text: str) -> list[float]:
    provider = settings.embedding_provider
    if provider in ("auto", "ollama"):
        emb = _ollama_embed(text)
        if emb:
            return emb
        if provider == "ollama":
            return _hash_embed(text)  # explicit ollama but unreachable -> fallback
    return _hash_embed(text)


def _cosine(a: list[float], b: list[float]) -> float:
    n = min(len(a), len(b))
    dot = sum(a[i] * b[i] for i in range(n))
    na = math.sqrt(sum(x * x for x in a[:n])) or 1.0
    nb = math.sqrt(sum(x * x for x in b[:n])) or 1.0
    return dot / (na * nb)


# --------------------------------------------------------------------------- #
#  Records + result type
# --------------------------------------------------------------------------- #
@dataclass
class Match:
    id: str
    text: str
    metadata: dict
    score: float


class _MemoryStore:
    """In-memory fallback store, namespaced like Chroma collections."""

    def __init__(self) -> None:
        self._ns: dict[str, list[dict]] = {}

    def add(self, namespace, id_, text, metadata):
        col = self._ns.setdefault(namespace, [])
        col[:] = [r for r in col if r["id"] != id_]  # upsert
        col.append({"id": id_, "text": text, "metadata": metadata, "vec": embed(text)})

    def query(self, namespace, text, top_k, where):
        col = self._ns.get(namespace, [])
        qv = embed(text)
        scored = []
        for r in col:
            if where and any(r["metadata"].get(k) != v for k, v in where.items()):
                continue
            scored.append(Match(r["id"], r["text"], r["metadata"], _cosine(qv, r["vec"])))
        scored.sort(key=lambda m: m.score, reverse=True)
        return scored[:top_k]

    def delete_namespace(self, namespace):
        self._ns.pop(namespace, None)


class _ChromaStore:
    """Real ChromaDB-backed store (HTTP client)."""

    def __init__(self, url: str):
        import chromadb  # imported lazily so the dep is optional

        host = url.replace("http://", "").replace("https://", "")
        host, _, port = host.partition(":")
        self._client = chromadb.HttpClient(host=host, port=int(port or 8000))

    def _col(self, namespace):
        return self._client.get_or_create_collection(name=namespace)

    def add(self, namespace, id_, text, metadata):
        self._col(namespace).upsert(
            ids=[id_], documents=[text], metadatas=[metadata], embeddings=[embed(text)]
        )

    def query(self, namespace, text, top_k, where):
        res = self._col(namespace).query(
            query_embeddings=[embed(text)], n_results=top_k, where=where or None
        )
        out = []
        ids = (res.get("ids") or [[]])[0]
        docs = (res.get("documents") or [[]])[0]
        metas = (res.get("metadatas") or [[]])[0]
        dists = (res.get("distances") or [[]])[0]
        for i, _id in enumerate(ids):
            score = 1.0 - float(dists[i]) if i < len(dists) else 0.0
            out.append(Match(_id, docs[i], metas[i] or {}, score))
        return out

    def delete_namespace(self, namespace):
        try:
            self._client.delete_collection(name=namespace)
        except Exception:  # noqa: BLE001
            pass


class VectorStore:
    """Public facade. Namespaces are prefixed so collections don't collide."""

    def __init__(self):
        self._backend = _ChromaStore(settings.chroma_url) if settings.chroma_url else _MemoryStore()

    def _ns(self, namespace: str) -> str:
        return f"{settings.chroma_collection_prefix}_{namespace}"

    def add(self, namespace: str, id_: str, text: str, metadata: dict | None = None) -> None:
        self._backend.add(self._ns(namespace), id_, text, metadata or {})

    def query(self, namespace: str, text: str, top_k: int = 5, where: dict | None = None) -> list[Match]:
        return self._backend.query(self._ns(namespace), text, top_k, where)

    def delete_namespace(self, namespace: str) -> None:
        self._backend.delete_namespace(self._ns(namespace))

    @property
    def backend_name(self) -> str:
        return type(self._backend).__name__


# Singleton — import and use.
store = VectorStore()
