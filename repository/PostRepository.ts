// src/repositories/PostRepository.ts
import { Post } from '@/models/models';
import type { SQLiteDatabase } from 'expo-sqlite';
import { DatabaseService } from '../services/DatabaseService';
import { MinHashService } from '../services/MinHashService';

export class PostRepository {
  private db: SQLiteDatabase;

  private constructor(db: SQLiteDatabase) {
    this.db = db;
  }

  public static async create(): Promise<PostRepository> {
    console.debug('Creating PostRepository instance');
    const svc = await DatabaseService.getInstance();
    return new PostRepository(svc.getDb());
  }

  /** load tags separately */
  private async loadTagIds(postId: number): Promise<number[]> {
    const rows = await this.db.getAllAsync<{ tagId: number }>(
      `SELECT tagId FROM post_tags WHERE postId = ?`,
      postId
    );
    return rows.map(r => r.tagId);
  }

  public async getAll(): Promise<Post[]> {
    const rows = await this.db.getAllAsync<{
      id: number;
      redditId: string;
      url: string;
      title: string;
      bodyText: string | null;
      bodyMinHash: string | null;
      author: string;
      subreddit: string;
      redditCreatedAt: string;
      addedAt: string;
      customTitle: string | null;
      customBody: string | null;
      notes: string | null;
      rating: number | null;
      isRead: number;
      isFavorite: number;
      folderId: number | null;
      extraFields: string | null;
    }>(`SELECT * FROM posts ORDER BY addedAt DESC`);

    const posts = await Promise.all(
      rows.map(async r => ({
        id: r.id,
        redditId: r.redditId,
        url: r.url,
        title: r.title,
        bodyText: r.bodyText ?? '',
        bodyMinHash: r.bodyMinHash ?? undefined,
        author: r.author,
        subreddit: r.subreddit,
        redditCreatedAt: new Date(r.redditCreatedAt),
        addedAt: new Date(r.addedAt),
        customTitle: r.customTitle ?? undefined,
        customBody: r.customBody ?? undefined,
        notes: r.notes ?? undefined,
        rating: r.rating ?? undefined,
        isRead: r.isRead === 1,
        isFavorite: r.isFavorite === 1,
        extraFields: r.extraFields ? JSON.parse(r.extraFields) : undefined,
        folderIds: await this.loadFolderIds(r.id),
        tagIds: await this.loadTagIds(r.id),
      }))
    );
    return posts;
  }

  public async getById(id: number): Promise<Post | null> {
    const r = await this.db.getFirstAsync<{
      id: number;
      redditId: string;
      url: string;
      title: string;
      bodyText: string | null;
      bodyMinHash: string | null;
      author: string;
      subreddit: string;
      redditCreatedAt: string;
      addedAt: string;
      customTitle: string | null;
      customBody: string | null;
      notes: string | null;
      rating: number | null;
      isRead: number;
      isFavorite: number;
      folderId: number | null;
      extraFields: string | null;
    }>(`SELECT * FROM posts WHERE id = ?`, id);
    if (!r) return null;
    return {
      id: r.id,
      redditId: r.redditId,
      url: r.url,
      title: r.title,
      bodyText: r.bodyText ?? '',
      bodyMinHash: r.bodyMinHash ?? undefined,
      author: r.author,
      subreddit: r.subreddit,
      redditCreatedAt: new Date(r.redditCreatedAt),
      addedAt: new Date(r.addedAt),
      customTitle: r.customTitle ?? undefined,
      customBody: r.customBody ?? undefined,
      notes: r.notes ?? undefined,
      rating: r.rating ?? undefined,
      isRead: r.isRead === 1,
      isFavorite: r.isFavorite === 1,
      extraFields: r.extraFields ? JSON.parse(r.extraFields) : undefined,
      tagIds: await this.loadTagIds(r.id),
      folderIds: await this.loadFolderIds(r.id),
    };
  }

