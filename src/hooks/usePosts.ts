// src/hooks/usePosts.ts
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { Post, PostListItem } from '@/models/models';
import { PostRepository } from '@/repository/PostRepository';
import { MinHashService } from '@/services/MinHashService';
import { useCallback, useEffect, useRef, useState } from 'react';

export type HandleAddPostOptions = {
  getPostData: (url: string) => Promise<Post>;
  syncSinglePost: (postId: number) => Promise<unknown>;
  onBeforeAdd?: () => void;
  onSuccess?: (post: Post) => void | Promise<void>;
  onError?: (error: Error) => void;
  onDuplicateFound?: (duplicates: PostListItem[], proceed: () => void) => void;
  onSimilarFound?: (similarPosts: Post[], proceed: () => void) => void;
  /** Called when the URL matches a post that was previously soft-deleted. */
  onFoundDeleted?: (post: Post, proceed: () => void) => void;
  similarityThreshold?: number;
  skipDuplicateCheck?: boolean;
  skipSimilarCheck?: boolean;
  /** When true, the post is added with isArchived = true after all dedup checks pass. */
  addToArchive?: boolean;
};

export interface UsePostsResult {
  posts: PostListItem[]; // Lightweight list items for rendering post cards.
  loading: boolean;
  refreshPosts: () => Promise<void>;
  /** Re-query only if the shared list is older than maxAgeMs. See refreshPostsIfStale. */
  refreshPostsIfStale: (maxAgeMs: number) => Promise<void>;
  addPost: (postData: Omit<Post, 'id'>) => Promise<Post>;
  handleAddPost: (url: string, options: HandleAddPostOptions) => Promise<void>;
  updatePost: (post: Post) => Promise<Post>;
  deletePost: (id: number) => Promise<void>;
  toggleDelete: (id: number) => Promise<boolean>;
  getDeletedPosts: () => Promise<PostListItem[]>;
  toggleRead: (id: number) => Promise<void>;
  toggleFavorite: (id: number) => Promise<void>;
  toggleArchive: (id: number) => Promise<void>;
  toggleQueue: (id: number) => Promise<void>;
  checkForSimilarPosts: (bodyText: string, threshold?: number) => Promise<Post[]>;
  setFolders: (postId: number, newFolderIds: number[]) => Promise<void>;
  recomputeMissingMinHashes: () => Promise<number>;
  getPostById: (id: number) => Promise<Post | null>;
}

// Module-level shared state so all usePosts() instances share one copy.
// This prevents duplicate DB loads across screens.
let sharedPosts: PostListItem[] = [];
let sharedLoading = true;
/** When sharedPosts was last re-queried from the DB (0 = never). */
let sharedLoadedAt = 0;
let sharedRepo: PostRepository | null = null;
let sharedInitPromise: Promise<void> | null = null;
/** Listeners notified on full list reloads (add, delete, initial load). */
const listeners = new Set<() => void>();
/** Listeners notified on single-item mutations (toggles, field updates). */
const itemUpdateListeners = new Set<(item: PostListItem) => void>();

function notifyListeners() {
  for (const fn of listeners) fn();
}

function notifyWithItemUpdate(item: PostListItem) {
  for (const fn of itemUpdateListeners) fn(item);
}

export function resetSharedPostsState() {
  sharedRepo = null;
  sharedInitPromise = null;
  sharedPosts = [];
  sharedLoading = true;
  sharedLoadedAt = 0;
  notifyListeners();
}
async function initSharedRepo(): Promise<PostRepository> {
  if (sharedRepo) return sharedRepo;
  if (!sharedInitPromise) {
    sharedInitPromise = (async () => {
      sharedRepo = await PostRepository.create();
    })();
  }
  await sharedInitPromise;
  return sharedRepo!;
}

/**
 * Trigger a full list re-query in all subscribed useFilteredPosts instances.
 * Use after mutations that affect list membership but aren't tracked via notifyWithItemUpdate
 * (e.g. place marker changes that affect PlaceMarkerAt ordering).
 */
export function notifyPostChanges(): void {
  notifyListeners();
}

/**
 * Subscribe to shared post-list change notifications (loads, mutations).
 * Returns an unsubscribe function. Used by useFilteredPosts.
 */
