import { PostListItem } from '@/models/models';

/**
 * Builds a minimal valid PostListItem for use in hook / filter unit tests.
 * Override any field by spreading: { ...makePost(1), isFavorite: true }
 */
export function makePost(id: number, overrides: Partial<PostListItem> = {}): PostListItem {
  return {
    id,
    redditId: `reddit_${id}`,
    url: `https://reddit.com/r/test/${id}`,
    title: `Post ${id}`,
    author: 'testuser',
    subreddit: 'test',
    redditCreatedAt: new Date('2024-01-01T00:00:00Z'),
    addedAt: new Date(`2024-01-${String(id).padStart(2, '0')}T00:00:00Z`),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    isRead: false,
    isFavorite: false,
    isArchived: false,
    queuedAt: null,
    readAt: null,
    folderIds: [],
    wordCount: 100,
    ...overrides,
  };
}
