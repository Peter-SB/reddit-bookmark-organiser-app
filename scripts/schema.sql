-- 1. Posts table
CREATE TABLE posts (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  reddit_id        TEXT    NOT NULL UNIQUE,
  url              TEXT    NOT NULL,
  title            TEXT    NOT NULL,
  body_text        TEXT,
  author           TEXT,
  subreddit        TEXT,
  reddit_created   INTEGER NOT NULL,  -- store as Unix epoch
  added_at         INTEGER NOT NULL,  -- Unix epoch
  custom_title     TEXT,
  custom_body      TEXT,
  notes            TEXT,
  rating           REAL,               -- floating point 1.0–5.0
  is_read          INTEGER NOT NULL DEFAULT 0,   -- 0 = false, 1 = true
  is_favorite      INTEGER NOT NULL DEFAULT 0,
  folder_id        INTEGER,            -- FK to folders(id)
  extra_fields     TEXT                -- JSON string
);

-- 2. Folders table
CREATE TABLE folders (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  name     TEXT    NOT NULL,
  parent_id INTEGER,           -- for nested folders
  created_at INTEGER NOT NULL  -- Unix epoch
);

-- 3. Tags table
CREATE TABLE tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

-- 4. Junction table for Post–Tag many-to-many
CREATE TABLE post_tags (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);
