export interface Post {
  /** Internal primary key */
  id: number;

  /** Reddit’s unique post ID */
  redditId: string;

  /** Full URL to the post */
  url: string;

  /** Extracted from Reddit */
  title: string;
  bodyText: string;
  author: string;
  subreddit: string;
  redditCreatedAt: Date;

  /** When the user added it */
  addedAt: Date;

  /** User-editable */
  customTitle?: string;
  customBody?: string;

  /** Personal metadata */
  notes?: string;
  rating?: number;       // 1–5 stars
  isRead: boolean;
  isFavorite: boolean;

  /** Folder association (one per post) */
  folderId?: number;

  /** Tag associations (many per post) */
  tagIds: number[];

  /** Any extra custom fields */
  extraFields?: Record<string, any>;
}
