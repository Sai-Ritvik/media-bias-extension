
// 1. Grab all the visible text from the webpage
const articleText = document.body.innerText;

// 2. Clean it up slightly (removing extra spaces)
const cleanText = articleText.replace(/\s+/g, ' ').trim();

// 3. Log it
console.log("News Comparator Extracted Text:");
console.log(cleanText.substring(0, 500) + "... [TEXT TRUNCATED]");