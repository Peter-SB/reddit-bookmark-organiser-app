// src/hooks/useFilteredPosts.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { PostListItem } from '@/models/models';
import { PostFilterOptions } from '@/repository/PostRepository';
import { initSharedRepo, subscribeToPostChanges } from './usePosts';
import { sortPosts } from '@/utils/postsHelpers';
import { OrderByOption } from "@/constants/orderBy";

export type UseFilteredPostsOptions = PostFilterOptions & {
  /** Seed used for client-side shuffle when orderBy === 'random'. */
  randomSeed?: number;
};

const SEARCH_DEBOUNCE_MS = 100;

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
} {
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Ref so the async callback always captures the latest options without
  // needing to be re-created on every render.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runQuery = useCallback(async () => {
    const repo = await initSharedRepo();
    const { randomSeed, orderBy, ...repoOptions } = optionsRef.current;
    const results = await repo.getFilteredListItems({ ...repoOptions, orderBy });
    // 'random' order: SQL returns rows in addedAt order; shuffle here with seeded RNG.
    let ordered: PostListItem[];
    if (orderBy === OrderByOption.Random) {
      ordered = sortPosts(results, OrderByOption.Random, repoOptions.orderDirection ?? 'desc', randomSeed);
    } else {
      ordered = results;
    }
    setPosts(ordered);
    setLoading(false);
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

  return { posts, loading };
}
