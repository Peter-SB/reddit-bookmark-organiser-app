import { OrderByOption } from "@/constants/orderBy";
// src/repositories/PostRepository.ts
import { AuthorSummary } from '@/models/AuthorSummary';
import { Post, PostListItem } from '@/models/models';
import type { SQLiteDatabase } from 'expo-sqlite';
import { DatabaseService } from '../services/DatabaseService';
import { MinHashService } from '../services/MinHashService';
import { parseDbDate } from '../utils/datetimeUtils';

export type TripleFilter = 'all' | 'yes' | 'no';

export type PostFilterOptions = {
  /** Free-text search across title, customTitle, bodyText, customBody, notes, author, subreddit */
  search?: string;
  /** Only include posts belonging to at least one of these folder IDs */
  selectedFolders?: number[];
  favouritesFilter?: TripleFilter;
  readFilter?: TripleFilter;
  archivedFilter?: TripleFilter;
  queuedFilter?: TripleFilter;
  /** Column to sort by. 'random' shuffles client-side using the provided randomSeed. */
  orderBy?: OrderByOption;
  orderDirection?: 'asc' | 'desc';
  /** Filter to a specific author (case-insensitive exact match) */
  authorFilter?: string;
};

type PostRow = {
  id: number;
  redditId: string;
  url: string;
  title: string;
  bodyText: string | null;
  bodyMinHash: string | null;
  author: string;
  subreddit: string;
  redditCreatedAt: string;
  addedAt: string;
  updatedAt: string;
  syncedAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  customTitle: string | null;
  customBody: string | null;
  notes: string | null;
  rating: number | null;
  isRead: number;
  isFavorite: number;
  isDeleted: number;
  isArchived: number;
  folderId: number | null;
  extraFields: string | null;
  summary: string | null;
  readAt: string | null;
  queuedAt: string | null;
};

export class PostRepository {
  private db: SQLiteDatabase;

  private constructor(db: SQLiteDatabase) {
    this.db = db;
  }

  /**
   * Computes the word count for a post body at write time so list queries
   * never need to touch the large bodyText / customBody overflow pages.
   * Uses the same space-counting heuristic as the old SQL expression.
   */
  private static computeWordCount(
    bodyText: string | null | undefined,
    customBody: string | null | undefined,
  ): number {
    const text = (customBody ?? bodyText ?? '').trim();
    if (!text) return 0;
    // Count runs of spaces (matches original SQL: LENGTH - LENGTH(REPLACE spaces) + 1)
    return (text.match(/ /g)?.length ?? 0) + 1;
  }

  private mapRowToPost(row: PostRow, folderIds: number[] = []): Post {
    let extraFields: Record<string, any> | undefined;
    if (row.extraFields) {
      try {
        extraFields = JSON.parse(row.extraFields);
      } catch {
        extraFields = undefined;
      }
    }

    return {
      id: row.id,
      redditId: row.redditId,
      url: row.url,
      title: row.title,
      bodyText: row.bodyText ?? '',
      bodyMinHash: row.bodyMinHash ?? undefined,
      author: row.author,
      subreddit: row.subreddit,
      redditCreatedAt: new Date(row.redditCreatedAt),
      addedAt: new Date(row.addedAt),
      updatedAt: parseDbDate(row.updatedAt),
      syncedAt: row.syncedAt ? parseDbDate(row.syncedAt) : null,
      lastSyncStatus: row.lastSyncStatus ?? undefined,
      lastSyncError: row.lastSyncError ?? undefined,
      customTitle: row.customTitle ?? undefined,
      customBody: row.customBody ?? undefined,
      notes: row.notes ?? undefined,
      rating: row.rating ?? undefined,
      isRead: row.isRead === 1,
      isFavorite: row.isFavorite === 1,
      isDeleted: row.isDeleted === 1,
      isArchived: row.isArchived === 1,
      extraFields,
      summary: row.summary ?? undefined,
      readAt: row.readAt ? parseDbDate(row.readAt) : null,
      queuedAt: row.queuedAt ? parseDbDate(row.queuedAt) : null,
      folderIds,
    };
  }

