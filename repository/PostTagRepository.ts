// src/repositories/PostTagRepository.ts
import type { SQLiteDatabase } from 'expo-sqlite';

export class PostTagRepository {
  constructor(private db: SQLiteDatabase) {}

  public async getTagIdsForPost(postId: number): Promise<number[]> {
    const rows = await this.db.getAllAsync<{ tagId: number }>(
      `SELECT tagId FROM post_tags WHERE postId = ?`, postId
    );
    return rows.map(r => r.tagId);
  }

  public async add(postId: number, tagId: number): Promise<void> {
    await this.db.runAsync(
      `INSERT OR IGNORE INTO post_tags (postId, tagId) VALUES (?, ?)`,
      postId, tagId
    );
  }

  public async remove(postId: number, tagId: number): Promise<number> {
    const res = await this.db.runAsync(
      `DELETE FROM post_tags WHERE postId = ? AND tagId = ?`,
      postId, tagId
    );
    return res.changes;
  }
}
