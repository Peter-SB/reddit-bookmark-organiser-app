// src/repository/SubredditRepository.ts
import { Subreddit } from '@/models/Subreddit';
import type { SQLiteDatabase } from 'expo-sqlite';
import { DatabaseService } from '../services/DatabaseService';

type SubredditRow = {
  name: string;
  isFavorite: number;
  isEnabledForSearch: number;
  rating: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export class SubredditRepository {
  private db: SQLiteDatabase;

  private constructor(db: SQLiteDatabase) {
    this.db = db;
  }

  private mapRow(row: SubredditRow): Subreddit {
    return {
      name: row.name,
      isFavorite: row.isFavorite === 1,
      isEnabledForSearch: row.isEnabledForSearch === 1,
      rating: row.rating ?? null,
      notes: row.notes ?? null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  public static async create(): Promise<SubredditRepository> {
    const svc = await DatabaseService.getInstance();
    return new SubredditRepository(svc.getDb());
  }

  public async getByName(name: string): Promise<Subreddit | null> {
    const row = await this.db.getFirstAsync<SubredditRow>(
      `SELECT * FROM subreddits WHERE name = ? COLLATE NOCASE`,
      name,
    );
    return row ? this.mapRow(row) : null;
  }

  public async getAll(): Promise<Subreddit[]> {
    const rows = await this.db.getAllAsync<SubredditRow>(
      `SELECT * FROM subreddits ORDER BY updatedAt DESC`,
    );
    return rows.map((r) => this.mapRow(r));
  }

  /**
   * Adds a subreddit to the list (idempotent). Returns the existing row
   * unchanged if it was already added.
   */
  public async add(name: string): Promise<Subreddit> {
    const now = new Date().toISOString();
    await this.db.runAsync(
      `INSERT OR IGNORE INTO subreddits (name, isFavorite, isEnabledForSearch, rating, notes, createdAt, updatedAt)
       VALUES (?, 0, 1, NULL, NULL, ?, ?)`,
      name,
      now,
      now,
    );
    return (await this.getByName(name))!;
  }

  /** Removes a subreddit from the list. Does not touch saved posts. */
  public async remove(name: string): Promise<void> {
    await this.db.runAsync(
      `DELETE FROM subreddits WHERE name = ? COLLATE NOCASE`,
      name,
    );
  }

  /**
   * Upsert: creates or updates the profile for the given subreddit.
   * Only call when the user has explicitly changed a field (lazy creation).
   */
  public async upsert(
    name: string,
    patch: Partial<
      Pick<Subreddit, 'isFavorite' | 'isEnabledForSearch' | 'rating' | 'notes'>
    >,
  ): Promise<Subreddit> {
    const now = new Date().toISOString();

    const existing = await this.getByName(name);

    if (existing) {
      const newIsFavorite =
        patch.isFavorite !== undefined ? patch.isFavorite : existing.isFavorite;
      const newIsEnabledForSearch =
        patch.isEnabledForSearch !== undefined
          ? patch.isEnabledForSearch
          : existing.isEnabledForSearch;
      const newRating =
        patch.rating !== undefined ? patch.rating : existing.rating;
      const newNotes =
        patch.notes !== undefined ? patch.notes : existing.notes;

      await this.db.runAsync(
        `UPDATE subreddits
         SET isFavorite = ?, isEnabledForSearch = ?, rating = ?, notes = ?, updatedAt = ?
         WHERE name = ? COLLATE NOCASE`,
        newIsFavorite ? 1 : 0,
        newIsEnabledForSearch ? 1 : 0,
        newRating ?? null,
        newNotes ?? null,
        now,
        name,
      );
    } else {
      const isFavorite = patch.isFavorite ?? false;
      const isEnabledForSearch = patch.isEnabledForSearch ?? true;
      const rating = patch.rating ?? null;
      const notes = patch.notes ?? null;

      await this.db.runAsync(
        `INSERT INTO subreddits (name, isFavorite, isEnabledForSearch, rating, notes, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        name,
        isFavorite ? 1 : 0,
        isEnabledForSearch ? 1 : 0,
        rating,
        notes,
        now,
        now,
      );
    }

    return (await this.getByName(name))!;
  }

  public async toggleFavorite(name: string): Promise<Subreddit> {
    const existing = await this.getByName(name);
    const newVal = existing ? !existing.isFavorite : true;
    return this.upsert(name, { isFavorite: newVal });
  }

  public async setEnabledForSearch(name: string, enabled: boolean): Promise<Subreddit> {
    return this.upsert(name, { isEnabledForSearch: enabled });
  }

  public async setRating(name: string, rating: number | null): Promise<Subreddit> {
    return this.upsert(name, { rating });
  }

  public async setNotes(name: string, notes: string | null): Promise<Subreddit> {
    return this.upsert(name, { notes });
  }
}
