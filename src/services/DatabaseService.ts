import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SQLiteDatabase } from 'expo-sqlite';
import * as SQLite from 'expo-sqlite';

const STORAGE_KEY = 'DB_FILENAME';
export const DEFAULT_DB = 'reddit_posts.db';

export class DatabaseService {
  private static instance: DatabaseService | null;
  private static inFlight: Promise<DatabaseService> | null = null;
  private db: SQLiteDatabase;
  private filename: string;

  private constructor(db: SQLiteDatabase, filename: string) {
    this.db = db;
    this.filename = filename;
    console.debug('DatabaseService.getFilename() called: ' + this.filename);

  }

  public static async getInstance(): Promise<DatabaseService> {
    // console.debug('DatabaseService.getInstance() called');

    if (DatabaseService.instance && await DatabaseService.instance.isConnectionValid()) {
      return DatabaseService.instance;
    }

    if (DatabaseService.inFlight) return DatabaseService.inFlight;

    DatabaseService.inFlight = (async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const filename = stored ?? DEFAULT_DB;
      const db = await SQLite.openDatabaseAsync(filename, { useNewConnection: true });

      const svc = new DatabaseService(db, filename);
      await svc.init();
      DatabaseService.instance = svc;
      DatabaseService.inFlight = null;
      return svc;
    })().catch((e) => {
      DatabaseService.inFlight = null;
      throw e;
    });

    return DatabaseService.inFlight;

    // const stored = await AsyncStorage.getItem(STORAGE_KEY);
    // const filename = stored ?? DEFAULT_DB;

    // const db = await SQLite.openDatabaseAsync(
    //   filename, 
    //   { useNewConnection: true } // stops null pointer exceptions caused by shared connection being automatically closed
    // );

    // const dbService = new DatabaseService(db, filename);
    // await dbService.init();
    // DatabaseService.instance = dbService;
    // return dbService;
  }

  private async isConnectionValid(): Promise<boolean> {
    try {
      await this.db.getFirstAsync('SELECT 1 as ok');
      return true;
    } catch {
      return false;
    }
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
        syncedAt          TEXT,
        lastSyncStatus    TEXT,
        lastSyncError     TEXT,
        customTitle       TEXT,
        customBody        TEXT,
        notes             TEXT,
        rating            REAL,
        isRead            INTEGER NOT NULL DEFAULT 0,
        isFavorite        INTEGER NOT NULL DEFAULT 0,
        isDeleted         INTEGER NOT NULL DEFAULT 0,
        extraFields       TEXT,
        bodyMinHash       TEXT,
        summary           TEXT
      );

      CREATE TABLE IF NOT EXISTS post_folders (
        post_id   INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
        PRIMARY KEY (post_id, folder_id)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // Migration: add minHash column if it doesn't exist
    const columns = await this.db.getAllAsync(`PRAGMA table_info(posts);`);
    const hasBodyMinHash = columns.some((col: any) => col.name === 'bodyMinHash');
    if (!hasBodyMinHash) {
      await this.db.execAsync(`ALTER TABLE posts ADD COLUMN bodyMinHash TEXT;`);
    }
    // Migration: add summary column if it doesn't exist
    const hasSummary = columns.some((col: any) => col.name === 'summary');
    if (!hasSummary) {
      await this.db.execAsync(`ALTER TABLE posts ADD COLUMN summary TEXT;`);
    }
    // Migration: add sync tracking columns if they don't exist
    const hasSyncedAt = columns.some((col: any) => col.name === 'syncedAt');
    if (!hasSyncedAt) {
      await this.db.execAsync(`ALTER TABLE posts ADD COLUMN syncedAt TEXT;`);
    }
    const hasLastSyncStatus = columns.some((col: any) => col.name === 'lastSyncStatus');
    if (!hasLastSyncStatus) {
      await this.db.execAsync(`ALTER TABLE posts ADD COLUMN lastSyncStatus TEXT;`);
    }
    const hasLastSyncError = columns.some((col: any) => col.name === 'lastSyncError');
    if (!hasLastSyncError) {
      await this.db.execAsync(`ALTER TABLE posts ADD COLUMN lastSyncError TEXT;`);
    }
    const hasIsDeleted = columns.some((col: any) => col.name === 'isDeleted');
    if (!hasIsDeleted) {
      await this.db.execAsync(`ALTER TABLE posts ADD COLUMN isDeleted INTEGER NOT NULL DEFAULT 0;`);
    }
  }

  public getDb(): SQLiteDatabase {
    return this.db;
  }

  public getFilename(): string {
    return this.filename;
  }
}
