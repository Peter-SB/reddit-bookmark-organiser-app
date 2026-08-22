/**
 * Builds the `q` string for Reddit's search endpoint from the fields of the
 * subreddit search form.
 *
 * Reddit's search syntax is Lucene-ish: bare words are ANDed, `"quoted
 * phrases"` match exactly, `-word` excludes, and `field:value` restricts a
 * match to one field. Score and date-range filtering are deliberately absent —
 * the old `syntax=cloudsearch` form (`score:100..`, `timestamp:…`) was removed
 * from Reddit's search backend, so those stay client-side.
 */

/** Reddit rejects queries longer than this. */
export const MAX_QUERY_LENGTH = 512;

export interface RedditSearchQueryParts {
  /** Free text, may contain "quoted phrases". */
  terms: string;
  /** Space-separated words/phrases to negate. */
  exclude?: string;
  /** Match `terms` against the title only, rather than title + body. */
  titleOnly?: boolean;
  /** Self (text) posts only — drops link posts server-side. */
  selfOnly?: boolean;
  /**
   * Author include/exclude. Not surfaced in the form yet; kept here so adding
   * the fields later is a UI change only.
   */
  author?: string;
  excludeAuthor?: string;
}

/**
 * Splits on whitespace but keeps "quoted phrases" as single tokens. Trailing
 * unbalanced quotes are treated as ordinary characters so a half-typed phrase
 * still searches for something sensible.
 */
export function tokenizeQueryInput(input: string): string[] {
  const matches = (input ?? '').match(/"[^"]*"|\S+/g);
  if (!matches) return [];
  return matches.map((t) => t.trim()).filter((t) => t && t !== '"' && t !== '""');
}

/** Wraps a value in quotes if it contains whitespace and isn't already quoted. */
function quoteIfNeeded(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) return value;
  return /\s/.test(value) ? `"${value}"` : value;
}

/** Trims to MAX_QUERY_LENGTH on a whitespace boundary rather than mid-token. */
function clampLength(query: string): string {
  if (query.length <= MAX_QUERY_LENGTH) return query;
  const cut = query.slice(0, MAX_QUERY_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
}

export function buildRedditSearchQuery(parts: RedditSearchQueryParts): string {
  const segments: string[] = [];

  const termTokens = tokenizeQueryInput(parts.terms);
  if (termTokens.length > 0) {
    const joined = termTokens.join(' ');
    // title:(a b) keeps the whole term group inside the field qualifier —
    // title:a b would only restrict the first word.
    segments.push(
      parts.titleOnly
        ? termTokens.length > 1
          ? `title:(${joined})`
          : `title:${joined}`
        : joined,
    );
  }

  for (const token of tokenizeQueryInput(parts.exclude ?? '')) {
    // Strip any leading "-" the user typed themselves so we never emit "--".
    const bare = token.replace(/^-+/, '');
    if (bare) segments.push(`-${bare}`);
  }

  if (parts.selfOnly) segments.push('self:yes');

  const author = parts.author?.trim().replace(/^u\//i, '');
  if (author) segments.push(`author:${quoteIfNeeded(author)}`);

  const excludeAuthor = parts.excludeAuthor?.trim().replace(/^u\//i, '');
  if (excludeAuthor) segments.push(`-author:${quoteIfNeeded(excludeAuthor)}`);

  return clampLength(segments.join(' '));
}
