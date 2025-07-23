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
  rating?: number;       // 1–5 stars (float)
  isRead: boolean;
  isFavorite: boolean;

  /** Folder association (one per post) */
  folderIds: number[];

  /** Tag associations (many per post) */
  tagIds: number[];

  /** Any extra custom fields */
  extraFields?: Record<string, any>;

  /** MinHash for duplicate detection in-case of repost or reupload */
  bodyMinHash?: string;
}

export interface Folder {
  /** Internal primary key */
  id: number;
  /** Folder name */
  name: string;
  /** Parent folder for nesting (optional) */
  parentId?: number;
  /** When the folder was created */
  createdAt: Date;
  /** List of post IDs associated with this folder */
  folderPostIds: number[];
}

export interface PostFolder {
  /** Post ID (FK) */
  postId: number;
  /** Folder ID (FK) */
  folderId: number;
}

export interface Tag {
  /** Internal primary key */
  id: number;
  /** Tag name (unique) */
  name: string;
  /** When the tag was created */
  createdAt: Date;
    /** Optional color for UI representation */
    color?: string;
    /** Optional description for the tag */
    description?: string;

}

export interface PostTag {
  /** Post ID (FK) */
  postId: number;
  /** Tag ID (FK) */
  tagId: number;
}