  /**
   * Batch load all folder mappings into a lookup map.
   * Single query instead of N+1.
   */
  private async loadAllFolderIds(postIds?: number[]): Promise<Map<number, number[]>> {
    const map = new Map<number, number[]>();
    let rows: { post_id: number; folder_id: number }[];
    if (postIds && postIds.length > 0) {
      // For a small set of posts, filter by IDs
      const placeholders = postIds.map(() => '?').join(',');
      rows = await this.db.getAllAsync<{ post_id: number; folder_id: number }>(
        `SELECT post_id, folder_id FROM post_folders WHERE post_id IN (${placeholders})`,
        ...postIds
      );
    } else {
      rows = await this.db.getAllAsync<{ post_id: number; folder_id: number }>(
        `SELECT post_id, folder_id FROM post_folders`
      );
    }
    for (const row of rows) {
      const arr = map.get(row.post_id);
      if (arr) {
        arr.push(row.folder_id);
      } else {
        map.set(row.post_id, [row.folder_id]);
      }
    }
    return map;
  }

  public static async create(): Promise<PostRepository> {
    console.debug('Creating PostRepository instance');
    const svc = await DatabaseService.getInstance();
    return new PostRepository(svc.getDb());
  }

  public async getAll(): Promise<Post[]> {
    const rows = await this.db.getAllAsync<PostRow>(
      `SELECT * FROM posts WHERE isDeleted = 0 ORDER BY addedAt DESC`
    );
    console.debug(`Retrieved ${rows.length} posts from database`);
    // Batch load all folder IDs in a single query (fixes N+1)
    const folderMap = await this.loadAllFolderIds();
    return rows.map(r => this.mapRowToPost(r, folderMap.get(r.id) ?? []));
  }

  /**
   * Lightweight query for list screens - skips heavy text fields.
   * Returns PostListItem[] with only the fields needed for rendering cards.
   */
  public async getAllListItems(): Promise<PostListItem[]> {
    type ListRow = {
      id: number;
      redditId: string;
      url: string;
      title: string;
      author: string;
      subreddit: string;
      redditCreatedAt: string;
      addedAt: string;
      updatedAt: string;
      customTitle: string | null;
      notes: string | null;
      rating: number | null;
      isRead: number;
      isFavorite: number;
      isArchived: number;
      readAt: string | null;
      queuedAt: string | null;
      wordCount: number;
    };
    const rows = await this.db.getAllAsync<ListRow>(
      `SELECT
         id, redditId, url, title, author, subreddit,
         redditCreatedAt, addedAt, updatedAt,
         customTitle, notes, rating, isRead, isFavorite, isArchived, readAt, queuedAt,
         wordCount
       FROM posts
       WHERE isDeleted = 0
       ORDER BY addedAt DESC`
    );
    console.debug(`Retrieved ${rows.length} post list items from database`);
    const folderMap = await this.loadAllFolderIds();
    return rows.map(r => ({
      id: r.id,
      redditId: r.redditId,
      url: r.url,
      title: r.title,
      author: r.author,
      subreddit: r.subreddit,
      redditCreatedAt: new Date(r.redditCreatedAt),
      addedAt: new Date(r.addedAt),
      updatedAt: parseDbDate(r.updatedAt),
      customTitle: r.customTitle ?? undefined,
      notes: r.notes ?? undefined,
      rating: r.rating ?? undefined,
      isRead: r.isRead === 1,
      isFavorite: r.isFavorite === 1,
      isArchived: r.isArchived === 1,
      readAt: r.readAt ? parseDbDate(r.readAt) : null,
      queuedAt: r.queuedAt ? parseDbDate(r.queuedAt) : null,
      folderIds: folderMap.get(r.id) ?? [],
      wordCount: r.wordCount,
    }));
  }

  /**
   * Filtered + sorted lightweight query for the list screen.
   *
   * For orderBy === 'random', the rows are returned in database order;
   * the caller is responsible for client-side seeded shuffling.
   */
  public async getFilteredListItems(options: PostFilterOptions = {}): Promise<PostListItem[]> {
    const {
      search,
      selectedFolders,
      favouritesFilter = 'all',
      readFilter = 'all',
      archivedFilter = 'no',
      queuedFilter = 'all',
      orderBy = OrderByOption.AddedAt,
      orderDirection = 'desc',
      authorFilter,
    } = options;

    const conditions: string[] = ['isDeleted = 0'];
    const params: (string | number)[] = [];

    // Author filter (case-insensitive exact match).
    // COLLATE NOCASE avoids calling LOWER() on the column, which would prevent index use.
    if (authorFilter) {
      conditions.push('author = ? COLLATE NOCASE');
      params.push(authorFilter);
    }

    // Full-text search across title, body, notes, author, subreddit
    const q = search?.trim();
    if (q) {
      const pattern = `%${q}%`;
      conditions.push(
        `(title LIKE ? OR COALESCE(customTitle,'') LIKE ? OR ` +
        `COALESCE(bodyText,'') LIKE ? OR COALESCE(customBody,'') LIKE ? OR ` +
        `COALESCE(notes,'') LIKE ? OR author LIKE ? OR subreddit LIKE ?)`
      );
      params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern);
    }

