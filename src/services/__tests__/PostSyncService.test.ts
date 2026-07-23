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
    resetSyncStateForAll: jest.Mock;
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
      resetSyncStateForAll: jest.fn().mockResolvedValue(undefined),
      getAllPostsPaginated: jest.fn(),
    };
    (PostRepository.create as jest.Mock).mockResolvedValue(repoMock);
    (SettingsRepository.getSettings as jest.Mock).mockResolvedValue({
      SYNC_SERVER_URL: "http://example.com",
      SYNC_TABLE_NAME: "main",
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

  it("syncs pending posts and uses the post's own updatedAt as syncedAt", async () => {
    repoMock.getPendingSyncPosts.mockResolvedValue([basePost]);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        results: [{ post_id: 1, success: true, status: "inserted" }],
      }),
    });

    const svc = await PostSyncService.create();
    const results = await svc.syncPendingPosts();

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://example.com/posts/sync",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.library_id).toBe("main");
    expect(body.posts[0]).toEqual(
      expect.objectContaining({ isDeleted: false })
    );
    expect(repoMock.updateSyncState).toHaveBeenCalledWith(
      1,
      "inserted",
      expect.any(Date),
      null
    );
    const syncedAtArg = repoMock.updateSyncState.mock.calls[0][2] as Date;
    expect(syncedAtArg.toISOString()).toBe(basePost.updatedAt.toISOString());
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

  it("uses the post's own updatedAt when the server reports it was skipped", async () => {
    const previousSync = new Date("2024-02-15T08:00:00");
    repoMock.getPendingSyncPosts.mockResolvedValue([
      { ...basePost, syncedAt: previousSync },
    ]);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        results: [{ post_id: 1, success: true, status: "skipped" }],
      }),
    });

    const svc = await PostSyncService.create();
    await svc.syncPendingPosts();

    expect(repoMock.updateSyncState).toHaveBeenCalledWith(
      1,
      "skipped",
      expect.any(Date),
      null
    );
    const syncedAtArg = repoMock.updateSyncState.mock.calls[0][2] as Date;
    expect(syncedAtArg.toISOString()).toBe(basePost.updatedAt.toISOString());
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
          status: "inserted",
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

  it("caps concurrent in-flight batches instead of firing them all at once", async () => {
    // 85 posts / batch size 10 = 9 batches; with a concurrency cap of 4 that's
    // three windows of [4, 4, 1] requests rather than 9 requests fired at once.
    const posts = Array.from({ length: 85 }, (_, i) => ({
      ...basePost,
      id: i + 1,
      redditId: `reddit-${i + 1}`,
      url: `https://reddit.com/r/test/${i + 1}`,
    }));
    repoMock.getPendingSyncPosts.mockResolvedValue(posts);

    const pendingRequests: { resolve: (v: any) => void; postIds: number[] }[] = [];
    fetchMock.mockImplementation((_url: string, options: any) => {
      const body = JSON.parse(options.body);
      const postIds = body.posts.map((p: any) => p.id);
      return new Promise((resolve) => {
        pendingRequests.push({ resolve, postIds });
      });
    });

    const resolveInFlightRequests = () => {
      const toResolve = pendingRequests.splice(0, pendingRequests.length);
      toResolve.forEach(({ resolve, postIds }) => {
        resolve({
          ok: true,
          status: 200,
          json: async () => ({
            results: postIds.map((id: number) => ({
              post_id: id,
              success: true,
              status: "inserted",
            })),
          }),
        });
      });
    };
    const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

    const svc = await PostSyncService.create();
    const resultsPromise = svc.syncPendingPosts();

    await flushMicrotasks();
    expect(fetchMock).toHaveBeenCalledTimes(4);

    resolveInFlightRequests();
    await flushMicrotasks();
    expect(fetchMock).toHaveBeenCalledTimes(8);

    resolveInFlightRequests();
    await flushMicrotasks();
    expect(fetchMock).toHaveBeenCalledTimes(9);

    resolveInFlightRequests();
    const results = await resultsPromise;
    expect(results).toHaveLength(85);
  });

  it("batches force resyncs instead of sending everything in a single request", async () => {
    const posts = Array.from({ length: 25 }, (_, i) => ({
      ...basePost,
      id: i + 1,
      redditId: `reddit-${i + 1}`,
      url: `https://reddit.com/r/test/${i + 1}`,
    }));
    // Simulate pagination: first page 10, second page 10, third page 5, then empty
    repoMock.getAllPostsPaginated
      .mockResolvedValueOnce(posts.slice(0, 10))
      .mockResolvedValueOnce(posts.slice(10, 20))
      .mockResolvedValueOnce(posts.slice(20))
      .mockResolvedValueOnce([]);

    const makeResponse = (batch: Post[]) => ({
      ok: true,
      status: 200,
      json: async () => ({
        results: batch.map((p) => ({
          post_id: p.id,
          success: true,
          status: "inserted",
        })),
      }),
    });

    fetchMock
      .mockResolvedValueOnce(makeResponse(posts.slice(0, 10)))
      .mockResolvedValueOnce(makeResponse(posts.slice(10, 20)))
      .mockResolvedValueOnce(makeResponse(posts.slice(20)));

    const svc = await PostSyncService.create();
    const results = await svc.forceResyncAllPosts();

    expect(repoMock.resetSyncStateForAll).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const batchSizes = fetchMock.mock.calls.map(([, options]) => {
      const body = JSON.parse((options as any).body);
      return body.posts.length;
    });
    expect(batchSizes).toEqual([10, 10, 5]);
    expect(results).toHaveLength(25);
  });

  it("force resync pages through all posts regardless of sync state", async () => {
    const page1 = Array.from({ length: 10 }, (_, i) => ({
      ...basePost,
      id: i + 1,
      redditId: `reddit-${i + 1}`,
      url: `https://reddit.com/r/test/${i + 1}`,
    }));
    const page2 = Array.from({ length: 5 }, (_, i) => ({
      ...basePost,
      id: i + 11,
      redditId: `reddit-${i + 11}`,
      url: `https://reddit.com/r/test/${i + 11}`,
    }));
    repoMock.getAllPostsPaginated
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2)
      .mockResolvedValueOnce([]);

    const makeResponse = (batch: Post[]) => ({
      ok: true,
      status: 200,
      json: async () => ({
        results: batch.map((p) => ({
          post_id: p.id,
          success: true,
          status: "inserted",
        })),
      }),
    });

    fetchMock
      .mockResolvedValueOnce(makeResponse(page1))
      .mockResolvedValueOnce(makeResponse(page2));

    const svc = await PostSyncService.create();
    const results = await svc.forceResyncAllPosts();

    expect(repoMock.resetSyncStateForAll).toHaveBeenCalled();
    expect(repoMock.getAllPostsPaginated).toHaveBeenCalledTimes(3);
    expect(repoMock.getAllPostsPaginated).toHaveBeenNthCalledWith(1, 10, 0);
    expect(repoMock.getAllPostsPaginated).toHaveBeenNthCalledWith(2, 10, 10);
    expect(repoMock.getAllPostsPaginated).toHaveBeenNthCalledWith(3, 10, 20);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(15);
  });
});
