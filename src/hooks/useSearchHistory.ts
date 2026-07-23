import { useCallback, useEffect, useRef, useState } from "react";

import {
  SearchHistoryEntry,
  SearchHistoryRepository,
} from "@/repository/SearchHistoryRepository";
import { SearchHistoryService } from "@/services/SearchHistoryService";
import { SemanticSearchParams } from "@/services/SemanticSearchService";

const PENDING_POLL_INTERVAL_MS = 1500;

export function useSearchHistory() {
  const [entries, setEntries] = useState<SearchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const repoRef = useRef<SearchHistoryRepository | null>(null);

  const ensureRepo = useCallback(async (): Promise<SearchHistoryRepository> => {
    if (!repoRef.current) {
      repoRef.current = await SearchHistoryRepository.create();
    }
    return repoRef.current;
  }, []);

  const refresh = useCallback(async () => {
    const repo = await ensureRepo();
    const rows = await repo.listAll();
    setEntries(rows);
    setLoading(false);
  }, [ensureRepo]);

  const startSearch = useCallback(
    async (params: SemanticSearchParams): Promise<number> => {
      const id = await SearchHistoryService.startSearch(params);
      await refresh();
      return id;
    },
    [refresh]
  );

  const deleteEntry = useCallback(
    async (id: number) => {
      const repo = await ensureRepo();
      await repo.delete(id);
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
    },
    [ensureRepo]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  // While any entry is still running its background search, poll for status updates.
  useEffect(() => {
    const hasPending = entries.some((entry) => entry.status === "pending");
    if (!hasPending) return;
    const interval = setInterval(refresh, PENDING_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [entries, refresh]);

  return { entries, loading, refresh, startSearch, deleteEntry };
}