    // Folder filter
    if (selectedFolders && selectedFolders.length > 0) {
      const placeholders = selectedFolders.map(() => '?').join(',');
      conditions.push(
        `EXISTS (SELECT 1 FROM post_folders WHERE post_id = posts.id AND folder_id IN (${placeholders}))`
      );
      params.push(...selectedFolders);
    }

    if (favouritesFilter === 'yes') conditions.push('isFavorite = 1');
    else if (favouritesFilter === 'no') conditions.push('isFavorite = 0');

    if (readFilter === 'yes') conditions.push('isRead = 1');
    else if (readFilter === 'no') conditions.push('isRead = 0');

    if (archivedFilter === 'yes') conditions.push('isArchived = 1');
    else if (archivedFilter === 'no') conditions.push('isArchived = 0');

    if (queuedFilter === 'yes') conditions.push('queuedAt IS NOT NULL');
    else if (queuedFilter === 'no') conditions.push('queuedAt IS NULL');

    const where = conditions.join(' AND ');
    const dir = orderDirection.toUpperCase() as 'ASC' | 'DESC';

    let orderClause = '';
    switch (orderBy) {
      case OrderByOption.Random:
        // Caller handles seeded shuffle; return in natural DB order
        orderClause = 'ORDER BY addedAt DESC';
        break;
      case OrderByOption.PostedAt:
        // Sort by redditCreatedAt (posted date)
        orderClause = `ORDER BY redditCreatedAt ${dir}`;
        break;
      case OrderByOption.UpdatedAt: {
        // Posts with a "real" update (updatedAt differs from addedAt by >1 s) sort first
        const updateExpr = `ABS((julianday(updatedAt) - julianday(addedAt)) * 86400.0) > 1.0`;
        orderClause =
          `ORDER BY CASE WHEN ${updateExpr} THEN 0 ELSE 1 END ASC, ` +
          `CASE WHEN ${updateExpr} THEN updatedAt ELSE addedAt END ${dir}`;
        break;
      }
      case OrderByOption.ReadAt:
        // NULL readAt always sorts last regardless of direction; NULLS LAST is supported in SQLite 3.30+
        orderClause = `ORDER BY readAt ${dir} NULLS LAST`;
        break;
      case OrderByOption.Rating:
        // NULLS LAST puts unrated posts at the bottom (DESC) / top (ASC), consistent with prior COALESCE(rating,0) semantics
        orderClause = `ORDER BY rating ${dir} NULLS LAST`;
        break;
      case OrderByOption.QueuedAt:
        // When sorting by queue order, only show queued posts and sort by queuedAt
        conditions.push('queuedAt IS NOT NULL');
        orderClause = `ORDER BY queuedAt ${dir}`;
        break;
      case OrderByOption.Length:
        // wordCount is the SELECT alias; SQLite allows ORDER BY on SELECT aliases
        orderClause = `ORDER BY wordCount ${dir}`;
        break;
      default:
        orderClause = `ORDER BY addedAt ${dir}`;
    }

    type ListRow = {
      id: number; redditId: string; url: string; title: string;
      author: string; subreddit: string; redditCreatedAt: string;
      addedAt: string; updatedAt: string; customTitle: string | null;
      notes: string | null; rating: number | null; isRead: number;
      isFavorite: number; isArchived: number; readAt: string | null; queuedAt: string | null; wordCount: number;
    };

    const sql = `
      SELECT
        id, redditId, url, title, author, subreddit,
        redditCreatedAt, addedAt, updatedAt,
        customTitle, notes, rating, isRead, isFavorite, isArchived, readAt, queuedAt,
        wordCount
      FROM posts
      WHERE ${where}
      ${orderClause}`;

    const rows = await this.db.getAllAsync<ListRow>(sql, ...params);
    console.debug(`getFilteredListItems: ${rows.length} rows (orderBy=${orderBy} ${dir})`);

    const postIds = rows.map(r => r.id);
    const folderMap = postIds.length > 0
      ? await this.loadAllFolderIds(postIds)
      : new Map<number, number[]>();

