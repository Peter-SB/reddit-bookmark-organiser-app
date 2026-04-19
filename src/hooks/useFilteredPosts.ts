// src/hooks/useFilteredPosts.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { PostListItem } from '@/models/models';
import { PostFilterOptions } from '@/repository/PostRepository';
import { initSharedRepo, subscribeToPostChanges, subscribeToItemUpdates } from './usePosts';
import { sortPosts } from '@/utils/postsHelpers';
import { OrderByOption } from "@/constants/orderBy";

export type UseFilteredPostsOptions = PostFilterOptions & {
  /** Seed used for client-side shuffle when orderBy === 'random'. */
  randomSeed?: number;
};

const SEARCH_DEBOUNCE_MS = 100;

/**
 * Client-side check: does an item pass the state-based filters (fav/read/archived/queued)?
 * Used to avoid a full DB re-query after single-item toggle mutations.
 * Search, folder, and author filters are not evaluated here because toggle operations
 * never change those fields — so membership is unchanged from the last full query.
 */
export function passesStateFilters(item: PostListItem, opts: UseFilteredPostsOptions): boolean {
  if (opts.favouritesFilter === 'yes' && !item.isFavorite) return false;
  if (opts.favouritesFilter === 'no' && item.isFavorite) return false;
  if (opts.readFilter === 'yes' && !item.isRead) return false;
  if (opts.readFilter === 'no' && item.isRead) return false;
  if (opts.archivedFilter === 'yes' && !item.isArchived) return false;
  if (opts.archivedFilter === 'no' && item.isArchived) return false;
  if (opts.queuedFilter === 'yes' && !item.queuedAt) return false;
  if (opts.queuedFilter === 'no' && item.queuedAt) return false;
  // Mirror the SQL implicit filter: ORDER BY QueuedAt only includes queued posts.
  if (opts.orderBy === OrderByOption.QueuedAt && !item.queuedAt) return false;
  return true;
}

/**
 * Pure function: applies a single-item update to the current posts list.
 * Handles filter membership and re-sorting without a DB round-trip.
 * Exported for testing.
 */
export function applyItemUpdate(
  currentPosts: PostListItem[],
  updatedItem: PostListItem,
  opts: UseFilteredPostsOptions,
): PostListItem[] {
  const existingIndex = currentPosts.findIndex((p) => p.id === updatedItem.id);
  const stillPasses = passesStateFilters(updatedItem, opts);

  if (existingIndex === -1 && !stillPasses) {
    // Not in list and still doesn't qualify: no change.
    return currentPosts;
  }

  if (existingIndex !== -1 && !stillPasses) {
    // Was in list but no longer qualifies: remove.
    return currentPosts.filter((p) => p.id !== updatedItem.id);
  }

  if (existingIndex === -1 && stillPasses) {
    // Not in list but now qualifies: insert and sort.
    // For random order, append at end — the seeded shuffle must not be re-run on
    // every toggle (random is only re-rolled on app start or explicit reroll).
    if ((opts.orderBy ?? OrderByOption.AddedAt) === OrderByOption.Random) {
      return [...currentPosts, updatedItem];
    }
    return sortPosts(
      [...currentPosts, updatedItem],
      opts.orderBy ?? OrderByOption.AddedAt,
      opts.orderDirection ?? 'desc',
      opts.randomSeed,
    );
  }

  // Item is in list and still qualifies: replace and re-sort so order-relevant
  // field changes (e.g. queuedAt, updatedAt) are reflected immediately.
  // For random order, only update the item in-place — re-shuffling would change
  // the positions of every post on every toggle, which is not desired.
  if ((opts.orderBy ?? OrderByOption.AddedAt) === OrderByOption.Random) {
    return currentPosts.map((p, i) => (i === existingIndex ? updatedItem : p));
  }
  return sortPosts(
    currentPosts.map((p, i) => (i === existingIndex ? updatedItem : p)),
    opts.orderBy ?? OrderByOption.AddedAt,
    opts.orderDirection ?? 'desc',
    opts.randomSeed,
  );
}

/**
 * Executes filter + sort in SQL via PostRepository.getFilteredListItems().
 *
 * Automatically re-queries whenever:
 *  - Any filter/sort option changes (search input is debounced).
 *  - The shared post list is mutated (add / delete / toggle read/favourite).
 */
