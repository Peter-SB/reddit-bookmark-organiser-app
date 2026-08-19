// src/services/SummaryJobService.ts
import type { Post } from '@/models/models';
import { PostRepository } from '@/repository/PostRepository';
import { SettingsRepository } from '@/repository/SettingsRepository';
import { startSSEChat } from './SSEChatService';

/** Settings keys the summary generator reads. Written by SettingsAiConfiguration. */
export const AI_ENDPOINT_URL = 'AI_ENDPOINT_URL';
export const AI_API_KEY = 'AI_API_KEY';
export const AI_MODEL_ID = 'AI_MODEL_ID';
export const AI_SYSTEM_PROMPT = 'AI_SYSTEM_PROMPT';
export const AI_ATTRIB_REFERER = 'AI_ATTRIB_REFERER';
export const AI_ATTRIB_TITLE = 'AI_ATTRIB_TITLE';
export const AI_MAX_TOKENS = 'AI_MAX_TOKENS';

const AI_SETTING_KEYS = [
  AI_ENDPOINT_URL,
  AI_API_KEY,
  AI_MODEL_ID,
  AI_SYSTEM_PROMPT,
  AI_ATTRIB_REFERER,
  AI_ATTRIB_TITLE,
  AI_MAX_TOKENS,
];

const DEFAULT_SYSTEM_PROMPT =
  'You are an assistant that summarises reddit posts in 3-4 lines.';
const DEFAULT_MAX_TOKENS = 1024;

export type SummaryJobStatus = 'streaming' | 'committed' | 'error';

/**
 * A summary generation that outlives the screen that started it.
 *
 * Jobs live in memory for the app session only. The generated text is written
 * to the DB as soon as the stream finishes; `previousSummary` is kept purely so
 * the user can undo that write while they are still looking at the post.
 */
export interface SummaryJob {
  postId: number;
  status: SummaryJobStatus;
  /** Text accumulated from the stream so far. */
  text: string;
  /** The summary that was in place when this job started — in memory only. */
  previousSummary: string;
  /** Whether there was a summary to go back to. Drives the revert affordance. */
  hadPreviousSummary: boolean;
  error: string | null;
}

/** Anything we can close — the real one is react-native-sse's EventSource. */
interface StreamHandle {
  close: () => void;
}

const jobs = new Map<number, SummaryJob>();
const handles = new Map<number, StreamHandle>();
const listeners = new Map<number, Set<() => void>>();

/**
 * Generation counter per post. Bumped whenever a job is started, stopped or
 * cleared, so callbacks from a superseded stream can tell they are stale and
 * leave the current job alone.
 */
const generations = new Map<number, number>();

// Injectable so tests can drive the stream and the DB without either.
let sseStarter: (args: Parameters<typeof startSSEChat>[0]) => StreamHandle =
  startSSEChat;
let loadSettings: (keys: string[]) => Promise<Record<string, string>> = (keys) =>
  SettingsRepository.getSettings(keys as any) as Promise<Record<string, string>>;
let repoPromise: Promise<Pick<PostRepository, 'updateSummaryById'>> | null = null;

function getRepo(): Promise<Pick<PostRepository, 'updateSummaryById'>> {
  if (!repoPromise) repoPromise = PostRepository.create();
  return repoPromise;
}

function notify(postId: number): void {
  const set = listeners.get(postId);
  if (!set) return;
  for (const fn of set) fn();
}

function setJob(postId: number, job: SummaryJob): void {
  // Replaced rather than mutated so subscribers can compare by reference.
  jobs.set(postId, job);
  notify(postId);
}

function bumpGeneration(postId: number): number {
  const next = (generations.get(postId) ?? 0) + 1;
  generations.set(postId, next);
  return next;
}

function isCurrent(postId: number, generation: number): boolean {
  return (generations.get(postId) ?? 0) === generation;
}

function closeHandle(postId: number): void {
  const handle = handles.get(postId);
  if (handle) {
    try {
      handle.close();
    } catch (err) {
      console.debug(`[SummaryJobService] error closing stream for ${postId}:`, err);
    }
    handles.delete(postId);
  }
}

export function getJob(postId: number): SummaryJob | undefined {
  return jobs.get(postId);
}

