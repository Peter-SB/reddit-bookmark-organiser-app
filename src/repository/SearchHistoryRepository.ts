import type { SQLiteDatabase } from "expo-sqlite";

import type { ChunkType } from "@/constants/search";
import type { SemanticSearchResult } from "@/services/SemanticSearchService";
import { DatabaseService } from "@/services/DatabaseService";
import { parseDbDate } from "@/utils/datetimeUtils";

export type SearchHistoryStatus = "pending" | "complete" | "error";

export type SearchHistoryEntry = {
  id: number;
  query: string;
  chunkType: ChunkType;
  k: number;
  libraryId: string;
  status: SearchHistoryStatus;
  results: SemanticSearchResult[];
  error: string | null;
  pollStatus?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateSearchHistoryEntryParams = {
  query: string;
  chunkType: ChunkType;
  k: number;
  libraryId: string;
};

type SearchHistoryRow = {
  id: number;
  query: string;
  chunk_type: string;
  k: number;
  library_id: string;
  status: string;
  results: string | null;
  error: string | null;
  poll_status: string | null;
  created_at: string;
  updated_at: string;
};

export class SearchHistoryRepository {
  private constructor(private db: SQLiteDatabase) {}

  public static async create(): Promise<SearchHistoryRepository> {
    const svc = await DatabaseService.getInstance();
    return new SearchHistoryRepository(svc.getDb());
  }

  private mapRow(row: SearchHistoryRow): SearchHistoryEntry {
    let results: SemanticSearchResult[] = [];
    if (row.results) {
      try {
        results = JSON.parse(row.results);
      } catch {
        results = [];
      }
    }
    return {
      id: row.id,
      query: row.query,
      chunkType: row.chunk_type as ChunkType,
      k: row.k,
      libraryId: row.library_id,
      status: row.status as SearchHistoryStatus,
      results,
      error: row.error,
      pollStatus: row.poll_status,
      createdAt: parseDbDate(row.created_at),
      updatedAt: parseDbDate(row.updated_at),
    };
  }

  async createEntry(params: CreateSearchHistoryEntryParams): Promise<number> {
    const result = await this.db.runAsync(
      `INSERT INTO semantic_search_history (query, chunk_type, k, library_id, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [params.query, params.chunkType, params.k, params.libraryId]
    );
    return result.lastInsertRowId;
  }

  async listAll(): Promise<SearchHistoryEntry[]> {
    const rows = await this.db.getAllAsync<SearchHistoryRow>(
      `SELECT * FROM semantic_search_history ORDER BY created_at DESC`
    );
    return rows.map((row) => this.mapRow(row));
  }

  async getById(id: number): Promise<SearchHistoryEntry | null> {
    const row = await this.db.getFirstAsync<SearchHistoryRow>(
      `SELECT * FROM semantic_search_history WHERE id = ?`,
      [id]
    );
    return row ? this.mapRow(row) : null;
  }

  async markComplete(id: number, results: SemanticSearchResult[]): Promise<void> {
    await this.db.runAsync(
      `UPDATE semantic_search_history
       SET status = 'complete', results = ?, error = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [JSON.stringify(results), id]
    );
  }

  async markError(id: number, error: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE semantic_search_history
       SET status = 'error', error = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [error, id]
    );
  }

  async updatePollStatus(id: number, pollStatus: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE semantic_search_history
       SET poll_status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [pollStatus, id]
    );
  }

  async delete(id: number): Promise<void> {
    await this.db.runAsync(`DELETE FROM semantic_search_history WHERE id = ?`, [id]);
  }
}
