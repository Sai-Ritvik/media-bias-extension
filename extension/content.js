chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractText") {

    // Try to target main article first
    const article = document.querySelector('article') || document.body;

    const paragraphs = article.querySelectorAll('p');
    let articleText = "";

    paragraphs.forEach((p) => {
      if (p.innerText.length > 50) {
        articleText += p.innerText + " ";
      }
    });

    // Clean text
    const cleanText = articleText.replace(/\s+/g, ' ').trim();

    sendResponse({ text: cleanText });
  }

  return true;
});