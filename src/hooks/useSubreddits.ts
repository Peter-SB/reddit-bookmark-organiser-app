// src/hooks/useSubreddits.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { Subreddit } from '@/models/Subreddit';
import { SubredditRepository } from '@/repository/SubredditRepository';
import { parseSubredditFromUrl } from '@/utils/redditLinks';

/** Module-level listeners so all instances stay in sync. */
const subredditListeners = new Set<() => void>();
function notifySubredditsChange() {
  for (const fn of subredditListeners) fn();
}

export interface UseSubredditsOptions {
  search?: string;
}

const SEARCH_DEBOUNCE_MS = 150;

export type AddSubredditResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

/**
 * Fetches the list of explicitly-added subreddits from the database.
 * Unlike authors, this is a real persisted membership list (not derived
 * from saved posts), since a subreddit can be added before any post from
 * it has been saved. Auto-refreshes when any instance mutates the list.
 */
export function useSubreddits(options: UseSubredditsOptions = {}): {
  subreddits: Subreddit[];
  loading: boolean;
  refresh: () => Promise<void>;
  addSubreddit: (url: string) => Promise<AddSubredditResult>;
  removeSubreddit: (name: string) => Promise<void>;
  setEnabledForSearch: (name: string, enabled: boolean) => Promise<void>;
} {
  const [subreddits, setSubreddits] = useState<Subreddit[]>([]);
  const [loading, setLoading] = useState(true);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const repo = await SubredditRepository.create();
    const all = await repo.getAll();
    const q = optionsRef.current.search?.trim().toLowerCase();
    const filtered = q
      ? all.filter((s) => s.name.toLowerCase().includes(q))
      : all;
    setSubreddits(filtered);
    setLoading(false);
  }, []);

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
  }, [options.search, load]);

  useEffect(() => {
    subredditListeners.add(load);
    return () => { subredditListeners.delete(load); };
  }, [load]);

  const addSubreddit = useCallback(async (url: string): Promise<AddSubredditResult> => {
    const name = parseSubredditFromUrl(url);
    if (!name) {
      return { ok: false, error: 'Not a valid reddit.com subreddit link.' };
    }
    const repo = await SubredditRepository.create();
    const existing = await repo.getByName(name);
    if (existing) {
      return { ok: false, error: `r/${name} is already in your list.` };
    }
    await repo.add(name);
    notifySubredditsChange();
    return { ok: true, name };
  }, []);

  const removeSubreddit = useCallback(async (name: string) => {
    const repo = await SubredditRepository.create();
    await repo.remove(name);
    notifySubredditsChange();
  }, []);

  const setEnabledForSearch = useCallback(async (name: string, enabled: boolean) => {
    const repo = await SubredditRepository.create();
    await repo.setEnabledForSearch(name, enabled);
    notifySubredditsChange();
  }, []);

  return {
    subreddits,
    loading,
    refresh: load,
    addSubreddit,
    removeSubreddit,
    setEnabledForSearch,
  };
}
