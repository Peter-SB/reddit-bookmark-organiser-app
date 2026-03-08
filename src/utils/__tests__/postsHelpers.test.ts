import { PostListItem, Post } from "@/models/models";
import { filterPosts, sortPosts } from "@/utils/postsHelpers";

/** Helper to create a PostListItem for tests */
function makeListItem(overrides: Partial<PostListItem> & { id: number }): PostListItem {
  return {
    redditId: `reddit_${overrides.id}`,
    url: `https://reddit.com/r/test/${overrides.id}`,
    title: `Post ${overrides.id}`,
    author: "testauthor",
    subreddit: "testsub",
    redditCreatedAt: new Date("2025-01-01"),
    addedAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    isRead: false,
    isFavorite: false,
    readAt: null,
    folderIds: [],
    wordCount: 100,
    ...overrides,
  };
}

describe("filterPosts", () => {
  const defaultOptions = {
    search: "",
    selectedFolders: [],
    favouritesFilter: "all" as const,
    readFilter: "all" as const,
  };

  describe("search filtering", () => {
    it("returns all posts when search is empty", () => {
      // Arrange
      const posts = [makeListItem({ id: 1 }), makeListItem({ id: 2 })];

      // Act
      const result = filterPosts(posts, defaultOptions);

      // Assert
      expect(result).toHaveLength(2);
    });

    it("filters by title match (case-insensitive)", () => {
      // Arrange
      const posts = [
        makeListItem({ id: 1, title: "React hooks guide" }),
        makeListItem({ id: 2, title: "Python basics" }),
        makeListItem({ id: 3, title: "Advanced React patterns" }),
      ];

      // Act
      const result = filterPosts(posts, { ...defaultOptions, search: "react" });

      // Assert
      expect(result).toHaveLength(2);
      expect(result.map((p) => p.id)).toEqual([1, 3]);
    });

    it("filters by author match", () => {
      // Arrange
      const posts = [
        makeListItem({ id: 1, author: "john_doe" }),
        makeListItem({ id: 2, author: "jane_smith" }),
      ];

      // Act
      const result = filterPosts(posts, { ...defaultOptions, search: "john" });

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].author).toBe("john_doe");
    });

    it("filters by subreddit match", () => {
      // Arrange
      const posts = [
        makeListItem({ id: 1, subreddit: "programming" }),
        makeListItem({ id: 2, subreddit: "cooking" }),
      ];

      // Act
      const result = filterPosts(posts, {
        ...defaultOptions,
        search: "programming",
      });

      // Assert
      expect(result).toHaveLength(1);
    });

    it("filters by customTitle match", () => {
      // Arrange
      const posts = [
        makeListItem({ id: 1, title: "Original", customTitle: "My Custom Title" }),
        makeListItem({ id: 2, title: "Other post" }),
      ];

      // Act
      const result = filterPosts(posts, { ...defaultOptions, search: "custom" });

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });
  });

  describe("folder filtering", () => {
    it("returns all posts when no folders selected", () => {
      // Arrange
      const posts = [
        makeListItem({ id: 1, folderIds: [10] }),
        makeListItem({ id: 2, folderIds: [] }),
      ];

      // Act
      const result = filterPosts(posts, defaultOptions);

      // Assert
      expect(result).toHaveLength(2);
    });

    it("filters posts by selected folders", () => {
      // Arrange
      const posts = [
        makeListItem({ id: 1, folderIds: [10] }),
        makeListItem({ id: 2, folderIds: [20] }),
        makeListItem({ id: 3, folderIds: [10, 20] }),
        makeListItem({ id: 4, folderIds: [] }),
      ];

      // Act
      const result = filterPosts(posts, {
        ...defaultOptions,
        selectedFolders: [10],
      });

      // Assert
      expect(result.map((p) => p.id)).toEqual([1, 3]);
    });
  });

  describe("favorites filtering", () => {
    it("returns only favorites when filter is 'yes'", () => {
      // Arrange
      const posts = [
        makeListItem({ id: 1, isFavorite: true }),
        makeListItem({ id: 2, isFavorite: false }),
        makeListItem({ id: 3, isFavorite: true }),
      ];

      // Act
      const result = filterPosts(posts, {
        ...defaultOptions,
        favouritesFilter: "yes",
      });

      // Assert
      expect(result.map((p) => p.id)).toEqual([1, 3]);
    });

    it("returns only non-favorites when filter is 'no'", () => {
      // Arrange
      const posts = [
        makeListItem({ id: 1, isFavorite: true }),
        makeListItem({ id: 2, isFavorite: false }),
      ];

      // Act
      const result = filterPosts(posts, {
        ...defaultOptions,
        favouritesFilter: "no",
      });

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });
  });

  describe("read filtering", () => {
    it("returns only read posts when filter is 'yes'", () => {
      // Arrange
      const posts = [
        makeListItem({ id: 1, isRead: true }),
        makeListItem({ id: 2, isRead: false }),
      ];

      // Act
      const result = filterPosts(posts, {
        ...defaultOptions,
        readFilter: "yes",
      });

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });
  });

  describe("combined filters", () => {
    it("applies search + folder + favorites filters together", () => {
      // Arrange
      const posts = [
        makeListItem({
          id: 1,
          title: "React hooks",
          folderIds: [10],
          isFavorite: true,
        }),
        makeListItem({
          id: 2,
          title: "React basics",
          folderIds: [20],
          isFavorite: true,
        }),
        makeListItem({
          id: 3,
          title: "React patterns",
          folderIds: [10],
          isFavorite: false,
        }),
        makeListItem({
          id: 4,
          title: "Python guide",
          folderIds: [10],
          isFavorite: true,
        }),
      ];

      // Act
      const result = filterPosts(posts, {
        search: "react",
        selectedFolders: [10],
        favouritesFilter: "yes",
        readFilter: "all",
      });

      // Assert - only post 1 matches all three criteria
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });
  });
});

