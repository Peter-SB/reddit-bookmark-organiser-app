import {
  DEFAULT_SEARCH_INCLUDE_TEXT,
  DEFAULT_SEARCH_RESULTS,
} from "@/constants/search";
import {
  DEFAULT_EMBED_MODEL,
  DEFAULT_SYNC_TABLE,
  SYNC_CHUNK_TABLE_KEY,
  SYNC_EMBED_MODEL_KEY,
  SYNC_SERVER_URL_KEY,
  SYNC_TABLE_NAME_KEY,
} from "@/constants/sync";
import { SettingsRepository } from "@/repository/SettingsRepository";

export type SemanticSearchParams = {
  query: string;
  k?: number;
  includeText?: boolean;
};

export type SemanticSearchResult = {
  postId: number;
  text?: string | null;
  metadata: Record<string, any>;
};

export type SemanticSearchResponse = {
  query: string;
  k: number;
  results: SemanticSearchResult[];
};

const normaliseServerUrl = (raw: string) => {
  const trimmed = raw.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
};

const resolveChunkTable = (
  settings: Record<string, string>,
  embeddingModel: string,
  tableName: string
) => {
  const explicit = settings[SYNC_CHUNK_TABLE_KEY];
  if (explicit && explicit.trim()) return explicit.trim();
  return `chunk_${embeddingModel}_${tableName}`;
};

export class SemanticSearchService {
  static async search(
    params: SemanticSearchParams
  ): Promise<SemanticSearchResponse> {
    const q = params.query.trim();
    if (!q) throw new Error("Enter a search query to continue.");

    const settings = await SettingsRepository.getSettings([
      SYNC_SERVER_URL_KEY,
      SYNC_TABLE_NAME_KEY,
      SYNC_EMBED_MODEL_KEY,
      SYNC_CHUNK_TABLE_KEY,
    ]);

    const serverUrlRaw = (settings[SYNC_SERVER_URL_KEY] || "").trim();
    if (!serverUrlRaw) {
      throw new Error(
        "Sync server URL not configured. Set it in Settings > Sync Server."
      );
    }

    const tableName =
      (settings[SYNC_TABLE_NAME_KEY] || DEFAULT_SYNC_TABLE).trim() ||
      DEFAULT_SYNC_TABLE;
    const embeddingModel =
      (settings[SYNC_EMBED_MODEL_KEY] || DEFAULT_EMBED_MODEL).trim() ||
      DEFAULT_EMBED_MODEL;
    const chunkTable = resolveChunkTable(settings, embeddingModel, tableName);

    const kRaw =
      typeof params.k === "number"
        ? params.k
        : parseInt(String(params.k ?? DEFAULT_SEARCH_RESULTS), 10);
    const k = Number.isFinite(kRaw) && kRaw > 0 ? kRaw : DEFAULT_SEARCH_RESULTS;

    const payload = {
      q,
      k,
      embedding_profile: embeddingModel,
      table_name: chunkTable,
      include_text: params.includeText ?? DEFAULT_SEARCH_INCLUDE_TEXT,
    };

    let response: Response;
    try {
      response = await fetch(`${normaliseServerUrl(serverUrlRaw)}/search`, {
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

    const rawResults: any[] = Array.isArray(data?.results) ? data.results : [];
    const results: SemanticSearchResult[] = rawResults
      .map((item) => {
        const postId = Number(item?.post_id ?? item?.postId);
        if (!Number.isFinite(postId)) return null;
        return {
          postId,
          text: typeof item?.text === "string" ? item.text : null,
          metadata: item?.metadata && typeof item.metadata === "object"
            ? item.metadata
            : {},
        } as SemanticSearchResult;
      })
      .filter(Boolean) as SemanticSearchResult[];

    return {
      query: typeof data?.query === "string" ? data.query : q,
      k: Number.isFinite(data?.k) ? data.k : k,
      results,
    };
  }
}
