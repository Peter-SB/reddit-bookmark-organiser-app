// src/repositories/PostRepository.ts
import { Post } from '@/models/models';
import type { SQLiteDatabase } from 'expo-sqlite';
import { DatabaseService } from '../services/DatabaseService';

export class PostRepository {
  private db: SQLiteDatabase;

  private constructor(db: SQLiteDatabase) {
    this.db = db;
  }

  public static async create(): Promise<PostRepository> {
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

    // hydrate Dates, booleans & JSON
    const posts = await Promise.all(
      rows.map(async r => ({
        id: r.id,
        redditId: r.redditId,
        url: r.url,
        title: r.title,
        bodyText: r.bodyText ?? '',
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
        folderId: r.folderId ?? undefined,
        extraFields: r.extraFields ? JSON.parse(r.extraFields) : undefined,
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
      folderId: r.folderId ?? undefined,
      extraFields: r.extraFields ? JSON.parse(r.extraFields) : undefined,
      tagIds: await this.loadTagIds(r.id),
    };
  }

  public async create(post: Omit<Post,'id'|'tagIds'> & { tagIds?: number[] }): Promise<number> {
    const {
      redditId, url, title, bodyText, author, subreddit,
      redditCreatedAt, addedAt,
      customTitle, customBody, notes, rating,
      isRead, isFavorite, folderId, extraFields, tagIds = []
    } = post;

    const result = await this.db.runAsync(
      `INSERT INTO posts (
         redditId, url, title, bodyText, author, subreddit,
         redditCreatedAt, addedAt,
         customTitle, customBody, notes, rating,
         isRead, isFavorite, folderId, extraFields
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      redditId,
      url,
      title,
      bodyText ?? null,
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
      folderId ?? null,
      extraFields ? JSON.stringify(extraFields) : null
    );
    const newId = result.lastInsertRowId;

    // attach tags
    for (const tagId of tagIds) {
      await this.db.runAsync(`INSERT INTO post_tags (postId, tagId) VALUES (?, ?)`, newId, tagId);
    }
    return newId;
  }

  public async update(post: Post): Promise<number> {
    const {
      id, title, bodyText, customTitle, customBody,
      notes, rating, isRead, isFavorite, folderId, extraFields
    } = post;

    const result = await this.db.runAsync(
      `UPDATE posts SET
         title         = ?,
         bodyText      = ?,
         customTitle   = ?,
         customBody    = ?,
         notes         = ?,
         rating        = ?,
         isRead        = ?,
         isFavorite    = ?,
         folderId      = ?,
         extraFields   = ?,
         updated_at    = CURRENT_TIMESTAMP
       WHERE id = ?`,
      title,
      bodyText,
      customTitle ?? null,
      customBody ?? null,
      notes ?? null,
      rating ?? null,
      post.isRead ? 1 : 0,
      post.isFavorite ? 1 : 0,
      folderId ?? null,
      post.extraFields ? JSON.stringify(post.extraFields) : null,
      id
    );

    // sync tags: delete all + reinsert
    await this.db.runAsync(`DELETE FROM post_tags WHERE postId = ?`, id);
    for (const tagId of post.tagIds) {
      await this.db.runAsync(`INSERT INTO post_tags (postId, tagId) VALUES (?, ?)`, id, tagId);
    }

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
}
