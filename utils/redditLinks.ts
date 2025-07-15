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