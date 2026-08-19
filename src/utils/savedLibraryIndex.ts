import { PostListItem } from "@/models/models";

/** Saved-library statistics for a single author, derived from the post list. */
export interface AuthorPostStats {
  /** Average star rating across the author's read *and* rated posts (null if none) */
  readAvgRating: number | null;
  /** How many read posts contributed to readAvgRating */
  ratedReadCount: number;
  /** Saved posts that are neither deleted nor archived */
  activeCount: number;
}

/** Everything the subreddit browse screen needs to know about the saved library. */
export interface SavedLibraryIndex {
  /** Reddit IDs of saved posts — drives the "already added" tick */
  savedRedditIds: Set<string>;
  /** Saved post by Reddit ID, so a tapped row can open the local copy */
  postByRedditId: Map<string, PostListItem>;
  /** Author stats keyed by lowercased username */
  authorStats: Map<string, AuthorPostStats>;
  /** Trimmed, lowercased titles already saved from the browsed subreddit(s) */
  titlesInSubreddits: Set<string>;
}

/**
 * Builds every saved-library lookup the browse screen needs in a single pass.
 *
 * The library can hold thousands of posts and the whole list is rebuilt
 * whenever it reloads, so this deliberately walks it once rather than running
 * one map/filter per lookup.
 *
 * `posts` is expected to be the shared post list (already excludes deleted
 * posts); any deleted item that does slip through is ignored, as are archived
 * posts for `activeCount`, so that count reflects posts still in rotation.
 */
export function buildSavedLibraryIndex(
  posts: PostListItem[],
  subredditNames: string[] = [],
): SavedLibraryIndex {
  const savedRedditIds = new Set<string>();
  const postByRedditId = new Map<string, PostListItem>();
  const titlesInSubreddits = new Set<string>();
  const authorTotals = new Map<
    string,
    { ratingSum: number; ratedReadCount: number; activeCount: number }
  >();
  const targetSubreddits = new Set(
    subredditNames.map((name) => name.toLowerCase()),
  );

  for (const post of posts) {
    savedRedditIds.add(post.redditId);
    postByRedditId.set(post.redditId, post);

    if (
      post.title &&
      targetSubreddits.has((post.subreddit || "").toLowerCase())
    ) {
      titlesInSubreddits.add(post.title.trim().toLowerCase());
    }

    const author = (post.author || "").trim().toLowerCase();
    if (!author || author === "[deleted]" || post.isDeleted) continue;

    let totals = authorTotals.get(author);
    if (!totals) {
      totals = { ratingSum: 0, ratedReadCount: 0, activeCount: 0 };
      authorTotals.set(author, totals);
    }

    if (!post.isArchived) totals.activeCount += 1;
    if (post.isRead && post.rating) {
      totals.ratingSum += post.rating;
      totals.ratedReadCount += 1;
    }
  }

  const authorStats = new Map<string, AuthorPostStats>();
  for (const [author, totals] of authorTotals) {
    authorStats.set(author, {
      readAvgRating:
        totals.ratedReadCount > 0
          ? totals.ratingSum / totals.ratedReadCount
          : null,
      ratedReadCount: totals.ratedReadCount,
      activeCount: totals.activeCount,
    });
  }

  return { savedRedditIds, postByRedditId, authorStats, titlesInSubreddits };
}
