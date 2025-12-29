import { SemanticSearchService } from "../SemanticSearchService";
import { SettingsRepository } from "@/repository/SettingsRepository";
import {
  SYNC_SEMANTIC_EMBED_MODEL_KEY,
  SYNC_SERVER_URL_KEY,
  SYNC_SIMILAR_EMBED_MODEL_KEY,
  SYNC_TABLE_NAME_KEY,
} from "@/constants/sync";

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
      [SYNC_SERVER_URL_KEY]: "example.com",
      [SYNC_TABLE_NAME_KEY]: "posts",
      [SYNC_SEMANTIC_EMBED_MODEL_KEY]: "semantic-model",
      [SYNC_SIMILAR_EMBED_MODEL_KEY]: "similar-model",
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
        embedding_profile: "semantic-model",
        table_name: "chunks_semantic-model_posts",
      })
    );
    expect(res.results[0]).toEqual(
      expect.objectContaining({ postId: 42, text: "snippet" })
    );
  });

  it("throws when server url is missing", async () => {
    (SettingsRepository.getSettings as jest.Mock).mockResolvedValue({
      [SYNC_SERVER_URL_KEY]: "",
      [SYNC_TABLE_NAME_KEY]: "posts",
    });

    await expect(
      SemanticSearchService.search({ query: "hello" })
    ).rejects.toThrow(/server url not configured/i);
  });

  it("hits /similar with post id and parses results", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        post_id: 7,
        k: 4,
        results: [{ post_id: 99, text: "sample", metadata: { title: "Match" } }],
      }),
    });

    const res = await SemanticSearchService.similar({
      postId: 7,
      k: 4,
      includeText: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://example.com/similar",
      expect.objectContaining({ method: "POST" })
    );
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload).toEqual(
      expect.objectContaining({
        post_id: 7,
        k: 4,
        include_text: false,
        embedding_profile: "similar-model",
        table_name: "chunks_similar-model_posts",
      })
    );
    expect(res).toEqual(
      expect.objectContaining({
        postId: 7,
        k: 4,
        results: [expect.objectContaining({ postId: 99, text: "sample" })],
      })
    );
  });

  it("requires a valid post id for similar search", async () => {
    await expect(
      SemanticSearchService.similar({ postId: NaN as any })
    ).rejects.toThrow(/post id/i);
  });
});
