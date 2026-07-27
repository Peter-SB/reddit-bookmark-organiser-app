import { parseSubredditNames, joinSubredditNames } from '../subredditNames';

describe('parseSubredditNames', () => {
  it('returns a single-element array for a plain subreddit name', () => {
    expect(parseSubredditNames('memes')).toEqual(['memes']);
  });

  it('splits a "+"-joined combined feed name into individual names', () => {
    expect(parseSubredditNames('memes+aww+funny')).toEqual(['memes', 'aww', 'funny']);
  });

  it('trims whitespace around each name', () => {
    expect(parseSubredditNames(' memes + aww ')).toEqual(['memes', 'aww']);
  });

  it('drops empty segments from stray "+" characters', () => {
    expect(parseSubredditNames('memes++aww+')).toEqual(['memes', 'aww']);
  });

  it('returns an empty array for an empty string', () => {
    expect(parseSubredditNames('')).toEqual([]);
  });

  it('returns an empty array for a string of only "+" characters', () => {
    expect(parseSubredditNames('+++')).toEqual([]);
  });
});

describe('joinSubredditNames', () => {
  it('joins multiple names with "+"', () => {
    expect(joinSubredditNames(['memes', 'aww', 'funny'])).toBe('memes+aww+funny');
  });

  it('returns the single name unchanged for a one-element array', () => {
    expect(joinSubredditNames(['memes'])).toBe('memes');
  });

  it('returns an empty string for an empty array', () => {
    expect(joinSubredditNames([])).toBe('');
  });
});

describe('parseSubredditNames / joinSubredditNames round-trip', () => {
  it('joining then parsing recovers the original list', () => {
    const names = ['memes', 'aww', 'funny'];
    expect(parseSubredditNames(joinSubredditNames(names))).toEqual(names);
  });
});
