from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
load_dotenv()

from news_fetch import get_biased_news

app = Flask(__name__)
CORS(app)

@app.route("/news")
def get_news():
    query = request.args.get("q")
    # keywords = named entities from the LLM, passed as comma-separated string
    keywords_raw = request.args.get("keywords", "")
    keywords = [k.strip() for k in keywords_raw.split(",") if k.strip()] if keywords_raw else None
    # source_event = core_event_slug from the LLM, used as the semantic bouncer truth
    source_event = request.args.get("source_event", "")

    if not query and not keywords:
        return jsonify({"error": "No query provided"}), 400

    try:
        result = get_biased_news(query or "", keywords=keywords, source_event=source_event)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    def clean(article):
        if not article:
            return None
        return {
            "title": article["title"],
            "source": article["source"]["name"],
            "url": article["url"]
        }

    return jsonify({
        "left": clean(result["left"]),
        "center": clean(result["center"]),
        "right": clean(result["right"])
    })

if __name__ == "__main__":
    app.run(debug=True)
