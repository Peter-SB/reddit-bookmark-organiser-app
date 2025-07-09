import type { SQLiteDatabase } from 'expo-sqlite';
import * as SQLite from 'expo-sqlite';

export class DatabaseService {
  private static instance: DatabaseService;
  private db: SQLiteDatabase;

  private constructor(db: SQLiteDatabase) {
    this.db = db;
  }

  /** call this at app-start to get the ready DB */
  public static async getInstance(): Promise<DatabaseService> {
    console.debug('DatabaseService.getInstance() called');
    if (!DatabaseService.instance) {
      console.log('Creating new DatabaseService instance');
      const db = await SQLite.openDatabaseAsync('reddit_posts.db', { enableChangeListener: false });
      const svc = new DatabaseService(db);
      await svc.init();
      DatabaseService.instance = svc;
      console.log('DatabaseService instance created and initialized');
    }
    return DatabaseService.instance;
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

      CREATE TABLE IF NOT EXISTS tags (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL UNIQUE,
        createdAt   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        color       TEXT,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS posts (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        redditId          TEXT    NOT NULL UNIQUE,
        url               TEXT    NOT NULL,
        title             TEXT    NOT NULL,
        bodyText          TEXT,
        author            TEXT    NOT NULL,
        subreddit         TEXT    NOT NULL,
        redditCreatedAt   TEXT    NOT NULL,
        addedAt           TEXT    NOT NULL,
        customTitle       TEXT,
        customBody        TEXT,
        notes             TEXT,
        rating            REAL,
        isRead            INTEGER NOT NULL DEFAULT 0,
        isFavorite        INTEGER NOT NULL DEFAULT 0,
        folderId          INTEGER REFERENCES folders(id) ON DELETE SET NULL,
        extraFields       TEXT
      );

      CREATE TABLE IF NOT EXISTS post_tags (
        postId   INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        tagId    INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
        PRIMARY KEY (postId, tagId)
      );
    `);
  }

  public getDb(): SQLiteDatabase {
    return this.db;
  }
}