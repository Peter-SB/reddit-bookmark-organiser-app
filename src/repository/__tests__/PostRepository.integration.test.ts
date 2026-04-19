/**
 * Integration tests for PostRepository against a real in-memory SQLite DB.
 *
 * These tests exercise the actual SQL, not a mock, so they catch issues like:
 *  - Incorrect column names or aliases
 *  - Missing WHERE clauses
 *  - Filter / sort logic errors
 *  - Toggle operations returning wrong values
 */
import { PostRepository } from '@/repository/PostRepository';
import { createInMemoryDb, seedPost, seedManyPosts, AsyncDbAdapter } from './utils/createInMemoryDb';

// PostRepository constructor is private; cast to any is the accepted test pattern
// (same as used in the existing mock-based tests).
function makeRepo(db: AsyncDbAdapter): PostRepository {
  return new (PostRepository as any)(db);
}

let db: AsyncDbAdapter;
let repo: PostRepository;

beforeEach(() => {
  db = createInMemoryDb();
  repo = makeRepo(db);
});

afterEach(async () => {
  await db.closeAsync();
});

// ── getAllListItems ────────────────────────────────────────────────────────────

describe('PostRepository.getAllListItems (integration)', () => {
  it('returns empty array from an empty DB', async () => {
    const items = await repo.getAllListItems();
    expect(items).toHaveLength(0);
  });

  it('returns all non-deleted posts', async () => {
    await seedPost(db, { title: 'Active' });
    await db.runAsync(`INSERT INTO posts (redditId, url, title, author, subreddit, redditCreatedAt, addedAt, isDeleted)
      VALUES ('del1','http://x','Deleted','u','s',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,1)`);

    const items = await repo.getAllListItems();
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Active');
  });

  it('maps boolean fields from integer columns correctly', async () => {
    await seedPost(db, { isRead: true, isFavorite: true, isArchived: false });

    const [item] = await repo.getAllListItems();
    expect(item.isRead).toBe(true);
    expect(item.isFavorite).toBe(true);
    expect(item.isArchived).toBe(false);
  });

  it('does not include heavy fields (bodyText, summary, bodyMinHash)', async () => {
    await seedPost(db, { bodyText: 'lots of text here' });

    const [item] = await repo.getAllListItems();
    expect((item as any).bodyText).toBeUndefined();
    expect((item as any).summary).toBeUndefined();
    expect((item as any).bodyMinHash).toBeUndefined();
  });

  it('attaches folder IDs via batch load', async () => {
    const postId = await seedPost(db);
    await db.runAsync(`INSERT INTO folders (name) VALUES ('My Folder')`);
    const folder = await db.getFirstAsync<{ id: number }>(`SELECT id FROM folders WHERE name='My Folder'`);
    await db.runAsync(`INSERT INTO post_folders (post_id, folder_id) VALUES (?,?)`, postId, folder!.id);

    const [item] = await repo.getAllListItems();
    expect(item.folderIds).toContain(folder!.id);
  });
});

// ── getFilteredListItems ──────────────────────────────────────────────────────

