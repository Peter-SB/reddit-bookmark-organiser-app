import {
  DEFAULT_LIBRARY_ID,
  SYNC_LIBRARY_ID_KEY,
  SYNC_SERVER_URL_KEY,
  FORCE_EXPORT_BATCH_SIZE,
  FORCE_EXPORT_CONCURRENCY,
} from '@/constants/sync';
import { Post } from '@/models/models';
import { PostRepository } from '@/repository/PostRepository';
import { SettingsRepository } from '@/repository/SettingsRepository';
import { parseDbDate } from '@/utils/datetimeUtils';

const DEFAULT_SYNC_BATCH_SIZE = 10;
// Caps how many batches are in flight at once so a large sync (e.g. thousands of
// posts on a force resync) doesn't fire hundreds of concurrent requests and
// overwhelm the server.
const DEFAULT_SYNC_CONCURRENCY = 4;

// todo: better error handeling and logging. Better ui for displaying when failed/successs

export type SyncSettings = {
  serverUrl: string;
  libraryId: string;
};

export type SyncResult = {
  postId: number;
  status: string;
  success: boolean;
  updatedAt?: string;
  error?: string | null;
};

export class PostSyncService {
  private constructor(private repo: PostRepository) {}

  public static async create(): Promise<PostSyncService> {
    const repo = await PostRepository.create();
    return new PostSyncService(repo);
  }

  private normaliseServerUrl(raw: string): string {
    const trimmed = raw.trim();
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    return withProtocol.replace(/\/+$/, '');
  }

  private async loadSettings(): Promise<SyncSettings | null> {
    const settings = await SettingsRepository.getSettings([
      SYNC_SERVER_URL_KEY,
      SYNC_LIBRARY_ID_KEY,
    ]);

    const serverUrl = (settings[SYNC_SERVER_URL_KEY] || '').trim();
    if (!serverUrl) {
      console.debug('Sync skipped: server URL not configured.');
      return null;
    }

    const libraryId = (settings[SYNC_LIBRARY_ID_KEY] || DEFAULT_LIBRARY_ID).trim() || DEFAULT_LIBRARY_ID;

    return {
      serverUrl: this.normaliseServerUrl(serverUrl),
      libraryId,
    };
  }

  private mapPostToPayload(post: Post) {
    return {
      id: post.id,
      redditId: post.redditId,
      url: post.url,
      title: post.customTitle ?? post.title,
      bodyText: post.customBody ?? post.bodyText ?? '',
      author: post.author,
      subreddit: post.subreddit,
      redditCreatedAt: post.redditCreatedAt,
      addedAt: post.addedAt,
      updatedAt: post.updatedAt,
      customTitle: post.customTitle ?? undefined,
      customBody: post.customBody ?? undefined,
      notes: post.notes ?? undefined,
      rating: post.rating ?? undefined,
      isRead: post.isRead,
      isFavorite: post.isFavorite,
      isDeleted: Boolean(post.isDeleted),
      isArchived: Boolean(post.isArchived),
      readAt: post.readAt ?? undefined,
      queuedAt: post.queuedAt ?? undefined,
      folderIds: post.folderIds ?? [],
      extraFields: post.extraFields ?? undefined,
      bodyMinHash: post.bodyMinHash ?? undefined,
      summary: post.summary ?? undefined,
    };
  }

  private buildPayload(posts: Post[], config: SyncSettings) {
    const payload: any = {
      posts: posts.map((p) => this.mapPostToPayload(p)),
      library_id: config.libraryId,
    };
    return payload;
  }

  private buildEndpoint(baseUrl: string) {
    return `${baseUrl}/posts/sync`;
  }

  // The sync response no longer echoes back updated_at, so on success we treat the
  // post's own updatedAt (the value just pushed to the server) as the new syncedAt.
  private mapResponseResults(rawResults: any[], posts: Post[]): SyncResult[] {
    const postsById = new Map(posts.map((p) => [p.id, p]));
    return rawResults.map((r) => {
      const postId = r.post_id ?? r.postId ?? null;
      const success = Boolean(r.success);
      const post = postId != null ? postsById.get(postId) : undefined;
      return {
        postId,
        status: r.status ?? (success ? 'synced' : 'failed'),
        success,
        updatedAt: success && post?.updatedAt ? new Date(post.updatedAt).toISOString() : undefined,
        error: r.error ?? null,
      };
    });
  }