/** True while any screen is watching this post's job. */
export function hasSubscribers(postId: number): boolean {
  return (listeners.get(postId)?.size ?? 0) > 0;
}

/** Subscribe to one post's job changes. Returns an unsubscribe function. */
export function subscribe(postId: number, fn: () => void): () => void {
  let set = listeners.get(postId);
  if (!set) {
    set = new Set();
    listeners.set(postId, set);
  }
  set.add(fn);
  return () => {
    const current = listeners.get(postId);
    if (!current) return;
    current.delete(fn);
    if (current.size === 0) listeners.delete(postId);
  };
}

/**
 * Drop a finished job. Called when the post screen unmounts: leaving the post
 * accepts the generated summary and retires the revert affordance. A job that
 * is still streaming is left alone — that is the whole point of the service.
 */
export function clearJob(postId: number): void {
  const job = jobs.get(postId);
  if (!job || job.status === 'streaming') return;
  bumpGeneration(postId);
  jobs.delete(postId);
  notify(postId);
}

async function commit(postId: number, text: string, generation: number): Promise<void> {
  try {
    const repo = await getRepo();
    await repo.updateSummaryById(postId, text);
  } catch (err: any) {
    console.error(`[SummaryJobService] failed to save summary for ${postId}:`, err);
    if (!isCurrent(postId, generation)) return;
    const job = jobs.get(postId);
    if (!job) return;
    setJob(postId, {
      ...job,
      status: 'error',
      error: err?.message || 'Failed to save summary',
    });
    return;
  }

  if (!isCurrent(postId, generation)) return;
  const job = jobs.get(postId);
  if (!job) return;

  // The revert affordance only makes sense if someone is on the post to use it
  // and there is an older summary to go back to. Otherwise the job is done.
  if (hasSubscribers(postId) && job.hadPreviousSummary) {
    setJob(postId, { ...job, status: 'committed', text, error: null });
  } else {
    jobs.delete(postId);
    notify(postId);
  }
}

interface AiConfig {
  endpoints: string[];
  apiKey: string;
  referer: string;
  appTitle: string;
  maxTokens: number;
  modelId: string;
  systemPrompt: string;
}

