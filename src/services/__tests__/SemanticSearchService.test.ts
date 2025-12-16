import { SemanticSearchService } from "../SemanticSearchService";
import { SettingsRepository } from "@/repository/SettingsRepository";

jest.mock("@/repository/SettingsRepository", () => ({
  SettingsRepository: { getSettings: jest.fn() },
}));

describe("SemanticSearchService", () => {
  const fetchMock = jest.fn();

  beforeAll(() => {
    (global as any).fetch = fetchMock;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (SettingsRepository.getSettings as jest.Mock).mockResolvedValue({
      SYNC_SERVER_URL: "example.com",
      SYNC_TABLE_NAME: "posts",
      SYNC_EMBED_MODEL: "embed-model",
    });
  });

  it("builds payload with defaults and normalises server url", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        query: "hello",
        k: 3,
        results: [
          { post_id: 42, text: "snippet", metadata: { title: "Example" } },
        ],
      }),
    });

    const res = await SemanticSearchService.search({
      query: "hello",
      k: 3,
      includeText: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://example.com/search",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual(
      expect.objectContaining({
        q: "hello",
        k: 3,
        include_text: true,
        embedding_profile: "embed-model",
        table_name: "chunk_embed-model_posts",
      })
    );
    expect(res.results[0]).toEqual(
      expect.objectContaining({ postId: 42, text: "snippet" })
    );
  });

  it("throws when server url is missing", async () => {
    (SettingsRepository.getSettings as jest.Mock).mockResolvedValue({
      SYNC_SERVER_URL: "",
      SYNC_TABLE_NAME: "posts",
      SYNC_EMBED_MODEL: "embed-model",
    });

    await expect(
      SemanticSearchService.search({ query: "hello" })
    ).rejects.toThrow(/server url not configured/i);
  });
});
