import { DEFAULT_CHUNK_TYPE, DEFAULT_SEARCH_RESULTS } from "@/constants/search";
import { DEFAULT_LIBRARY_ID, SYNC_LIBRARY_ID_KEY } from "@/constants/sync";
import { SearchHistoryRepository } from "@/repository/SearchHistoryRepository";
import { SettingsRepository } from "@/repository/SettingsRepository";
import {
  SemanticSearchParams,
  SemanticSearchService,
} from "@/services/SemanticSearchService";

// Runs the search in the background (independent of any screen's lifecycle) so the
// caller can close the entry modal immediately and check back on status later.
export class SearchHistoryService {
  static async startSearch(params: SemanticSearchParams): Promise<number> {
    const repo = await SearchHistoryRepository.create();
    const settings = await SettingsRepository.getSettings([SYNC_LIBRARY_ID_KEY]);
    const libraryId =
      (settings[SYNC_LIBRARY_ID_KEY] || DEFAULT_LIBRARY_ID).trim() ||
      DEFAULT_LIBRARY_ID;

    const id = await repo.createEntry({
      query: params.query.trim(),
      chunkType: params.chunkType ?? DEFAULT_CHUNK_TYPE,
      k: params.k ?? DEFAULT_SEARCH_RESULTS,
      libraryId,
    });

    SemanticSearchService.search(params, async (status) => {
      await repo.updatePollStatus(id, status);
    })
      .then((res) => repo.markComplete(id, res.results))
      .catch((err: any) => repo.markError(id, err?.message || "Search failed"));

    return id;
  }
}
