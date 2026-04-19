/**
 * User-curated metadata for a Reddit author.
 * A row only exists if the user has explicitly set at least one field.
 */
export interface AuthorProfile {
  /** Reddit username (without u/ prefix). Primary key. */
  author: string;
  isFavorite: boolean;
  /** Star rating 0–5 (null = unrated) */
  rating: number | null;
  /** Free-text notes / description */
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
