# backend/nlp/analyzer.py

import os
import json
from groq import Groq

# Import your perfectly engineered prompts from the other file
from .prompts import FRONTEND_ANALYSIS_PROMPT, RSS_INGESTION_PROMPT, RELEVANCE_AND_BIAS_PROMPT

# Initialize the Groq client
# Note: Sai/Supraja need to ensure GROQ_API_KEY is in their local .env file
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

# The model we are using for fast, JSON-strict inference
MODEL_NAME = "llama-3.1-8b-instant"


def analyze_article(article_text: str) -> dict:
    """
    Used by the Frontend. 
    Analyzes a full (truncated) article to get bias, 4-6 keywords, and a 1-2 sentence explanation.
    """
    print("Sending to LLM:", article_text[:200])
    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": FRONTEND_ANALYSIS_PROMPT},
                {"role": "user", "content": article_text}
            ],
            model=MODEL_NAME,
            temperature=0.0, # 0.0 forces strict JSON adherence
        )
        
        # Extract the string and convert to a Python dictionary
        response_text = chat_completion.choices[0].message.content
        # Strip markdown code fences if the LLM wraps its output
        cleaned = response_text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(cleaned)
        
    except json.JSONDecodeError:
        return {"error": "Failed to parse JSON from LLM.", "raw_output": response_text}
    except Exception as e:
        print("ERROR:", str(e))
        return {"error": str(e)}


def classify_and_check_relevance(candidate_summary: str, source_event: str) -> dict:
    """
    Used by process_perspectives (the "Same Story" feature).
    Simultaneously checks if a candidate article is about the same event as the source,
    and classifies its bias. Returns {"is_relevant_to_source": bool, "bias": str|None}.
    If source_event is empty, skips the relevance check and classifies bias only.
    """
    # If we have no source event to compare against, fall back to plain bias classification
    if not source_event:
        result = analyze_rss_summary(candidate_summary)
        return {
            "is_relevant_to_source": True,
            "relevance_reasoning": "No source event provided; relevance check skipped.",
            "bias": result.get("bias"),
        }

    system_prompt = RELEVANCE_AND_BIAS_PROMPT.format(source_event=source_event)
    response_text = ""
    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"CANDIDATE ARTICLE: {candidate_summary}"},
            ],
            model=MODEL_NAME,
            temperature=0.0,
        )
        response_text = chat_completion.choices[0].message.content
        cleaned = response_text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(cleaned)

    except json.JSONDecodeError:
        return {"error": "Failed to parse JSON from LLM.", "raw_output": response_text}
    except Exception as e:
        return {"error": str(e)}


def analyze_rss_summary(summary_text: str) -> dict:
    """
    Used by the Background Scraper.
    Quickly analyzes a short RSS summary to get bias and 3-5 keywords for ChromaDB.
    Uses response_format to force valid JSON output and avoid parse failures.
    """
    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": RSS_INGESTION_PROMPT},
                {"role": "user", "content": summary_text}
            ],
            model=MODEL_NAME,
            temperature=0.0,
            response_format={"type": "json_object"},
        )
        response_text = chat_completion.choices[0].message.content
        return json.loads(response_text)

    except json.JSONDecodeError:
        return {"error": "Failed to parse JSON from LLM.", "raw_output": response_text}
    except Exception as e:
        return {"error": str(e)}
