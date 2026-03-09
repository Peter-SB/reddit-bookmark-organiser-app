/**
 * Aggregated author statistics derived from the posts table.
 * No dedicated author table — computed via SQL GROUP BY.
 */
export interface AuthorSummary {
  /** Reddit username (without u/ prefix) */
  author: string;
  /** Total number of saved posts by this author */
  postCount: number;
  /** Number of posts marked as read */
  readCount: number;
  /** Number of posts marked as favourite */
  favouriteCount: number;
  /** Number of posts marked as archived */
  archivedCount: number;
  /** Average star rating across rated posts (null if no rated posts) */
  avgRating: number | null;
  /** Sum of all star ratings */
  totalRating: number;
  /** Most recent addedAt date among author's posts */
  lastAddedAt: Date;
}
