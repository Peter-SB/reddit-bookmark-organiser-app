// src/hooks/usePlaceMarker.ts
import { PlaceMarker } from '@/models/models';
import { PlaceMarkerRepository } from '@/repository/PlaceMarkerRepository';
import { extractPlaceMarkerContext, resolvePlaceMarkerPosition } from '@/utils/placeMarkerUtils';
import { notifyPostChanges } from '@/hooks/usePosts';
import { useCallback, useEffect, useState } from 'react';

export interface UsePlaceMarkerResult {
  /** Current place marker for this post, or null if none exists. */
  placeMarker: PlaceMarker | null;
  loading: boolean;
  /**
   * Save (or overwrite) the place marker for this post.
   * @param charIndex   Cursor character offset in the current body text.
   * @param currentText The current body text — used to extract context snippets.
   */
  savePlaceMarker: (charIndex: number, currentText: string) => Promise<void>;
  /**
   * Toggle behaviour:
   * - No marker → save at charIndex.
   * - Marker exists at same charIndex → delete (double-tap to remove).
   * - Marker exists at different charIndex → update position.
   */
  togglePlaceMarker: (charIndex: number, currentText: string) => Promise<void>;
  /**
   * Resolve the stored place marker position against the current text (accounts for edits)
   * WITHOUT deleting the marker. Returns the resolved character offset or null.
   */
  getMarkerResolvedPosition: (currentText: string) => Promise<number | null>;
  /** Delete the marker without consuming it. */
  clearPlaceMarker: () => Promise<void>;
}

export function usePlaceMarker(postId: number | undefined): UsePlaceMarkerResult {
  const [placeMarker, setPlaceMarker] = useState<PlaceMarker | null>(null);
  const [loading, setLoading] = useState(true);
  const [repo, setRepo] = useState<PlaceMarkerRepository | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const r = await PlaceMarkerRepository.create();
      if (!mounted) return;
      setRepo(r);
      if (postId !== undefined) {
        const marker = await r.getPlaceMarker(postId);
        if (mounted) {
          setPlaceMarker(marker);
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [postId]);

  const savePlaceMarker = useCallback(
    async (charIndex: number, currentText: string) => {
      if (!repo || postId === undefined) throw new Error('PlaceMarkerRepository not ready');
      const { contextBefore, contextAfter } = extractPlaceMarkerContext(currentText, charIndex);
      // Optimistic update
      const now = new Date();
      setPlaceMarker(prev => ({
        id: prev?.id ?? 0,
        postId: postId,
        charIndex,
        contextBefore,
        contextAfter,
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
      }));
      await repo.setPlaceMarker(postId, charIndex, contextBefore, contextAfter);
      const updated = await repo.getPlaceMarker(postId);
      setPlaceMarker(updated);
      notifyPostChanges();
    },
    [repo, postId]
  );

  /**
   * Toggle: no marker → save; same index → remove; different index → update.
   */
  const togglePlaceMarker = useCallback(
    async (charIndex: number, currentText: string) => {
      if (!repo || postId === undefined) throw new Error('PlaceMarkerRepository not ready');
      if (placeMarker && placeMarker.charIndex === charIndex) {
        // Same position — remove (double-tap to clear)
        setPlaceMarker(null);
        await repo.deletePlaceMarker(postId);
        notifyPostChanges();
      } else {
        // No marker or different position — save/update
        const { contextBefore, contextAfter } = extractPlaceMarkerContext(currentText, charIndex);
        const now = new Date();
        setPlaceMarker(prev => ({
          id: prev?.id ?? 0,
          postId: postId,
          charIndex,
          contextBefore,
          contextAfter,
          createdAt: prev?.createdAt ?? now,
          updatedAt: now,
        }));
        await repo.setPlaceMarker(postId, charIndex, contextBefore, contextAfter);
        const updated = await repo.getPlaceMarker(postId);
        setPlaceMarker(updated);
        notifyPostChanges();
      }
    },
    [repo, postId, placeMarker]
  );

  /**
   * Resolve the marker position WITHOUT deleting it. Useful for scrolling to the marker.
   * Returns null if no marker exists.
   */
  const getMarkerResolvedPosition = useCallback(
    async (currentText: string): Promise<number | null> => {
      if (!placeMarker) return null;
      return resolvePlaceMarkerPosition(
        placeMarker.charIndex,
        placeMarker.contextBefore,
        placeMarker.contextAfter,
        currentText
      );
    },
    [placeMarker]
  );

  const clearPlaceMarker = useCallback(async () => {
    if (!repo || postId === undefined) return;
    setPlaceMarker(null);
    await repo.deletePlaceMarker(postId);
    notifyPostChanges();
  }, [repo, postId]);

  return { placeMarker, loading, savePlaceMarker, togglePlaceMarker, getMarkerResolvedPosition, clearPlaceMarker };
}
