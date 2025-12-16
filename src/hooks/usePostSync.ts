import { DEFAULT_SYNC_INTERVAL_MS } from '@/constants/sync';
import { PostSyncService, SyncResult } from '@/services/PostSyncService';
import { useCallback, useEffect, useRef, useState } from 'react';

type Options = {
  autoStart?: boolean;
};

export function usePostSync(options: Options = {}) {
  const { autoStart = true } = options;
  const serviceRef = useRef<PostSyncService | null>(null);
  const createPromiseRef = useRef<Promise<PostSyncService> | null>(null);
  const syncingRef = useRef(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);

  const ensureService = useCallback(async (): Promise<PostSyncService> => {
    if (serviceRef.current) return serviceRef.current;
    if (createPromiseRef.current) return createPromiseRef.current;
    createPromiseRef.current = PostSyncService.create()
      .then((svc) => {
        serviceRef.current = svc;
        return svc;
      })
      .finally(() => {
        createPromiseRef.current = null;
      });
    return createPromiseRef.current;
  }, []);

  const syncPending = useCallback(async (): Promise<SyncResult[]> => {
    if (syncingRef.current) return [];
    syncingRef.current = true;
    setSyncing(true);
    try {
      const svc = await ensureService();
      const results = await svc.syncPendingPosts();
      if (results.some((r) => r.success)) {
        setLastSyncAt(new Date());
      }
      return results;
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [ensureService]);

  const forceResyncAll = useCallback(async (): Promise<SyncResult[]> => {
    if (syncingRef.current) return [];
    syncingRef.current = true;
    setSyncing(true);
    try {
      const svc = await ensureService();
      const results = await svc.forceResyncAllPosts();
      if (results.some((r) => r.success)) {
        setLastSyncAt(new Date());
      }
      return results;
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [ensureService]);

  const syncSinglePost = useCallback(async (postId: number): Promise<SyncResult[]> => {
    const svc = await ensureService();
    const results = await svc.syncSinglePost(postId);
    if (results.some((r) => r.success)) {
      setLastSyncAt(new Date());
    }
    return results;
  }, [ensureService]);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    (async () => {
      await ensureService();
      if (cancelled || !autoStart) return;
      await syncPending(); // bulk sync on app open
      interval = setInterval(syncPending, DEFAULT_SYNC_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [autoStart, ensureService, syncPending]);

  return {
    syncing,
    lastSyncAt,
    syncPending,
    forceResyncAll,
    syncSinglePost,
  };
}
