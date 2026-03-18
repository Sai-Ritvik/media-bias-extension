// Step 1: Grab the HTML elements so JavaScript can control them
const analyzeBtn = document.getElementById('analyzeBtn');
const resultsArea = document.getElementById('resultsArea');
const biasResult = document.getElementById('biasResult');
const explanationText = document.getElementById('explanationText');
const articleLinks = document.getElementById('articleLinks');

// Step 2: Listen for a click on the button
analyzeBtn.addEventListener('click', function() {
  
  // Change the button text so the user knows it's working
  analyzeBtn.innerText = "Analyzing article...";
  
  // Unhide the results box
  resultsArea.classList.remove('hidden');

  // Step 3: Simulate a delay to act like the backend AI is thinking
  // Later, we will replace this with an actual fetch() call to your team's API
  setTimeout(function() {
    biasResult.innerText = "Left-Leaning";
    biasResult.style.color = "blue";
    
    explanationText.innerText = "This article emphasizes progressive economic terminology.";
    
    articleLinks.innerHTML = `
      <li><a href="#">Right perspective: Times of India</a></li>
      <li><a href="#">Center perspective: Reuters</a></li>
    `;
    
    analyzeBtn.innerText = "Analysis Complete";
  }, 1500); // Wait 1.5 seconds before showing results
});