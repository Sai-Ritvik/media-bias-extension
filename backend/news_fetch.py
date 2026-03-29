import requests
import json
from urllib.parse import urlparse

API_KEY = "5856049a571545c9b02e5d355651f250"


def get_domain(url):
    return urlparse(url).netloc.replace("www.", "")


def load_bias_map():
    with open("source_bias.json", "r") as f:
        return json.load(f)


def get_keyword_variants(keyword):
    return [
        keyword,
        keyword + " india"
    ]

def get_biased_news(keyword):
    bias_map = load_bias_map()
    variants = get_keyword_variants(keyword)

    left, center, right = None, None, None
    all_articles = []

    # fetch using keyword variants
    for variant in variants:
        try:
            url = "https://newsapi.org/v2/everything"
            params = {
                "q": variant,
                "language": "en",
                "apiKey": API_KEY
            }
            response = requests.get(url, params=params, timeout=5).json()
            articles = response.get("articles", [])
            all_articles.extend(articles)
        except Exception as e:
            print(f"Skipping variant '{variant}': {e}")

    # classify articles
    for article in all_articles:
        domain = get_domain(article["url"])
        bias = bias_map.get(domain)

        if bias == "left" and left is None:
            left = article

        elif bias == "center" and center is None:
            center = article

        elif bias == "right" and right is None:
            right = article

        if left and center and right:
            break

    # fallback if any side is missing — use any available article
    fallback = next((a for a in all_articles if a), None)

    if left is None:
        left = center or right or fallback
    if center is None:
        center = left or right or fallback
    if right is None:
        right = center or left or fallback

    return {
        "left": left,
        "center": center,
        "right": right
    }


# TEST
#result = get_biased_news("farmers protest")


#def display(article, label):
   # if article:
     #   print(f"\n{label}:")
      #  print("Title:", article["title"])
       # print("Source:", article["source"]["name"])
       # print("URL:", article["url"])
   # else:
      #  print(f"\n{label}: No article found")


#display(result["left"], "LEFT")
#display(result["center"], "CENTER")
#display(result["right"], "RIGHT")
