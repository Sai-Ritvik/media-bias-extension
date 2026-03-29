
.catch(err => {
    console.error(err);
    document.getElementById("result").innerText = "Error fetching news";
});

function getNews() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
       
        let title = tabs[0].title || "news";

        title = title.split("|")[0].split("-")[0];
        title = title.split(" ").slice(0, 6).join(" ");

        fetch(`http://127.0.0.1:5000/news?q=${encodeURIComponent(title)}`)
    .then(res =>{
           console.log("STATUS:", res.status);
        return res.json();
    })
    .then(data => {
         console.log("DATA:", data);
      
        const resultDiv = document.getElementById("result");

        resultDiv.innerHTML = `
            <h3>LEFT</h3>
            ${format(data.left)}

            <h3>CENTER</h3>
            ${format(data.center)}

            <h3>RIGHT</h3>
            ${format(data.right)}
        `;
    })
    .catch(err => {
        console.error(err);
        document.getElementById("result").innerText = "Error fetching news";
 
 
    });
}

function format(article) {
    if (!article) return "<p>No article</p>";

    return `
        <p>
            <b>${article.title || "No title"}</b><br>
            ${article.source?.name || "Unknown"}<br>
            <a href="${article.url}" target="_blank">Read</a>
        </p>
    `;
}