  public async create(post: Omit<Post,'id'|'tagIds'> & { tagIds?: number[] }): Promise<number> {
    const {
      redditId, url, title, bodyText, author, subreddit,
      redditCreatedAt, addedAt,
      customTitle, customBody, notes, rating,
      isRead, isFavorite, extraFields, tagIds = []
    } = post;

    // Generate MinHash signature for body text
    const bodyMinHashArr = MinHashService.generateSignature(bodyText || '');
    const bodyMinHash = JSON.stringify(bodyMinHashArr);

    const result = await this.db.runAsync(
      `INSERT INTO posts (
         redditId, url, title, bodyText, bodyMinHash, author, subreddit,
         redditCreatedAt, addedAt,
         customTitle, customBody, notes, rating,
         isRead, isFavorite, extraFields
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      redditId,
      url,
      title,
      bodyText ?? null,
      bodyMinHash ?? null,
      author,
      subreddit,
      redditCreatedAt.toISOString(),
      addedAt.toISOString(),
      customTitle ?? null,
      customBody ?? null,
      notes ?? null,
      rating ?? null,
      isRead ? 1 : 0,
      isFavorite ? 1 : 0,
      extraFields ? JSON.stringify(extraFields) : null,
    );
    const newId = result.lastInsertRowId;

    // attach tags
    for (const tagId of tagIds) {
      await this.db.runAsync(`INSERT INTO post_tags (postId, tagId) VALUES (?, ?)`, newId, tagId);
    }
    return newId;
  }

  /**
   * Find potential duplicates based on minHash similarity
   */
  public async findSimilarPosts(bodyText: string, threshold: number = 0.75): Promise<Post[]> {
    const start = Date.now();

    if (!bodyText || bodyText.trim().length < 10) {
      return [];
    }

    const inputHash = MinHashService.generateSignature(bodyText);
    if (!inputHash) return [];

    let elapsed = Date.now() - start;
    console.debug(`generating data took ${elapsed}ms`);

    // Get all posts with minhash - todo: optimise this query
    const rows = await this.db.getAllAsync<{
      id: number;
      bodyMinHash: string | null;
    }>(`SELECT id, bodyMinHash
        FROM posts WHERE bodyMinHash IS NOT NULL AND bodyMinHash != ''`);

    const similarPosts: Post[] = [];
    
    elapsed = Date.now() - start;
    console.debug(`querying data took ${elapsed}ms`);

    for (const row of rows) {
      if (row.bodyMinHash) {
        const similarity = MinHashService.similarity(inputHash, JSON.parse(row.bodyMinHash));
        console.debug(`Comparing with post ${row.id}: similarity = ${similarity}`);
        if (similarity >= threshold) {
          // Load full post data for similar posts
          const fullPost = await this.getById(row.id);
          if (fullPost) {
            similarPosts.push(fullPost);
          }
        }
      }
    }

    elapsed = Date.now() - start;
    console.debug(`findSimilarPosts took ${elapsed}ms`);

    return similarPosts;
  }

  public async update(post: Post): Promise<number> {
    const {
      id, title, bodyText, customTitle, customBody,
      notes, rating, isRead, isFavorite, extraFields, bodyMinHash
    } = post; // todo: clean this up. Remove and use post. bellow

    const result = await this.db.runAsync(
      `UPDATE posts SET
         title         = ?,
         bodyText      = ?,
         bodyMinHash   = ?,
         customTitle   = ?,
         customBody    = ?,
         notes         = ?,
         rating        = ?,
         isRead        = ?,
         isFavorite    = ?,
         extraFields   = ?,
         updatedAt    = CURRENT_TIMESTAMP
       WHERE id = ?`,
      title,
      bodyText,
      bodyMinHash ?? null,
      customTitle ?? null,
      customBody ?? null,
      notes ?? null,
      rating ?? null,
      post.isRead ? 1 : 0,
      post.isFavorite ? 1 : 0,
      post.extraFields ? JSON.stringify(post.extraFields) : null,
      id
    );

    for (const fid of post.folderIds ?? []) {
      await this.db.runAsync(
        `INSERT OR IGNORE INTO post_folders (post_id, folder_id) VALUES (?, ?)`,
        id, fid
      );
    }

    console.debug(`Updated post ${id}:`, result);

    // sync tags: delete all + reinsert
    await this.db.runAsync(`DELETE FROM post_tags WHERE postId = ?`, id);
    for (const tagId of post.tagIds) {
      await this.db.runAsync(`INSERT INTO post_tags (postId, tagId) VALUES (?, ?)`, id, tagId);
    }

    console.debug(`Updated tags for post ${id}:`, post.tagIds);
    return result.changes;
  }

  public async delete(id: number): Promise<number> {
    const result = await this.db.runAsync(`DELETE FROM posts WHERE id = ?`, id);
    return result.changes;
  }

  /** helpers */
  public async addTag(postId: number, tagId: number): Promise<void> {
    await this.db.runAsync(
      `INSERT OR IGNORE INTO post_tags (postId, tagId) VALUES (?, ?)`,
      postId,
      tagId
    );
  }

  public async removeTag(postId: number, tagId: number): Promise<number> {
    const r = await this.db.runAsync(
      `DELETE FROM post_tags WHERE postId = ? AND tagId = ?`,
      postId,
      tagId
    );
    return r.changes;
  }

  private async loadFolderIds(postId: number): Promise<number[]> {
    const rows = await this.db.getAllAsync<{ folder_id: number }>(
      `SELECT folder_id FROM post_folders WHERE post_id = ?`,
      postId
    );
    return rows.map(row => row.folder_id);
  }

  public async addPostToFolder(postId: number, folderId: number): Promise<void> {
    await this.db.runAsync(
      'INSERT OR IGNORE INTO post_folders (post_id, folder_id) VALUES (?, ?)',
      postId,
      folderId
    );
  }

  public async removeAllFoldersFromPost(postId: number): Promise<void> {
    await this.db.runAsync(
      'DELETE FROM post_folders WHERE post_id = ?',
      postId
    );
  }
}
