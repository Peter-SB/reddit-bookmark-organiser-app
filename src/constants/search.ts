export const DEFAULT_SEARCH_RESULTS = 50;

export const CHUNK_TYPES = [
  { value: "body", label: "Body" },
  { value: "summary_title", label: "Summary + Title" },
  { value: "title", label: "Title" },
] as const;

export type ChunkType = (typeof CHUNK_TYPES)[number]["value"];

export const DEFAULT_CHUNK_TYPE: ChunkType = "body";
