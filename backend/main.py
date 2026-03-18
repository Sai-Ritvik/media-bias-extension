# backend/main.py

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

# Load the API key from the .env file BEFORE importing your NLP module
load_dotenv()

# Now import YOUR exact functions
from nlp.analyzer import analyze_article, analyze_rss_summary

# Initialize the FastAPI app
app = FastAPI(title="News Comparator API Prototype")

# Define the data structure the frontend (Jahnavi) will send
class ArticleRequest(BaseModel):
    text: str

@app.post("/api/analyze")
async def process_frontend_request(request: ArticleRequest):
    """
    Simulates Jahnavi's extension sending text to the backend.
    """
    if not request.text:
        raise HTTPException(status_code=400, detail="No text provided")
    
    # Call YOUR NLP code
    print("Received text from frontend. Sending to Groq...")
    result = analyze_article(request.text)
    
    # Return the exact JSON you engineered back to the frontend
    return result

@app.post("/api/ingest-rss")
async def process_rss_ingestion(request: ArticleRequest):
    """
    Simulates the background script processing an RSS summary.
    """
    if not request.text:
        raise HTTPException(status_code=400, detail="No text provided")
    
    # Step 1: Truncate the article
    truncated_text = truncate_article_text(request.text)

    # Step 2: Send truncated version to LLM
    result = analyze_article(truncated_text)
    return result
def truncate_article_text(raw_text: str) -> str:
    """
    Applies the Inverted Pyramid method to truncate long news articles.
    Keeps the first 3 paragraphs and the final paragraph to preserve core framing and bias.
    """
    # Split the text into a list of paragraphs, ignoring empty lines
    paragraphs = [p.strip() for p in raw_text.split('\n') if p.strip()]
    
    total_paragraphs = len(paragraphs)
    
    # If the article is 4 paragraphs or shorter, just return the whole thing
    if total_paragraphs <= 4:
        return "\n\n".join(paragraphs)
    
    # Extract the top 3 paragraphs (The Lead)
    top_section = paragraphs[:3]
    
    # Extract the very last paragraph (The Tail)
    bottom_section = [paragraphs[-1]]
    
    # Reassemble the text with a marker in the middle
    truncated_text = "\n\n".join(top_section)
    truncated_text += "\n\n[...article truncated for length...]\n\n"
    truncated_text += "\n\n".join(bottom_section)
    
    return truncated_text
