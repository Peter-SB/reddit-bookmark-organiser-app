import { AuthorProfileRepository } from '../AuthorProfileRepository';

const NOW = '2025-01-01T00:00:00.000Z';

function makeRepo(overrides: Partial<ReturnType<typeof makeMockDb>> = {}) {
  const db = { ...makeMockDb(), ...overrides };
  return new (AuthorProfileRepository as any)(db);
}

function makeMockDb() {
  return {
    getFirstAsync: jest.fn<Promise<any>, any>(),
    getAllAsync: jest.fn<Promise<any[]>, any>(),
    runAsync: jest.fn<Promise<{ lastInsertRowId: number; changes: number }>, any>(),
  };
}

function makeRow(overrides: Partial<{
  author: string;
  isFavorite: number;
  rating: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}> = {}) {
  return {
    author: 'testuser',
    isFavorite: 0,
    rating: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

// ─── mapRow (via getByAuthor) ─────────────────────────────────────────────────

describe('AuthorProfileRepository', () => {
  describe('getByAuthor', () => {
    it('returns null when no row exists', async () => {
      const repo = makeRepo({ getFirstAsync: jest.fn().mockResolvedValue(null) });
      const result = await repo.getByAuthor('nobody');
      expect(result).toBeNull();
    });

    it('maps isFavorite integer 1 to true', async () => {
      const row = makeRow({ isFavorite: 1 });
      const repo = makeRepo({ getFirstAsync: jest.fn().mockResolvedValue(row) });
      const result = await repo.getByAuthor('testuser');
      expect(result!.isFavorite).toBe(true);
    });

    it('maps isFavorite integer 0 to false', async () => {
      const row = makeRow({ isFavorite: 0 });
      const repo = makeRepo({ getFirstAsync: jest.fn().mockResolvedValue(row) });
      const result = await repo.getByAuthor('testuser');
      expect(result!.isFavorite).toBe(false);
    });

    it('maps all fields correctly', async () => {
      const row = makeRow({ author: 'alice', isFavorite: 1, rating: 4.5, notes: 'great author' });
      const repo = makeRepo({ getFirstAsync: jest.fn().mockResolvedValue(row) });
      const result = await repo.getByAuthor('alice');
      expect(result).toMatchObject({
        author: 'alice',
        isFavorite: true,
        rating: 4.5,
        notes: 'great author',
      });
      expect(result!.createdAt).toBeInstanceOf(Date);
      expect(result!.updatedAt).toBeInstanceOf(Date);
    });

    it('passes COLLATE NOCASE query to db', async () => {
      const getFirstAsync = jest.fn().mockResolvedValue(null);
      const repo = makeRepo({ getFirstAsync });
      await repo.getByAuthor('Alice');
      expect(getFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining('COLLATE NOCASE'),
        'Alice',
      );
    });
  });

  // ─── getAll ───────────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('returns empty array when no profiles exist', async () => {
      const repo = makeRepo({ getAllAsync: jest.fn().mockResolvedValue([]) });
      expect(await repo.getAll()).toEqual([]);
    });

    it('maps all rows', async () => {
      const rows = [
        makeRow({ author: 'alice', isFavorite: 1 }),
        makeRow({ author: 'bob', rating: 3.0 }),
      ];
      const repo = makeRepo({ getAllAsync: jest.fn().mockResolvedValue(rows) });
      const result = await repo.getAll();
      expect(result).toHaveLength(2);
      expect(result[0].author).toBe('alice');
      expect(result[0].isFavorite).toBe(true);
      expect(result[1].author).toBe('bob');
      expect(result[1].rating).toBe(3.0);
    });
  });

  // ─── upsert (insert path) ─────────────────────────────────────────────────

  describe('upsert — insert path (no existing row)', () => {
    it('inserts a new row when no profile exists', async () => {
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
      // getFirstAsync: first call (getByAuthor inside upsert) returns null; second call (re-fetch) returns new row
      const newRow = makeRow({ author: 'newuser', isFavorite: 1 });
      const getFirstAsync = jest.fn()
        .mockResolvedValueOnce(null)    // no existing row
        .mockResolvedValueOnce(newRow); // re-fetch after insert
      const repo = makeRepo({ getFirstAsync, runAsync });

      const result = await repo.upsert('newuser', { isFavorite: true });

      expect(runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO author_profiles'),
        'newuser',
        1,      // isFavorite true → 1
        null,   // rating
        null,   // notes
        expect.any(String),
        expect.any(String),
      );
      expect(result.isFavorite).toBe(true);
    });

    it('uses default false/null for unset fields on insert', async () => {
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
      const newRow = makeRow({ author: 'user2', rating: 4.0 });
      const getFirstAsync = jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(newRow);
      const repo = makeRepo({ getFirstAsync, runAsync });

      await repo.upsert('user2', { rating: 4.0 });

      expect(runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO author_profiles'),
        'user2',
        0,    // isFavorite defaults to false → 0
        4.0,  // rating as provided
        null, // notes defaults to null
        expect.any(String),
        expect.any(String),
      );
    });
  });

  // ─── upsert (update path) ─────────────────────────────────────────────────

  describe('upsert — update path (existing row)', () => {
    it('updates row and preserves unchanged fields', async () => {
      const existingRow = makeRow({ author: 'alice', isFavorite: 0, rating: 3.0, notes: 'nice' });
      const updatedRow = makeRow({ author: 'alice', isFavorite: 0, rating: 5.0, notes: 'nice' });
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 0, changes: 1 });
      const getFirstAsync = jest.fn()
        .mockResolvedValueOnce(existingRow) // existing check
        .mockResolvedValueOnce(updatedRow); // re-fetch
      const repo = makeRepo({ getFirstAsync, runAsync });

      const result = await repo.upsert('alice', { rating: 5.0 });

      expect(runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE author_profiles'),
        0,      // isFavorite preserved (false → 0)
        5.0,    // rating changed
        'nice', // notes preserved
        expect.any(String),
        'alice',
      );
      expect(result.rating).toBe(5.0);
      expect(result.notes).toBe('nice');
    });
  });

  // ─── toggleFavorite ───────────────────────────────────────────────────────

  describe('toggleFavorite', () => {
    it('sets isFavorite to true when no profile exists', async () => {
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
      const newRow = makeRow({ author: 'user1', isFavorite: 1 });
      const getFirstAsync = jest.fn()
        .mockResolvedValueOnce(null)    // no existing row
        .mockResolvedValueOnce(null)    // second getByAuthor inside upsert
        .mockResolvedValueOnce(newRow); // re-fetch
      const repo = makeRepo({ getFirstAsync, runAsync });

      const result = await repo.toggleFavorite('user1');

      expect(runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO author_profiles'),
        'user1',
        1, // true → 1
        null,
        null,
        expect.any(String),
        expect.any(String),
      );
      expect(result.isFavorite).toBe(true);
    });

    it('flips isFavorite from true to false on existing profile', async () => {
      const favRow = makeRow({ author: 'user2', isFavorite: 1 });
      const unfavRow = makeRow({ author: 'user2', isFavorite: 0 });
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 0, changes: 1 });
      const getFirstAsync = jest.fn()
        .mockResolvedValueOnce(favRow)   // existing row in toggleFavorite
        .mockResolvedValueOnce(favRow)   // existing check in upsert
        .mockResolvedValueOnce(unfavRow); // re-fetch
      const repo = makeRepo({ getFirstAsync, runAsync });

      const result = await repo.toggleFavorite('user2');

      expect(runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE author_profiles'),
        0, // flipped to false → 0
        null,
        null,
        expect.any(String),
        'user2',
      );
      expect(result.isFavorite).toBe(false);
    });
  });

  // ─── setRating ────────────────────────────────────────────────────────────

  describe('setRating', () => {
    it('inserts a profile with the given rating', async () => {
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
      const newRow = makeRow({ author: 'rater', rating: 4.5 });
      const getFirstAsync = jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(newRow);
      const repo = makeRepo({ getFirstAsync, runAsync });

      const result = await repo.setRating('rater', 4.5);

      expect(result.rating).toBe(4.5);
    });

    it('clears the rating when passed null', async () => {
      const existingRow = makeRow({ author: 'rater', rating: 4.5 });
      const clearedRow = makeRow({ author: 'rater', rating: null });
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 0, changes: 1 });
      const getFirstAsync = jest.fn()
        .mockResolvedValueOnce(existingRow)
        .mockResolvedValueOnce(clearedRow);
      const repo = makeRepo({ getFirstAsync, runAsync });

      const result = await repo.setRating('rater', null);

      expect(result.rating).toBeNull();
    });
  });

  // ─── setNotes ─────────────────────────────────────────────────────────────

  describe('setNotes', () => {
    it('inserts a profile with the given notes', async () => {
      const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
      const newRow = makeRow({ author: 'noter', notes: 'interesting writer' });
      const getFirstAsync = jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(newRow);
      const repo = makeRepo({ getFirstAsync, runAsync });

      const result = await repo.setNotes('noter', 'interesting writer');

      expect(result.notes).toBe('interesting writer');
    });

    it('clears notes when passed null', async () => {
      const existingRow = makeRow({ author: 'noter', notes: 'something' });
      const clearedRow = makeRow({ author: 'noter', notes: null });
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