async function loadAiConfig(): Promise<AiConfig> {
  const settings = await loadSettings(AI_SETTING_KEYS);
  const maxTokens = (() => {
    const parsed = parseInt(settings[AI_MAX_TOKENS] || String(DEFAULT_MAX_TOKENS), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_TOKENS;
  })();
  return {
    // Semicolon-separated failover list, tried in order.
    endpoints: (settings[AI_ENDPOINT_URL] || '')
      .split(';')
      .map((e) => e.trim())
      .filter(Boolean),
    apiKey: settings[AI_API_KEY]?.trim() || '',
    referer: settings[AI_ATTRIB_REFERER]?.trim() || '',
    appTitle: settings[AI_ATTRIB_TITLE]?.trim() || 'Reddit-Bookmark-App',
    maxTokens,
    modelId: settings[AI_MODEL_ID] || '',
    systemPrompt: settings[AI_SYSTEM_PROMPT] || DEFAULT_SYSTEM_PROMPT,
  };
}

/**
 * Start (or restart) generation for a post. At most one job per post; jobs for
 * different posts run concurrently.
 */
export async function startSummary(post: Post): Promise<void> {
  const postId = post.id;
  closeHandle(postId);
  const generation = bumpGeneration(postId);

  const previous = jobs.get(postId);
  // Keep the summary from before the *first* generation in this run of jobs, so
  // regenerating twice still offers the text the user originally had.
  const previousSummary = previous
    ? previous.previousSummary
    : post.summary || '';

  setJob(postId, {
    postId,
    status: 'streaming',
    text: '',
    previousSummary,
    hadPreviousSummary: !!previousSummary,
    error: null,
  });

  const config = await loadAiConfig();
  if (!isCurrent(postId, generation)) return;

  if (!config.endpoints.length) {
    fail(postId, generation, 'AI Settings Not Configured');
    return;
  }

  const bodyText = post.customBody || post.bodyText || '';
  const payload = {
    model: config.modelId,
    stream: true,
    messages: [
      { role: 'system', content: config.systemPrompt },
      {
        role: 'user',
        content: bodyText + '----End of Text ---' + config.systemPrompt,
      },
    ],
    max_tokens: config.maxTokens,
  };

  let endpointIndex = 0;
  const tryNextEndpoint = (errorMsg?: string) => {
    if (!isCurrent(postId, generation)) return;
    if (endpointIndex >= config.endpoints.length) {
      fail(postId, generation, `All endpoints failed.${errorMsg ?? ''}`);
      return;
    }
    const endpoint = config.endpoints[endpointIndex];
    endpointIndex++;
    try {
      const handle = sseStarter({
        endpoint,
        payload,
        apiKey: config.apiKey,
        referer: config.referer,
        appTitle: config.appTitle,
        onDelta: (delta) => {
          if (!isCurrent(postId, generation)) return;
          const job = jobs.get(postId);
          if (!job || job.status !== 'streaming') return;
          setJob(postId, { ...job, text: job.text + delta });
        },
        onFinish: () => {
          if (!isCurrent(postId, generation)) return;
          handles.delete(postId);
          const job = jobs.get(postId);
          if (!job) return;
          commit(postId, job.text, generation);
        },
        onError: (err: any) => {
          if (!isCurrent(postId, generation)) return;
          handles.delete(postId);
          const message =
            typeof err === 'string' ? err : err?.message || 'Unknown error';
          tryNextEndpoint(message);
        },
      });
      handles.set(postId, handle);
    } catch (err) {
      console.debug('[SummaryJobService] endpoint failed synchronously:', err);
      tryNextEndpoint(err instanceof Error ? err.message : String(err));
    }
  };

  tryNextEndpoint();
}

function fail(postId: number, generation: number, message: string): void {
  if (!isCurrent(postId, generation)) return;
  const job = jobs.get(postId);
  if (!job) return;
  setJob(postId, { ...job, status: 'error', error: message });
}

/**
 * Stop a running generation, keeping what has arrived so far — the partial text
 * is committed, matching what the stop button has always done.
 */
export function stopSummary(postId: number): void {
  const job = jobs.get(postId);
  if (!job || job.status !== 'streaming') return;
  closeHandle(postId);
  const generation = generations.get(postId) ?? 0;
  commit(postId, job.text, generation);
}

/**
 * Undo a committed summary, restoring the one that was in place when the job
 * started. Only available while the user is still on the post (the job is
 * cleared when they leave).
 */
export async function revertSummary(postId: number): Promise<void> {
  const job = jobs.get(postId);
  if (!job || job.status !== 'committed' || !job.hadPreviousSummary) return;

  const generation = bumpGeneration(postId);
  try {
    const repo = await getRepo();
    await repo.updateSummaryById(postId, job.previousSummary);
  } catch (err: any) {
    console.error(`[SummaryJobService] failed to revert summary for ${postId}:`, err);
    if (!isCurrent(postId, generation)) return;
    setJob(postId, {
      ...job,
      status: 'error',
      error: err?.message || 'Failed to restore the previous summary',
    });
    return;
  }
  if (!isCurrent(postId, generation)) return;
  jobs.delete(postId);
  notify(postId);
}

/** @internal Test-only: drive the stream, settings and DB without any of them. */
export function _setDependenciesForTesting(deps: {
  sseStarter?: typeof sseStarter;
  loadSettings?: typeof loadSettings;
  repo?: Pick<PostRepository, 'updateSummaryById'>;
}): void {
  if (deps.sseStarter) sseStarter = deps.sseStarter;
  if (deps.loadSettings) loadSettings = deps.loadSettings;
  if (deps.repo) repoPromise = Promise.resolve(deps.repo);
}

/** @internal Test-only: wipe all jobs, handles, subscribers and injected deps. */
export function _resetForTesting(): void {
  for (const postId of [...handles.keys()]) closeHandle(postId);
  jobs.clear();
  handles.clear();
  listeners.clear();
  generations.clear();
  sseStarter = startSSEChat;
  loadSettings = (keys) =>
    SettingsRepository.getSettings(keys as any) as Promise<Record<string, string>>;
  repoPromise = null;
}
