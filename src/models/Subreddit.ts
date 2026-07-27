/**
 * A subreddit the user has explicitly added to their list.
 * Row existence = membership; profile fields are optional user curation,
 * mirroring AuthorProfile.
 */
export interface Subreddit {
  /** Subreddit name without the r/ prefix, e.g. "memes". Primary key. */
  name: string;
  isFavorite: boolean;
  /** Whether this subreddit is included when browsing "Search All". Defaults to true. */
  isEnabledForSearch: boolean;
  rating: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
