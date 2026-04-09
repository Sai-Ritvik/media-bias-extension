document.getElementById("btn").addEventListener("click", getNews);

function getNews() {
    const resultDiv = document.getElementById("result");
    resultDiv.innerHTML = '<p style="color:#888;font-style:italic">Analyzing article...</p>';

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const tab = tabs[0];

        // Can't inject into chrome:// or edge:// pages
        if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:")) {
            resultDiv.innerHTML = '<p style="color:#888">Navigate to a news article first.</p>';
            return;
        }

        chrome.scripting.executeScript(
            { target: { tabId: tab.id }, files: ["content.js"] },
            () => {
                chrome.tabs.sendMessage(tab.id, { action: "extractText" }, function (response) {
                    const articleText = (response && response.text) ? response.text : "";

                    if (!articleText) {
                        resultDiv.innerHTML = '<p style="color:#888">Could not extract article text from this page.</p>';
                        return;
                    }

                    // Step 1: Analyze bias of current article
                    fetch("http://127.0.0.1:8000/api/analyze", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ text: articleText }),
                    })
                    .then(r => {
                        if (!r.ok) {
                            throw new Error(`FastAPI returned ${r.status}`);
                        }
                        return r.json();
                    })
                    .then(biasData => {
                        console.log("Bias analysis result:", biasData);
                        
                        // Check if there's an error from the LLM
                        if (biasData.error) {
                            resultDiv.innerHTML = `<p style="color:#d32f2f">Analysis error: ${biasData.error}</p>`;
                            return;
                        }

                        // named_entities and core_event_slug are now returned by FRONTEND_ANALYSIS_PROMPT
                        const entities = biasData.named_entities || [];
                        const summary = biasData.article_summary || "";
                        const coreSlug = biasData.core_event_slug || "";

                        console.log("Entities for search:", entities);
                        console.log("Core event slug:", coreSlug);

                        const vectorPromise = fetch("http://127.0.0.1:8000/api/related", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                summary: summary,
                                named_entities: entities,
                                published_at: "",
                            }),
                        }).then(r => r.json()).catch((e) => { console.warn("Vector DB failed:", e); return null; });

                        vectorPromise.then(vectorResults => {
                            console.log("Vector DB results:", vectorResults);
                            const hasVectorResults = vectorResults &&
                                (vectorResults.left || vectorResults.center || vectorResults.right);

                            if (hasVectorResults) {
                                renderResults(biasData, vectorResults, true);
                            } else {
                                // Fallback: NewsAPI keyword search
                                let title = tab.title || "news";
                                title = title.split("|")[0].split("-")[0].trim();
                                title = title.split(" ").slice(0, 5).join(" ");

                                const params = new URLSearchParams({ q: title });
                                if (entities.length) params.set("keywords", entities.join(","));
                                if (coreSlug) params.set("source_event", coreSlug);

                                console.log("Falling back to NewsAPI:", params.toString());

                                fetch(`http://127.0.0.1:5000/news?${params}`)
                                    .then(r => r.json())
                                    .then(newsData => { console.log("NewsAPI results:", newsData); renderResults(biasData, newsData, false); })
                                    .catch((e) => { console.error("NewsAPI fallback failed:", e); renderResults(biasData, null, false); });
                            }
                        });
                    })
                    .catch(err => {
                        console.error("Full error:", err);
                        resultDiv.innerHTML = `<p style="color:#d32f2f">Error: ${err.message}<br><small>Check the browser console (F12) for details.</small></p>`;
                    });
                });
            }
        );
    });
}

function renderResults(biasData, newsData, fromVectorDB) {
    const resultDiv = document.getElementById("result");
    let html = "";

    // ── Bias analysis panel ──────────────────────────────────────────────
    if (biasData && biasData.bias_classification) {
        const colors = { Left: "#1565c0", Right: "#b71c1c", Center: "#2e7d32" };
        const bias = biasData.bias_classification;
        const color = colors[bias] || "#333";

        html += `
            <div class="bias-box">
                <div class="bias-label" style="color:${color}">This article leans: ${bias}</div>
                <p style="margin:8px 0 6px;font-size:12px"><strong>Summary:</strong> ${biasData.article_summary || ""}</p>
                ${biasData.step_1_target_analysis
                    ? `<p style="margin:6px 0;font-size:11px;color:#555"><strong>Target:</strong> ${biasData.step_1_target_analysis}</p>`
                    : ""}
                ${biasData.step_2_alignment_logic
                    ? `<p style="margin:6px 0;font-size:11px;color:#555"><strong>Reasoning:</strong> ${biasData.step_2_alignment_logic}</p>`
                    : ""}
            </div>
        `;
    } else {
        html += `<div class="bias-box" style="color:#888">Bias analysis unavailable.</div>`;
    }

    // ── Related articles panel ───────────────────────────────────────────
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
        return `
        <div class="article-card">
            <b>${label}</b>
            <p style="color:#888;margin:4px 0;font-style:italic">No distinct perspective found for this category.</p>
        </div>`;
    }
    const summaryHtml = (showSummary && article.summary)
        ? `<p style="font-size:11px;color:#555;margin:4px 0">${article.summary}</p>`
        : "";
    const sourceHtml = article.source
        ? `<span style="color:#888;font-size:11px">${article.source}</span><br>`
        : "";
    return `
        <div class="article-card">
            <b>${label}</b><br>
            <span style="font-size:12px">${article.title || "No title"}</span><br>
            ${sourceHtml}
            ${summaryHtml}
            <a href="${article.url}" target="_blank" rel="noopener noreferrer">Read article →</a>
        </div>
    `;
}
