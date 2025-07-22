// src/repositories/TagRepository.ts
import { Tag } from '@/models/models';
import type { SQLiteDatabase } from 'expo-sqlite';
import { DatabaseService } from '../services/DatabaseService';


export class TagRepository {
  private db: SQLiteDatabase;

  private constructor(db: SQLiteDatabase) {
    this.db = db;
  }

  public static async create(): Promise<TagRepository> {
    const svc = await DatabaseService.getInstance();
    return new TagRepository(svc.getDb());
  }

  public async getAll(): Promise<Tag[]> {
    const rows = await this.db.getAllAsync<{
      id: number;
      name: string;
      createdAt: string;
      color: string | null;
      description: string | null;
    }>(`SELECT id, name, createdAt, color, description FROM tags`);
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      createdAt: new Date(r.createdAt),
      color: r.color ?? undefined,
      description: r.description ?? undefined,
    }));
  }

  public async getById(id: number): Promise<Tag | null> {
    const r = await this.db.getFirstAsync<{
      id: number;
      name: string;
      createdAt: string;
      color: string | null;
      description: string | null;
    }>(`SELECT id, name, createdAt, color, description FROM tags WHERE id = ?`, id);
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      createdAt: new Date(r.createdAt),
      color: r.color ?? undefined,
      description: r.description ?? undefined,
    };
  }

  public async create(name: string, color?: string, description?: string): Promise<number> {
    const result = await this.db.runAsync(
      `INSERT INTO tags (name, color, description) VALUES (?, ?, ?)`,
      name,
      color ?? null,
      description ?? null
    );
    return result.lastInsertRowId;
  }

  public async update(
    id: number,
    name: string,
    color?: string,
    description?: string
  ): Promise<number> {
    const result = await this.db.runAsync(
      `UPDATE tags SET name = ?, color = ?, description = ? WHERE id = ?`,
      name,
      color ?? null,
      description ?? null,
      id
    );
    return result.changes;
  }

  public async delete(id: number): Promise<number> {
    const result = await this.db.runAsync(`DELETE FROM tags WHERE id = ?`, id);
    return result.changes;
  }
}
