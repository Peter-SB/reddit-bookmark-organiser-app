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
    isDeleted: 0,
    folderId: null,
    extraFields: null,
    summary: null,
    readAt: null,
  };

  const makeRepo = () => {
    return new (PostRepository as any)({});
  };

  it("treats updatedAt without timezone as UTC", () => {
    const repo = makeRepo();
    const row = { ...baseRow, updatedAt: "2025-07-21 19:14:17" };
    const post = (repo as any).mapRowToPost(row, []);
    expect(post.updatedAt.toISOString()).toBe("2025-07-21T19:14:17.000Z");
  });

  it("keeps updatedAt with Z as UTC", () => {
    const repo = makeRepo();
    const row = { ...baseRow, updatedAt: "2025-07-21T19:14:17Z" };
    const post = (repo as any).mapRowToPost(row, []);
    expect(post.updatedAt.toISOString()).toBe("2025-07-21T19:14:17.000Z");
  });

  it("uses provided folderIds instead of loading from DB", () => {
    // Arrange
    const repo = makeRepo();
    const row = { ...baseRow };

    // Act
    const post = (repo as any).mapRowToPost(row, [10, 20, 30]);

    // Assert
    expect(post.folderIds).toEqual([10, 20, 30]);
  });

  it("defaults to empty folderIds when none provided", () => {
    // Arrange
    const repo = makeRepo();

    // Act
    const post = (repo as any).mapRowToPost(baseRow, []);

    // Assert
    expect(post.folderIds).toEqual([]);
  });

  it("maps boolean fields from integer values", () => {
    // Arrange
    const repo = makeRepo();
    const row = { ...baseRow, isRead: 1, isFavorite: 1, isDeleted: 1 };

    // Act
    const post = (repo as any).mapRowToPost(row, []);

    // Assert
    expect(post.isRead).toBe(true);
    expect(post.isFavorite).toBe(true);
    expect(post.isDeleted).toBe(true);
  });

  it("maps boolean fields as false when 0", () => {
    // Arrange
    const repo = makeRepo();

    // Act
    const post = (repo as any).mapRowToPost(baseRow, []);

    // Assert
    expect(post.isRead).toBe(false);
    expect(post.isFavorite).toBe(false);
    expect(post.isDeleted).toBe(false);
  });

  it("parses extraFields JSON string", () => {
    // Arrange
    const repo = makeRepo();
    const extras = { mediaType: "image", nsfw: true };
    const row = { ...baseRow, extraFields: JSON.stringify(extras) };

    // Act
    const post = (repo as any).mapRowToPost(row, []);

    // Assert
    expect(post.extraFields).toEqual(extras);
  });

  it("handles invalid extraFields JSON gracefully", () => {
    // Arrange
    const repo = makeRepo();
    const row = { ...baseRow, extraFields: "{not valid json" };

    // Act
    const post = (repo as any).mapRowToPost(row, []);

    // Assert
    expect(post.extraFields).toBeUndefined();
  });

  it("maps null text fields to empty/undefined", () => {
    // Arrange
    const repo = makeRepo();

    // Act
    const post = (repo as any).mapRowToPost(baseRow, []);

    // Assert
    expect(post.bodyText).toBe("");
    expect(post.bodyMinHash).toBeUndefined();
    expect(post.customTitle).toBeUndefined();
    expect(post.customBody).toBeUndefined();
    expect(post.notes).toBeUndefined();
    expect(post.summary).toBeUndefined();
  });
});

describe("PostRepository loadAllFolderIds", () => {
  it("batches all folder lookups into a single query", async () => {
    // Arrange
    const mockGetAllAsync = jest.fn().mockResolvedValue([
      { post_id: 1, folder_id: 10 },
      { post_id: 1, folder_id: 20 },
      { post_id: 2, folder_id: 30 },
      { post_id: 5, folder_id: 10 },
    ]);
    const repo = new (PostRepository as any)({ getAllAsync: mockGetAllAsync });

    // Act
    const result = await (repo as any).loadAllFolderIds();

    // Assert
    expect(mockGetAllAsync).toHaveBeenCalledTimes(1);
    expect(result.get(1)).toEqual([10, 20]);
    expect(result.get(2)).toEqual([30]);
    expect(result.get(5)).toEqual([10]);
    expect(result.get(99)).toBeUndefined(); // non-existent post
  });

  it("returns empty map when no folder assignments exist", async () => {
    // Arrange
    const mockGetAllAsync = jest.fn().mockResolvedValue([]);
    const repo = new (PostRepository as any)({ getAllAsync: mockGetAllAsync });

    // Act
    const result = await (repo as any).loadAllFolderIds();

    // Assert
    expect(result.size).toBe(0);
  });

  it("filters by post IDs when provided", async () => {
    // Arrange
    const mockGetAllAsync = jest.fn().mockResolvedValue([
      { post_id: 1, folder_id: 10 },
    ]);
    const repo = new (PostRepository as any)({ getAllAsync: mockGetAllAsync });

    // Act
    await (repo as any).loadAllFolderIds([1, 2]);

    // Assert
    expect(mockGetAllAsync).toHaveBeenCalledTimes(1);
    const query = mockGetAllAsync.mock.calls[0][0] as string;
    expect(query).toContain("IN");
    expect(query).toContain("?,?");
  });
});

