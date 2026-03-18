// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  // Check if the popup is specifically asking for the text
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
3. cleaning weird spaces
    const cleanText = articleText.replace(/\s+/g, ' ').trim();
    
    // 4. Reply to the popup with the text packaged inside an object
    sendResponse({ text: cleanText });
  }
  
  // Return true tells Chrome we are sending the response asynchronously
  return true; 
});
