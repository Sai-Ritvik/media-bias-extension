chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractText") {
    sendResponse({ text: extractArticleText() });
  }
  return true;
});

function extractArticleText() {
  // --- Step 1: Find the article container on the LIVE DOM (innerText works here) ---
  const container = findArticleContainer();
  if (!container) return "";

  // --- Step 2: Collect paragraph text, skipping noise nodes inline ---
  const lines = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT);

  let node = walker.currentNode;
  while (node) {
    if (shouldSkipNode(node)) {
      // skip this node and all its children
      node = walker.nextSibling() || walker.parentNode();
      // move past it properly by just going next
      node = walker.nextNode();
      continue;
    }

    const tag = node.tagName;
    if (tag === "P" || tag === "H1" || tag === "H2" || tag === "H3") {
      // Only grab text from this element directly, not its sub-elements again
      const text = (node.innerText || node.textContent || "").replace(/\s+/g, " ").trim();
      if (text.length > 40) {
        lines.push(text);
      }
    }

    node = walker.nextNode();
  }

  // Fallback: if walker found nothing, just grab all <p> from container directly
  if (lines.length === 0) {
    container.querySelectorAll("p").forEach(p => {
      const text = (p.innerText || p.textContent || "").replace(/\s+/g, " ").trim();
      if (text.length > 40) lines.push(text);
    });
  }

  return lines.join(" ");
}

/**
 * Find the most likely article container using semantic selectors first,
 * then fall back to the densest-text block.
 */
function findArticleContainer() {
  // Ordered by specificity — first match wins
  const selectors = [
    "[itemprop='articleBody']",
    "article",
    "[role='main'] article",
    "[class*='article-body']",
    "[class*='article__body']",
    "[class*='ArticleBody']",
    "[class*='story-body']",
    "[class*='StoryBody']",
    "[class*='post-content']",
    "[class*='PostContent']",
    "[class*='entry-content']",
    "[class*='article-content']",
    "[class*='ArticleContent']",
    "[class*='content-body']",
    "[class*='body-text']",
    "[class*='paywall']",       // paywalled content is still the article
    "main article",
    "main",
    "[role='main']",
  ];

  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim().length > 200) return el;
    } catch (_) { /* invalid selector on some sites, skip */ }
  }

  // Last resort: find the div/section with the most paragraph text
  return findDensestTextBlock();
}

/**
 * Returns true if a node is clearly noise and its subtree should be skipped.
 * Uses exact tag names and tightly scoped class/role checks — NOT substring wildcards
 * that would accidentally match article content.
 */
function shouldSkipNode(node) {
  const tag = node.tagName;

  // Always skip these tags entirely
  if (["SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "FIGURE", "PICTURE",
       "BUTTON", "FORM", "INPUT", "SELECT", "TEXTAREA"].includes(tag)) {
    return true;
  }

  const role = (node.getAttribute("role") || "").toLowerCase();
  if (["navigation", "banner", "contentinfo", "complementary", "search"].includes(role)) {
    return true;
  }

  // Only skip nav/aside/footer/header structural tags
  if (["NAV", "ASIDE", "FOOTER", "HEADER"].includes(tag)) return true;

  // Tight class/id checks — only exact noise words, not substrings
  const cls = (node.className || "").toLowerCase();
  const id  = (node.id || "").toLowerCase();

  const noiseWords = [
    "sidebar", "related-articles", "related-stories", "related-posts",
    "newsletter", "subscribe", "subscription",
    "comments", "comment-section",
    "social-share", "share-bar", "share-buttons",
    "cookie-banner", "cookie-notice",
    "advertisement", "sponsored",
    "trending", "most-popular", "recommended-articles",
    "breaking-news-bar", "ticker",
  ];

  for (const word of noiseWords) {
    if (cls.includes(word) || id.includes(word)) return true;
  }

  return false;
}

/**
 * Fallback: find the div/section whose direct <p> children have the most combined text.
 */
function findDensestTextBlock() {
  let best = null;
  let bestLen = 0;

  document.querySelectorAll("div, section").forEach(el => {
    // Use ALL descendant <p> tags but weight by count to prefer focused containers
    const ps = el.querySelectorAll("p");
    const totalLen = Array.from(ps).reduce((sum, p) => sum + (p.innerText || "").length, 0);
    if (totalLen > bestLen) {
      bestLen = totalLen;
      best = el;
    }
  });

  return best;
}