    return rows.map(r => ({
      id: r.id,
      redditId: r.redditId,
      url: r.url,
      title: r.title,
      author: r.author,
      subreddit: r.subreddit,
      redditCreatedAt: new Date(r.redditCreatedAt),
      addedAt: new Date(r.addedAt),
      updatedAt: parseDbDate(r.updatedAt),
      customTitle: r.customTitle ?? undefined,
      notes: r.notes ?? undefined,
      rating: r.rating ?? undefined,
      isRead: r.isRead === 1,
      isFavorite: r.isFavorite === 1,
      isArchived: r.isArchived === 1,
      readAt: r.readAt ? parseDbDate(r.readAt) : null,
      queuedAt: r.queuedAt ? parseDbDate(r.queuedAt) : null,
      folderIds: folderMap.get(r.id) ?? [],
      wordCount: r.wordCount,
    }));
  }

  /**
   * Aggregate author statistics from the posts table.
   * Returns one AuthorSummary per distinct author, excluding deleted posts
   * and placeholder authors like '[deleted]'.
   */
  public async getAuthorSummaries(): Promise<AuthorSummary[]> {
    type AuthorRow = {
      author: string;
      postCount: number;
      readCount: number;
      favouriteCount: number;
      archivedCount: number;
      avgRating: number | null;
      totalRating: number;
      lastAddedAt: string;
    };

    const rows = await this.db.getAllAsync<AuthorRow>(`
      SELECT
        author,
        COUNT(*)              AS postCount,
        SUM(isRead)           AS readCount,
        SUM(isFavorite)       AS favouriteCount,
        SUM(isArchived)       AS archivedCount,
        AVG(NULLIF(rating,0)) AS avgRating,
        SUM(COALESCE(rating,0)) AS totalRating,
        MAX(addedAt)          AS lastAddedAt
      FROM posts
      WHERE isDeleted = 0
        AND author != ''
        AND author != '[deleted]'
      GROUP BY author
    `);

    console.debug(`getAuthorSummaries: ${rows.length} authors`);

    return rows.map(r => ({
      author: r.author,
      postCount: r.postCount,
      readCount: r.readCount,
      favouriteCount: r.favouriteCount,
      archivedCount: r.archivedCount,
      avgRating: r.avgRating,
      totalRating: r.totalRating,
      lastAddedAt: new Date(r.lastAddedAt),
    }));
  }

  public async getById(id: number): Promise<Post | null> {
    const r = await this.db.getFirstAsync<PostRow>(
      `SELECT * FROM posts WHERE id = ? AND isDeleted = 0`,
      id
    );
    if (!r) return null;
    const folderIds = await this.loadFolderIds(r.id);
    return this.mapRowToPost(r, folderIds);
  }

  public async create(post: Omit<Post,'id'>): Promise<number> {
    const addedAt = post.addedAt ?? new Date();
    const updatedAt = post.updatedAt ?? addedAt ?? new Date();
    const syncedAt = post.syncedAt ? post.syncedAt : new Date(0);


    // Use provided MinHash if present, otherwise generate from body text
    let bodyMinHash: string | null = null;
    if (typeof post.bodyMinHash === 'string') {
      bodyMinHash = post.bodyMinHash;
    } else {
      const sig = MinHashService.generateSignature(post.bodyText || '');
      bodyMinHash = sig ? JSON.stringify(sig) : null;
    }


    const result = await this.db.runAsync(
      `INSERT INTO posts (
         redditId, url, title, bodyText, bodyMinHash, author, subreddit,
         redditCreatedAt, addedAt, updatedAt, syncedAt, lastSyncStatus, lastSyncError,
         customTitle, customBody, notes, rating,
         isRead, isFavorite, isDeleted, isArchived, extraFields, summary, readAt, wordCount
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      post.redditId,
      post.url,
      post.title,
      post.bodyText ?? null,
      bodyMinHash,
      post.author,
      post.subreddit,
      post.redditCreatedAt.toISOString(),
      addedAt.toISOString(),
      updatedAt.toISOString(),
      syncedAt.toISOString(),
      post.lastSyncStatus ?? null,
      post.lastSyncError ?? null,
      post.customTitle ?? null,
      post.customBody ?? null,
      post.notes ?? null,
      post.rating ?? null,
      post.isRead ? 1 : 0,
      post.isFavorite ? 1 : 0,
      post.isDeleted ? 1 : 0,
      post.isArchived ? 1 : 0,
      post.extraFields ? JSON.stringify(post.extraFields) : null,
      post.summary ?? null,
      post.readAt instanceof Date ? post.readAt.toISOString() : post.readAt ?? null,
      PostRepository.computeWordCount(post.bodyText, post.customBody),
    );
    const newId = result.lastInsertRowId;
    return newId;
  }

  /**
   * Find potential duplicates based on minHash similarity
   */
  public async findSimilarPosts(bodyText: string, threshold: number = 0.75): Promise<Post[]> {
    const start = Date.now();

    if (!bodyText || bodyText.trim().length < 10) {
      return [];
    }

    const inputHash = MinHashService.generateSignature(bodyText);
    if (!inputHash) return [];

    let elapsed = Date.now() - start;
    console.debug(`generating data took ${elapsed}ms`);

    // Get all posts with minhash - todo: optimise this query
    const rows = await this.db.getAllAsync<{
      id: number;
      bodyMinHash: string | null;
    }>(`SELECT id, bodyMinHash
        FROM posts
        WHERE isDeleted = 0
          AND bodyMinHash IS NOT NULL
          AND bodyMinHash != ''`);

    const similarPosts: Post[] = [];
    
    elapsed = Date.now() - start;
    console.debug(`querying data took ${elapsed}ms`);

    for (const row of rows) {
      if (row.bodyMinHash) {
        const similarity = MinHashService.similarity(inputHash, JSON.parse(row.bodyMinHash));
        console.debug(`Comparing with post ${row.id}: similarity = ${similarity}`);
        if (similarity >= threshold) {
          // Load full post data for similar posts
          const fullPost = await this.getById(row.id);
          if (fullPost) {
            similarPosts.push(fullPost);
          }
        }
      }
    }

    elapsed = Date.now() - start;
    console.debug(`findSimilarPosts took ${elapsed}ms`);

    return similarPosts;
  }

  public async getPendingSyncPosts(): Promise<Post[]> {
    const rows = await this.db.getAllAsync<PostRow>(
      `SELECT * FROM posts
       WHERE syncedAt IS NULL OR datetime(syncedAt) < datetime(updatedAt)`
    );
    console.debug(`Found ${rows.length} pending sync posts`);
    const postIds = rows.map(r => r.id);
    const folderMap = await this.loadAllFolderIds(postIds);
    return rows.map(r => this.mapRowToPost(r, folderMap.get(r.id) ?? []));
  }

  public async updateSyncState(
    postId: number,
    status: string,
    syncedAt: Date | string | null,
    error?: string | null
  ): Promise<void> {
    const syncedAtValue =
      syncedAt instanceof Date ? syncedAt.toISOString() : syncedAt ?? null;
    await this.db.runAsync(
      `UPDATE posts
         SET syncedAt = ?,
             lastSyncStatus = ?,
             lastSyncError = ?
       WHERE id = ?`,
      syncedAtValue,
      status,
      error ?? null,
      postId
    );
  }

  public async resetSyncStateForAll(): Promise<void> {
    await this.db.runAsync(
      `UPDATE posts
         SET syncedAt = NULL,
             lastSyncStatus = NULL,
             lastSyncError = NULL`
    );
  }

  public async update(post: Post): Promise<number> {
    const bodyMinHash = typeof post.bodyMinHash === 'string'
      ? post.bodyMinHash
      : post.bodyMinHash
        ? JSON.stringify(post.bodyMinHash)
        : null;
    const extraFields = post.extraFields ? JSON.stringify(post.extraFields) : null;

    const result = await this.db.runAsync(
      `UPDATE posts SET
         title         = ?,
         bodyText      = ?,
         bodyMinHash   = ?,
         customTitle   = ?,
         customBody    = ?,
         notes         = ?,
         rating        = ?,
         isRead        = ?,
         isFavorite    = ?,
         isArchived    = ?,
         extraFields   = ?,
         summary       = ?,
         readAt        = ?,
         queuedAt      = ?,
         wordCount     = ?,
         updatedAt     = CURRENT_TIMESTAMP
       WHERE id = ?`,
      post.title,
      post.bodyText ?? null,
      bodyMinHash,
      post.customTitle ?? null,
      post.customBody ?? null,
      post.notes ?? null,
      post.rating ?? null,
      post.isRead ? 1 : 0,
      post.isFavorite ? 1 : 0,
      post.isArchived ? 1 : 0,
      extraFields,
      post.summary ?? null,
      post.readAt instanceof Date ? post.readAt.toISOString() : post.readAt ?? null,
      post.queuedAt instanceof Date ? post.queuedAt.toISOString() : post.queuedAt ?? null,
      PostRepository.computeWordCount(post.bodyText, post.customBody),
      post.id
    );

    for (const fid of post.folderIds ?? []) {
      await this.db.runAsync(
        `INSERT OR IGNORE INTO post_folders (post_id, folder_id) VALUES (?, ?)`,
        post.id, fid
      );
    }

    console.debug(`Updated post ${post.id}:`, result);
    return result.changes;
  }

  public async delete(id: number): Promise<number> {
    const result = await this.db.runAsync(
      `UPDATE posts
         SET isDeleted = 1,
             updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      id
    );
    return result.changes;
  }

  /**
   * Toggle isFavorite directly in DB without loading the full post.
   * When setting favorite ON, also updates queuedAt to now.
   * Returns the new isFavorite value and the current queuedAt.
   */
  public async toggleFavoriteById(id: number): Promise<{ isFavorite: boolean; queuedAt: Date | null }> {
    const result = await this.db.runAsync(
      `UPDATE posts SET 
        isFavorite = CASE WHEN isFavorite = 1 THEN 0 ELSE 1 END,
        updatedAt = CURRENT_TIMESTAMP,
        queuedAt = CASE WHEN isFavorite = 0 THEN strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ELSE queuedAt END
        WHERE id = ?`,
      id
    );
    if (result.changes === 0) return { isFavorite: false, queuedAt: null };
    const row = await this.db.getFirstAsync<{ isFavorite: number; queuedAt: string | null }>(
      `SELECT isFavorite, queuedAt FROM posts WHERE id = ?`, id
    );
    return {
      isFavorite: row?.isFavorite === 1,
      queuedAt: row?.queuedAt ? parseDbDate(row.queuedAt) : null,
    };
  }

  /**
   * Toggle isArchived directly in DB without loading the full post.
   * Returns the new isArchived value.
   */
  public async toggleArchivedById(id: number): Promise<boolean> {
    const result = await this.db.runAsync(
      `UPDATE posts SET isArchived = CASE WHEN isArchived = 1 THEN 0 ELSE 1 END, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      id
    );
    if (result.changes === 0) return false;
    const row = await this.db.getFirstAsync<{ isArchived: number }>(
      `SELECT isArchived FROM posts WHERE id = ?`, id
    );
    return row?.isArchived === 1;
  }

  /**
   * Set queuedAt to the current timestamp, always moving the post to the top of the queue.
   * Never removes from queue — use update() to clear queuedAt.
   * Does not update updatedAt.
   * Returns the new queuedAt value.
   */
  public async setQueuedAtById(id: number): Promise<Date> {
    await this.db.runAsync(
      `UPDATE posts SET queuedAt = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
      id
    );
    const row = await this.db.getFirstAsync<{ queuedAt: string }>(
      `SELECT queuedAt FROM posts WHERE id = ?`, id
    );
    return parseDbDate(row!.queuedAt);
  }

  /**
   * Toggle isRead directly in DB without loading the full post.
   * Returns the new isRead value.
   */
  public async toggleReadById(id: number): Promise<boolean> {
    // If transitioning to read, set readAt. If transitioning to unread, leave readAt.
    const result = await this.db.runAsync(
      `UPDATE posts SET
         isRead = CASE WHEN isRead = 1 THEN 0 ELSE 1 END,
         readAt = CASE WHEN isRead = 0 THEN strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ELSE readAt END,
         updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      id
    );
    if (result.changes === 0) return false;
    const row = await this.db.getFirstAsync<{ isRead: number }>(
      `SELECT isRead FROM posts WHERE id = ?`, id
    );
    return row?.isRead === 1;
  }

  private async loadFolderIds(postId: number): Promise<number[]> {
    const rows = await this.db.getAllAsync<{ folder_id: number }>(
      `SELECT folder_id FROM post_folders WHERE post_id = ?`,
      postId
    );
    return rows.map(row => row.folder_id);
  }

  public async addPostToFolder(postId: number, folderId: number): Promise<void> {
    await this.db.runAsync(
      'INSERT OR IGNORE INTO post_folders (post_id, folder_id) VALUES (?, ?)',
      postId,
      folderId
    );
  }

  public async removeAllFoldersFromPost(postId: number): Promise<void> {
    await this.db.runAsync(
      'DELETE FROM post_folders WHERE post_id = ?',
      postId
    );
  }
}
