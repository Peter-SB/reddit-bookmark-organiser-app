// src/repository/PlaceMarkerRepository.ts
import { PlaceMarker } from '@/models/models';
import type { SQLiteDatabase } from 'expo-sqlite';
import { DatabaseService } from '../services/DatabaseService';

type PlaceMarkerRow = {
  id: number;
  post_id: number;
  char_index: number;
  context_before: string;
  context_after: string;
  created_at: string;
  updated_at: string;
};

export class PlaceMarkerRepository {
  private db: SQLiteDatabase;

  private constructor(db: SQLiteDatabase) {
    this.db = db;
  }

  private mapRowToPlaceMarker(row: PlaceMarkerRow): PlaceMarker {
    return {
      id: row.id,
      postId: row.post_id,
      charIndex: row.char_index,
      contextBefore: row.context_before,
      contextAfter: row.context_after,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  public static async create(): Promise<PlaceMarkerRepository> {
    const svc = await DatabaseService.getInstance();
    return new PlaceMarkerRepository(svc.getDb());
  }

  /**
   * Set (upsert) a place marker for a post. Only one marker is kept per post —
   * saving again overwrites the previous position. Context snippets are used to
   * recover the position after the body text has been edited.
   */
  public async setPlaceMarker(
    postId: number,
    charIndex: number,
    contextBefore: string,
    contextAfter: string
  ): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO place_markers (post_id, char_index, context_before, context_after, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(post_id) DO UPDATE SET
         char_index     = excluded.char_index,
         context_before = excluded.context_before,
         context_after  = excluded.context_after,
         updated_at     = CURRENT_TIMESTAMP`,
      postId,
      charIndex,
      contextBefore,
      contextAfter
    );
  }

  /** Get the place marker for a specific post without consuming (deleting) it. */
  public async getPlaceMarker(postId: number): Promise<PlaceMarker | null> {
    const row = await this.db.getFirstAsync<PlaceMarkerRow>(
      `SELECT * FROM place_markers WHERE post_id = ?`,
      postId
    );
    return row ? this.mapRowToPlaceMarker(row) : null;
  }

  /** Return all place markers ordered by most recently updated first. */
  public async getAllPlaceMarkers(): Promise<PlaceMarker[]> {
    const rows = await this.db.getAllAsync<PlaceMarkerRow>(
      `SELECT * FROM place_markers ORDER BY updated_at DESC`
    );
    return rows.map(r => this.mapRowToPlaceMarker(r));
  }

  /**
   * Consume a place marker: fetch it then immediately delete it.
   * Returns null if no marker exists for this post.
   */
  public async consumePlaceMarker(postId: number): Promise<PlaceMarker | null> {
    const marker = await this.getPlaceMarker(postId);
    if (!marker) return null;
    await this.deletePlaceMarker(postId);
    return marker;
  }

  /** Delete the place marker for a post. No-op if it doesn't exist. */
  public async deletePlaceMarker(postId: number): Promise<void> {
    await this.db.runAsync(
      `DELETE FROM place_markers WHERE post_id = ?`,
      postId
    );
  }
}
