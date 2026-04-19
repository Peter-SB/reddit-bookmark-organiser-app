// src/hooks/useAuthors.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthorSummary } from '@/models/AuthorSummary';
import { OrderByOption } from '@/constants/orderBy';
import { initSharedRepo, subscribeToPostChanges } from './usePosts';
import { getAllAuthorProfilesMap, profileListeners } from './useAuthorProfile';

export interface UseAuthorsOptions {
  orderBy?: OrderByOption;
  orderDirection?: 'asc' | 'desc';
  search?: string;
}

const SEARCH_DEBOUNCE_MS = 150;

/**
 * Pure function: filters and sorts an author list by the given options and profile map.
 * Exported for unit testing.
 */
export function filterAndSortAuthors(
  results: AuthorSummary[],
  profilesMap: Map<string, import('@/models/AuthorProfile').AuthorProfile>,
  options: UseAuthorsOptions,
): AuthorSummary[] {
  let filtered = [...results];

  // Filter to only authors with the profile field being sorted by
  const ob = options.orderBy;
  if (ob === OrderByOption.AuthorIsFavorite) {
    filtered = filtered.filter(a => profilesMap.get(a.author.toLowerCase())?.isFavorite === true);
  } else if (ob === OrderByOption.AuthorRating) {
    filtered = filtered.filter(a => (profilesMap.get(a.author.toLowerCase())?.rating ?? null) !== null);
  } else if (ob === OrderByOption.AuthorHasNotes) {
    filtered = filtered.filter(a => !!profilesMap.get(a.author.toLowerCase())?.notes);
  }

  // Search filter
  const q = options.search?.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(a => a.author.toLowerCase().includes(q));
  }

  // Sort
  const dir = options.orderDirection === 'asc' ? 1 : -1;
  return [...filtered].sort((a, b) => {
    const aProfile = profilesMap.get(a.author.toLowerCase());
    const bProfile = profilesMap.get(b.author.toLowerCase());
    switch (options.orderBy) {
      case OrderByOption.AuthorIsFavorite: {
        const aFav = aProfile?.isFavorite ? 1 : 0;
        const bFav = bProfile?.isFavorite ? 1 : 0;
        if (aFav !== bFav) return dir * (bFav - aFav);
        return a.author.toLowerCase().localeCompare(b.author.toLowerCase());
      }
      case OrderByOption.AuthorRating: {
        const aRating = aProfile?.rating ?? -1;
        const bRating = bProfile?.rating ?? -1;
        if (aRating !== bRating) return dir * (aRating - bRating);
        return a.author.toLowerCase().localeCompare(b.author.toLowerCase());
      }
      case OrderByOption.AuthorHasNotes: {
        const aHas = aProfile?.notes ? 1 : 0;
        const bHas = bProfile?.notes ? 1 : 0;
        if (aHas !== bHas) return dir * (bHas - aHas);
        return a.author.toLowerCase().localeCompare(b.author.toLowerCase());
      }
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
}

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
    const results = await repo.getAuthorSummaries();
    const profilesMap = await getAllAuthorProfilesMap();
    const sorted = filterAndSortAuthors(results, profilesMap, optionsRef.current);
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

  // Auto-refresh when any author profile changes
  useEffect(() => {
    profileListeners.add(load);
    return () => { profileListeners.delete(load); };
  }, [load]);

  return { authors, loading, refresh: load };
}
