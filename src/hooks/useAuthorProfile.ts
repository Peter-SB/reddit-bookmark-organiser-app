// src/hooks/useAuthorProfile.ts
import { AuthorProfile } from '@/models/AuthorProfile';
import { AuthorProfileRepository } from '@/repository/AuthorProfileRepository';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Module-level listeners so all instances stay in sync. */
const profileListeners = new Set<(author: string) => void>();
function notifyProfileChange(author: string) {
  for (const fn of profileListeners) fn(author);
}

/**
 * Load and mutate the author profile for a single author.
 * Only creates a DB row when a field is explicitly changed.
 */
export function useAuthorProfile(author: string): {
  profile: AuthorProfile | null;
  loading: boolean;
  toggleFavorite: () => Promise<void>;
  setRating: (rating: number | null) => Promise<void>;
  setNotes: (notes: string | null) => Promise<void>;
} {
  const [profile, setProfile] = useState<AuthorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const authorRef = useRef(author);
  authorRef.current = author;

  const load = useCallback(async () => {
    if (!authorRef.current) {
      setLoading(false);
      return;
    }
    const repo = await AuthorProfileRepository.create();
    const p = await repo.getByAuthor(authorRef.current);
    setProfile(p);
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
  }, [author, load]);

  // Subscribe to cross-instance updates
  useEffect(() => {
    const listener = (changedAuthor: string) => {
      if (changedAuthor.toLowerCase() === authorRef.current.toLowerCase()) {
        load();
      }
    };
    profileListeners.add(listener);
    return () => { profileListeners.delete(listener); };
  }, [load]);

  const toggleFavorite = useCallback(async () => {
    const repo = await AuthorProfileRepository.create();
    const updated = await repo.toggleFavorite(authorRef.current);
    setProfile(updated);
    notifyProfileChange(authorRef.current);
  }, []);

  const setRating = useCallback(async (rating: number | null) => {
    const repo = await AuthorProfileRepository.create();
    const updated = await repo.setRating(authorRef.current, rating);
    setProfile(updated);
    notifyProfileChange(authorRef.current);
  }, []);

  const setNotes = useCallback(async (notes: string | null) => {
    const repo = await AuthorProfileRepository.create();
    const updated = await repo.setNotes(authorRef.current, notes || null);
    setProfile(updated);
    notifyProfileChange(authorRef.current);
  }, []);

  return { profile, loading, toggleFavorite, setRating, setNotes };
}

/**
 * Load all author profiles as a map keyed by lowercase author name.
 * Used in useAuthors for merged sorting.
 */
export async function getAllAuthorProfilesMap(): Promise<Map<string, AuthorProfile>> {
  const repo = await AuthorProfileRepository.create();
  const all = await repo.getAll();
  const map = new Map<string, AuthorProfile>();
  for (const p of all) {
    map.set(p.author.toLowerCase(), p);
  }
  return map;
}

export { profileListeners, notifyProfileChange };
