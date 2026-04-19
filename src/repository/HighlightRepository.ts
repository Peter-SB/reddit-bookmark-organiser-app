// src/repository/HighlightRepository.ts
import { Highlight } from '@/models/models';
import type { SQLiteDatabase } from 'expo-sqlite';
import { DatabaseService } from '../services/DatabaseService';

type HighlightRow = {
  id: number;
  post_id: number;
  text: string;
  note: string | null;
  start_offset: number | null;
  end_offset: number | null;
  created_at: string;
  updated_at: string;
  is_deleted: number;
};

export class HighlightRepository {
  private db: SQLiteDatabase;

  private constructor(db: SQLiteDatabase) {
    this.db = db;
  }

  private mapRowToHighlight(row: HighlightRow): Highlight {
    return {
      id: row.id,
      postId: row.post_id,
      text: row.text,
      note: row.note ?? undefined,
      startOffset: row.start_offset ?? undefined,
      endOffset: row.end_offset ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      isDeleted: row.is_deleted === 1,
    };
  }

  public static async create(): Promise<HighlightRepository> {
    console.debug('Creating HighlightRepository instance');
    const svc = await DatabaseService.getInstance();
    return new HighlightRepository(svc.getDb());
  }

  public async createHighlight(
    postId: number,
    payload: {
      text: string;
      note?: string;
      startOffset?: number;
      endOffset?: number;
    }
  ): Promise<number> {
    const result = await this.db.runAsync(
      `INSERT INTO highlights (post_id, text, note, start_offset, end_offset)
       VALUES (?, ?, ?, ?, ?)`,
      postId,
      payload.text,
      payload.note ?? null,
      payload.startOffset ?? null,
      payload.endOffset ?? null
    );
    return result.lastInsertRowId;
  }

  public async getHighlightsByPostId(postId: number): Promise<Highlight[]> {
    const rows = await this.db.getAllAsync<HighlightRow>(
      `SELECT * FROM highlights 
       WHERE post_id = ? AND is_deleted = 0 
       ORDER BY created_at DESC`,
      postId
    );
    return rows.map(r => this.mapRowToHighlight(r));
  }

  public async getAllHighlights(): Promise<Highlight[]> {
    const rows = await this.db.getAllAsync<HighlightRow>(
      `SELECT * FROM highlights 
       WHERE is_deleted = 0 
       ORDER BY created_at DESC`
    );
    return rows.map(r => this.mapRowToHighlight(r));
  }

  public async getById(id: number): Promise<Highlight | null> {
    const row = await this.db.getFirstAsync<HighlightRow>(
      `SELECT * FROM highlights WHERE id = ? AND is_deleted = 0`,
      id
    );
    if (!row) return null;
    return this.mapRowToHighlight(row);
  }

  public async updateHighlight(
    id: number,
    changes: {
      text?: string;
      note?: string;
      startOffset?: number | null;
      endOffset?: number | null;
    }
  ): Promise<void> {
    const highlight = await this.getById(id);
    if (!highlight) throw new Error(`Highlight ${id} not found`);

    await this.db.runAsync(
      `UPDATE highlights SET
         text = ?,
         note = ?,
         start_offset = ?,
         end_offset = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      changes.text ?? highlight.text,
      changes.note ?? highlight.note ?? null,
      changes.startOffset !== undefined ? changes.startOffset : highlight.startOffset ?? null,
      changes.endOffset !== undefined ? changes.endOffset : highlight.endOffset ?? null,
      id
    );
  }

  public async deleteHighlight(id: number): Promise<void> {
    await this.db.runAsync(
      `UPDATE highlights 
       SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      id
    );
  }
}
