// src/hooks/useAuthors.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthorSummary } from '@/models/AuthorSummary';
import { OrderByOption } from '@/constants/orderBy';
import { initSharedRepo, subscribeToPostChanges } from './usePosts';

export interface UseAuthorsOptions {
  orderBy?: OrderByOption;
  orderDirection?: 'asc' | 'desc';
  search?: string;
}

const SEARCH_DEBOUNCE_MS = 150;

/**
 * Fetches aggregated author statistics from the database.
 * Sorting is done client-side since the author count is typically small.
 * Auto-refreshes when posts are mutated.
 */
export function useAuthors(options: UseAuthorsOptions = {}): {
  authors: AuthorSummary[];
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [authors, setAuthors] = useState<AuthorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const repo = await initSharedRepo();
    let results = await repo.getAuthorSummaries();

    // Client-side search filter
    const q = optionsRef.current.search?.trim().toLowerCase();
    if (q) {
      results = results.filter(a => a.author.toLowerCase().includes(q));
    }

    // Client-side sort
    const dir = optionsRef.current.orderDirection === 'asc' ? 1 : -1;
    const sorted = [...results].sort((a, b) => {
      switch (optionsRef.current.orderBy) {
        case OrderByOption.Name:
          return dir * a.author.toLowerCase().localeCompare(b.author.toLowerCase());
        case OrderByOption.AvgRating:
          return dir * ((a.avgRating ?? 0) - (b.avgRating ?? 0));
        case OrderByOption.TotalRating:
          return dir * (a.totalRating - b.totalRating);
        case OrderByOption.AddedAt:
          return dir * (a.lastAddedAt.getTime() - b.lastAddedAt.getTime());
        case OrderByOption.FavouriteCount:
          return dir * (a.favouriteCount - b.favouriteCount);
        case OrderByOption.ReadCount:
          return dir * (a.readCount - b.readCount);
        case OrderByOption.PostCount:
        default:
          return dir * (a.postCount - b.postCount);
      }
    });

    setAuthors(sorted);
    setLoading(false);
  }, []);

  // Track search for debounce
  const prevSearchRef = useRef(options.search);

  useEffect(() => {
    const searchChanged = options.search !== prevSearchRef.current;
    prevSearchRef.current = options.search;

    if (searchChanged) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(load, SEARCH_DEBOUNCE_MS);
    } else {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      load();
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [options.orderBy, options.orderDirection, options.search, load]);

  // Auto-refresh when posts change
  useEffect(() => {
    return subscribeToPostChanges(load);
  }, [load]);

  return { authors, loading, refresh: load };
}
