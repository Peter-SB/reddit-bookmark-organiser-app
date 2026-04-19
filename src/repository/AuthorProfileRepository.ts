// src/repository/AuthorProfileRepository.ts
import { AuthorProfile } from '@/models/AuthorProfile';
import type { SQLiteDatabase } from 'expo-sqlite';
import { DatabaseService } from '../services/DatabaseService';

type AuthorProfileRow = {
  author: string;
  isFavorite: number;
  rating: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export class AuthorProfileRepository {
  private db: SQLiteDatabase;

  private constructor(db: SQLiteDatabase) {
    this.db = db;
  }

  private mapRow(row: AuthorProfileRow): AuthorProfile {
    return {
      author: row.author,
      isFavorite: row.isFavorite === 1,
      rating: row.rating ?? null,
      notes: row.notes ?? null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  public static async create(): Promise<AuthorProfileRepository> {
    const svc = await DatabaseService.getInstance();
    return new AuthorProfileRepository(svc.getDb());
  }

  public async getByAuthor(author: string): Promise<AuthorProfile | null> {
    const row = await this.db.getFirstAsync<AuthorProfileRow>(
      `SELECT * FROM author_profiles WHERE author = ? COLLATE NOCASE`,
      author,
    );
    return row ? this.mapRow(row) : null;
  }

  public async getAll(): Promise<AuthorProfile[]> {
    const rows = await this.db.getAllAsync<AuthorProfileRow>(
      `SELECT * FROM author_profiles ORDER BY updatedAt DESC`,
    );
    return rows.map((r) => this.mapRow(r));
  }

  /**
   * Upsert: creates or updates the profile for the given author.
   * Only call when the user has explicitly changed a field (lazy creation).
   */
  public async upsert(
    author: string,
    patch: Partial<Pick<AuthorProfile, 'isFavorite' | 'rating' | 'notes'>>,
  ): Promise<AuthorProfile> {
    const now = new Date().toISOString();

    // Try to get existing
    const existing = await this.getByAuthor(author);

    if (existing) {
      const newIsFavorite =
        patch.isFavorite !== undefined ? patch.isFavorite : existing.isFavorite;
      const newRating =
        patch.rating !== undefined ? patch.rating : existing.rating;
      const newNotes =
        patch.notes !== undefined ? patch.notes : existing.notes;

      await this.db.runAsync(
        `UPDATE author_profiles
         SET isFavorite = ?, rating = ?, notes = ?, updatedAt = ?
         WHERE author = ? COLLATE NOCASE`,
        newIsFavorite ? 1 : 0,
        newRating ?? null,
        newNotes ?? null,
        now,
        author,
      );
    } else {
      const isFavorite = patch.isFavorite ?? false;
      const rating = patch.rating ?? null;
      const notes = patch.notes ?? null;

      await this.db.runAsync(
        `INSERT INTO author_profiles (author, isFavorite, rating, notes, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
        author,
        isFavorite ? 1 : 0,
        rating,
        notes,
        now,
        now,
      );
    }

    return (await this.getByAuthor(author))!;
  }

  public async toggleFavorite(author: string): Promise<AuthorProfile> {
    const existing = await this.getByAuthor(author);
    const newVal = existing ? !existing.isFavorite : true;
    return this.upsert(author, { isFavorite: newVal });
  }

  public async setRating(
    author: string,
    rating: number | null,
  ): Promise<AuthorProfile> {
    return this.upsert(author, { rating });
  }

  public async setNotes(
    author: string,
    notes: string | null,
  ): Promise<AuthorProfile> {
    return this.upsert(author, { notes });
  }
}
