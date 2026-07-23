/**
 * Integration tests for SearchHistoryRepository against a real in-memory SQLite DB.
 */
import { SearchHistoryRepository } from '@/repository/SearchHistoryRepository';
import { createInMemoryDb, AsyncDbAdapter } from './utils/createInMemoryDb';

// SearchHistoryRepository constructor is private; cast to any is the accepted test
// pattern used across this repo's other integration tests.
function makeRepo(db: AsyncDbAdapter): SearchHistoryRepository {
  return new (SearchHistoryRepository as any)(db);
}

let db: AsyncDbAdapter;
let repo: SearchHistoryRepository;

beforeEach(() => {
  db = createInMemoryDb();
  repo = makeRepo(db);
});

afterEach(async () => {
  await db.closeAsync();
});

describe('SearchHistoryRepository (integration)', () => {
  it('creates a pending entry and reads it back', async () => {
    const id = await repo.createEntry({
      query: 'cooking tips',
      chunkType: 'body',
      k: 10,
      libraryId: 'main',
    });

    const entry = await repo.getById(id);
    expect(entry).toEqual(
      expect.objectContaining({
        id,
        query: 'cooking tips',
        chunkType: 'body',
        k: 10,
        libraryId: 'main',
        status: 'pending',
        results: [],
        error: null,
      }),
    );
  });

  it('marks an entry complete with serialized results', async () => {
    const id = await repo.createEntry({
      query: 'sourdough',
      chunkType: 'title',
      k: 5,
      libraryId: 'main',
    });

    await repo.markComplete(id, [
      { chunkId: 'c1', postId: 42, text: 'snippet', metadata: { title: 'Bread' }, score: 0.9 },
    ]);

    const entry = await repo.getById(id);
    expect(entry?.status).toBe('complete');
    expect(entry?.error).toBeNull();
    expect(entry?.results).toEqual([
      { chunkId: 'c1', postId: 42, text: 'snippet', metadata: { title: 'Bread' }, score: 0.9 },
    ]);
  });

  it('marks an entry as errored', async () => {
    const id = await repo.createEntry({
      query: 'broken query',
      chunkType: 'body',
      k: 10,
      libraryId: 'main',
    });

    await repo.markError(id, 'Search timed out waiting for results.');

    const entry = await repo.getById(id);
    expect(entry?.status).toBe('error');
    expect(entry?.error).toBe('Search timed out waiting for results.');
    expect(entry?.results).toEqual([]);
  });

  it('lists entries most-recently-created first', async () => {
    const olderId = await repo.createEntry({
      query: 'older',
      chunkType: 'body',
      k: 10,
      libraryId: 'main',
    });
    const newerId = await repo.createEntry({
      query: 'newer',
      chunkType: 'body',
      k: 10,
      libraryId: 'main',
    });
    // CURRENT_TIMESTAMP has only second-level resolution, so force distinct
    // timestamps to make ordering deterministic in a fast test run.
    await db.runAsync(`UPDATE semantic_search_history SET created_at = ? WHERE id = ?`, '2024-01-01T00:00:00', olderId);
    await db.runAsync(`UPDATE semantic_search_history SET created_at = ? WHERE id = ?`, '2024-01-02T00:00:00', newerId);

    const entries = await repo.listAll();
    expect(entries.map((e) => e.id)).toEqual([newerId, olderId]);
  });

  it('falls back to an empty results array when the stored JSON is corrupted', async () => {
    const id = await repo.createEntry({
      query: 'corrupted',
      chunkType: 'body',
      k: 10,
      libraryId: 'main',
    });
    await db.runAsync(`UPDATE semantic_search_history SET status = 'complete', results = ? WHERE id = ?`, '{not valid json', id);

    const entry = await repo.getById(id);
    expect(entry?.status).toBe('complete');
    expect(entry?.results).toEqual([]);
  });

  it('returns null for a non-existent id', async () => {
    expect(await repo.getById(999)).toBeNull();
  });

  it('deletes an entry', async () => {
    const id = await repo.createEntry({
      query: 'to delete',
      chunkType: 'body',
      k: 10,
      libraryId: 'main',
    });

    await repo.delete(id);

    expect(await repo.getById(id)).toBeNull();
    expect(await repo.listAll()).toHaveLength(0);
  });
});