export function useFilteredPosts(options: UseFilteredPostsOptions): {
  posts: PostListItem[];
  loading: boolean;
  setPostsAt: React.MutableRefObject<number>;
} {
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const setPostsAt = useRef<number>(0);

  // Ref so the async callback always captures the latest options without
  // needing to be re-created on every render.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryInFlightRef = useRef(false);
  const queryPendingRef = useRef(false);

  const runQuery = useCallback(async () => {
    // If a query is already running, mark a pending re-run instead of stacking.
    if (queryInFlightRef.current) {
      queryPendingRef.current = true;
      return;
    }
    queryInFlightRef.current = true;
    try {
    const t0 = Date.now();
    const repo = await initSharedRepo();
    const repoReady = Date.now();
    const { randomSeed, orderBy, ...repoOptions } = optionsRef.current;
    const results = await repo.getFilteredListItems({ ...repoOptions, orderBy });
    const sqlDone = Date.now();
    // 'random' order: SQL returns rows in addedAt order; shuffle here with seeded RNG.
    let ordered: PostListItem[];
    if (orderBy === OrderByOption.Random) {
      ordered = sortPosts(results, OrderByOption.Random, repoOptions.orderDirection ?? 'desc', randomSeed);
    } else {
      ordered = results;
    }
    console.log(
      `[PERF] useFilteredPosts.runQuery: repoInit=${repoReady - t0}ms, sql=${sqlDone - repoReady}ms, total=${sqlDone - t0}ms, posts=${results.length}`,
    );
    setPostsAt.current = Date.now();
    // Re-use existing object references for posts whose data is unchanged.
    // Without this, every runQuery call creates 1000s of new objects, defeating React.memo.
    setPosts((prev) => {
      const prevById = new Map<number, PostListItem>(prev.map(p => [p.id, p]));
      return ordered.map(next => {
        const p = prevById.get(next.id);
        if (!p) return next;
        if (
          p.title === next.title &&
          p.customTitle === next.customTitle &&
          p.author === next.author &&
          p.subreddit === next.subreddit &&
          p.url === next.url &&
          p.notes === next.notes &&
          p.rating === next.rating &&
          p.isRead === next.isRead &&
          p.isFavorite === next.isFavorite &&
          p.isArchived === next.isArchived &&
          p.wordCount === next.wordCount &&
          p.readAt?.getTime() === next.readAt?.getTime() &&
          p.queuedAt?.getTime() === next.queuedAt?.getTime() &&
          p.addedAt?.getTime() === next.addedAt?.getTime() &&
          p.updatedAt?.getTime() === next.updatedAt?.getTime() &&
          p.folderIds.length === next.folderIds.length &&
          p.folderIds.every((id, i) => id === next.folderIds[i])
        ) {
          return p; // same reference → React.memo bails out
        }
        return next;
      });
    });
    setLoading(false);
    } 
    finally { 
      queryInFlightRef.current = false;
      if (queryPendingRef.current) {
        queryPendingRef.current = false;
        runQuery();
      }
    }
  }, []); // stable – uses optionsRef inside

  // Track the previous search value so we can debounce only search changes.
  const prevSearchRef = useRef(options.search);

  useEffect(() => {
    const searchChanged = options.search !== prevSearchRef.current;
    prevSearchRef.current = options.search;

    if (searchChanged) {
      // Debounce search input to avoid a DB query on every keystroke.
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(runQuery, SEARCH_DEBOUNCE_MS);
    } else {
      // Non-search change: run immediately, cancel any pending search debounce.
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      runQuery();
    }

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [
    options.search,
    options.selectedFolders,
    options.favouritesFilter,
    options.readFilter,
    options.archivedFilter,
    options.queuedFilter,
    options.orderBy,
    options.orderDirection,
    options.randomSeed,
    options.authorFilter,
    runQuery,
  ]);

  // Re-run whenever posts are mutated (add / delete / toggle).
  useEffect(() => {
    return subscribeToPostChanges(runQuery);
  }, [runQuery]);

  // Handle single-item updates (fav/queue/read/archive toggles) without a full DB re-query.
  useEffect(() => {
    return subscribeToItemUpdates((updatedItem) => {
      const opts = optionsRef.current;
      setPosts((currentPosts) => applyItemUpdate(currentPosts, updatedItem, opts));
    });
  }, []); // stable – uses optionsRef and applyItemUpdate (pure, stable ref)

  return { posts, loading, setPostsAt };
}
