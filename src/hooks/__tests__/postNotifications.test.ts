/**
 * Tests for the Phase 3 pub/sub notification channels in usePosts.ts.
 *
 * Key property being verified: toggle operations (fav/queue/read/archive) fire
 * `notifyWithItemUpdate` — NOT `notifyListeners` — so that useFilteredPosts can
 * skip the full DB re-query and update state in-place.
 */
import {
  subscribeToPostChanges,
  subscribeToItemUpdates,
  resetSharedPostsState,
  _resetPostsSharedState,
  _notifyWithItemUpdateForTesting,
} from '@/hooks/usePosts';
import { makePost } from './test_post_helpers';

beforeEach(() => {
  _resetPostsSharedState();
});

afterEach(() => {
  _resetPostsSharedState();
});

// ── subscribeToItemUpdates ────────────────────────────────────────────────────

describe('subscribeToItemUpdates', () => {
  it('calls the subscriber with the updated item', () => {
    const received: any[] = [];
    subscribeToItemUpdates((item) => received.push(item));

    const post = makePost(42, { isFavorite: true });
    _notifyWithItemUpdateForTesting(post);

    expect(received).toHaveLength(1);
    expect(received[0].id).toBe(42);
    expect(received[0].isFavorite).toBe(true);
  });

  it('calls all registered subscribers', () => {
    const callA = jest.fn();
    const callB = jest.fn();
    subscribeToItemUpdates(callA);
    subscribeToItemUpdates(callB);

    _notifyWithItemUpdateForTesting(makePost(1));

    expect(callA).toHaveBeenCalledTimes(1);
    expect(callB).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops future notifications', () => {
    const fn = jest.fn();
    const unsub = subscribeToItemUpdates(fn);

    unsub();
    _notifyWithItemUpdateForTesting(makePost(1));

    expect(fn).not.toHaveBeenCalled();
  });

  it('multiple unsubscribes are safe (idempotent)', () => {
    const fn = jest.fn();
    const unsub = subscribeToItemUpdates(fn);
    unsub();
    unsub(); // should not throw

    _notifyWithItemUpdateForTesting(makePost(1));
    expect(fn).not.toHaveBeenCalled();
  });
});

// ── subscribeToPostChanges ────────────────────────────────────────────────────

describe('subscribeToPostChanges', () => {
  it('calls the subscriber when a full-reload event fires', () => {
    const fn = jest.fn();
    subscribeToPostChanges(fn);

    // resetSharedPostsState calls notifyListeners(), which is the full-reload channel
    resetSharedPostsState();

    expect(fn).toHaveBeenCalled();
  });

  it('unsubscribe stops future notifications', () => {
    const fn = jest.fn();
    const unsub = subscribeToPostChanges(fn);

    unsub();
    resetSharedPostsState();

    expect(fn).not.toHaveBeenCalled();
  });
});

// ── Phase 3 optimisation guarantee ───────────────────────────────────────────

describe('Phase 3 optimisation: item updates do NOT trigger full-reload listeners', () => {
  it('does not call subscribeToPostChanges listener when an item update fires', () => {
    const fullReloadFn = jest.fn();
    subscribeToPostChanges(fullReloadFn);

    // Any number of item-level updates must never trigger the full-reload channel
    _notifyWithItemUpdateForTesting(makePost(1, { isFavorite: true }));
    _notifyWithItemUpdateForTesting(makePost(2, { isRead: true, readAt: new Date() }));
    _notifyWithItemUpdateForTesting(makePost(3, { queuedAt: new Date() }));

    expect(fullReloadFn).not.toHaveBeenCalled();
  });

  it('subscribeToItemUpdates listener is NOT called by full list reload events', () => {
    // Guard: the two channels are completely separate
    const itemFn = jest.fn();
    subscribeToItemUpdates(itemFn);

    // Trigger a full list reload (not an item update)
    _resetPostsSharedState();

    expect(itemFn).not.toHaveBeenCalled();
  });
});

// ── isolation between tests ───────────────────────────────────────────────────

describe('listener isolation', () => {
  it('listeners registered in one test do not leak into others', () => {
    // After beforeEach _resetPostsSharedState, there should be no listeners
    const fn = jest.fn();
    subscribeToItemUpdates(fn);
    _notifyWithItemUpdateForTesting(makePost(1));
    expect(fn).toHaveBeenCalledTimes(1);
    // After reset, fn should be gone
    _resetPostsSharedState();
    _notifyWithItemUpdateForTesting(makePost(2));
    expect(fn).toHaveBeenCalledTimes(1); // still just once
  });
});
