# backend/vector_store.py
# Local vector database using ChromaDB + sentence-transformers

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from datetime import datetime, timezone
import uuid

# Persistent local DB stored in backend/chroma_db/
_client = chromadb.PersistentClient(path="./chroma_db")
_collection = _client.get_or_create_collection(
    name="news_articles",
    metadata={"hnsw:space": "cosine"}
)

# Free, lightweight embedding model (~80MB, runs locally)
_model = SentenceTransformer("all-MiniLM-L6-v2")


def ingest_article(summary: str, bias: str, named_entities: list, core_event_slug: str,
                   title: str = "", url: str = "", published_at: str = ""):
    """
    Embed the article summary and store it with metadata in ChromaDB.
    published_at should be an ISO 8601 string. Defaults to now if not provided.
    """
    embedding = _model.encode(summary).tolist()

    # Normalise published_at to a UTC unix timestamp for range queries
    if published_at:
        try:
            dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
        except ValueError:
            dt = datetime.now(timezone.utc)
    else:
        dt = datetime.now(timezone.utc)

    ts = int(dt.timestamp())

    _collection.add(
        ids=[str(uuid.uuid4())],
        embeddings=[embedding],
        documents=[summary],
        metadatas=[{
            "bias": bias,
            "named_entities": "|".join(named_entities),   # ChromaDB metadata must be scalar
            "core_event_slug": core_event_slug,
            "title": title,
            "url": url,
            "published_ts": ts,
        }]
    )


def find_related(summary: str, published_at: str = "", n_results: int = 20) -> dict:
    """
    Given the current article's summary and publish time, find the best
    Left / Center / Right match using:
      1. Cosine similarity (vector search)
      2. ±48-hour time window
      3. At least 2 shared named entities
    Returns {"left": {...}, "center": {...}, "right": {...}}
    """
    embedding = _model.encode(summary).tolist()

    # Determine time window
    if published_at:
        try:
            dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
        except ValueError:
            dt = datetime.now(timezone.utc)
    else:
        dt = datetime.now(timezone.utc)

    window = 48 * 3600
    ts_min = int(dt.timestamp()) - window
    ts_max = int(dt.timestamp()) + window

    # Pull top candidates by cosine similarity within the time window
    results = _collection.query(
        query_embeddings=[embedding],
        n_results=min(n_results, _collection.count() or 1),
        where={"$and": [
            {"published_ts": {"$gte": ts_min}},
            {"published_ts": {"$lte": ts_max}},
        ]},
        include=["metadatas", "documents", "distances"]
    )

    candidates = []
    if results and results["metadatas"]:
        for meta, doc, dist in zip(
            results["metadatas"][0],
            results["documents"][0],
            results["distances"][0]
        ):
            candidates.append({**meta, "summary": doc, "similarity": 1 - dist})

    # Extract named entities from the query article for overlap check
    # We re-use the top candidate's entity list as a proxy if we don't have them directly
    # (caller can pass them explicitly via find_related_by_entities)
    return _rank_by_bias(candidates)


def find_related_by_entities(summary: str, named_entities: list,
                              published_at: str = "", n_results: int = 30) -> dict:
    """
    Full pipeline: cosine similarity + 48h window + entity overlap filter.
    """
    embedding = _model.encode(summary).tolist()

    if published_at:
        try:
            dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
        except ValueError:
            dt = datetime.now(timezone.utc)
    else:
        dt = datetime.now(timezone.utc)

    window = 48 * 3600
    ts_min = int(dt.timestamp()) - window
    ts_max = int(dt.timestamp()) + window

    total = _collection.count()
    if total == 0:
        return {"left": None, "center": None, "right": None}

    results = _collection.query(
        query_embeddings=[embedding],
        n_results=min(n_results, total),
        where={"$and": [
            {"published_ts": {"$gte": ts_min}},
            {"published_ts": {"$lte": ts_max}},
        ]},
        include=["metadatas", "documents", "distances"]
    )

    query_entities = set(e.lower() for e in named_entities)
    candidates = []

    if results and results["metadatas"]:
        for meta, doc, dist in zip(
            results["metadatas"][0],
            results["documents"][0],
            results["distances"][0]
        ):
            stored_entities = set(e.lower() for e in meta.get("named_entities", "").split("|") if e)
            overlap = len(query_entities & stored_entities)
            if overlap >= 2:
                candidates.append({**meta, "summary": doc, "similarity": 1 - dist, "overlap": overlap})

    # Sort by overlap first, then similarity
    candidates.sort(key=lambda x: (x["overlap"], x["similarity"]), reverse=True)
    return _rank_by_bias(candidates)


def _rank_by_bias(candidates: list) -> dict:
    result = {"left": None, "center": None, "right": None}
    for c in candidates:
        bias = c.get("bias", "").lower()
        if bias in result and result[bias] is None:
            result[bias] = {
                "title": c.get("title", ""),
                "url": c.get("url", ""),
                "summary": c.get("summary", ""),
                "bias": c.get("bias", ""),
                "similarity": round(c.get("similarity", 0), 3),
            }
        if all(result.values()):
            break
    return result
