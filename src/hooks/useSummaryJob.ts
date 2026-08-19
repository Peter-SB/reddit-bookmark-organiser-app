// src/hooks/useSummaryJob.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Post } from '@/models/models';
import {
  clearJob,
  getJob,
  revertSummary,
  startSummary,
  stopSummary,
  subscribe,
  type SummaryJob,
} from '@/services/SummaryJobService';

export interface UseSummaryJobResult {
  /** Live text from the running (or just-finished) job; '' when there is no job. */
  text: string;
  isStreaming: boolean;
  error: string | null;
  /** A summary was just generated over an older one, and it can still be undone. */
  canRevert: boolean;
  start: (post: Post) => void;
  stop: () => void;
  revert: () => void;
}

/**
 * Subscribes to the background summary job for one post.
 *
 * The job itself lives in SummaryJobService and keeps running when this hook
 * unmounts — that is what lets a summary finish while the user browses
 * elsewhere. What unmounting does mean is that the user has left the post, so a
 * *finished* job is cleared: they no longer get the chance to reject it.
 *
 * `onCommitted` fires with the text that was just written to the DB, so the
 * post screen can refresh its own copy and not count it as an unsaved edit.
 */
export function useSummaryJob(
  postId: number | undefined,
  onCommitted?: (summary: string) => void,
): UseSummaryJobResult {
  const [job, setJob] = useState<SummaryJob | undefined>(() =>
    postId === undefined ? undefined : getJob(postId),
  );

  const onCommittedRef = useRef(onCommitted);
  onCommittedRef.current = onCommitted;

  useEffect(() => {
    if (postId === undefined) return;
    let mounted = true;
    setJob(getJob(postId));
    const unsubscribe = subscribe(postId, () => {
      if (mounted) setJob(getJob(postId));
    });
    return () => {
      mounted = false;
      unsubscribe();
      // Leaving the post accepts whatever was generated.
      clearJob(postId);
    };
  }, [postId]);

  // A job that was streaming and is now committed (or gone, because there was
  // nothing to revert to) has just been written to the DB.
  const previousJobRef = useRef<SummaryJob | undefined>(undefined);
  useEffect(() => {
    const previous = previousJobRef.current;
    previousJobRef.current = job;
    if (previous?.status !== 'streaming') return;
    if (job && job.status !== 'committed') return;
    onCommittedRef.current?.(job ? job.text : previous.text);
  }, [job]);

  const start = useCallback((post: Post) => {
    startSummary(post);
  }, []);

  const stop = useCallback(() => {
    if (postId === undefined) return;
    stopSummary(postId);
  }, [postId]);

  const revert = useCallback(() => {
    if (postId === undefined) return;
    const current = getJob(postId);
    if (!current) return;
    const restored = current.previousSummary;
    // The service deletes the job once the old text is back in the DB, so tell
    // the screen directly rather than inferring it from the job disappearing.
    revertSummary(postId).then(() => {
      if (!getJob(postId)) onCommittedRef.current?.(restored);
    });
  }, [postId]);

  return {
    text: job?.text ?? '',
    isStreaming: job?.status === 'streaming',
    error: job?.status === 'error' ? job.error : null,
    canRevert: job?.status === 'committed' && job.hadPreviousSummary,
    start,
    stop,
    revert,
  };
}
