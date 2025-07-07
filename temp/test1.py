import requests
from datetime import datetime

def get_reddit_post_data(post_url):
    # Ensure the URL ends with .json
    api_url = post_url.rstrip('/') + '.json'
    headers = {'User-Agent': 'reddit-post-scraper/1.0'}
    res = requests.get(api_url, headers=headers)
    if not res.ok:
        raise Exception(f"Failed to fetch: {res.reason}")
    data = res.json()
    post = data[0]['data']['children'][0]['data']
    return {
        'title': post['title'],
        'author': post['author'],
        'text': post['selftext'],
        'publishDate': datetime.utcfromtimestamp(post['created_utc']).isoformat() + 'Z',
        'url': 'https://reddit.com' + post['permalink']
    }

# Example usage:
if __name__ == "__main__":
    post_url = 'https://www.reddit.com/r/LocalLLaMA/comments/15sgg4m/what_modules_should_i_target_when_training_using/'  # Replace with your post URL
    try:
        post_data = get_reddit_post_data(post_url)
        print(post_data)
    except Exception as err:
        print(err)