  private async persistResults(results: SyncResult[], posts: Post[]): Promise<void> {
    const postsById = new Map(posts.map((p) => [p.id, p]));
    for (const result of results) {
      const post = postsById.get(result.postId);
      let syncedAt: Date | null = post?.syncedAt ?? null;

      if (result.success) {
        if (result.updatedAt) {
          const parsedUpdatedAt = parseDbDate(result.updatedAt);
          if (!Number.isNaN(parsedUpdatedAt.getTime())) {
            syncedAt = parsedUpdatedAt;
          }
        }
      }

      const error = result.success ? null : result.error ?? null;
      await this.repo.updateSyncState(result.postId, result.status, syncedAt, error);
    }
  }

  private async syncPosts(posts: Post[], settingsOverride?: SyncSettings): Promise<SyncResult[]> {
    if (posts.length === 0) return [];
    const config = settingsOverride ?? (await this.loadSettings());
    if (!config) throw new Error('Sync settings not configured');

    const endpoint = this.buildEndpoint(config.serverUrl);
    const payload = this.buildPayload(posts, config);
    let results: SyncResult[] = [];

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let data: any = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        const detail = data?.detail || response.statusText;
        throw new Error(`Sync failed (${response.status}): ${detail}`);
      }

      if (Array.isArray(data?.results) && data.results.length > 0) {
        results = this.mapResponseResults(data.results, posts);
      } else {
        results = posts.map((p) => ({
          postId: p.id,
          status: 'failed',
          success: false,
          error: 'Sync endpoint returned no per-post results',
        }));
      }
    } catch (err: any) {
      const message = err?.message || 'Sync request failed';
      results = posts.map((p) => ({
        postId: p.id,
        status: 'failed',
        success: false,
        error: message,
      }));
    }

    await this.persistResults(results, posts);
    return results;
  }

  // Splits posts into DEFAULT_SYNC_BATCH_SIZE-sized requests and runs at most
  // DEFAULT_SYNC_CONCURRENCY of them at once, rather than firing every batch
  // in parallel or sending everything in a single oversized request.
  private async syncInBatches(posts: Post[]): Promise<SyncResult[]> {
    if (posts.length <= DEFAULT_SYNC_BATCH_SIZE) {
      return this.syncPosts(posts);
    }

    const chunks: Post[][] = [];
    for (let i = 0; i < posts.length; i += DEFAULT_SYNC_BATCH_SIZE) {
      chunks.push(posts.slice(i, i + DEFAULT_SYNC_BATCH_SIZE));
    }

    const results: SyncResult[] = [];
    for (let i = 0; i < chunks.length; i += DEFAULT_SYNC_CONCURRENCY) {
      const window = chunks.slice(i, i + DEFAULT_SYNC_CONCURRENCY);
      const windowResults = await Promise.all(
        window.map((chunk) => this.syncPosts(chunk))
      );
      results.push(...windowResults.flat());
    }
    return results;
  }

  public async syncPendingPosts(): Promise<SyncResult[]> {
    const pending = await this.repo.getPendingSyncPosts();
    return this.syncInBatches(pending);
  }

  public async syncSinglePost(postId: number): Promise<SyncResult[]> {
    const post = await this.repo.getById(postId);
    if (!post) return [];
    return this.syncPosts([post]);
  }

  // Syncs all posts in the database regardless of sync state, using pagination to work with
  // very large databases without loading all posts into memory at once.
  // Respects FORCE_EXPORT_CONCURRENCY to avoid overwhelming the server.
  public async forceResyncAllPosts(): Promise<SyncResult[]> {
    await this.repo.resetSyncStateForAll();
    const allResults: SyncResult[] = [];
    let offset = 0;

    while (true) {
      const posts = await this.repo.getAllPostsPaginated(FORCE_EXPORT_BATCH_SIZE, offset);
      if (posts.length === 0) break;

      // Sync this page's posts with respecting the force export concurrency limit
      const pageResults = await this.syncInBatchesWithConcurrency(
        posts,
        FORCE_EXPORT_BATCH_SIZE,
        FORCE_EXPORT_CONCURRENCY
      );
      allResults.push(...pageResults);
      offset += FORCE_EXPORT_BATCH_SIZE;
    }

    return allResults;
  }

  // Splits posts into batches and syncs them with a configurable concurrency limit.
  private async syncInBatchesWithConcurrency(
    posts: Post[],
    batchSize: number,
    concurrency: number
  ): Promise<SyncResult[]> {
    if (posts.length <= batchSize) {
      return this.syncPosts(posts);
    }

    const chunks: Post[][] = [];
    for (let i = 0; i < posts.length; i += batchSize) {
      chunks.push(posts.slice(i, i + batchSize));
    }

    const results: SyncResult[] = [];
    for (let i = 0; i < chunks.length; i += concurrency) {
      const window = chunks.slice(i, i + concurrency);
      const windowResults = await Promise.all(
        window.map((chunk) => this.syncPosts(chunk))
      );
      results.push(...windowResults.flat());
    }
    return results;
  }
}
