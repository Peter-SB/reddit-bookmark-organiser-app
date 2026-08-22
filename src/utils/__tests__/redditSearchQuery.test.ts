import {
  buildRedditSearchQuery,
  tokenizeQueryInput,
  MAX_QUERY_LENGTH,
} from '../redditSearchQuery';

describe('tokenizeQueryInput', () => {
  it('splits on whitespace', () => {
    expect(tokenizeQueryInput('one two three')).toEqual(['one', 'two', 'three']);
  });

  it('keeps a quoted phrase as one token', () => {
    expect(tokenizeQueryInput('cast iron "dutch oven"')).toEqual([
      'cast',
      'iron',
      '"dutch oven"',
    ]);
  });

  it('collapses runs of whitespace', () => {
    expect(tokenizeQueryInput('  one   two  ')).toEqual(['one', 'two']);
  });

  it('returns an empty array for an empty string', () => {
    expect(tokenizeQueryInput('')).toEqual([]);
  });
});

describe('buildRedditSearchQuery', () => {
  it('passes plain terms through', () => {
    expect(buildRedditSearchQuery({ terms: 'cast iron' })).toBe('cast iron');
  });

  it('preserves quoted phrases', () => {
    expect(buildRedditSearchQuery({ terms: '"dutch oven" seasoning' })).toBe(
      '"dutch oven" seasoning',
    );
  });

  it('negates each exclude token', () => {
    expect(
      buildRedditSearchQuery({ terms: 'recipe', exclude: 'vegan keto' }),
    ).toBe('recipe -vegan -keto');
  });

  it('negates a quoted exclude phrase as a single term', () => {
    expect(
      buildRedditSearchQuery({ terms: 'recipe', exclude: '"slow cooker"' }),
    ).toBe('recipe -"slow cooker"');
  });

  it('does not double up a leading "-" the user typed', () => {
    expect(buildRedditSearchQuery({ terms: 'recipe', exclude: '-vegan' })).toBe(
      'recipe -vegan',
    );
  });

  it('wraps multi-word terms in title:(...) when titleOnly is set', () => {
    expect(
      buildRedditSearchQuery({ terms: 'cast iron', titleOnly: true }),
    ).toBe('title:(cast iron)');
  });

  it('uses the bare field qualifier for a single title-only term', () => {
    expect(buildRedditSearchQuery({ terms: 'recipe', titleOnly: true })).toBe(
      'title:recipe',
    );
  });

  it('appends self:yes for text posts only', () => {
    expect(buildRedditSearchQuery({ terms: 'recipe', selfOnly: true })).toBe(
      'recipe self:yes',
    );
  });

  it('combines title-only, exclude and self:yes', () => {
    expect(
      buildRedditSearchQuery({
        terms: 'cast iron',
        exclude: 'vegan',
        titleOnly: true,
        selfOnly: true,
      }),
    ).toBe('title:(cast iron) -vegan self:yes');
  });

  it('adds author and excluded author qualifiers', () => {
    expect(
      buildRedditSearchQuery({
        terms: 'recipe',
        author: 'u/someone',
        excludeAuthor: 'AutoModerator',
      }),
    ).toBe('recipe author:someone -author:AutoModerator');
  });

  it('returns an empty string when nothing is set', () => {
    expect(buildRedditSearchQuery({ terms: '   ' })).toBe('');
  });

  it('still builds a valid query from filters alone, with no terms', () => {
    expect(buildRedditSearchQuery({ terms: '', selfOnly: true })).toBe(
      'self:yes',
    );
  });

  it('clamps an over-long query on a whitespace boundary', () => {
    const terms = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ');
    const query = buildRedditSearchQuery({ terms });
    expect(query.length).toBeLessThanOrEqual(MAX_QUERY_LENGTH);
    expect(query.endsWith(' ')).toBe(false);
    // The cut must not leave a half-written token.
    expect(terms.split(' ')).toContain(query.split(' ').pop());
  });
});