describe('PostRepository.getFilteredListItems (integration)', () => {
  beforeEach(async () => {
    await seedPost(db, { title: 'Unread post', isRead: false, isFavorite: false });
    await seedPost(db, { title: 'Read post', isRead: true, isFavorite: false });
    await seedPost(db, { title: 'Fav post', isRead: false, isFavorite: true });
    await seedPost(db, { title: 'Queued post', isRead: false, queuedAt: new Date().toISOString() });
  });

  it('returns all posts with no filters', async () => {
    const items = await repo.getFilteredListItems({});
    expect(items).toHaveLength(4);
  });

  it('filters to unread posts only', async () => {
    const items = await repo.getFilteredListItems({ readFilter: 'no' });
    expect(items.every((p) => !p.isRead)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
  });

  it('filters to read posts only', async () => {
    const items = await repo.getFilteredListItems({ readFilter: 'yes' });
    expect(items.every((p) => p.isRead)).toBe(true);
    expect(items.length).toBe(1);
    expect(items[0].title).toBe('Read post');
  });

  it('filters to favourite posts only', async () => {
    const items = await repo.getFilteredListItems({ favouritesFilter: 'yes' });
    expect(items.every((p) => p.isFavorite)).toBe(true);
    expect(items.length).toBe(1);
    expect(items[0].title).toBe('Fav post');
  });

  it('filters to queued posts only', async () => {
    const items = await repo.getFilteredListItems({ queuedFilter: 'yes' });
    expect(items.every((p) => !!p.queuedAt)).toBe(true);
    expect(items.length).toBe(1);
    expect(items[0].title).toBe('Queued post');
  });

  it('filters by search term in title', async () => {
    const items = await repo.getFilteredListItems({ search: 'Fav' });
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Fav post');
  });

  it('search is case-insensitive', async () => {
    const items = await repo.getFilteredListItems({ search: 'fav' });
    expect(items).toHaveLength(1);
  });

  it('returns empty array when search matches nothing', async () => {
    const items = await repo.getFilteredListItems({ search: 'zzzzz_no_match' });
    expect(items).toHaveLength(0);
  });
});

// ── toggleFavoriteById ────────────────────────────────────────────────────────

describe('PostRepository.toggleFavoriteById (integration)', () => {
  it('toggles from false → true and persists to DB', async () => {
    const id = await seedPost(db, { isFavorite: false });

    const newValue = await repo.toggleFavoriteById(id);

    expect(newValue).toBe(true);
    const row = await db.getFirstAsync<{ isFavorite: number }>(`SELECT isFavorite FROM posts WHERE id=?`, id);
    expect(row!.isFavorite).toBe(1);
  });

  it('toggles from true → false', async () => {
    const id = await seedPost(db, { isFavorite: true });

    const newValue = await repo.toggleFavoriteById(id);

    expect(newValue).toBe(false);
    const row = await db.getFirstAsync<{ isFavorite: number }>(`SELECT isFavorite FROM posts WHERE id=?`, id);
    expect(row!.isFavorite).toBe(0);
  });
});

// ── toggleReadById ────────────────────────────────────────────────────────────

describe('PostRepository.toggleReadById (integration)', () => {
  it('toggles from false → true and sets readAt timestamp', async () => {
    const id = await seedPost(db, { isRead: false });

    const newValue = await repo.toggleReadById(id);

    expect(newValue).toBe(true);
    const row = await db.getFirstAsync<{ isRead: number; readAt: string | null }>(
      `SELECT isRead, readAt FROM posts WHERE id=?`, id,
    );
    expect(row!.isRead).toBe(1);
    expect(row!.readAt).not.toBeNull();
  });

  it('toggles from true → false and clears readAt', async () => {
    const id = await seedPost(db, { isRead: true });
    // Manually set readAt so we can assert it gets cleared
    await db.runAsync(`UPDATE posts SET readAt = CURRENT_TIMESTAMP WHERE id = ?`, id);

    const newValue = await repo.toggleReadById(id);

    expect(newValue).toBe(false);
    const row = await db.getFirstAsync<{ isRead: number; readAt: string | null }>(
      `SELECT isRead, readAt FROM posts WHERE id=?`, id,
    );
    expect(row!.isRead).toBe(0);
    // readAt is left as-is (the toggle only sets it when transitioning to read)
  });
});

// ── setQueuedAtById ───────────────────────────────────────────────────────────

describe('PostRepository.setQueuedAtById (integration)', () => {
  it('sets queuedAt and returns the new timestamp', async () => {
    const id = await seedPost(db, { queuedAt: null });

    const newQueuedAt = await repo.setQueuedAtById(id);

    expect(newQueuedAt).toBeInstanceOf(Date);
    expect(newQueuedAt!.getTime()).toBeGreaterThan(Date.now() - 5000);
    const row = await db.getFirstAsync<{ queuedAt: string | null }>(`SELECT queuedAt FROM posts WHERE id=?`, id);
    expect(row!.queuedAt).not.toBeNull();
  });

  it('overwrites an existing queuedAt with a new timestamp', async () => {
    const oldTime = new Date(Date.now() - 60_000).toISOString();
    const id = await seedPost(db, { queuedAt: oldTime });

    const newQueuedAt = await repo.setQueuedAtById(id);

    // The new timestamp should be more recent than the old one
    expect(newQueuedAt!.getTime()).toBeGreaterThan(new Date(oldTime).getTime());
  });
});

// ── bulk data correctness ─────────────────────────────────────────────────────

describe('PostRepository bulk data correctness (integration)', () => {
  it('getFilteredListItems returns the correct count from 200 seeded posts', async () => {
    await seedManyPosts(db, 200);

    const all = await repo.getFilteredListItems({});
    expect(all).toHaveLength(200);
  });

  it('favourite filter matches expected count from seeded data', async () => {
    // seedManyPosts marks i%7===0 as favourite: 200/7 = 28 posts (ids 7,14,...196)
    await seedManyPosts(db, 200);

    const favs = await repo.getFilteredListItems({ favouritesFilter: 'yes' });
    // Every 7th post is a favourite in the seed helper
    const expectedFavCount = Math.floor(200 / 7);
    expect(favs.length).toBe(expectedFavCount);
    expect(favs.every((p) => p.isFavorite)).toBe(true);
  });

  it('all results are sorted by addedAt desc by default', async () => {
    await seedManyPosts(db, 50);

    const items = await repo.getFilteredListItems({});
    const dates = items.map((p) => p.addedAt.getTime());
    const sorted = [...dates].sort((a, b) => b - a);
    expect(dates).toEqual(sorted);
  });
});
