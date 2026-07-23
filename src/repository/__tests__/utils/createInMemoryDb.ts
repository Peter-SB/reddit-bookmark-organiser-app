/**
 * In-memory SQLite adapter for tests.
 *
 * Uses better-sqlite3 (synchronous, pure Node.js) and wraps it in the same
 * async interface that PostRepository expects from expo-sqlite, so the
 * repository can be tested against real SQL without any Expo environment.
 */
import Database from 'better-sqlite3';

/** The subset of the expo-sqlite async interface that PostRepository uses. */
export interface AsyncDbAdapter {
  getFirstAsync<T = unknown>(sql: string, ...params: any[]): Promise<T | null>;
  getAllAsync<T = unknown>(sql: string, ...params: any[]): Promise<T[]>;
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: any[]): Promise<{ lastInsertRowId: number; changes: number }>;
  closeAsync(): Promise<void>;
}

const SCHEMA_SQL = `
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA temp_store = MEMORY;

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
    isArchived        INTEGER NOT NULL DEFAULT 0,
    extraFields       TEXT,
    bodyMinHash       TEXT,
    summary           TEXT,
    readAt            TEXT,
    queuedAt          TEXT,
    wordCount         INTEGER NOT NULL DEFAULT 0
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

  CREATE TABLE IF NOT EXISTS highlights (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id     INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    text        TEXT    NOT NULL,
    note        TEXT,
    start_offset INTEGER,
    end_offset   INTEGER,
    created_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_deleted   INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_highlights_post_id ON highlights(post_id);

  CREATE TABLE IF NOT EXISTS place_markers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id         INTEGER NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
    char_index      INTEGER NOT NULL DEFAULT 0,
    context_before  TEXT    NOT NULL DEFAULT '',
    context_after   TEXT    NOT NULL DEFAULT '',
    created_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_place_markers_updated_at ON place_markers(updated_at DESC);

  CREATE TABLE IF NOT EXISTS semantic_search_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    query       TEXT    NOT NULL,
    chunk_type  TEXT    NOT NULL,
    k           INTEGER NOT NULL,
    library_id  TEXT    NOT NULL,
    status      TEXT    NOT NULL DEFAULT 'pending',
    results     TEXT,
    error       TEXT,
    created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_semantic_search_history_created_at ON semantic_search_history(created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_posts_deleted_archived_added         ON posts(isDeleted, isArchived, addedAt);
  CREATE INDEX IF NOT EXISTS idx_posts_deleted_archived_updated       ON posts(isDeleted, isArchived, updatedAt);
  CREATE INDEX IF NOT EXISTS idx_posts_deleted_archived_queued        ON posts(isDeleted, isArchived, queuedAt);
  CREATE INDEX IF NOT EXISTS idx_posts_deleted_archived_rating        ON posts(isDeleted, isArchived, rating);
  CREATE INDEX IF NOT EXISTS idx_posts_deleted_archived_read_added    ON posts(isDeleted, isArchived, isRead, addedAt);
  CREATE INDEX IF NOT EXISTS idx_posts_deleted_archived_read_updated  ON posts(isDeleted, isArchived, isRead, updatedAt);
  CREATE INDEX IF NOT EXISTS idx_posts_deleted_archived_read_queued   ON posts(isDeleted, isArchived, isRead, queuedAt);
  CREATE INDEX IF NOT EXISTS idx_posts_deleted_archived_favorite      ON posts(isDeleted, isArchived, isFavorite, updatedAt);
  CREATE INDEX IF NOT EXISTS idx_posts_deleted_minhash                ON posts(isDeleted, bodyMinHash);
  CREATE INDEX IF NOT EXISTS idx_posts_deleted_archived_readat        ON posts(isDeleted, isArchived, readAt);
  CREATE INDEX IF NOT EXISTS idx_posts_deleted_archived_wordcount     ON posts(isDeleted, isArchived, wordCount);
`;

/**
 * Creates a fresh in-memory SQLite database with the full app schema applied.
 * Returns an async adapter compatible with the expo-sqlite interface.
 *
 * Each call returns an isolated DB — safe to create per-test.
 */
export function createInMemoryDb(): AsyncDbAdapter {
  const db = new Database(':memory:');
  db.exec(SCHEMA_SQL);

  return {
    async getFirstAsync<T>(sql: string, ...params: any[]): Promise<T | null> {
      const stmt = db.prepare(sql);
      const row = stmt.get(...params) as T | undefined;
      return row ?? null;
    },

    async getAllAsync<T>(sql: string, ...params: any[]): Promise<T[]> {
      const stmt = db.prepare(sql);
      return stmt.all(...params) as T[];
    },

    async execAsync(sql: string): Promise<void> {
      db.exec(sql);
    },

    async runAsync(sql: string, ...params: any[]): Promise<{ lastInsertRowId: number; changes: number }> {
      const stmt = db.prepare(sql);
      const info = stmt.run(...params);
      return {
        lastInsertRowId: Number(info.lastInsertRowid),
        changes: info.changes,
      };
    },

    async closeAsync(): Promise<void> {
      db.close();
    },
  };
}

// ── Seed helpers ──────────────────────────────────────────────────────────────

export interface SeedPostOptions {
  id?: number;
  title?: string;
  author?: string;
  subreddit?: string;
  isRead?: boolean;
  isFavorite?: boolean;
  isArchived?: boolean;
  queuedAt?: string | null;
  rating?: number | null;
  addedAt?: string;
  wordCount?: number;
  bodyText?: string;
}

/**
 * Inserts a single post into the DB and returns its auto-assigned id.
 * Uses explicit INSERT so the caller controls all fields deterministically.
 */
export function seedPost(db: AsyncDbAdapter, opts: SeedPostOptions = {}): Promise<number> {
  const {
    title = 'Test Post',
    author = 'testuser',
    subreddit = 'test',
    isRead = false,
    isFavorite = false,
    isArchived = false,
    queuedAt = null,
    rating = null,
    addedAt = new Date().toISOString(),
    bodyText = 'body text here',
  } = opts;

  return db
    .runAsync(
      `INSERT INTO posts
         (redditId, url, title, bodyText, author, subreddit, redditCreatedAt, addedAt,
          isRead, isFavorite, isArchived, queuedAt, rating)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      `reddit_${Math.random().toString(36).slice(2)}`,
      `https://reddit.com/r/${subreddit}/comments/test`,
      title,
      bodyText,
      author,
      subreddit,
      addedAt,
      addedAt,
      isRead ? 1 : 0,
      isFavorite ? 1 : 0,
      isArchived ? 1 : 0,
      queuedAt,
      rating,
    )
    .then((r) => r.lastInsertRowId);
}

/**
 * Inserts N posts with predictable, index-based data for bulk testing.
 * Returns the array of inserted IDs in insertion order.
 */
export async function seedManyPosts(db: AsyncDbAdapter, count: number): Promise<number[]> {
  const ids: number[] = [];
  for (let i = 1; i <= count; i++) {
    const id = await seedPost(db, {
      title: `Post ${i}`,
      author: `user_${i % 10}`,
      subreddit: `sub_${i % 5}`,
      isRead: i % 3 === 0,
      isFavorite: i % 7 === 0,
      rating: i % 6 === 0 ? (i % 5) + 1 : null,
      addedAt: new Date(Date.UTC(2024, 0, 1) + i * 60_000).toISOString(),
      bodyText: 'word '.repeat(50 + i),
    });
    ids.push(id);
  }
  return ids;
}
