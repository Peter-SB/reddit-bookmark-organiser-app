import { Linking } from "react-native";

export function openRedditUser(username?: string) {
  if (username) {
    Linking.openURL(`https://www.reddit.com/user/${username}`);
  }
}

export function openRedditSubreddit(subreddit?: string) {
  if (subreddit) {
    Linking.openURL(`https://www.reddit.com/r/${subreddit}`);
  }
}

export function openRedditPost(url?: string) {
  if (url) {
    Linking.openURL(url);
  }
}

/**
 * Extracts a bare subreddit name from a subreddit-root URL
 * (https://www.reddit.com/r/memes/) or a post permalink
 * (https://www.reddit.com/r/memes/comments/.../...) — both share
 * the leading /r/{name} path segment. Returns null if not a reddit.com URL
 * or no /r/ segment is found.
 */
export function parseSubredditFromUrl(input: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    return null;
  }
  if (!/^(www\.)?reddit\.com$/i.test(parsed.hostname)) return null;
  const match = parsed.pathname.match(/^\/r\/([A-Za-z0-9_]+)/i);
  return match ? match[1] : null;
}