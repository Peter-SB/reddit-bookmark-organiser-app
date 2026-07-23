import { SearchHistoryService } from "../SearchHistoryService";
import { SearchHistoryRepository } from "@/repository/SearchHistoryRepository";
import { SettingsRepository } from "@/repository/SettingsRepository";
import { SemanticSearchService } from "@/services/SemanticSearchService";
import { SYNC_LIBRARY_ID_KEY } from "@/constants/sync";

jest.mock("@/repository/SearchHistoryRepository");
jest.mock("@/repository/SettingsRepository");
jest.mock("@/services/SemanticSearchService");

const mockRepoCreate = SearchHistoryRepository.create as jest.MockedFunction<
  typeof SearchHistoryRepository.create
>;
const mockGetSettings = SettingsRepository.getSettings as jest.MockedFunction<
  typeof SettingsRepository.getSettings
>;
const mockSearch = SemanticSearchService.search as jest.MockedFunction<
  typeof SemanticSearchService.search
>;

describe("SearchHistoryService.startSearch", () => {
  let repoMock: {
    createEntry: jest.Mock;
    markComplete: jest.Mock;
    markError: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repoMock = {
      createEntry: jest.fn().mockResolvedValue(7),
      markComplete: jest.fn().mockResolvedValue(undefined),
      markError: jest.fn().mockResolvedValue(undefined),
    };
    mockRepoCreate.mockResolvedValue(repoMock as any);
    mockGetSettings.mockResolvedValue({ [SYNC_LIBRARY_ID_KEY]: "main" });
  });

  it("creates a pending entry with trimmed query and resolved defaults", async () => {
    mockSearch.mockReturnValue(new Promise(() => {})); // never resolves in this test

    const id = await SearchHistoryService.startSearch({ query: "  hello world  " });

    expect(id).toBe(7);
    expect(repoMock.createEntry).toHaveBeenCalledWith({
      query: "hello world",
      chunkType: "body",
      k: 50,
      libraryId: "main",
    });
  });

  it("honours explicit k and chunkType instead of defaults", async () => {
    mockSearch.mockReturnValue(new Promise(() => {}));

    await SearchHistoryService.startSearch({
      query: "topic",
      k: 3,
      chunkType: "title",
    });

    expect(repoMock.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({ chunkType: "title", k: 3 })
    );
  });

  it("falls back to the default library id when settings are empty", async () => {
    mockGetSettings.mockResolvedValue({});
    mockSearch.mockReturnValue(new Promise(() => {}));

    await SearchHistoryService.startSearch({ query: "topic" });

    expect(repoMock.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({ libraryId: "main" })
    );
  });

  it("returns the new entry id immediately without waiting for the search to finish", async () => {
    let resolveSearch: (value: any) => void;
    mockSearch.mockReturnValue(
      new Promise((resolve) => {
        resolveSearch = resolve;
      })
    );

    const id = await SearchHistoryService.startSearch({ query: "topic" });

    expect(id).toBe(7);
    expect(repoMock.markComplete).not.toHaveBeenCalled();
    expect(repoMock.markError).not.toHaveBeenCalled();

    resolveSearch!({ query: "topic", k: 50, chunkType: "body", results: [] });
  });

  it("marks the entry complete once the background search resolves", async () => {
    const results = [
      { chunkId: "c1", postId: 1, text: "snippet", metadata: {}, score: 0.5 },
    ];
    mockSearch.mockResolvedValue({
      query: "topic",
      k: 50,
      chunkType: "body",
      results,
    });

    await SearchHistoryService.startSearch({ query: "topic" });
    await flushMicrotasks();

    expect(repoMock.markComplete).toHaveBeenCalledWith(7, results);
    expect(repoMock.markError).not.toHaveBeenCalled();
  });

  it("marks the entry as errored when the background search rejects", async () => {
    mockSearch.mockRejectedValue(new Error("Search timed out waiting for results."));

    await SearchHistoryService.startSearch({ query: "topic" });
    await flushMicrotasks();

    expect(repoMock.markError).toHaveBeenCalledWith(
      7,
      "Search timed out waiting for results."
    );
    expect(repoMock.markComplete).not.toHaveBeenCalled();
  });

  it("falls back to a generic error message when the rejection has none", async () => {
    mockSearch.mockRejectedValue({});

    await SearchHistoryService.startSearch({ query: "topic" });
    await flushMicrotasks();

    expect(repoMock.markError).toHaveBeenCalledWith(7, "Search failed");
  });
});

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
