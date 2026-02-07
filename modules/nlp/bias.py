from transformers import pipeline
from keybert import KeyBERT
import re

classifier = pipeline("zero-shot-classification")
kw_model = KeyBERT()

BIASED_WORDS = ["shocking", "failed", "propaganda", "corrupt", "anti-national", "angry"]

def analyze_text(text: str):
    labels = ["left", "right", "center"]
    result = classifier(text, labels)
    bias = result["labels"][0]

    keywords = kw_model.extract_keywords(text, top_n=5)
    keywords = [k[0] for k in keywords]

    # simple explanation logic
    sentences = re.split(r'[.!?]', text)
    biased_sentences = [s.strip() for s in sentences if any(w in s.lower() for w in BIASED_WORDS)]

    explanation = "Uses emotionally charged language."
    if biased_sentences:
        explanation = f"Biased phrases found like: '{biased_sentences[0]}'"

    return {
        "bias": bias,
        "keywords": keywords,
        "explanation": explanation
    }
