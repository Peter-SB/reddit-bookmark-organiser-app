import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SQLiteDatabase } from 'expo-sqlite';
import * as SQLite from 'expo-sqlite';

const STORAGE_KEY = 'DB_FILENAME';
export const DEFAULT_DB = 'reddit_posts.db';

export class DatabaseService {
  private static instance: DatabaseService | null;
  private db: SQLiteDatabase;
  private filename: string;

  private constructor(db: SQLiteDatabase, filename: string) {
    this.db = db;
    this.filename = filename;
    console.debug('DatabaseService.getFilename() called: ' + this.filename);

  }

  public static async getInstance(): Promise<DatabaseService> {
    console.debug('DatabaseService.getInstance() called');

    if (DatabaseService.instance) {
      return DatabaseService.instance;
    }

    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const filename = stored ?? DEFAULT_DB;

    const db = await SQLite.openDatabaseAsync(
      filename, 
      { useNewConnection: true } // stops null pointer exceptions caused by shared connection being automatically closed
    );

    const dbService = new DatabaseService(db, filename);
    await dbService.init();
    DatabaseService.instance = dbService;
    return dbService;
  }

  public static async switchDatabase(filename: string): Promise<void> {
    if (DatabaseService.instance) {
      await DatabaseService.instance.db.closeAsync();
      DatabaseService.instance = null;
    }
    await AsyncStorage.setItem(STORAGE_KEY, filename);
    await DatabaseService.getInstance();   
  }

  private async init(): Promise<void> {
    await this.db.execAsync(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS folders (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL UNIQUE,
        parentId    INTEGER REFERENCES folders(id) ON DELETE SET NULL,
        createdAt   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS posts (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        redditId          TEXT    NOT NULL,
        url               TEXT    NOT NULL,
        title             TEXT    NOT NULL,
        bodyText          TEXT,
        author            TEXT    NOT NULL,
        subreddit         TEXT    NOT NULL,
        redditCreatedAt   TEXT    NOT NULL,
        addedAt           TEXT    NOT NULL,
        updatedAt         TEXT    DEFAULT CURRENT_TIMESTAMP,
        customTitle       TEXT,
        customBody        TEXT,
        notes             TEXT,
        rating            REAL,
        isRead            INTEGER NOT NULL DEFAULT 0,
        isFavorite        INTEGER NOT NULL DEFAULT 0,
        extraFields       TEXT,
        bodyMinHash       TEXT
      );

      CREATE TABLE IF NOT EXISTS post_folders (
        post_id   INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
        PRIMARY KEY (post_id, folder_id)
      );
    `);

    // Migration: add minHash column if it doesn't exist
    const columns = await this.db.getAllAsync(`PRAGMA table_info(posts);`);
    const hasBodyMinHash = columns.some((col: any) => col.name === 'bodyMinHash');
    if (!hasBodyMinHash) {
      await this.db.execAsync(`ALTER TABLE posts ADD COLUMN bodyMinHash TEXT;`);
    }
  }

  public getDb(): SQLiteDatabase {
    return this.db;
  }

  public getFilename(): string {
    return this.filename;
  }
}