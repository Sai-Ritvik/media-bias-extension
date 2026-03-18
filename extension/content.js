// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  // Check if the popup is specifically asking for the text
  if (request.action === "extractText") {
    
    // 1. Grab the text
    const articleText = document.body.innerText;
    
    // 2. Clean it up
    const cleanText = articleText.replace(/\s+/g, ' ').trim();
    
    // 3. Reply to the popup with the text packaged inside an object
    sendResponse({ text: cleanText });
  }
  
  // Return true tells Chrome we are sending the response asynchronously
  return true; 
});