import {
  DEFAULT_EMBED_MODEL,
  DEFAULT_SYNC_TABLE,
  SYNC_SEMANTIC_EMBED_MODEL_KEY,
  SYNC_SERVER_URL_KEY,
  SYNC_SIMILAR_EMBED_MODEL_KEY,
  SYNC_TABLE_NAME_KEY,
} from '@/constants/sync';
import { Post } from '@/models/models';
import { PostRepository } from '@/repository/PostRepository';
import { SettingsRepository } from '@/repository/SettingsRepository';
import { parseDbDate } from '@/utils/datetimeUtils';

const DEFAULT_SYNC_BATCH_SIZE = 10;

// todo: better error handeling and logging. Better ui for displaying when failed/successs

export type SyncSettings = {
  serverUrl: string;
  tableName: string;
  embeddingProfiles: string[];
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
      SYNC_TABLE_NAME_KEY,
      SYNC_SEMANTIC_EMBED_MODEL_KEY,
      SYNC_SIMILAR_EMBED_MODEL_KEY,
    ]);

    const serverUrl = (settings[SYNC_SERVER_URL_KEY] || '').trim();
    if (!serverUrl) {
      console.debug('Sync skipped: server URL not configured.');
      return null;
    }

    const tableName = (settings[SYNC_TABLE_NAME_KEY] || DEFAULT_SYNC_TABLE).trim() || DEFAULT_SYNC_TABLE;
    const semanticEmbed =
      (settings[SYNC_SEMANTIC_EMBED_MODEL_KEY] || DEFAULT_EMBED_MODEL).trim() || DEFAULT_EMBED_MODEL;
    const similarEmbed =
      (settings[SYNC_SIMILAR_EMBED_MODEL_KEY] || DEFAULT_EMBED_MODEL).trim() || DEFAULT_EMBED_MODEL;
    const embeddingProfiles = Array.from(
      new Set([semanticEmbed, similarEmbed].filter((p) => p && p.trim()))
    );

    return {
      serverUrl: this.normaliseServerUrl(serverUrl),
      tableName,
      embeddingProfiles,
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
      extraFields: post.extraFields ?? undefined,
      bodyMinHash: post.bodyMinHash ?? undefined,
      summary: post.summary ?? undefined,
    };
  }

  private buildPayload(posts: Post[], config: SyncSettings, forceEmbed: boolean) {
    const payload: any = {
      posts: posts.map((p) => this.mapPostToPayload(p)),
      table_name: config.tableName,
      embedding_profiles: config.embeddingProfiles,
      force_embed: Boolean(forceEmbed),
    };
    return payload;
  }

  private buildEndpoint(baseUrl: string) {
    return `${baseUrl}/sync`;
  }

  private mapResponseResults(rawResults: any[]): SyncResult[] {
    return rawResults.map((r) => ({
      postId: r.post_id ?? r.postId ?? null,
      status: r.status ?? (r.success ? 'synced' : 'failed'),
      success: Boolean(r.success),
      updatedAt: r.updated_at ?? r.updatedAt,
      error: r.error ?? null,
    }));
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

  private async syncPosts(posts: Post[], settingsOverride?: SyncSettings, forceEmbed: boolean = false): Promise<SyncResult[]> {
    if (posts.length === 0) return [];
    const config = settingsOverride ?? (await this.loadSettings());
    if (!config) throw new Error('Sync settings not configured');

    const endpoint = this.buildEndpoint(config.serverUrl);
    const payload = this.buildPayload(posts, config, forceEmbed);
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
        results = this.mapResponseResults(data.results);
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

  public async syncPendingPosts(): Promise<SyncResult[]> {
    const pending = await this.repo.getPendingSyncPosts();
    if (pending.length <= DEFAULT_SYNC_BATCH_SIZE) {
      return this.syncPosts(pending);
    }

    const batches: Promise<SyncResult[]>[] = [];
    for (let i = 0; i < pending.length; i += DEFAULT_SYNC_BATCH_SIZE) {
      batches.push(this.syncPosts(pending.slice(i, i + DEFAULT_SYNC_BATCH_SIZE)));
    }

    const results = await Promise.all(batches);
    return results.flat();
  }

  public async syncSinglePost(postId: number): Promise<SyncResult[]> {
    const post = await this.repo.getById(postId);
    if (!post) return [];
    return this.syncPosts([post]);
  }

  public async forceResyncAllPosts(): Promise<SyncResult[]> {
    await this.repo.resetSyncStateForAll();
    const pending = await this.repo.getPendingSyncPosts();
    return this.syncPosts(pending, undefined, true);
  }
}
