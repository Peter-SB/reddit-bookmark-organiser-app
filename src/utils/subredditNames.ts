/**
 * Reddit's own multireddit syntax joins subreddit names with "+"
 * (e.g. "r/sub1+sub2+sub3"), which is what the "Search All" combined feed
 * URL uses. Shared by the subreddit browse screen (parsing the route param)
 * and the subreddits list screen (building the route param).
 */

/** Splits a "sub1+sub2" route param into individual, trimmed subreddit names. */
export function parseSubredditNames(raw: string): string[] {
  return raw
    .split('+')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Joins subreddit names into the "sub1+sub2" combined-feed route param. */
export function joinSubredditNames(names: string[]): string {
  return names.join('+');
}
