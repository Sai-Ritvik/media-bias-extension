# News Comparator

A Chrome extension that detects political bias in Indian news articles and surfaces the same story from Left, Center, and Right perspectives — all without leaving the page.

## How it works

1. User clicks the extension on any news article
2. The article text is extracted from the page and sent to the FastAPI backend
3. Groq's LLM classifies the bias and extracts named entities + a core event slug
4. The extension first queries a local ChromaDB vector store for pre-ingested articles on the same story
5. If the vector DB has no matches, it falls back to a live search via NewsAPI and The Guardian API
6. Results are bucketed into Left / Center / Right with publisher uniqueness enforced and rendered in the popup

## Project Structure

```
media-bias-extension-main/
├── extension/
│   ├── manifest.json       # Chrome extension config, permissions, host access
│   ├── popup.html          # Extension popup UI shell
│   ├── popup.js            # Main orchestration logic, fetch calls, rendering
│   └── content.js          # Injected into tab to extract article text from DOM
│
└── backend/
    ├── main.py             # FastAPI server (port 8000) — /api/analyze, /api/related, /api/ingest
    ├── app.py              # Flask server (port 5000) — /news NewsAPI/Guardian fallback
    ├── news_fetch.py       # News retrieval, entity search, bias bucketing pipeline
    ├── vector_store.py     # ChromaDB embed/store/query with SentenceTransformer
    ├── source_bias.json    # Legacy domain→bias map
    ├── .env                # Secret keys (not committed)
    ├── .env.example        # Key template
    └── nlp/
        ├── prompts.py      # All three LLM prompt templates
        ├── analyzer.py     # Groq API calls — analyze_article, analyze_rss_summary
        └── __init__.py
```

## Tech Stack

- **Extension** — Chrome Manifest V3, Vanilla JS
- **Backend** — FastAPI, Flask, Python 3.11+
- **LLM** — Groq API (`llama-3.1-8b-instant`)
- **Vector DB** — ChromaDB + `sentence-transformers` (`all-MiniLM-L6-v2`)
- **News Sources** — NewsAPI (last 30 days), The Guardian Open Platform (full archive)

## Setup

### 1. Clone the repo

```bash
git clone <repo-url>
cd media-bias-extension-main/media-bias-extension-main/backend
```

### 2. Install dependencies

```bash
pip install fastapi uvicorn flask flask-cors groq chromadb python-dotenv sentence-transformers requests
```

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

```env
GROQ_API_KEY=your_groq_api_key_here
GUARDIAN_API_KEY=your_guardian_api_key_here
```

- Groq API key: [console.groq.com](https://console.groq.com)
- Guardian API key (free Developer tier): [open-platform.theguardian.com/access](https://open-platform.theguardian.com/access)

### 4. Run the backends

Open two terminals inside the `backend/` folder:

**Terminal 1 — FastAPI (bias analysis + vector DB)**
```bash
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Flask (NewsAPI/Guardian fallback)**
```bash
python app.py
```

Both must be running at the same time for the extension to work.

### 5. Load the extension in Chrome

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder

The extension icon will appear in your toolbar. Navigate to any news article and click it.

## API Endpoints

| Method | Endpoint | Server | Description |
|--------|----------|--------|-------------|
| POST | `/api/analyze` | FastAPI :8000 | Classify bias of article text |
| POST | `/api/related` | FastAPI :8000 | Find related articles from vector DB |
| POST | `/api/ingest` | FastAPI :8000 | Ingest an RSS article into ChromaDB |
| GET | `/news` | Flask :5000 | Fetch Left/Center/Right articles via NewsAPI + Guardian |

## Notes

- NewsAPI only indexes articles from the **last 30 days** on the free tier. The Guardian fallback covers older articles with no date restriction.
- The first run will download the `all-MiniLM-L6-v2` embedding model (~80MB). Subsequent runs use the cached version.
- The ChromaDB vector store is only useful once articles have been ingested via `/api/ingest`. Without ingested data, the extension always falls back to live news search.
