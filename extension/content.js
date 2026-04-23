chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractText") {
    sendResponse({ text: extractArticleText() });
  }
  if (request.action === "debugDOM") {
    sendResponse({ debug: debugDOM() });
  }
  return true;
});

// ─── DEBUG ───────────────────────────────────────────────────────────────────
// Run in browser console on a TOI/Hindu article:
//   chrome.tabs.query({active:true,currentWindow:true}, t =>
//     chrome.tabs.sendMessage(t[0].id, {action:"debugDOM"}, r => console.log(JSON.parse(r.debug))))
function debugDOM() {
  const candidates = Array.from(document.querySelectorAll("div, section, article, main"))
    .map(el => {
      const ps = el.querySelectorAll("p");
      const pText = Array.from(ps).reduce((s, p) => s + (p.innerText || "").length, 0);
      return {
        tag: el.tagName,
        cls: (el.className?.toString() || "").slice(0, 80),
        id: (el.id || "").slice(0, 40),
        totalChars: (el.innerText || "").trim().length,
        pTagChars: pText,
        pTagCount: ps.length,
      };
    })
    .filter(d => d.totalChars > 300)
    .sort((a, b) => b.pTagChars - a.pTagChars)
    .slice(0, 15);

  return JSON.stringify({
    url: location.href,
    ogTitle: document.querySelector('meta[property="og:title"]')?.content,
    h1s: Array.from(document.querySelectorAll("h1")).map(h => h.innerText.trim().slice(0, 100)),
    hasLdJson: !!document.querySelector('script[type="application/ld+json"]'),
    topCandidates: candidates,
  }, null, 2);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
const MAX_CHARS = 3000;

function extractArticleText() {
  const headline = extractHeadline();
  const container = findArticleContainer();

  const lines = headline ? [headline] : [];

  if (container) {
    // Pass 1: <p> tags inside container
    container.querySelectorAll("p").forEach(p => {
      if (isNoise(p)) return;
      const t = clean(p.innerText);
      if (t.length > 40 && !lines.includes(t)) lines.push(t);
    });

    // Pass 2: leaf divs — for TOI which uses bare divs instead of <p>
    if (lines.length <= 2) {
      container.querySelectorAll("div").forEach(el => {
        if (isNoise(el)) return;
        const hasBlockChild = Array.from(el.children).some(c =>
          ["DIV","P","SECTION","ARTICLE","UL","OL","BLOCKQUOTE","TABLE"].includes(c.tagName)
        );
        if (hasBlockChild) return;
        const t = clean(el.innerText);
        if (t.length > 60 && !lines.includes(t)) lines.push(t);
      });
    }
  }

  // Hard cap — never send more than MAX_CHARS to the backend
  return lines.join(" ").slice(0, MAX_CHARS);
}

// ─── HEADLINE ────────────────────────────────────────────────────────────────
function extractHeadline() {
  // 1. JSON-LD structured data
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const items = [].concat(JSON.parse(s.textContent));
      for (const item of items) {
        const h = item.headline || item.name;
        if (h && h.length > 10) return h.trim();
      }
    } catch (_) {}
  }

  // 2. og:title — strip trailing site name like " - The Hindu" or " | TOI"
  const og = document.querySelector('meta[property="og:title"]');
  if (og?.content?.length > 10) {
    return og.content.replace(/\s*[-|]\s*[^-|]{2,40}$/, "").trim();
  }

  // 3. First h1 with real content
  for (const h1 of document.querySelectorAll("h1")) {
    const t = clean(h1.innerText);
    if (t.length > 20) return t;
  }

  return "";
}

// ─── CONTAINER FINDER ────────────────────────────────────────────────────────
function findArticleContainer() {
  // Ordered by specificity — stop at first match with real content
  const selectors = [
    "[itemprop='articleBody']",
    "article",
    "main article",
    "[role='main'] article",
    "[id*='content-body']",       // The Hindu: #content-body-{sectionId}-{articleId}
    "[class*='content-body']",
    "[class*='article-body']",
    "[class*='article__body']",
    "[class*='ArticleBody']",
    "[class*='story-body']",
    "[class*='StoryBody']",
    "[class*='post-content']",
    "[class*='entry-content']",
    "[class*='article-content']",
    "[class*='ArticleContent']",
    "[class*='body-text']",
    "[class*='paywall']",
    "main",
    "[role='main']",
  ];

  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim().length > 200) return el;
    } catch (_) {}
  }

  return findDensestBlock();
}

// ─── DENSEST BLOCK ───────────────────────────────────────────────────────────
// For React SPAs like TOI with hashed class names.
// Key insight: pick the container with the best ratio of <p> text to total text.
// A real article body is almost all <p> text. A page wrapper has lots of nav/UI text too.
function findDensestBlock() {
  let best = null;
  let bestScore = 0;

  document.querySelectorAll("div, section").forEach(el => {
    if (el === document.body) return;

    const totalText = (el.innerText || "").trim();
    if (totalText.length < 400) return;

    const ps = el.querySelectorAll("p");
    if (ps.length < 2) return; // need at least 2 paragraphs

    const pText = Array.from(ps).reduce((s, p) => s + (p.innerText || "").length, 0);

    // Ratio: what fraction of this element's text is inside <p> tags
    // High ratio = focused article container, low ratio = page wrapper
    const ratio = pText / totalText.length;

    // Also weight by absolute text length so we don't pick tiny elements
    const score = ratio * pText;

    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  });

  return best;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function clean(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function isNoise(el) {
  const tag = el.tagName;
  if (["SCRIPT","STYLE","NOSCRIPT","IFRAME","BUTTON","FORM","INPUT","SELECT","TEXTAREA"].includes(tag)) return true;

  const role = (el.getAttribute?.("role") || "").toLowerCase();
  if (["navigation","banner","contentinfo","complementary","search"].includes(role)) return true;

  if (["NAV","ASIDE","FOOTER","HEADER"].includes(tag)) return true;

  const cls = (el.className?.toString() || "").toLowerCase();
  const id  = (el.id || "").toLowerCase();
  const noiseWords = [
    "sidebar","related-articles","related-stories","related-posts",
    "newsletter","subscribe","comments","comment-section",
    "social-share","share-bar","cookie-banner","advertisement",
    "sponsored","trending","most-popular","recommended",
  ];
  return noiseWords.some(w => cls.includes(w) || id.includes(w));
}
