const analyzeBtn = document.getElementById('analyzeBtn');
const resultsArea = document.getElementById('resultsArea');
const biasResult = document.getElementById('biasResult');
const explanationText = document.getElementById('explanationText');
const articleLinks = document.getElementById('articleLinks');

// 1. THE PLACEHOLDER ADDRESS: This is a standard local testing URL.
// dummy url
const BACKEND_URL = "http://127.0.0.1:8000/analyze"; 

analyzeBtn.addEventListener('click', async function() {
  analyzeBtn.innerText = "Extracting article text...";
  resultsArea.classList.add('hidden'); // Hide old results
  
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { action: "extractText" }, async function(response) {
    if (response && response.text) {
      analyzeBtn.innerText = "Sending to AI for analysis...";
      
      // 2. THE FETCH CALL (Talking to the server)
      try {
        const apiResponse = await fetch(BACKEND_URL, {
          method: 'POST', // We are "posting" data to the server
          headers: {
            'Content-Type': 'application/json',
          },
          // We package our extracted text into a JSON format
          body: JSON.stringify({ article_text: response.text }) 
        });

        // If the server connects but returns a failure code
        if (!apiResponse.ok) {
          throw new Error("Server responded with an error");
        }

        // 3. UNPACKING THE REPLY
        const data = await apiResponse.json();

        // 4. UPDATING THE UI WITH REAL DATA
        // (Assuming your backend sends { bias: "...", explanation: "..." })
        biasResult.innerText = data.bias; 
        explanationText.innerText = data.explanation;
        
        // We will keep dummy links here until your backend sends real ones
        articleLinks.innerHTML = `
          <li><a href="#">Right perspective: Times of India</a></li>
          <li><a href="#">Center perspective: Reuters</a></li>
        `;
        
        resultsArea.classList.remove('hidden');
        analyzeBtn.innerText = "Analysis Complete";

      } catch (error) {
        // 5. ERROR HANDLING: What happens if the server is offline?
        console.error("API Error:", error);
        analyzeBtn.innerText = "Error: Backend not reachable";
        analyzeBtn.style.backgroundColor = "#dc3545"; // Turn button red
      }

    } else {
      analyzeBtn.innerText = "Error: Could not read page";
      analyzeBtn.style.backgroundColor = "#dc3545";
    }
  });
});
