import { SemanticSearchService } from "../SemanticSearchService";
import { SettingsRepository } from "@/repository/SettingsRepository";
import { SYNC_LIBRARY_ID_KEY, SYNC_SERVER_URL_KEY } from "@/constants/sync";

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
      [SYNC_LIBRARY_ID_KEY]: "main",
    });
  });

  it("creates a search job, polls until complete, and maps results", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ job_id: "job-1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          job_id: "job-1",
          status: "complete",
          results: [
            {
              chunk_id: "c1",
              post_id: 42,
              text: "snippet",
              metadata: { title: "Example" },
              score: 0.87,
            },
          ],
        }),
      });

    const res = await SemanticSearchService.search({
      query: "hello",
      k: 3,
      chunkType: "title",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://example.com/search/",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({
      query: "hello",
      chunk_type: "title",
      k: 3,
      library_id: "main",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://example.com/search/job-1");
    expect(res.results[0]).toEqual(
      expect.objectContaining({ postId: 42, text: "snippet", score: 0.87 })
    );
    expect(res.chunkType).toBe("title");
  });

  it("throws when the search job fails", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ job_id: "job-2" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ job_id: "job-2", status: "failed", error: "boom" }),
      });

    await expect(
      SemanticSearchService.search({ query: "hello" })
    ).rejects.toThrow(/boom/);
  });

  it("throws when server url is missing", async () => {
    (SettingsRepository.getSettings as jest.Mock).mockResolvedValue({
      [SYNC_SERVER_URL_KEY]: "",
      [SYNC_LIBRARY_ID_KEY]: "main",
    });

    await expect(
      SemanticSearchService.search({ query: "hello" })
    ).rejects.toThrow(/server url not configured/i);
  });

  it("hits /search/similar with post id and parses results", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        post_id: 7,
        chunk_type: "body",
        chunks_averaged: 4,
        results: [
          { chunk_id: "c2", post_id: 99, text: "sample", metadata: { title: "Match" }, score: 0.5 },
        ],
      }),
    });

    const res = await SemanticSearchService.similar({
      postId: 7,
      k: 4,
      chunkType: "body",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://example.com/search/similar",
      expect.objectContaining({ method: "POST" })
    );
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload).toEqual({
      post_id: 7,
      chunk_type: "body",
      k: 4,
      library_id: "main",
    });
    expect(res).toEqual(
      expect.objectContaining({
        postId: 7,
        chunkType: "body",
        chunksAveraged: 4,
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
