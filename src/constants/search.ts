export const DEFAULT_SEARCH_RESULTS = 50;

export const CHUNK_TYPES = [
  { value: "body", label: "Body" },
  { value: "summary_title", label: "Summary + Title" },
  { value: "title", label: "Title" },
] as const;

export type ChunkType = (typeof CHUNK_TYPES)[number]["value"];

export const DEFAULT_CHUNK_TYPE: ChunkType = "body";

/**
 * Thresholds offered for the minimum upvote / comment filters. 0 = no minimum.
 * Reddit's search API has no server-side score filter (the old cloudsearch
 * `score:` syntax was removed), so these are applied client-side to fetched
 * pages by both the subreddit browse screen and the subreddit search form.
 */
export const MIN_COUNT_OPTIONS = [0, 5, 10, 25, 50, 100, 500];
