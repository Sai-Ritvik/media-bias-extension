
from flask import Flask, request, jsonify
from flask_cors import CORS
from news_fetch import get_biased_news

app = Flask(__name__)
CORS(app)

@app.route("/news")
def get_news():
    query = request.args.get("q")

    if not query:
        return jsonify({"error": "No query provided"}), 400

    try:
        result = get_biased_news(query)
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
