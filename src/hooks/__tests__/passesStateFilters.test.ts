import { passesStateFilters } from '@/hooks/useFilteredPosts';
import { OrderByOption } from '@/constants/orderBy';
import { makePost } from './test_post_helpers';

describe('passesStateFilters', () => {
  const post = makePost(1);

  // ── favouritesFilter ─────────────────────────────────────────────────────

  describe('favouritesFilter', () => {
    it('passes when filter is "all" regardless of isFavorite', () => {
      expect(passesStateFilters({ ...post, isFavorite: false }, { favouritesFilter: 'all' })).toBe(true);
      expect(passesStateFilters({ ...post, isFavorite: true }, { favouritesFilter: 'all' })).toBe(true);
    });

    it('passes when filter is "yes" and item is a favourite', () => {
      expect(passesStateFilters({ ...post, isFavorite: true }, { favouritesFilter: 'yes' })).toBe(true);
    });

    it('fails when filter is "yes" and item is not a favourite', () => {
      expect(passesStateFilters({ ...post, isFavorite: false }, { favouritesFilter: 'yes' })).toBe(false);
    });

    it('passes when filter is "no" and item is not a favourite', () => {
      expect(passesStateFilters({ ...post, isFavorite: false }, { favouritesFilter: 'no' })).toBe(true);
    });

    it('fails when filter is "no" and item is a favourite', () => {
      expect(passesStateFilters({ ...post, isFavorite: true }, { favouritesFilter: 'no' })).toBe(false);
    });
  });

  // ── readFilter ────────────────────────────────────────────────────────────

  describe('readFilter', () => {
    it('passes when filter is "all" regardless of isRead', () => {
      expect(passesStateFilters({ ...post, isRead: false }, { readFilter: 'all' })).toBe(true);
      expect(passesStateFilters({ ...post, isRead: true }, { readFilter: 'all' })).toBe(true);
    });

    it('passes when filter is "yes" and item is read', () => {
      expect(passesStateFilters({ ...post, isRead: true }, { readFilter: 'yes' })).toBe(true);
    });

    it('fails when filter is "yes" and item is unread', () => {
      expect(passesStateFilters({ ...post, isRead: false }, { readFilter: 'yes' })).toBe(false);
    });

    it('passes when filter is "no" and item is unread', () => {
      expect(passesStateFilters({ ...post, isRead: false }, { readFilter: 'no' })).toBe(true);
    });

    it('fails when filter is "no" and item is read', () => {
      expect(passesStateFilters({ ...post, isRead: true }, { readFilter: 'no' })).toBe(false);
    });
  });

  // ── archivedFilter ────────────────────────────────────────────────────────

  describe('archivedFilter', () => {
    it('passes when filter is "yes" and item is archived', () => {
      expect(passesStateFilters({ ...post, isArchived: true }, { archivedFilter: 'yes' })).toBe(true);
    });

    it('fails when filter is "yes" and item is not archived', () => {
      expect(passesStateFilters({ ...post, isArchived: false }, { archivedFilter: 'yes' })).toBe(false);
    });

    it('passes when filter is "no" and item is not archived', () => {
      expect(passesStateFilters({ ...post, isArchived: false }, { archivedFilter: 'no' })).toBe(true);
    });

    it('fails when filter is "no" and item is archived', () => {
      expect(passesStateFilters({ ...post, isArchived: true }, { archivedFilter: 'no' })).toBe(false);
    });
  });

  // ── queuedFilter ──────────────────────────────────────────────────────────

  describe('queuedFilter', () => {
    const queued = new Date('2024-06-01');

    it('passes when filter is "yes" and item has queuedAt', () => {
      expect(passesStateFilters({ ...post, queuedAt: queued }, { queuedFilter: 'yes' })).toBe(true);
    });

    it('fails when filter is "yes" and item has no queuedAt', () => {
      expect(passesStateFilters({ ...post, queuedAt: null }, { queuedFilter: 'yes' })).toBe(false);
    });

    it('passes when filter is "no" and item has no queuedAt', () => {
      expect(passesStateFilters({ ...post, queuedAt: null }, { queuedFilter: 'no' })).toBe(true);
    });

    it('fails when filter is "no" and item has queuedAt', () => {
      expect(passesStateFilters({ ...post, queuedAt: queued }, { queuedFilter: 'no' })).toBe(false);
    });
  });

  // ── combined filters ──────────────────────────────────────────────────────

  describe('combined filters', () => {
    it('passes when all active filters match', () => {
      const favouriteUnread = { ...post, isFavorite: true, isRead: false };
      expect(passesStateFilters(favouriteUnread, {
        favouritesFilter: 'yes',
        readFilter: 'no',
      })).toBe(true);
    });

    it('fails when one of multiple filters does not match', () => {
      const favouriteRead = { ...post, isFavorite: true, isRead: true };
      expect(passesStateFilters(favouriteRead, {
        favouritesFilter: 'yes',
        readFilter: 'no', // mismatch
      })).toBe(false);
    });

    it('passes with no filters set (all undefined behaves as "all")', () => {
      expect(passesStateFilters(post, {})).toBe(true);
    });
  });

  // ── orderBy: QueuedAt implicit filter ─────────────────────────────────────

  describe('orderBy QueuedAt implicit filter', () => {
    const queued = new Date('2024-06-01');

    it('fails for a non-queued item when orderBy is QueuedAt (mirrors SQL implicit filter)', () => {
      expect(passesStateFilters(
        { ...post, queuedAt: null },
        { orderBy: OrderByOption.QueuedAt },
      )).toBe(false);
    });

    it('passes for a queued item when orderBy is QueuedAt', () => {
      expect(passesStateFilters(
        { ...post, queuedAt: queued },
        { orderBy: OrderByOption.QueuedAt },
      )).toBe(true);
    });

    it('does NOT apply the implicit filter for other orderBy values', () => {
      expect(passesStateFilters(
        { ...post, queuedAt: null },
        { orderBy: OrderByOption.AddedAt },
      )).toBe(true);
    });
  });
});
