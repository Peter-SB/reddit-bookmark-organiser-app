// src/repositories/PostRepository.ts
import { Post } from '@/models/models';
import type { SQLiteDatabase } from 'expo-sqlite';
import { DatabaseService } from '../services/DatabaseService';
import { MinHashService } from '../services/MinHashService';
import { parseDbDate } from '../utils/datetimeUtils';

type PostRow = {
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
  updatedAt: string;
  syncedAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  customTitle: string | null;
  customBody: string | null;
  notes: string | null;
  rating: number | null;
  isRead: number;
  isFavorite: number;
  isDeleted: number;
  folderId: number | null;
  extraFields: string | null;
  summary: string | null;
};

export class PostRepository {
  private db: SQLiteDatabase;

  private constructor(db: SQLiteDatabase) {
    this.db = db;
  }

  private async mapRowToPost(row: PostRow): Promise<Post> {
    let extraFields: Record<string, any> | undefined;
    if (row.extraFields) {
      try {
        extraFields = JSON.parse(row.extraFields);
      } catch {
        extraFields = undefined;
      }
    }

    return {
      id: row.id,
      redditId: row.redditId,
      url: row.url,
      title: row.title,
      bodyText: row.bodyText ?? '',
      bodyMinHash: row.bodyMinHash ?? undefined,
      author: row.author,
      subreddit: row.subreddit,
      redditCreatedAt: new Date(row.redditCreatedAt),
      addedAt: new Date(row.addedAt),
      updatedAt: parseDbDate(row.updatedAt),
      syncedAt: row.syncedAt ? parseDbDate(row.syncedAt) : null,
      lastSyncStatus: row.lastSyncStatus ?? undefined,
      lastSyncError: row.lastSyncError ?? undefined,
      customTitle: row.customTitle ?? undefined,
      customBody: row.customBody ?? undefined,
      notes: row.notes ?? undefined,
      rating: row.rating ?? undefined,
      isRead: row.isRead === 1,
      isFavorite: row.isFavorite === 1,
      extraFields,
      summary: row.summary ?? undefined,
      folderIds: await this.loadFolderIds(row.id),
    };
  }

  public static async create(): Promise<PostRepository> {
    console.debug('Creating PostRepository instance');
    const svc = await DatabaseService.getInstance();
    return new PostRepository(svc.getDb());
  }

  public async getAll(): Promise<Post[]> {
    const rows = await this.db.getAllAsync<PostRow>(
      `SELECT * FROM posts WHERE isDeleted = 0 ORDER BY addedAt DESC`
    );
    console.debug(`Retrieved ${rows.length} posts from database`);
    return Promise.all(rows.map(r => this.mapRowToPost(r)));
  }

  public async getById(id: number): Promise<Post | null> {
    const r = await this.db.getFirstAsync<PostRow>(
      `SELECT * FROM posts WHERE id = ? AND isDeleted = 0`,
      id
    );
    if (!r) return null;
    return this.mapRowToPost(r);
  }

  public async create(post: Omit<Post,'id'>): Promise<number> {
    const addedAt = post.addedAt ?? new Date();
    const updatedAt = post.updatedAt ?? addedAt ?? new Date();
    const syncedAt = post.syncedAt ? post.syncedAt : new Date(0);


    // Use provided MinHash if present, otherwise generate from body text
    let bodyMinHash: string | null = null;
    if (typeof post.bodyMinHash === 'string') {
      bodyMinHash = post.bodyMinHash;
    } else {
      const sig = MinHashService.generateSignature(post.bodyText || '');
      bodyMinHash = sig ? JSON.stringify(sig) : null;
    }


    const result = await this.db.runAsync(
      `INSERT INTO posts (
         redditId, url, title, bodyText, bodyMinHash, author, subreddit,
         redditCreatedAt, addedAt, updatedAt, syncedAt, lastSyncStatus, lastSyncError,
         customTitle, customBody, notes, rating,
         isRead, isFavorite, extraFields, summary
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      post.redditId,
      post.url,
      post.title,
      post.bodyText ?? null,
      bodyMinHash,
      post.author,
      post.subreddit,
      post.redditCreatedAt.toISOString(),
      addedAt.toISOString(),
      updatedAt.toISOString(),
      syncedAt.toISOString(),
      post.lastSyncStatus ?? null,
      post.lastSyncError ?? null,
      post.customTitle ?? null,
      post.customBody ?? null,
      post.notes ?? null,
      post.rating ?? null,
      post.isRead ? 1 : 0,
      post.isFavorite ? 1 : 0,
      post.extraFields ? JSON.stringify(post.extraFields) : null,
      post.summary ?? null,
    );
    const newId = result.lastInsertRowId;
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
        FROM posts
        WHERE isDeleted = 0
          AND bodyMinHash IS NOT NULL
          AND bodyMinHash != ''`);

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

  public async getPendingSyncPosts(): Promise<Post[]> {
    const rows = await this.db.getAllAsync<PostRow>(
      `SELECT * FROM posts
       WHERE isDeleted = 0
         AND (syncedAt IS NULL OR datetime(syncedAt) < datetime(updatedAt))`
    );
    console.debug(`Found ${rows.length} pending sync posts`);
    return Promise.all(rows.map(r => this.mapRowToPost(r)));
  }

  public async updateSyncState(
    postId: number,
    status: string,
    syncedAt: Date | string | null,
    error?: string | null
  ): Promise<void> {
    const syncedAtValue =
      syncedAt instanceof Date ? syncedAt.toISOString() : syncedAt ?? null;
    await this.db.runAsync(
      `UPDATE posts
         SET syncedAt = ?,
             lastSyncStatus = ?,
             lastSyncError = ?
       WHERE id = ?`,
      syncedAtValue,
      status,
      error ?? null,
      postId
    );
  }

  public async resetSyncStateForAll(): Promise<void> {
    await this.db.runAsync(
      `UPDATE posts
         SET syncedAt = NULL,
             lastSyncStatus = NULL,
             lastSyncError = NULL`
    );
  }

  public async update(post: Post): Promise<number> {
    const bodyMinHash = typeof post.bodyMinHash === 'string'
      ? post.bodyMinHash
      : post.bodyMinHash
        ? JSON.stringify(post.bodyMinHash)
        : null;
    const extraFields = post.extraFields ? JSON.stringify(post.extraFields) : null;

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
         summary       = ?,
         updatedAt     = CURRENT_TIMESTAMP
       WHERE id = ?`,
      post.title,
      post.bodyText ?? null,
      bodyMinHash,
      post.customTitle ?? null,
      post.customBody ?? null,
      post.notes ?? null,
      post.rating ?? null,
      post.isRead ? 1 : 0,
      post.isFavorite ? 1 : 0,
      extraFields,
      post.summary ?? null,
      post.id
    );

    for (const fid of post.folderIds ?? []) {
      await this.db.runAsync(
        `INSERT OR IGNORE INTO post_folders (post_id, folder_id) VALUES (?, ?)`,
        post.id, fid
      );
    }

    console.debug(`Updated post ${post.id}:`, result);
    return result.changes;
  }

  public async delete(id: number): Promise<number> {
    const result = await this.db.runAsync(
      `UPDATE posts
         SET isDeleted = 1,
             updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      id
    );
    return result.changes;
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
