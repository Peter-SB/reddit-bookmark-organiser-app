export interface Folder {
  /** Internal primary key */
  id: number;
  /** Folder name */
  name: string;
  /** Parent folder for nesting (optional) */
  parentId?: number;
  /** When the folder was created */
  createdAt: Date;
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
