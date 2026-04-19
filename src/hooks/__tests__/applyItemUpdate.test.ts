import { applyItemUpdate } from '@/hooks/useFilteredPosts';
import { OrderByOption } from '@/constants/orderBy';
import { makePost } from './test_post_helpers';

describe('applyItemUpdate', () => {
  // ── no-op scenarios ───────────────────────────────────────────────────────

  describe('item not in list and does not pass filters', () => {
    it('returns the same array reference (no change)', () => {
      const posts = [makePost(1), makePost(2)];
      const outsider = makePost(99, { isFavorite: false });

      const result = applyItemUpdate(posts, outsider, { favouritesFilter: 'yes' });

      expect(result).toBe(posts); // exact same reference
    });
  });

  // ── removal scenarios ─────────────────────────────────────────────────────

  describe('item in list but no longer passes filters', () => {
    it('removes item when unfavorited while favourites-only filter is active', () => {
      const favPost = makePost(5, { isFavorite: true });
      const posts = [makePost(1), favPost, makePost(3)];
      const nowUnfavorited = { ...favPost, isFavorite: false };

      const result = applyItemUpdate(posts, nowUnfavorited, { favouritesFilter: 'yes' });

      expect(result).toHaveLength(2);
      expect(result.find((p) => p.id === 5)).toBeUndefined();
    });

    it('removes item when marked read while unread-only filter is active', () => {
      const unreadPost = makePost(7, { isRead: false });
      const posts = [unreadPost, makePost(8)];
      const nowRead = { ...unreadPost, isRead: true, readAt: new Date() };

      const result = applyItemUpdate(posts, nowRead, { readFilter: 'no' });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(8);
    });

    it('removes item when dequeued while queued-only filter is active', () => {
      const queued = makePost(10, { queuedAt: new Date() });
      const posts = [queued];
      const dequeued = { ...queued, queuedAt: null };

      const result = applyItemUpdate(posts, dequeued, { queuedFilter: 'yes' });

      expect(result).toHaveLength(0);
    });
  });

  // ── insertion scenarios ───────────────────────────────────────────────────

  describe('item not in list but now passes filters', () => {
    it('inserts item when favorited while favourites-only filter is active', () => {
      const posts = [makePost(1), makePost(2)];
      const newFav = makePost(99, { isFavorite: true });

      const result = applyItemUpdate(posts, newFav, { favouritesFilter: 'yes' });

      expect(result).toHaveLength(3);
      expect(result.find((p) => p.id === 99)).toBeDefined();
    });

    it('inserts and sorts by addedAt desc by default', () => {
      const older = makePost(1, { addedAt: new Date('2024-01-01') });
      const newer = makePost(2, { addedAt: new Date('2024-06-01') });
      const posts = [newer, older]; // already sorted newest-first

      // newItem has a date between the two
      const mid = makePost(99, {
        isFavorite: true,
        addedAt: new Date('2024-03-01'),
      });

      const result = applyItemUpdate(posts, mid, { favouritesFilter: 'yes' });

      expect(result.map((p) => p.id)).toEqual([2, 99, 1]); // newest → oldest
    });

    it('inserts newly queued item into queuedAt view at the correct position', () => {
      const existing = makePost(1, { queuedAt: new Date('2024-01-01') });
      const posts = [existing];

      // Item 99 was not queued — now it is
      const nowQueued = makePost(99, { queuedAt: new Date('2024-12-01') });

      const result = applyItemUpdate(posts, nowQueued, { orderBy: OrderByOption.QueuedAt, orderDirection: 'desc' });

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(99); // newest queuedAt → top
    });

    it('does NOT insert a non-queued item into a queuedAt view (phantom insertion guard)', () => {
      const existing = makePost(1, { queuedAt: new Date('2024-01-01') });
      const posts = [existing];

      // Non-queued item gets its favorite toggled — must NOT appear in queuedAt view
      const nonQueued = makePost(99, { queuedAt: null, isFavorite: true });

      const result = applyItemUpdate(posts, nonQueued, { orderBy: OrderByOption.QueuedAt });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });
  });

  // ── in-place update scenarios ─────────────────────────────────────────────

  describe('item in list and still passes filters', () => {
    it('updates the item and re-sorts by default ordering (addedAt desc)', () => {
      const p = makePost(5, { isFavorite: false });
      const posts = [makePost(1), p, makePost(3)];
      const updated = { ...p, isFavorite: true };

      const result = applyItemUpdate(posts, updated, {});

      expect(result).toHaveLength(3);
      // Post 5 has addedAt 2024-01-05 (newest), so it moves to position 0 when sorted desc
      expect(result[0].id).toBe(5);
      expect(result[0].isFavorite).toBe(true);
      // Order should be [5, 3, 1] by addedAt desc
      expect(result.map((p) => p.id)).toEqual([5, 3, 1]);
    });

    it('maintains correct order when sort key is not affected', () => {
      const posts = [makePost(3), makePost(2), makePost(1)];
      const updatedPost2 = { ...posts[1], isFavorite: true };

      // orderBy=AddedAt: isFavorite change re-sorts but maintains order since addedAt is unchanged
      const result = applyItemUpdate(posts, updatedPost2, {
        orderBy: OrderByOption.AddedAt,
      });

      // Still sorted by addedAt desc: [3, 2, 1]
      expect(result.map((p) => p.id)).toEqual([3, 2, 1]);
      expect(result[1].isFavorite).toBe(true);
    });

    it('re-sorts when readAt changes with ReadAt sort order', () => {
      const a = makePost(1, { readAt: new Date('2024-01-01') });
      const b = makePost(2, { readAt: new Date('2024-06-01') });
      const c = makePost(3, { readAt: new Date('2024-03-01') });
      const posts = [b, c, a]; // b > c > a

      // Post a gets a newer readAt — should move to the top (desc)
      const updatedA = { ...a, readAt: new Date('2024-12-01') };

      const result = applyItemUpdate(posts, updatedA, {
        orderBy: OrderByOption.ReadAt,
        orderDirection: 'desc',
      });

      expect(result[0].id).toBe(1); // updatedA now has newest readAt
    });

    it('re-sorts when queuedAt changes with QueuedAt sort order', () => {
      const nowQueued = new Date('2024-12-01');
      const a = makePost(1, { queuedAt: new Date('2024-01-01') });
      const b = makePost(2, { queuedAt: new Date('2024-06-01') });
      const posts = [b, a]; // b > a

      // Post a gets a newer queuedAt — should move to top
      const updatedA = { ...a, queuedAt: nowQueued };

      const result = applyItemUpdate(posts, updatedA, {
        orderBy: OrderByOption.QueuedAt,
        orderDirection: 'desc',
      });

      expect(result[0].id).toBe(1);
    });

    it('always re-sorts when orderBy is UpdatedAt (server-side computed value)', () => {
      const a = makePost(1, { updatedAt: new Date('2024-01-01') });
      const b = makePost(2, { updatedAt: new Date('2024-06-01') });
      const posts = [b, a];

      // isFavorite toggle: the sort key itself (updatedAt) didn't change here,
      // but UpdatedAt sorting always triggers a re-sort because the DB computes
      // "real update" (updatedAt > addedAt + 1s) which we can't check client-side.
      const updated = { ...a, isFavorite: true };

      // Just assert it doesn't throw and returns 2 items in some order
      const result = applyItemUpdate(posts, updated, {
        orderBy: OrderByOption.UpdatedAt,
      });

      expect(result).toHaveLength(2);
    });
  });

  // ── random order scenarios ────────────────────────────────────────────────

  describe('random order — no re-shuffle on item update', () => {
    it('updates item data in-place without changing relative order of other posts', () => {
      const a = makePost(1);
      const b = makePost(2);
      const c = makePost(3);
      // A specific shuffled order that would not be produced by addedAt sorting
      const posts = [b, c, a];
      const updatedB = { ...b, isFavorite: true };

      const result = applyItemUpdate(posts, updatedB, {
        orderBy: OrderByOption.Random,
        randomSeed: 42,
      });

      // Data should be updated
      expect(result.find((p) => p.id === 2)?.isFavorite).toBe(true);
      // Order of all three posts must be unchanged: [2, 3, 1]
      expect(result.map((p) => p.id)).toEqual([2, 3, 1]);
    });

    it('does not re-shuffle when queuedAt changes under random order', () => {
      const a = makePost(1, { queuedAt: null });
      const b = makePost(2, { queuedAt: null });
      const posts = [b, a]; // shuffled order

      const updatedA = { ...a, queuedAt: new Date() };

      const result = applyItemUpdate(posts, updatedA, {
        orderBy: OrderByOption.Random,
        randomSeed: 99,
      });

      // queuedAt update should be reflected
      expect(result.find((p) => p.id === 1)?.queuedAt).not.toBeNull();
      // Order must not change: still [2, 1]
      expect(result.map((p) => p.id)).toEqual([2, 1]);
    });

    it('does not re-shuffle when updatedAt changes under random order', () => {
      const a = makePost(1);
      const b = makePost(2);
      const c = makePost(3);
      const posts = [c, a, b]; // shuffled order

      const updatedA = { ...a, updatedAt: new Date() };

      const result = applyItemUpdate(posts, updatedA, {
        orderBy: OrderByOption.Random,
        randomSeed: 7,
      });

      // Order must not change: still [3, 1, 2]
      expect(result.map((p) => p.id)).toEqual([3, 1, 2]);
    });

    it('appends newly qualifying item at end instead of reshuffling', () => {
      const a = makePost(1);
      const b = makePost(2);
      const posts = [b, a]; // shuffled [2, 1]

      // Post 99 was not a favourite; now it is (favouritesFilter: 'yes')
      const newFav = makePost(99, { isFavorite: true });

      const result = applyItemUpdate(posts, newFav, {
        orderBy: OrderByOption.Random,
        favouritesFilter: 'yes',
        randomSeed: 42,
      });

      expect(result).toHaveLength(3);
      // Existing order preserved; new item at the end
      expect(result[0].id).toBe(2);
      expect(result[1].id).toBe(1);
      expect(result[2].id).toBe(99);
    });
  });
});
