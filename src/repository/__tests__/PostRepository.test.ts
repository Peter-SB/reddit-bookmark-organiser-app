import { PostRepository } from "@/repository/PostRepository";

describe("PostRepository mapRowToPost", () => {
  const baseRow = {
    id: 1,
    redditId: "abc",
    url: "https://reddit.com/r/test/abc",
    title: "Hello",
    bodyText: null,
    bodyMinHash: null,
    author: "author",
    subreddit: "test",
    redditCreatedAt: "2025-07-21T00:00:00Z",
    addedAt: "2025-07-21T01:00:00Z",
    updatedAt: "2025-07-21 19:14:17",
    syncedAt: null,
    lastSyncStatus: null,
    lastSyncError: null,
    customTitle: null,
    customBody: null,
    notes: null,
    rating: null,
    isRead: 0,
    isFavorite: 0,
    folderId: null,
    extraFields: null,
    summary: null,
  };

  const makeRepo = () => {
    const repo = new (PostRepository as any)({});
    jest.spyOn(repo as any, "loadFolderIds").mockResolvedValue([]);
    return repo;
  };

  it("treats updatedAt without timezone as UTC", async () => {
    const repo = makeRepo();
    const row = { ...baseRow, updatedAt: "2025-07-21 19:14:17" };
    const post = await (repo as any).mapRowToPost(row);
    expect(post.updatedAt.toISOString()).toBe("2025-07-21T19:14:17.000Z");
  });

  it("keeps updatedAt with Z as UTC", async () => {
    const repo = makeRepo();
    const row = { ...baseRow, updatedAt: "2025-07-21T19:14:17Z" };
    const post = await (repo as any).mapRowToPost(row);
    expect(post.updatedAt.toISOString()).toBe("2025-07-21T19:14:17.000Z");
  });
});
