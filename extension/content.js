chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractText") {
    
    // 1. Instead of grabbing the whole body, find ONLY the paragraph tags
    const paragraphs = document.querySelectorAll('p');
    let articleText = "";
    
    // 2. Loop through every paragraph we found
    paragraphs.forEach((p) => {
       // Only keep paragraphs that have more than 50 characters.
       // This is a neat trick to filter out tiny ad links, author names, or footer text!
       if (p.innerText.length > 50) {
           articleText += p.innerText + " ";
       }
    });
    
    // 3. Clean up any weird spacing
    const cleanText = articleText.replace(/\s+/g, ' ').trim();
    
    // 4. Send the cleaned, highly-focused text back to the popup
    sendResponse({ text: cleanText });
  }
  return true; 
});