export function subscribeToPostChanges(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Subscribe to single-item updates (fav/queue/read/archive toggles).
 * Allows useFilteredPosts to update in-place without a full DB re-query.
 */
export function subscribeToItemUpdates(fn: (item: PostListItem) => void): () => void {
  itemUpdateListeners.add(fn);
  return () => itemUpdateListeners.delete(fn);
}

/** Exposed so sibling hooks can share the same DB connection. */
export { initSharedRepo };

/** @internal Test-only: inject a pre-built repo so tests don't call PostRepository.create(). */
export function setSharedRepoForTesting(repo: PostRepository): void {
  sharedRepo = repo;
  sharedInitPromise = null;
}

async function sharedLoadPosts(r?: PostRepository): Promise<void> {
  console.debug('Loading posts...');
  sharedLoading = true;
  notifyListeners();
  const repository = r ?? sharedRepo;
  if (!repository) return;
  const all = await repository.getAllListItems();
  sharedPosts = all;
  sharedLoading = false;
  sharedLoadedAt = Date.now();
  notifyListeners();
}

export function usePosts(): UsePostsResult {
  const [, forceRender] = useState(0);
  const mountedRef = useRef(true);

  // Subscribe to shared state changes
  useEffect(() => {
    mountedRef.current = true;
    const listener = () => {
      if (mountedRef.current) {
        forceRender(c => c + 1);
      }
    };
    listeners.add(listener);

    // Initialize on first subscriber
    if (!sharedRepo && !sharedInitPromise) {
      (async () => {
        const r = await initSharedRepo();
        await sharedLoadPosts(r);
      })();
    }

    return () => {
      mountedRef.current = false;
      listeners.delete(listener);
    };
  }, []);

  const refreshPosts = useCallback(async () => {
    await initSharedRepo();
    await sharedLoadPosts();
  }, []);

  /**
   * Refresh only if the shared list hasn't been re-queried within maxAgeMs.
   *
   * Reloading pulls every non-deleted post out of SQLite and re-renders every
   * subscriber, which is wasted work on screens that refresh on focus. In-app
   * mutations already update the shared list optimistically, so a re-query only
   * matters for writes made outside it (e.g. background sync).
   */
  const refreshPostsIfStale = useCallback(async (maxAgeMs: number) => {
    if (sharedLoadedAt > 0 && Date.now() - sharedLoadedAt < maxAgeMs) {
      console.debug(
        `Skipping post refresh — list is ${Date.now() - sharedLoadedAt}ms old (max ${maxAgeMs}ms)`,
      );
      return;
    }
    await initSharedRepo();
    await sharedLoadPosts();
  }, []);

  const getPostById = useCallback(async (id: number): Promise<Post | null> => {
    const repo = await initSharedRepo();
    // Use getByIdAny so deleted posts can also be viewed (e.g. from the deleted list)
    return repo.getByIdAny(id);
  }, []);

  const checkForSimilarPosts = useCallback(async (bodyText: string, threshold: number = 0.75): Promise<Post[]> => {
    const repo = await initSharedRepo();
    console.debug('Checking for similar posts with threshold:', threshold);
    return await repo.findSimilarPosts(bodyText, threshold);
  }, []);

  const addPost = useCallback(async (data: Omit<Post, 'id'>) => {
    const repo = await initSharedRepo();
    const id = await repo.create(data);
    const newPost = await repo.getById(id);
    // Reload list to include the new post
    await sharedLoadPosts();
    if (!newPost) throw new Error('Failed to load new post');
    return newPost;
  }, []);

  const handleAddPost = useCallback(async (url: string, options: HandleAddPostOptions) => {
    const {
      getPostData,
      syncSinglePost,
      onBeforeAdd,
      onSuccess,
      onError,
      onDuplicateFound,
      onSimilarFound,
      onFoundDeleted,
      similarityThreshold = 0.8,
      skipDuplicateCheck = false,
      skipSimilarCheck = false,
      addToArchive = false,
    } = options;

    const reportError = (err: Error) => {
      if (onError) {
        onError(err);
        return;
      }
      Alert.alert('Error', `Failed to add post: ${err.message}`);
    };

    const defaultDuplicatePrompt = (duplicates: PostListItem[], _proceed: () => void) => {
      Alert.alert(
        'Duplicate Post',
        'This post has already been added.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go To Post',
            onPress: () => router.push(`/post/${duplicates[0].id}` as any),
          },
        ],
      );
    };

    const defaultFoundDeletedPrompt = (post: Post, _proceed: () => void) => {
      Alert.alert(
        'Post Found',
        'This post was previously deleted. Would you like to go to it?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go To Post',
            onPress: () => router.push(`/post/${post.id}` as any),
          },
        ],
      );
    };

    const defaultSimilarPrompt = (similarPosts: Post[], _proceed: () => void) => {
      const similarTitles = similarPosts
        .slice(0, 2)
        .map((p) => `"${p.title}"`)
        .join('\n');
      Alert.alert(
        'Similar Content Found',
        `Found ${similarPosts.length} post(s) with similar content:\n\n${similarTitles}${
          similarPosts.length > 3 ? '\n...and more' : ''
        }`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go To Post',
            onPress: () => router.push(`/post/${similarPosts[0].id}` as any),
          },
          {
            text: 'Add Anyway',
            onPress: () => _proceed(),
          },
        ],
      );
    };

    try {
      const postData = await getPostData(url);
      const repo = await initSharedRepo();

      const addAndSync = async () => {
        const created = await addPost(addToArchive ? { ...postData, isArchived: true } : postData);
        onBeforeAdd?.();
        await syncSinglePost(created.id);
        if (onSuccess) {
          await onSuccess(created);
        }
      };
      const safeAddAndSync = () => 
        addAndSync().catch((err) => {
          console.error('Failed to add post:', err);
          reportError(err as Error);
        });

      // Check DB for exact duplicate by redditId — includes deleted and archived posts
      const dbDuplicate = skipDuplicateCheck
        ? null
        : await repo.getByRedditIdAny(postData.redditId);

      if (!skipDuplicateCheck && dbDuplicate) {
        // Deleted duplicate: prompt to view the existing post since it won't appear in the main list
        if (dbDuplicate.isDeleted) {
          (onFoundDeleted ?? defaultFoundDeletedPrompt)(dbDuplicate, safeAddAndSync);
          return;
        }
        // Non-deleted duplicate: find the PostListItem for the callback
        const exactDuplicates = sharedPosts.filter((p) => p.redditId === postData.redditId);
        const dupeList = exactDuplicates.length > 0
          ? exactDuplicates
          : [{ ...dbDuplicate, wordCount: 0 } as PostListItem];
        (onDuplicateFound ?? defaultDuplicatePrompt)(dupeList, safeAddAndSync);
        return;
      }

      const similarPosts = skipSimilarCheck
        ? []
        : await checkForSimilarPosts(postData.bodyText || '', similarityThreshold);

      if (!skipSimilarCheck && similarPosts.length > 0) {
        (onSimilarFound ?? defaultSimilarPrompt)(similarPosts, safeAddAndSync);
        return;
      }

      await addAndSync();
    } catch (err) {
      console.error('Failed to add post:', err);
      reportError(err as Error);
    }
  }, [addPost, checkForSimilarPosts]);

  const updatePost = useCallback(async (post: Post) => {
    const repo = await initSharedRepo();
    await repo.update(post);
    const updated = await repo.getById(post.id);
    if (!updated) throw new Error('Failed to load updated post');

    // Optimistic: merge updated fields into the shared list
    sharedPosts = sharedPosts.map(p =>
      p.id === updated.id
        ? {
            ...p,
            title: updated.title,
            customTitle: updated.customTitle,
            notes: updated.notes,
            rating: updated.rating,
            isRead: updated.isRead,
            isFavorite: updated.isFavorite,
            readAt: updated.readAt,
            queuedAt: updated.queuedAt,
            updatedAt: updated.updatedAt,
            folderIds: updated.folderIds,
          }
        : p
    );
    notifyListeners();
    return updated;
  }, []);

  const deletePost = useCallback(async (id: number) => {
    const repo = await initSharedRepo();
    await repo.delete(id);

    // Optimistic: remove from local list
    sharedPosts = sharedPosts.filter(p => p.id !== id);
    notifyListeners();
  }, []);

  const toggleDelete = useCallback(async (id: number): Promise<boolean> => {
    const repo = await initSharedRepo();
    const nowDeleted = await repo.toggleDeletedById(id);
    if (nowDeleted) {
      // Optimistic: remove from active list
      sharedPosts = sharedPosts.filter(p => p.id !== id);
    } else {
      // Restored: trigger a full reload so the post re-appears in the main list
      await sharedLoadPosts();
    }
    notifyListeners();
    return nowDeleted;
  }, []);

  const getDeletedPosts = useCallback(async (): Promise<PostListItem[]> => {
    const repo = await initSharedRepo();
    return repo.getDeletedListItems();
  }, []);

  const toggleRead = useCallback(async (id: number) => {
    console.debug('Toggling read status for post:', id);
    const repo = await initSharedRepo();
    const newIsRead = await repo.toggleReadById(id);

    // Optimistic: update local state without reloading
    sharedPosts = sharedPosts.map(p =>
      p.id === id
        ? { ...p, isRead: newIsRead, readAt: newIsRead ? new Date() : p.readAt, updatedAt: new Date() }
        : p
    );
    const updatedRead = sharedPosts.find(p => p.id === id);
    if (updatedRead) notifyWithItemUpdate(updatedRead);
  }, []);

  const toggleFavorite = useCallback(async (id: number) => {
    console.debug('Toggling favorite status for post:', id);
    const repo = await initSharedRepo();
    const { isFavorite: newIsFavorite, queuedAt: newQueuedAt } = await repo.toggleFavoriteById(id);

    // Optimistic: update isFavorite, queuedAt (set when favoriting ON), and updatedAt without reloading
    sharedPosts = sharedPosts.map(p =>
      p.id === id ? { ...p, isFavorite: newIsFavorite, queuedAt: newQueuedAt, updatedAt: new Date() } : p
    );
    const updatedFav = sharedPosts.find(p => p.id === id);
    if (updatedFav) notifyWithItemUpdate(updatedFav);
  }, []);

  const toggleArchive = useCallback(async (id: number) => {
    console.debug('Toggling archive status for post:', id);
    const repo = await initSharedRepo();    
    const newIsArchived = await repo.toggleArchivedById(id);

    // Optimistic: update local state without reloading
    sharedPosts = sharedPosts.map(p =>
      p.id === id ? { ...p, isArchived: newIsArchived, updatedAt: new Date() } : p
    );
    const updatedArchive = sharedPosts.find(p => p.id === id);
    if (updatedArchive) notifyWithItemUpdate(updatedArchive);
  }, []);

  const toggleQueue = useCallback(async (id: number) => {
    console.debug('Setting queue timestamp for post:', id);
    const repo = await initSharedRepo();
    const newQueuedAt = await repo.setQueuedAtById(id);

    // Optimistic: update local state without reloading
    sharedPosts = sharedPosts.map(p =>
      p.id === id ? { ...p, queuedAt: newQueuedAt } : p
    );
    const updatedQueue = sharedPosts.find(p => p.id === id);
    if (updatedQueue) notifyWithItemUpdate(updatedQueue);
  }, []);

  const setFolders = useCallback(
    async (postId: number, newFolderIds: number[]) => {
      console.debug('Setting folders for post:', postId + " ids:" + newFolderIds);
      const repo = await initSharedRepo();
      await repo.removeAllFoldersFromPost(postId);
      for (const fid of newFolderIds) {
        await repo.addPostToFolder(postId, fid);
      }

      // Optimistic: update folder IDs locally
      sharedPosts = sharedPosts.map(p =>
        p.id === postId ? { ...p, folderIds: newFolderIds } : p
      );
      notifyListeners();
    },
    []
  );

  const recomputeMissingMinHashes = useCallback(async () => {
    const repo = await initSharedRepo();
    const allPosts = await repo.getAll();
    let updatedCount = 0;
    for (const post of allPosts) {
      if (!post.bodyMinHash) {
        console.log(`Recomputing MinHash for post ${post.id}`);
        const bodyMinHashArr = MinHashService.generateSignature(post.bodyText || '');
        const bodyMinHash = JSON.stringify(bodyMinHashArr);
        await repo.update({ ...post, bodyMinHash });
        updatedCount++;
      }
    }
    await sharedLoadPosts();
    return updatedCount;
  }, []);

  return {
    posts: sharedPosts,
    loading: sharedLoading,
    refreshPosts,
    refreshPostsIfStale,
    addPost,
    handleAddPost,
    updatePost,
    deletePost,
    toggleDelete,
    getDeletedPosts,
    toggleRead,
    toggleFavorite,
    toggleArchive,
    toggleQueue,
    checkForSimilarPosts,
    setFolders,
    recomputeMissingMinHashes,
    getPostById,
  };
}

// Reset shared state - useful for testing.
export function _resetPostsSharedState() {
  sharedPosts = [];
  sharedLoading = true;
  sharedLoadedAt = 0;
  sharedRepo = null;
  sharedInitPromise = null;
  listeners.clear();
  itemUpdateListeners.clear();
}

/** For testing only: trigger an item-level update notification. */
export function _notifyWithItemUpdateForTesting(item: PostListItem) {
  notifyWithItemUpdate(item);
}
