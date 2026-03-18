const analyzeBtn = document.getElementById('analyzeBtn');
const resultsArea = document.getElementById('resultsArea');
const biasResult = document.getElementById('biasResult');
const explanationText = document.getElementById('explanationText');
const articleLinks = document.getElementById('articleLinks');

analyzeBtn.addEventListener('click', async function() {
  analyzeBtn.innerText = "Extracting article text...";
  
  // 1. Find the active tab the user is currently looking at
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // 2. Send a message to the content.js file injected in that tab
  chrome.tabs.sendMessage(tab.id, { action: "extractText" }, function(response) {
    
    // 3. Check if we got a successful reply back
    if (response && response.text) {
      
      // Let's log the first 100 characters to the POPUP's console to prove it arrived!
      console.log("SUCCESS! Popup received this text from the webpage:");
      console.log(response.text);

      analyzeBtn.innerText = "Analyzing text with AI...";
      resultsArea.classList.remove('hidden');

      // 4. Now we run our fake AI delay
      setTimeout(function() {
        biasResult.innerText = "Left-Leaning";
        biasResult.style.color = "blue";
        explanationText.innerText = "This article emphasizes progressive economic terminology.";
        articleLinks.innerHTML = `
          <li><a href="#">Right perspective: Times of India</a></li>
          <li><a href="#">Center perspective: Reuters</a></li>
        `;
        analyzeBtn.innerText = "Analysis Complete";
      }, 1500);

    } else {
      // If something goes wrong (like running it on a blank new tab)
      analyzeBtn.innerText = "Error: Could not read page";
      analyzeBtn.style.backgroundColor = "red";
    }
  });
});
