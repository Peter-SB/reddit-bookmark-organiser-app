import { Folder } from '@/models/models';
import type { SQLiteDatabase } from 'expo-sqlite';
import { DatabaseService } from '../services/DatabaseService';

export class FolderRepository {
  private db: SQLiteDatabase;

  private constructor(db: SQLiteDatabase) {
    this.db = db;
  }

  public static async create(): Promise<FolderRepository> {
    console.debug('Creating FolderRepository instance');
    const svc = await DatabaseService.getInstance();
    return new FolderRepository(svc.getDb());
  }

  public async getAll(): Promise<Folder[]> {
    const rows = await this.db.getAllAsync<{
      id: number;
      name: string;
      parentId: number | null;
      createdAt: string;
    }>(`SELECT id, name, parentId, createdAt FROM folders`);
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      parentId: r.parentId ?? undefined,
      createdAt: new Date(r.createdAt),
    }));
  }

  public async getById(id: number): Promise<Folder | null> {
    const r = await this.db.getFirstAsync<{
      id: number;
      name: string;
      parentId: number | null;
      createdAt: string;
    }>(`SELECT id, name, parentId, createdAt FROM folders WHERE id = ?`, id);
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      parentId: r.parentId ?? undefined,
      createdAt: new Date(r.createdAt),
    };
  }

  public async create(name: string, parentId?: number): Promise<number> {
    const createdAt = new Date().toISOString();
    const result = await this.db.runAsync(
      `INSERT INTO folders (name, parentId, createdAt) VALUES (?, ?, ?)`,
      name,
      parentId ?? null,
      createdAt
    );
    return result.lastInsertRowId;
  }

  public async update(id: number, name: string, parentId?: number): Promise<number> {
    const result = await this.db.runAsync(
      `UPDATE folders SET name = ?, parentId = ? WHERE id = ?`,
      name,
      parentId ?? null,
      id
    );
    return result.changes;
  }

  public async delete(id: number): Promise<number> {
    const result = await this.db.runAsync(`DELETE FROM folders WHERE id = ?`, id);
    return result.changes;
  }
}
