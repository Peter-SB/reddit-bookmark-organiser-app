const fetch = require('node-fetch');

async function getRedditPostData(postUrl) {
    // Ensure the URL ends with a slash and .json
    let apiUrl = postUrl.replace(/\/$/, '') + '.json';

    const res = await fetch(apiUrl, {
        headers: { 'User-Agent': 'reddit-post-scraper/1.0' }
    });
    if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
    const data = await res.json();

    // Reddit post data is in data[0].data.children[0].data
    const post = data[0].data.children[0].data;

    return {
        title: post.title,
        author: post.author,
        text: post.selftext,
        publishDate: new Date(post.created_utc * 1000).toISOString(),
        url: 'https://reddit.com' + post.permalink
    };
}

// Example usage:
(async () => {
    const postUrl = 'https://www.reddit.com/r/LocalLLaMA/comments/15sgg4m/what_modules_should_i_target_when_training_using/'; // Replace with your post URL
    try {
        const postData = await getRedditPostData(postUrl);
        console.log(postData);
    } catch (err) {
        console.error(err);
    }
})();