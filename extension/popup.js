const analyzeBtn = document.getElementById('analyzeBtn');
const resultsArea = document.getElementById('resultsArea');
const biasResult = document.getElementById('biasResult');
const explanationText = document.getElementById('explanationText');
const articleLinks = document.getElementById('articleLinks');
const keywordsEl = document.getElementById('keywords'); 
const BACKEND_URL = "http://127.0.0.1:8000/api/analyze";

analyzeBtn.addEventListener('click', async () => {

  analyzeBtn.innerText = "Extracting article...";
  analyzeBtn.disabled = true;
  resultsArea.classList.add('hidden');

  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { action: "extractText" }, async (response) => {

    if (!response || !response.text || response.text.length < 100) {
      showError("No readable article found.");
      return;
    }

    // Limit text size (important for LLMs)
    const MAX_LENGTH = 3000;
    const trimmedText = response.text.substring(0, MAX_LENGTH);

    analyzeBtn.innerText = "Analyzing...";

    try {
      const apiResponse = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // FIXED: matches backend (text, not article_text)
        body: JSON.stringify({ text: trimmedText })
      });

      if (!apiResponse.ok) {
        throw new Error("Server error");
      }

      const data = await apiResponse.json();
      console.log("Backend response:", data);

      // Display results
      biasResult.innerText = data.bias;
      explanationText.innerText = data.explanation;
     if (data.keywords && data.keywords.length > 0) { // NEW
        keywordsEl.innerText = data.keywords.join(", "); // NEW
      } else {
        keywordsEl.innerText = "No keywords available"; // NEW
      }
      // Color coding
      biasResult.className = "";
      if (data.bias === "Left") biasResult.classList.add("bias-left");
      else if (data.bias === "Right") biasResult.classList.add("bias-right");
      else biasResult.classList.add("bias-center");

      // Links (fallback if backend not ready)
      if (data.links && data.links.length > 0) {
        articleLinks.innerHTML = data.links.map(link =>
          `<li><a href="${link}" target="_blank">${link}</a></li>`
        ).join("");
      } else {
        articleLinks.innerHTML = `
          <li><a href="#">Right: Times of India</a></li>
          <li><a href="#">Center: Reuters</a></li>
        `;
      }

      resultsArea.classList.remove('hidden');
      analyzeBtn.innerText = "Analysis Complete";
      analyzeBtn.disabled = false;

    } catch (error) {
      console.error(error);
      showError("Backend not reachable.");
    }

  });
});

// Error display function
function showError(message) {
  resultsArea.innerHTML = `<p style="color:red;">${message}</p>`;
  resultsArea.classList.remove('hidden');

  analyzeBtn.innerText = "Try Again";
  analyzeBtn.disabled = false;
}
