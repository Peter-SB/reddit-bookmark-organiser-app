import { ChunkType, DEFAULT_CHUNK_TYPE, DEFAULT_SEARCH_RESULTS } from "@/constants/search";
import {
  DEFAULT_LIBRARY_ID,
  SYNC_LIBRARY_ID_KEY,
  SYNC_SERVER_URL_KEY,
} from "@/constants/sync";
import { SettingsRepository } from "@/repository/SettingsRepository";

export type SemanticSearchParams = {
  query: string;
  k?: number;
  chunkType?: ChunkType;
};

export type SimilarSearchParams = {
  postId: number;
  k?: number;
  chunkType?: ChunkType;
};

export type SemanticSearchResult = {
  chunkId: string;
  postId: number;
  text?: string | null;
  metadata: Record<string, any>;
  score: number;
};

export type SemanticSearchResponse = {
  query: string;
  k: number;
  chunkType: ChunkType;
  results: SemanticSearchResult[];
};

export type SimilarSearchResponse = {
  postId: number;
  chunkType: ChunkType;
  chunksAveraged: number;
  results: SemanticSearchResult[];
};

const SEARCH_POLL_INTERVAL_MS = 600;
const SEARCH_POLL_TIMEOUT_MS = 30000;

const normaliseServerUrl = (raw: string) => {
  const trimmed = raw.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
};

export class SemanticSearchService {
  private static async buildSearchConfig() {
    const settings = await SettingsRepository.getSettings([
      SYNC_SERVER_URL_KEY,
      SYNC_LIBRARY_ID_KEY,
    ]);

    const serverUrlRaw = (settings[SYNC_SERVER_URL_KEY] || "").trim();
    if (!serverUrlRaw) {
      throw new Error(
        "Sync server URL not configured. Set it in Settings > Sync Server."
      );
    }

    const libraryId =
      (settings[SYNC_LIBRARY_ID_KEY] || DEFAULT_LIBRARY_ID).trim() ||
      DEFAULT_LIBRARY_ID;
    return { serverUrlRaw, libraryId };
  }

  private static resolveK(k?: number) {
    const kRaw =
      typeof k === "number" ? k : parseInt(String(k ?? DEFAULT_SEARCH_RESULTS), 10);
    return Number.isFinite(kRaw) && kRaw > 0 ? kRaw : DEFAULT_SEARCH_RESULTS;
  }

  private static mapResults(raw: any[]): SemanticSearchResult[] {
    return raw
      .map((item) => {
        const postId = Number(item?.post_id ?? item?.postId);
        if (!Number.isFinite(postId)) return null;
        return {
          chunkId: String(item?.chunk_id ?? item?.chunkId ?? ""),
          postId,
          text: typeof item?.text === "string" ? item.text : null,
          metadata:
            item?.metadata && typeof item.metadata === "object"
              ? item.metadata
              : {},
          score: Number.isFinite(item?.score) ? Number(item.score) : 0,
        } as SemanticSearchResult;
      })
      .filter(Boolean) as SemanticSearchResult[];
  }

  static async search(
    params: SemanticSearchParams,
    onStatusUpdate?: (status: string) => void
  ): Promise<SemanticSearchResponse> {
    const q = params.query.trim();
    if (!q) throw new Error("Enter a search query to continue.");

    const { serverUrlRaw, libraryId } = await this.buildSearchConfig();
    const k = this.resolveK(params.k);
    const chunkType = params.chunkType ?? DEFAULT_CHUNK_TYPE;
    const baseUrl = normaliseServerUrl(serverUrlRaw);

    const payload = {
      query: q,
      chunk_type: chunkType,
      k,
      library_id: libraryId,
    };

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/search/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      const message = err?.message || "Network request failed";
      throw new Error(`Search request failed: ${message}`);
    }

    let data: any = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      const detail = data?.detail || response.statusText || "Unknown error";
      throw new Error(`Search failed (${response.status}): ${detail}`);
    }

    const jobId = data?.job_id ?? data?.jobId;
    if (!jobId) {
      throw new Error("Search failed: server did not return a job id.");
    }

    const job = await this.pollSearchJob(baseUrl, jobId, onStatusUpdate);
    const rawResults: any[] = Array.isArray(job?.results) ? job.results : [];

    return {
      query: q,
      k,
      chunkType,
      results: this.mapResults(rawResults),
    };
  }

  private static async pollSearchJob(
    baseUrl: string,
    jobId: string,
    onStatusUpdate?: (status: string) => void
  ): Promise<any> {
    const deadline = Date.now() + SEARCH_POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/search/${jobId}`);
      } catch (err: any) {
        const message = err?.message || "Network request failed";
        throw new Error(`Search polling failed: ${message}`);
      }

      let data: any = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        const detail = data?.detail || response.statusText || "Unknown error";
        throw new Error(`Search polling failed (${response.status}): ${detail}`);
      }

      const status = data?.status;
      if (status && onStatusUpdate) {
        const statusLabel = this.getStatusLabel(status);
        onStatusUpdate(statusLabel);
      }

      if (data?.status === "complete") return data;
      if (data?.status === "failed") {
        throw new Error(data?.error || "Search job failed.");
      }

      await new Promise((resolve) => setTimeout(resolve, SEARCH_POLL_INTERVAL_MS));
    }

    throw new Error("Search timed out waiting for results.");
  }

  private static getStatusLabel(status: string): string {
    switch (status) {
      case "embedding":
        return "Embedding...";
      case "searching":
        return "Searching...";
      case "complete":
        return "Complete";
      case "failed":
        return "Failed";
      default:
        return status;
    }
  }

  static async similar(
    params: SimilarSearchParams
  ): Promise<SimilarSearchResponse> {
    const postId = Number(params.postId);
    if (!Number.isFinite(postId) || postId <= 0) {
      throw new Error("Valid post ID required to search for similar posts.");
    }

    const { serverUrlRaw, libraryId } = await this.buildSearchConfig();
    const k = this.resolveK(params.k);
    const chunkType = params.chunkType ?? DEFAULT_CHUNK_TYPE;

    const payload = {
      post_id: postId,
      chunk_type: chunkType,
      k,
      library_id: libraryId,
    };

    let response: Response;
    try {
      response = await fetch(`${normaliseServerUrl(serverUrlRaw)}/search/similar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      const message = err?.message || "Network request failed";
      throw new Error(`Similar request failed: ${message}`);
    }

    let data: any = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      const detail = data?.detail || response.statusText || "Unknown error";
      throw new Error(`Similar search failed (${response.status}): ${detail}`);
    }

    const rawResults: any[] = Array.isArray(data?.results) ? data.results : [];

    return {
      postId: Number.isFinite(data?.post_id) ? Number(data.post_id) : postId,
      chunkType: (data?.chunk_type as ChunkType) ?? chunkType,
      chunksAveraged: Number.isFinite(data?.chunks_averaged)
        ? Number(data.chunks_averaged)
        : 0,
      results: this.mapResults(rawResults),
    };
  }
}