describe("sortPosts", () => {
  it("sorts by addedAt descending", () => {
    // Arrange
    const posts = [
      makeListItem({ id: 1, addedAt: new Date("2025-01-01") }),
      makeListItem({ id: 2, addedAt: new Date("2025-03-01") }),
      makeListItem({ id: 3, addedAt: new Date("2025-02-01") }),
    ];

    // Act
    const result = sortPosts(posts, "addedAt", "desc");

    // Assert
    expect(result.map((p) => p.id)).toEqual([2, 3, 1]);
  });

  it("sorts by addedAt ascending", () => {
    // Arrange
    const posts = [
      makeListItem({ id: 1, addedAt: new Date("2025-03-01") }),
      makeListItem({ id: 2, addedAt: new Date("2025-01-01") }),
    ];

    // Act
    const result = sortPosts(posts, "addedAt", "asc");

    // Assert
    expect(result.map((p) => p.id)).toEqual([2, 1]);
  });

  it("sorts by title alphabetically", () => {
    // Arrange
    const posts = [
      makeListItem({ id: 1, title: "Zebra" }),
      makeListItem({ id: 2, title: "Apple" }),
      makeListItem({ id: 3, title: "Mango" }),
    ];

    // Act
    const result = sortPosts(posts, "title", "asc");

    // Assert
    expect(result.map((p) => p.id)).toEqual([2, 3, 1]);
  });

  it("sorts by rating descending", () => {
    // Arrange
    const posts = [
      makeListItem({ id: 1, rating: 3 }),
      makeListItem({ id: 2, rating: 5 }),
      makeListItem({ id: 3 }),
    ];

    // Act
    const result = sortPosts(posts, "rating", "desc");

    // Assert
    expect(result[0].id).toBe(2);
    expect(result[1].id).toBe(1);
  });

  it("sorts by wordCount (length) for PostListItem", () => {
    // Arrange
    const posts = [
      makeListItem({ id: 1, wordCount: 500 }),
      makeListItem({ id: 2, wordCount: 100 }),
      makeListItem({ id: 3, wordCount: 300 }),
    ];

    // Act
    const result = sortPosts(posts, "length", "desc");

    // Assert
    expect(result.map((p) => p.id)).toEqual([1, 3, 2]);
  });

  it("produces deterministic random order with same seed", () => {
    // Arrange
    const posts = [
      makeListItem({ id: 1 }),
      makeListItem({ id: 2 }),
      makeListItem({ id: 3 }),
      makeListItem({ id: 4 }),
      makeListItem({ id: 5 }),
    ];

    // Act
    const result1 = sortPosts(posts, "random", "asc", 42);
    const result2 = sortPosts(posts, "random", "asc", 42);

    // Assert
    expect(result1.map((p) => p.id)).toEqual(result2.map((p) => p.id));
  });

  it("does not mutate the original array", () => {
    // Arrange
    const posts = [
      makeListItem({ id: 1, addedAt: new Date("2025-03-01") }),
      makeListItem({ id: 2, addedAt: new Date("2025-01-01") }),
    ];
    const originalIds = posts.map((p) => p.id);

    // Act
    sortPosts(posts, "addedAt", "asc");

    // Assert
    expect(posts.map((p) => p.id)).toEqual(originalIds);
  });

  it("handles readAt sort with null values (nulls last)", () => {
    // Arrange
    const posts = [
      makeListItem({ id: 1, readAt: null }),
      makeListItem({ id: 2, readAt: new Date("2025-02-01") }),
      makeListItem({ id: 3, readAt: new Date("2025-01-01") }),
    ];

    // Act
    const result = sortPosts(posts, "readAt", "asc");

    // Assert - nulls sort last
    expect(result[2].id).toBe(1);
    expect(result[0].id).toBe(3);
    expect(result[1].id).toBe(2);
  });
});
