import { PostSyncService } from "../PostSyncService";
import { PostRepository } from "@/repository/PostRepository";
import { SettingsRepository } from "@/repository/SettingsRepository";
import type { Post } from "@/models/models";

jest.mock("@/repository/PostRepository", () => ({
  PostRepository: { create: jest.fn() },
}));

jest.mock("@/repository/SettingsRepository", () => ({
  SettingsRepository: { getSettings: jest.fn() },
}));

describe("PostSyncService", () => {
  const fetchMock = jest.fn();
  let repoMock: {
    getPendingSyncPosts: jest.Mock;
    getById: jest.Mock;
    updateSyncState: jest.Mock;
  };

  beforeAll(() => {
    (global as any).fetch = fetchMock;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    repoMock = {
      getPendingSyncPosts: jest.fn(),
      getById: jest.fn(),
      updateSyncState: jest.fn(),
    };
    (PostRepository.create as jest.Mock).mockResolvedValue(repoMock);
    (SettingsRepository.getSettings as jest.Mock).mockResolvedValue({
      SYNC_SERVER_URL: "http://example.com",
      SYNC_TABLE_NAME: "posts",
      SYNC_EMBED_MODEL: "embed-model",
    });
  });

  const basePost: Post = {
    id: 1,
    redditId: "abc",
    url: "https://reddit.com/r/test/abc",
    title: "Hello",
    bodyText: "body",
    author: "author",
    subreddit: "test",
    redditCreatedAt: new Date("2024-01-01T00:00:00Z"),
    addedAt: new Date("2024-01-02T00:00:00Z"),
    updatedAt: new Date("2024-01-03T00:00:00Z"),
    isRead: false,
    isFavorite: false,
    folderIds: [],
  };

  it("syncs pending posts and uses server updated_at as syncedAt", async () => {
    repoMock.getPendingSyncPosts.mockResolvedValue([basePost]);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            post_id: 1,
            success: true,
            status: "synced",
            updated_at: "2024-03-01T12:00:00",
          },
        ],
      }),
    });

    const svc = await PostSyncService.create();
    const results = await svc.syncPendingPosts();

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://example.com/sync",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.posts[0]).toEqual(
      expect.objectContaining({ isDeleted: false })
    );
    expect(repoMock.updateSyncState).toHaveBeenCalledWith(
      1,
      "synced",
      expect.any(Date),
      null
    );
    const syncedAtArg = repoMock.updateSyncState.mock.calls[0][2] as Date;
    expect(syncedAtArg.toISOString()).toBe("2024-03-01T12:00:00.000Z");
  });

  it("keeps previous syncedAt on failure", async () => {
    const previousSync = new Date("2024-02-01T00:00:00");
    repoMock.getPendingSyncPosts.mockResolvedValue([
      { ...basePost, syncedAt: previousSync },
    ]);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Server error",
      json: async () => ({ detail: "oops" }),
    });

    const svc = await PostSyncService.create();
    const results = await svc.syncPendingPosts();

    expect(results[0].success).toBe(false);
    expect(repoMock.updateSyncState).toHaveBeenCalledWith(
      1,
      "failed",
      previousSync,
      "Sync failed (500): oops"
    );
  });

  it("falls back to previous syncedAt when server omits updated_at", async () => {
    const previousSync = new Date("2024-02-15T08:00:00");
    repoMock.getPendingSyncPosts.mockResolvedValue([
      { ...basePost, syncedAt: previousSync },
    ]);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        results: [{ post_id: 1, success: true, status: "synced" }],
      }),
    });

    const svc = await PostSyncService.create();
    await svc.syncPendingPosts();

    expect(repoMock.updateSyncState).toHaveBeenCalledWith(
      1,
      "synced",
      previousSync,
      null
    );
  });

  it("batches when pending posts exceed the batch size", async () => {
    const posts = Array.from({ length: 25 }, (_, i) => ({
      ...basePost,
      id: i + 1,
      redditId: `reddit-${i + 1}`,
      url: `https://reddit.com/r/test/${i + 1}`,
    }));
    repoMock.getPendingSyncPosts.mockResolvedValue(posts);

    const makeResponse = (batch: Post[]) => ({
      ok: true,
      status: 200,
      json: async () => ({
        results: batch.map((p) => ({
          post_id: p.id,
          success: true,
          status: "synced",
          updated_at: "2024-03-01T00:00:00",
        })),
      }),
    });

    fetchMock
      .mockResolvedValueOnce(makeResponse(posts.slice(0, 10)))
      .mockResolvedValueOnce(makeResponse(posts.slice(10, 20)))
      .mockResolvedValueOnce(makeResponse(posts.slice(20)));

    const svc = await PostSyncService.create();
    const results = await svc.syncPendingPosts();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const batchSizes = fetchMock.mock.calls.map(([, options]) => {
      const body = JSON.parse((options as any).body);
      return body.posts.length;
    });
    expect(batchSizes).toEqual([10, 10, 5]);
    expect(results).toHaveLength(posts.length);
    expect(repoMock.updateSyncState).toHaveBeenCalledTimes(posts.length);
  });
});
