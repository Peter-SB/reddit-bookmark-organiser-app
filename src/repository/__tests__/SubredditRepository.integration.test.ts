/**
 * Integration tests for SubredditRepository against a real in-memory SQLite DB.
 * Focused on the "Search All" include/exclude flag (isEnabledForSearch), which
 * needs real SQL round-tripping to catch column/type mismatches the mocked
 * unit tests (SubredditRepository.test.ts) can't.
 */
import { SubredditRepository } from '@/repository/SubredditRepository';
import { createInMemoryDb, AsyncDbAdapter } from './utils/createInMemoryDb';

function makeRepo(db: AsyncDbAdapter): SubredditRepository {
  return new (SubredditRepository as any)(db);
}

let db: AsyncDbAdapter;
let repo: SubredditRepository;

beforeEach(() => {
  db = createInMemoryDb();
  repo = makeRepo(db);
});

afterEach(async () => {
  await db.closeAsync();
});

describe('SubredditRepository (integration)', () => {
  it('defaults isEnabledForSearch to true when adding a new subreddit', async () => {
    const result = await repo.add('memes');
    expect(result.isEnabledForSearch).toBe(true);

    const reloaded = await repo.getByName('memes');
    expect(reloaded!.isEnabledForSearch).toBe(true);
  });

  it('setEnabledForSearch(false) excludes a subreddit and persists it', async () => {
    await repo.add('memes');
    await repo.setEnabledForSearch('memes', false);

    const reloaded = await repo.getByName('memes');
    expect(reloaded!.isEnabledForSearch).toBe(false);
  });

  it('setEnabledForSearch does not affect other subreddits', async () => {
    await repo.add('memes');
    await repo.add('aww');

    await repo.setEnabledForSearch('memes', false);

    const memes = await repo.getByName('memes');
    const aww = await repo.getByName('aww');
    expect(memes!.isEnabledForSearch).toBe(false);
    expect(aww!.isEnabledForSearch).toBe(true);
  });

  it('re-enabling a subreddit restores it to Search All', async () => {
    await repo.add('memes');
    await repo.setEnabledForSearch('memes', false);
    await repo.setEnabledForSearch('memes', true);

    const reloaded = await repo.getByName('memes');
    expect(reloaded!.isEnabledForSearch).toBe(true);
  });

  it('disabling a subreddit does not remove it from getAll (it stays browsable)', async () => {
    await repo.add('memes');
    await repo.setEnabledForSearch('memes', false);

    const all = await repo.getAll();
    expect(all.map((s) => s.name)).toContain('memes');
  });

  it('getAll reflects a mix of enabled and disabled subreddits, filterable by the caller', async () => {
    await repo.add('memes');
    await repo.add('aww');
    await repo.add('funny');
    await repo.setEnabledForSearch('aww', false);

    const all = await repo.getAll();
    const enabledNames = all.filter((s) => s.isEnabledForSearch).map((s) => s.name);
    expect(enabledNames.sort()).toEqual(['funny', 'memes']);
  });

  it('setEnabledForSearch preserves an existing favorite/rating/notes profile', async () => {
    await repo.add('memes');
    await repo.upsert('memes', { isFavorite: true, rating: 4.5, notes: 'good stuff' });

    await repo.setEnabledForSearch('memes', false);

    const reloaded = await repo.getByName('memes');
    expect(reloaded).toMatchObject({
      isFavorite: true,
      rating: 4.5,
      notes: 'good stuff',
      isEnabledForSearch: false,
    });
  });

  it('setEnabledForSearch on a not-yet-added subreddit creates it (lazy creation, matching upsert semantics)', async () => {
    const result = await repo.setEnabledForSearch('brandnew', false);
    expect(result.isEnabledForSearch).toBe(false);

    const all = await repo.getAll();
    expect(all.map((s) => s.name)).toContain('brandnew');
  });

  it('is case-insensitive when looking up by name (COLLATE NOCASE)', async () => {
    await repo.add('Memes');
    await repo.setEnabledForSearch('MEMES', false);

    const reloaded = await repo.getByName('memes');
    expect(reloaded!.isEnabledForSearch).toBe(false);
  });
});
