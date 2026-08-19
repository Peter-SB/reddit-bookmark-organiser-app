import { buildSavedLibraryIndex } from '@/utils/savedLibraryIndex';
import { makePost } from '@/hooks/__tests__/test_post_helpers';

describe('buildSavedLibraryIndex', () => {
  describe('author stats', () => {
    it('averages ratings across read posts only', () => {
      const { authorStats } = buildSavedLibraryIndex([
        makePost(1, { author: 'alice', isRead: true, rating: 4 }),
        makePost(2, { author: 'alice', isRead: true, rating: 2 }),
        // Unread posts are rated but must not count towards the average
        makePost(3, { author: 'alice', isRead: false, rating: 5 }),
        // Read but unrated
        makePost(4, { author: 'alice', isRead: true }),
      ]);

      expect(authorStats.get('alice')).toEqual({
        readAvgRating: 3,
        ratedReadCount: 2,
        activeCount: 4,
      });
    });

    it('returns a null average when the author has no rated read posts', () => {
      const { authorStats } = buildSavedLibraryIndex([
        makePost(1, { author: 'bob', isRead: false, rating: 5 }),
      ]);

      expect(authorStats.get('bob')?.readAvgRating).toBeNull();
      expect(authorStats.get('bob')?.activeCount).toBe(1);
    });

    it('excludes archived and deleted posts from the active count', () => {
      const { authorStats } = buildSavedLibraryIndex([
        makePost(1, { author: 'carol' }),
        makePost(2, { author: 'carol', isArchived: true }),
        makePost(3, { author: 'carol', isDeleted: true }),
      ]);

      expect(authorStats.get('carol')?.activeCount).toBe(1);
    });

    it('keys authors case-insensitively and skips placeholder authors', () => {
      const { authorStats } = buildSavedLibraryIndex([
        makePost(1, { author: 'Dave' }),
        makePost(2, { author: 'dave' }),
        makePost(3, { author: '[deleted]' }),
        makePost(4, { author: '' }),
      ]);

      expect(authorStats.get('dave')?.activeCount).toBe(2);
      expect(authorStats.has('[deleted]')).toBe(false);
      expect(authorStats.has('')).toBe(false);
    });

    it('still counts an archived post towards the read rating average', () => {
      const { authorStats } = buildSavedLibraryIndex([
        makePost(1, { author: 'erin', isRead: true, rating: 5, isArchived: true }),
      ]);

      expect(authorStats.get('erin')).toEqual({
        readAvgRating: 5,
        ratedReadCount: 1,
        activeCount: 0,
      });
    });
  });

  describe('saved post lookups', () => {
    it('indexes every post by reddit id, including deleted ones', () => {
      const posts = [
        makePost(1, { redditId: 'aaa' }),
        makePost(2, { redditId: 'bbb', isDeleted: true }),
      ];
      const { savedRedditIds, postByRedditId } = buildSavedLibraryIndex(posts);

      expect([...savedRedditIds]).toEqual(['aaa', 'bbb']);
      expect(postByRedditId.get('aaa')).toBe(posts[0]);
    });

    it('collects titles only for the browsed subreddits, normalised', () => {
      const { titlesInSubreddits } = buildSavedLibraryIndex(
        [
          makePost(1, { subreddit: 'Books', title: '  A Great Read  ' }),
          makePost(2, { subreddit: 'movies', title: 'Watched This' }),
          makePost(3, { subreddit: 'other', title: 'Not Included' }),
        ],
        ['books', 'MOVIES'],
      );

      expect(titlesInSubreddits.has('a great read')).toBe(true);
      expect(titlesInSubreddits.has('watched this')).toBe(true);
      expect(titlesInSubreddits.has('not included')).toBe(false);
    });

    it('collects no titles when no subreddits are given', () => {
      const { titlesInSubreddits } = buildSavedLibraryIndex([
        makePost(1, { subreddit: 'books', title: 'A Great Read' }),
      ]);

      expect(titlesInSubreddits.size).toBe(0);
    });
  });
});
