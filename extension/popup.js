document.getElementById("btn").addEventListener("click", getNews);

function getNews() {
  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = '<p style="color:#888;font-style:italic">Analyzing article...</p>';

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs[0];

    if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:")) {
      resultDiv.innerHTML = '<p style="color:#888">Navigate to a news article first.</p>';
      return;
    }

    // content.js is already injected via manifest content_scripts,
    // but executeScript ensures it's ready on dynamically loaded pages
    chrome.scripting.executeScript(
      { target: { tabId: tab.id }, files: ["content.js"] },
      () => {
        chrome.tabs.sendMessage(tab.id, { action: "extractText" }, function (response) {
          const articleText = response && response.text ? response.text : "";

          if (!articleText) {
            resultDiv.innerHTML = '<p style="color:#888">Could not extract article text from this page.</p>';
            return;
          }

          // Route fetch through background service worker
          chrome.runtime.sendMessage({ action: "analyze", text: articleText }, function (res) {
            if (chrome.runtime.lastError || !res || !res.ok) {
              const msg = (res && res.error) || (chrome.runtime.lastError && chrome.runtime.lastError.message) || "Unknown error";
              resultDiv.innerHTML = `<p style="color:#d32f2f">Error: ${msg}<br><small>Is the backend running on port 8000?</small></p>`;
              return;
            }

            const biasData = res.data;
            console.log("Bias analysis result:", biasData);

            if (biasData.error) {
              resultDiv.innerHTML = `<p style="color:#d32f2f">Analysis error: ${biasData.error}</p>`;
              return;
            }

            const entities = biasData.named_entities || [];
            const summary = biasData.article_summary || "";
            const coreSlug = biasData.core_event_slug || "";

            chrome.runtime.sendMessage({
              action: "related",
              payload: { summary, named_entities: entities, published_at: "" },
            }, function (relRes) {
              const vectorResults = relRes && relRes.ok ? relRes.data : null;
              const hasVectorResults = vectorResults && (vectorResults.left || vectorResults.center || vectorResults.right);

              if (hasVectorResults) {
                renderResults(biasData, vectorResults, true);
              } else {
                // Fallback: NewsAPI keyword search via background
                let title = tab.title || "news";
                title = title.split("|")[0].split("-")[0].trim();
                title = title.split(" ").slice(0, 5).join(" ");

                const params = new URLSearchParams({ q: title });
                if (entities.length) params.set("keywords", entities.join(","));
                if (coreSlug) params.set("source_event", coreSlug);

                chrome.runtime.sendMessage({ action: "news", params: params.toString() }, function (newsRes) {
                  const newsData = newsRes && newsRes.ok ? newsRes.data : null;
                  renderResults(biasData, newsData, false);
                });
              }
            });
          });
        });
      }
    );
  });
}

function renderResults(biasData, newsData, fromVectorDB) {
  const resultDiv = document.getElementById("result");
  let html = "";

  if (biasData && biasData.bias_classification) {
    const colors = { Left: "#1565c0", Right: "#b71c1c", Center: "#2e7d32" };
    const bias = biasData.bias_classification;
    const color = colors[bias] || "#333";
    html += `
      <div class="bias-box">
        <div class="bias-label" style="color:${color}">This article leans: ${bias}</div>
        <p style="margin:8px 0 6px;font-size:12px"><strong>Summary:</strong> ${biasData.article_summary || ""}</p>
        ${biasData.step_1_target_analysis ? `<p style="margin:6px 0;font-size:11px;color:#555"><strong>Target:</strong> ${biasData.step_1_target_analysis}</p>` : ""}
        ${biasData.step_2_alignment_logic ? `<p style="margin:6px 0;font-size:11px;color:#555"><strong>Reasoning:</strong> ${biasData.step_2_alignment_logic}</p>` : ""}
      </div>`;
  } else {
    html += `<div class="bias-box" style="color:#888">Bias analysis unavailable.</div>`;
  }

  const sourceLabel = fromVectorDB
    ? "Same Story, Different Perspectives <span style='font-size:10px;color:#888'>(matched by AI)</span>"
    : "Same Story, Different Perspectives <span style='font-size:10px;color:#888'>(via NewsAPI)</span>";

  html += `<h3>${sourceLabel}</h3>`;

  if (!newsData) {
    html += `<p style="color:#888">Could not fetch alternative coverage.</p>`;
  } else {
    html += formatCard("Left", newsData.left, fromVectorDB);
    html += formatCard("Center", newsData.center, fromVectorDB);
    html += formatCard("Right", newsData.right, fromVectorDB);
  }

  resultDiv.innerHTML = html;
}

function formatCard(label, article, showSummary) {
  if (!article) {
    return `<div class="article-card"><b>${label}</b><p style="color:#888;margin:4px 0;font-style:italic">No distinct perspective found for this category.</p></div>`;
  }
  const summaryHtml = showSummary && article.summary ? `<p style="font-size:11px;color:#555;margin:4px 0">${article.summary}</p>` : "";
  const sourceHtml = article.source ? `<span style="color:#888;font-size:11px">${article.source}</span><br>` : "";
  return `
    <div class="article-card">
      <b>${label}</b><br>
      <span style="font-size:12px">${article.title || "No title"}</span><br>
      ${sourceHtml}${summaryHtml}
      <a href="${article.url}" target="_blank" rel="noopener noreferrer">Read article →</a>
    </div>`;
}
