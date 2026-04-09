# backend/main.py

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

from nlp.analyzer import analyze_article, analyze_rss_summary
from vector_store import ingest_article, find_related_by_entities

app = FastAPI(title="News Comparator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ArticleRequest(BaseModel):
    text: str


class IngestRequest(BaseModel):
    summary: str
    title: str = ""
    url: str = ""
    published_at: str = ""   # ISO 8601 e.g. "2024-06-01T10:30:00Z"


class RelatedRequest(BaseModel):
    summary: str
    named_entities: list[str] = []
    published_at: str = ""


# ── Bias analysis for the current article the user is reading ──────────────
@app.post("/api/analyze")
async def analyze(request: ArticleRequest):
    if not request.text:
        raise HTTPException(status_code=400, detail="No text provided")

    truncated = truncate_article_text(request.text)
    result = analyze_article(truncated)
    return result


# ── Ingest an RSS article into the vector DB ───────────────────────────────
@app.post("/api/ingest")
async def ingest(request: IngestRequest):
    """
    Call this for each RSS article you want to store.
    Runs the RSS prompt to get bias/entities/slug, then embeds and stores.
    """
    if not request.summary:
        raise HTTPException(status_code=400, detail="No summary provided")

    tagged = analyze_rss_summary(request.summary)
    if "error" in tagged:
        raise HTTPException(status_code=500, detail=tagged["error"])

    ingest_article(
        summary=request.summary,
        bias=tagged.get("bias", "Center"),
        named_entities=tagged.get("named_entities", []),
        core_event_slug=tagged.get("core_event_slug", ""),
        title=request.title,
        url=request.url,
        published_at=request.published_at,
    )
    return {"status": "ingested", "tagged": tagged}


# ── Find related articles from the vector DB ──────────────────────────────
@app.post("/api/related")
async def related(request: RelatedRequest):
    """
    Given the current article's summary + named entities + publish time,
    returns the best Left/Center/Right match from the vector DB using
    cosine similarity + 48h window + entity overlap.
    """
    if not request.summary:
        raise HTTPException(status_code=400, detail="No summary provided")

    result = find_related_by_entities(
        summary=request.summary,
        named_entities=request.named_entities,
        published_at=request.published_at,
    )
    return result


# ── Legacy RSS ingest endpoint (kept for compatibility) ────────────────────
@app.post("/api/ingest-rss")
async def ingest_rss(request: ArticleRequest):
    result = analyze_rss_summary(request.text)
    return result


# ── Helpers ────────────────────────────────────────────────────────────────
def truncate_article_text(raw_text: str, max_chars: int = 3000) -> str:
    """
    Hard-cap the article at max_chars to stay within Groq's TPM limit.
    Takes the first 2/3 and last 1/3 of the budget so we capture both
    the lede and the conclusion, which carry the most framing signal.
    """
    text = " ".join(raw_text.split())  # collapse all whitespace
    if len(text) <= max_chars:
        return text

    head = int(max_chars * 0.67)
    tail = max_chars - head
    return text[:head] + " [...] " + text[-tail:]