describe("PostRepository getAll (N+1 fix)", () => {
  it("uses batch folder loading instead of per-post queries", async () => {
    // Arrange
    const rows = [
      { ...makePostRow(1), title: "Post 1" },
      { ...makePostRow(2), title: "Post 2" },
      { ...makePostRow(3), title: "Post 3" },
    ];

    const folderRows = [
      { post_id: 1, folder_id: 10 },
      { post_id: 3, folder_id: 20 },
    ];

    const mockDb = {
      getAllAsync: jest.fn()
        .mockResolvedValueOnce(rows)     // posts query
        .mockResolvedValueOnce(folderRows), // batch folder query
    };
    const repo = new (PostRepository as any)(mockDb);

    // Act
    const posts = await repo.getAll();

    // Assert - only 2 DB calls (posts + folders), not 1 + N
    expect(mockDb.getAllAsync).toHaveBeenCalledTimes(2);
    expect(posts).toHaveLength(3);
    expect(posts[0].folderIds).toEqual([10]);
    expect(posts[1].folderIds).toEqual([]);
    expect(posts[2].folderIds).toEqual([20]);
  });
});

describe("PostRepository toggleFavoriteById", () => {
  it("toggles favorite in DB and returns new isFavorite and queuedAt", async () => {
    // Arrange
    const mockDb = {
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
      getFirstAsync: jest.fn().mockResolvedValue({ isFavorite: 1, queuedAt: '2024-01-01T00:00:00Z' }),
    };
    const repo = new (PostRepository as any)(mockDb);

    // Act
    const result = await repo.toggleFavoriteById(42);

    // Assert
    expect(result.isFavorite).toBe(true);
    expect(result.queuedAt).toBeInstanceOf(Date);
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
    const sql = mockDb.runAsync.mock.calls[0][0] as string;
    expect(sql).toContain("isFavorite");
    expect(sql).toContain("CASE");
    expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining("isFavorite"),
      42
    );
  });
});

describe("PostRepository toggleReadById", () => {
  it("toggles read status in DB and returns new value", async () => {
    // Arrange
    const mockDb = {
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
      getFirstAsync: jest.fn().mockResolvedValue({ isRead: 0 }),
    };
    const repo = new (PostRepository as any)(mockDb);

    // Act
    const result = await repo.toggleReadById(42);

    // Assert
    expect(result).toBe(false);
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
    const sql = mockDb.runAsync.mock.calls[0][0] as string;
    expect(sql).toContain("isRead");
    expect(sql).toContain("readAt");
  });
});

describe("PostRepository getAllListItems", () => {
  it("returns lightweight items without heavy text fields", async () => {
    // Arrange
    const listRows = [
      {
        id: 1,
        redditId: "abc",
        url: "https://reddit.com/r/test/abc",
        title: "Hello",
        author: "testauthor",
        subreddit: "test",
        redditCreatedAt: "2025-07-21T00:00:00Z",
        addedAt: "2025-07-21T01:00:00Z",
        updatedAt: "2025-07-21T02:00:00Z",
        customTitle: null,
        notes: "some note",
        rating: 4.5,
        isRead: 1,
        isFavorite: 0,
        readAt: "2025-07-21T03:00:00Z",
        wordCount: 150,
      },
    ];
    const folderRows = [{ post_id: 1, folder_id: 5 }];

    const mockDb = {
      getAllAsync: jest.fn()
        .mockResolvedValueOnce(listRows)
        .mockResolvedValueOnce(folderRows),
    };
    const repo = new (PostRepository as any)(mockDb);

    // Act
    const items = await repo.getAllListItems();

    // Assert
    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item.id).toBe(1);
    expect(item.wordCount).toBe(150);
    expect(item.isRead).toBe(true);
    expect(item.isFavorite).toBe(false);
    expect(item.folderIds).toEqual([5]);
    expect(item.notes).toBe("some note");
    expect(item.rating).toBe(4.5);
    // Should NOT have heavy fields
    expect((item as any).bodyText).toBeUndefined();
    expect((item as any).bodyMinHash).toBeUndefined();
    expect((item as any).summary).toBeUndefined();
    expect((item as any).extraFields).toBeUndefined();

    // Verify SQL query selects specific columns, not *
    const sql = mockDb.getAllAsync.mock.calls[0][0] as string;
    expect(sql).not.toContain("SELECT *");
    expect(sql).toContain("wordCount");
  });
});

// Helper to create a valid PostRow for tests
function makePostRow(id: number) {
  return {
    id,
    redditId: `reddit_${id}`,
    url: `https://reddit.com/r/test/${id}`,
    title: `Post ${id}`,
    bodyText: null,
    bodyMinHash: null,
    author: "author",
    subreddit: "test",
    redditCreatedAt: "2025-07-21T00:00:00Z",
    addedAt: "2025-07-21T01:00:00Z",
    updatedAt: "2025-07-21T02:00:00Z",
    syncedAt: null,
    lastSyncStatus: null,
    lastSyncError: null,
    customTitle: null,
    customBody: null,
    notes: null,
    rating: null,
    isRead: 0,
    isFavorite: 0,
    isDeleted: 0,
    folderId: null,
    extraFields: null,
    summary: null,
    readAt: null,
  };
}
