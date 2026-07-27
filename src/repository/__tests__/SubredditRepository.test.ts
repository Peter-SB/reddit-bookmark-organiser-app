import { SubredditRepository } from '../SubredditRepository';

const NOW = '2025-01-01T00:00:00.000Z';

function makeRepo(overrides: Partial<ReturnType<typeof makeMockDb>> = {}) {
  const db = { ...makeMockDb(), ...overrides };
  return new (SubredditRepository as any)(db);
}

function makeMockDb() {
  return {
    getFirstAsync: jest.fn<Promise<any>, any>(),
    getAllAsync: jest.fn<Promise<any[]>, any>(),
    runAsync: jest.fn<Promise<{ lastInsertRowId: number; changes: number }>, any>(),
  };
}

function makeRow(overrides: Partial<{
  name: string;
  isFavorite: number;
  isEnabledForSearch: number;
  rating: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}> = {}) {
  return {
    name: 'memes',
    isFavorite: 0,
    isEnabledForSearch: 1,
    rating: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

// ─── mapRow (via getByName) ────────────────────────────────────────────────

describe('SubredditRepository', () => {
  describe('getByName', () => {
    it('returns null when no row exists', async () => {
      const repo = makeRepo({ getFirstAsync: jest.fn().mockResolvedValue(null) });
      const result = await repo.getByName('nobody');
      expect(result).toBeNull();
    });

    it('maps isFavorite integer 1 to true', async () => {
      const row = makeRow({ isFavorite: 1 });
      const repo = makeRepo({ getFirstAsync: jest.fn().mockResolvedValue(row) });
      const result = await repo.getByName('memes');
      expect(result!.isFavorite).toBe(true);
    });

    it('maps isFavorite integer 0 to false', async () => {
      const row = makeRow({ isFavorite: 0 });
      const repo = makeRepo({ getFirstAsync: jest.fn().mockResolvedValue(row) });
      const result = await repo.getByName('memes');
      expect(result!.isFavorite).toBe(false);
    });

    it('maps isEnabledForSearch integer 1 to true', async () => {
      const row = makeRow({ isEnabledForSearch: 1 });
      const repo = makeRepo({ getFirstAsync: jest.fn().mockResolvedValue(row) });
      const result = await repo.getByName('memes');
      expect(result!.isEnabledForSearch).toBe(true);
    });

    it('maps isEnabledForSearch integer 0 to false', async () => {
      const row = makeRow({ isEnabledForSearch: 0 });
      const repo = makeRepo({ getFirstAsync: jest.fn().mockResolvedValue(row) });
      const result = await repo.getByName('memes');
      expect(result!.isEnabledForSearch).toBe(false);
    });

    it('maps all fields correctly', async () => {
      const row = makeRow({ name: 'aww', isFavorite: 1, rating: 4.5, notes: 'wholesome' });
      const repo = makeRepo({ getFirstAsync: jest.fn().mockResolvedValue(row) });
      const result = await repo.getByName('aww');
      expect(result).toMatchObject({
        name: 'aww',
        isFavorite: true,
        isEnabledForSearch: true,
        rating: 4.5,
        notes: 'wholesome',
      });
      expect(result!.createdAt).toBeInstanceOf(Date);
      expect(result!.updatedAt).toBeInstanceOf(Date);
    });

    it('passes COLLATE NOCASE query to db', async () => {
      const getFirstAsync = jest.fn().mockResolvedValue(null);
      const repo = makeRepo({ getFirstAsync });
      await repo.getByName('Memes');
      expect(getFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining('COLLATE NOCASE'),
        'Memes',
      );
    });
  });

  // ─── getAll ─────────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('returns empty array when no subreddits exist', async () => {
      const repo = makeRepo({ getAllAsync: jest.fn().mockResolvedValue([]) });
      expect(await repo.getAll()).toEqual([]);
    });

    it('maps all rows', async () => {
      const rows = [
        makeRow({ name: 'memes', isFavorite: 1 }),
        makeRow({ name: 'aww', rating: 3.0 }),
      ];
      const repo = makeRepo({ getAllAsync: jest.fn().mockResolvedValue(rows) });
      const result = await repo.getAll();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('memes');
      expect(result[0].isFavorite).toBe(true);
      expect(result[1].name).toBe('aww');
      expect(result[1].rating).toBe(3.0);
    });
  });

  // ─── add ────────────────────────────────────────────────────────────────

  describe('add', () => {
    it('inserts the subreddit as enabled-for-search by default and returns it', async () => {
      const newRow = makeRow({ name: 'newsub' });
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
      const getFirstAsync = jest.fn().mockResolvedValue(newRow);
      const repo = makeRepo({ getFirstAsync, runAsync });

      const result = await repo.add('newsub');

      expect(runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR IGNORE INTO subreddits'),
        'newsub',
        expect.any(String),
        expect.any(String),
      );
      expect(result.name).toBe('newsub');
      expect(result.isEnabledForSearch).toBe(true);
    });

    it('is idempotent — INSERT OR IGNORE leaves an existing row unchanged', async () => {
      const existingRow = makeRow({ name: 'memes', isFavorite: 1, rating: 5 });
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 0, changes: 0 });
      const getFirstAsync = jest.fn().mockResolvedValue(existingRow);
      const repo = makeRepo({ getFirstAsync, runAsync });

      const result = await repo.add('memes');

      expect(result).toMatchObject({ name: 'memes', isFavorite: true, rating: 5 });
    });
  });

  // ─── remove ─────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('deletes the row with COLLATE NOCASE', async () => {
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 0, changes: 1 });
      const repo = makeRepo({ runAsync });

      await repo.remove('Memes');

      expect(runAsync).toHaveBeenCalledWith(
        expect.stringContaining('COLLATE NOCASE'),
        'Memes',
      );
    });
  });

  // ─── upsert (insert path) ───────────────────────────────────────────────

  describe('upsert — insert path (no existing row)', () => {
    it('inserts a new row when no profile exists', async () => {
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
      const newRow = makeRow({ name: 'newsub', isFavorite: 1 });
      const getFirstAsync = jest.fn()
        .mockResolvedValueOnce(null)    // no existing row
        .mockResolvedValueOnce(newRow); // re-fetch after insert
      const repo = makeRepo({ getFirstAsync, runAsync });

      const result = await repo.upsert('newsub', { isFavorite: true });

      expect(runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO subreddits'),
        'newsub',
        1,      // isFavorite true → 1
        1,      // isEnabledForSearch defaults to true → 1
        null,   // rating
        null,   // notes
        expect.any(String),
        expect.any(String),
      );
      expect(result.isFavorite).toBe(true);
    });

    it('uses default false/true/null for unset fields on insert', async () => {
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
      const newRow = makeRow({ name: 'sub2', rating: 4.0 });
      const getFirstAsync = jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(newRow);
      const repo = makeRepo({ getFirstAsync, runAsync });

      await repo.upsert('sub2', { rating: 4.0 });

      expect(runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO subreddits'),
        'sub2',
        0,    // isFavorite defaults to false → 0
        1,    // isEnabledForSearch defaults to true → 1
        4.0,  // rating as provided
        null, // notes defaults to null
        expect.any(String),
        expect.any(String),
      );
    });

    it('respects an explicit isEnabledForSearch: false on insert', async () => {
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
      const newRow = makeRow({ name: 'sub3', isEnabledForSearch: 0 });
      const getFirstAsync = jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(newRow);
      const repo = makeRepo({ getFirstAsync, runAsync });

      const result = await repo.upsert('sub3', { isEnabledForSearch: false });

      expect(runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO subreddits'),
        'sub3',
        0,
        0, // isEnabledForSearch explicitly false → 0
        null,
        null,
        expect.any(String),
        expect.any(String),
      );
      expect(result.isEnabledForSearch).toBe(false);
    });
  });

  // ─── upsert (update path) ───────────────────────────────────────────────

  describe('upsert — update path (existing row)', () => {
    it('updates row and preserves unchanged fields', async () => {
      const existingRow = makeRow({ name: 'memes', isFavorite: 0, rating: 3.0, notes: 'nice' });
      const updatedRow = makeRow({ name: 'memes', isFavorite: 0, rating: 5.0, notes: 'nice' });
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 0, changes: 1 });
      const getFirstAsync = jest.fn()
        .mockResolvedValueOnce(existingRow) // existing check
        .mockResolvedValueOnce(updatedRow); // re-fetch
      const repo = makeRepo({ getFirstAsync, runAsync });

      const result = await repo.upsert('memes', { rating: 5.0 });

      expect(runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE subreddits'),
        0,      // isFavorite preserved (false → 0)
        1,      // isEnabledForSearch preserved (true → 1)
        5.0,    // rating changed
        'nice', // notes preserved
        expect.any(String),
        'memes',
      );
      expect(result.rating).toBe(5.0);
      expect(result.notes).toBe('nice');
    });

    it('preserves isEnabledForSearch=false when updating an unrelated field', async () => {
      const existingRow = makeRow({ name: 'disabled', isEnabledForSearch: 0, rating: 3.0 });
      const updatedRow = makeRow({ name: 'disabled', isEnabledForSearch: 0, rating: 5.0 });
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 0, changes: 1 });
      const getFirstAsync = jest.fn()
        .mockResolvedValueOnce(existingRow)
        .mockResolvedValueOnce(updatedRow);
      const repo = makeRepo({ getFirstAsync, runAsync });

      const result = await repo.upsert('disabled', { rating: 5.0 });

      expect(runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE subreddits'),
        0,
        0, // isEnabledForSearch preserved as false → 0
        5.0,
        null,
        expect.any(String),
        'disabled',
      );
      expect(result.isEnabledForSearch).toBe(false);
    });
  });

  // ─── toggleFavorite ─────────────────────────────────────────────────────

  describe('toggleFavorite', () => {
    it('sets isFavorite to true when no subreddit exists', async () => {
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
      const newRow = makeRow({ name: 'sub1', isFavorite: 1 });
      const getFirstAsync = jest.fn()
        .mockResolvedValueOnce(null)    // no existing row
        .mockResolvedValueOnce(null)    // second getByName inside upsert
        .mockResolvedValueOnce(newRow); // re-fetch
      const repo = makeRepo({ getFirstAsync, runAsync });

      const result = await repo.toggleFavorite('sub1');

      expect(runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO subreddits'),
        'sub1',
        1, // true → 1
        1, // isEnabledForSearch defaults to true → 1
        null,
        null,
        expect.any(String),
        expect.any(String),
      );
      expect(result.isFavorite).toBe(true);
    });

    it('flips isFavorite from true to false on existing subreddit', async () => {
      const favRow = makeRow({ name: 'sub2', isFavorite: 1 });
      const unfavRow = makeRow({ name: 'sub2', isFavorite: 0 });
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 0, changes: 1 });
      const getFirstAsync = jest.fn()
        .mockResolvedValueOnce(favRow)   // existing row in toggleFavorite
        .mockResolvedValueOnce(favRow)   // existing check in upsert
        .mockResolvedValueOnce(unfavRow); // re-fetch
      const repo = makeRepo({ getFirstAsync, runAsync });

      const result = await repo.toggleFavorite('sub2');

      expect(runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE subreddits'),
        0, // flipped to false → 0
        1, // isEnabledForSearch preserved (true → 1)
        null,
        null,
        expect.any(String),
        'sub2',
      );
      expect(result.isFavorite).toBe(false);
    });
  });

  // ─── setEnabledForSearch ────────────────────────────────────────────────

  describe('setEnabledForSearch', () => {
    it('inserts an enabled subreddit when none exists', async () => {
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
      const newRow = makeRow({ name: 'newsub', isEnabledForSearch: 1 });
      const getFirstAsync = jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(newRow);
      const repo = makeRepo({ getFirstAsync, runAsync });

      const result = await repo.setEnabledForSearch('newsub', true);

      expect(result.isEnabledForSearch).toBe(true);
    });

    it('disables an existing subreddit without touching other fields', async () => {
      const existingRow = makeRow({ name: 'memes', isFavorite: 1, rating: 4.5, isEnabledForSearch: 1 });
      const disabledRow = makeRow({ name: 'memes', isFavorite: 1, rating: 4.5, isEnabledForSearch: 0 });
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 0, changes: 1 });
      const getFirstAsync = jest.fn()
        .mockResolvedValueOnce(existingRow)
        .mockResolvedValueOnce(disabledRow);
      const repo = makeRepo({ getFirstAsync, runAsync });

      const result = await repo.setEnabledForSearch('memes', false);

      expect(runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE subreddits'),
        1,   // isFavorite preserved
        0,   // isEnabledForSearch → false
        4.5, // rating preserved
        null,
        expect.any(String),
        'memes',
      );
      expect(result.isEnabledForSearch).toBe(false);
      expect(result.isFavorite).toBe(true);
    });

    it('re-enables a previously disabled subreddit', async () => {
      const existingRow = makeRow({ name: 'memes', isEnabledForSearch: 0 });
      const enabledRow = makeRow({ name: 'memes', isEnabledForSearch: 1 });
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 0, changes: 1 });
      const getFirstAsync = jest.fn()
        .mockResolvedValueOnce(existingRow)
        .mockResolvedValueOnce(enabledRow);
      const repo = makeRepo({ getFirstAsync, runAsync });

      const result = await repo.setEnabledForSearch('memes', true);

      expect(result.isEnabledForSearch).toBe(true);
    });
  });

  // ─── setRating ──────────────────────────────────────────────────────────

  describe('setRating', () => {
    it('inserts a subreddit with the given rating', async () => {
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
      const newRow = makeRow({ name: 'rater', rating: 4.5 });
      const getFirstAsync = jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(newRow);
      const repo = makeRepo({ getFirstAsync, runAsync });

      const result = await repo.setRating('rater', 4.5);

      expect(result.rating).toBe(4.5);
    });

    it('clears the rating when passed null', async () => {
      const existingRow = makeRow({ name: 'rater', rating: 4.5 });
      const clearedRow = makeRow({ name: 'rater', rating: null });
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 0, changes: 1 });
      const getFirstAsync = jest.fn()
        .mockResolvedValueOnce(existingRow)
        .mockResolvedValueOnce(clearedRow);
      const repo = makeRepo({ getFirstAsync, runAsync });

      const result = await repo.setRating('rater', null);

      expect(result.rating).toBeNull();
    });
  });

  // ─── setNotes ───────────────────────────────────────────────────────────

  describe('setNotes', () => {
    it('inserts a subreddit with the given notes', async () => {
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
      const newRow = makeRow({ name: 'noter', notes: 'good content' });
      const getFirstAsync = jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(newRow);
      const repo = makeRepo({ getFirstAsync, runAsync });

      const result = await repo.setNotes('noter', 'good content');

      expect(result.notes).toBe('good content');
    });

    it('clears notes when passed null', async () => {
      const existingRow = makeRow({ name: 'noter', notes: 'something' });
      const clearedRow = makeRow({ name: 'noter', notes: null });
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 0, changes: 1 });
      const getFirstAsync = jest.fn()
        .mockResolvedValueOnce(existingRow)
        .mockResolvedValueOnce(clearedRow);
      const repo = makeRepo({ getFirstAsync, runAsync });

      const result = await repo.setNotes('noter', null);

      expect(result.notes).toBeNull();
    });
  });
});
