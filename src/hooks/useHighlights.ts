// src/hooks/useHighlights.ts
import { Highlight } from '@/models/models';
import { HighlightRepository } from '@/repository/HighlightRepository';
import { useCallback, useEffect, useState } from 'react';

export interface UseHighlightsResult {
  highlights: Highlight[];
  loading: boolean;
  refreshHighlights: () => Promise<void>;
  addHighlight: (
    postId: number,
    payload: {
      text: string;
      note?: string;
      startOffset?: number;
      endOffset?: number;
    }
  ) => Promise<Highlight>;
  updateHighlight: (
    id: number,
    changes: {
      text?: string;
      note?: string;
      startOffset?: number | null;
      endOffset?: number | null;
    }
  ) => Promise<void>;
  removeHighlight: (id: number) => Promise<void>;
  getHighlightsByPostId: (postId: number) => Promise<Highlight[]>;
}

export function useHighlights(postId?: number): UseHighlightsResult {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [repo, setRepo] = useState<HighlightRepository | null>(null);

  // Initialize repository
  useEffect(() => {
    let mounted = true;
    (async () => {
      const r = await HighlightRepository.create();
      if (mounted) {
        setRepo(r);
        await loadHighlights(r);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [postId]);

  // Helper to reload highlights
  const loadHighlights = useCallback(
    async (r?: HighlightRepository) => {
      console.debug('Loading highlights...');
      setLoading(true);
      const repository = r ?? repo;
      if (!repository) return;

      const all = postId
        ? await repository.getHighlightsByPostId(postId)
        : await repository.getAllHighlights();
      setHighlights(all);
      setLoading(false);
    },
    [repo, postId]
  );

  const refreshHighlights = useCallback(() => loadHighlights(), [loadHighlights]);

  const addHighlight = useCallback(
    async (
      postId: number,
      payload: {
        text: string;
        note?: string;
        startOffset?: number;
        endOffset?: number;
      }
    ) => {
      if (!repo) throw new Error('HighlightRepository not ready');
      const id = await repo.createHighlight(postId, payload);
      const newHighlight = await repo.getById(id);
      await loadHighlights();
      if (!newHighlight) throw new Error('Failed to load new highlight');
      return newHighlight;
    },
    [repo, loadHighlights]
  );

  const updateHighlight = useCallback(
    async (
      id: number,
      changes: {
        text?: string;
        note?: string;
        startOffset?: number | null;
        endOffset?: number | null;
      }
    ) => {
      if (!repo) throw new Error('HighlightRepository not ready');
      await repo.updateHighlight(id, changes);
      await loadHighlights();
    },
    [repo, loadHighlights]
  );

  const removeHighlight = useCallback(
    async (id: number) => {
      if (!repo) throw new Error('HighlightRepository not ready');
      await repo.deleteHighlight(id);
      await loadHighlights();
    },
    [repo, loadHighlights]
  );

  const getHighlightsByPostId = useCallback(
    async (postId: number) => {
      if (!repo) throw new Error('HighlightRepository not ready');
      return await repo.getHighlightsByPostId(postId);
    },
    [repo]
  );

  return {
    highlights,
    loading,
    refreshHighlights,
    addHighlight,
    updateHighlight,
    removeHighlight,
    getHighlightsByPostId,
  };
}
