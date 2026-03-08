// src/hooks/usePosts.ts
import { Alert } from 'react-native';
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
  similarityThreshold?: number;
  skipDuplicateCheck?: boolean;
  skipSimilarCheck?: boolean;
};

export interface UsePostsResult {
  posts: PostListItem[]; // Lightweight list items for rendering post cards.
  loading: boolean;
  refreshPosts: () => Promise<void>;
  addPost: (postData: Omit<Post, 'id'>) => Promise<Post>;
  handleAddPost: (url: string, options: HandleAddPostOptions) => Promise<void>;
  updatePost: (post: Post) => Promise<Post>;
  deletePost: (id: number) => Promise<void>;
  toggleRead: (id: number) => Promise<void>;
  toggleFavorite: (id: number) => Promise<void>;
  checkForSimilarPosts: (bodyText: string, threshold?: number) => Promise<Post[]>;
  setFolders: (postId: number, newFolderIds: number[]) => Promise<void>;
  recomputeMissingMinHashes: () => Promise<number>;
  getPostById: (id: number) => Promise<Post | null>;
}

// Module-level shared state so all usePosts() instances share one copy.
// This prevents duplicate DB loads across screens.
let sharedPosts: PostListItem[] = [];
let sharedLoading = true;
let sharedRepo: PostRepository | null = null;
let sharedInitPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const fn of listeners) fn();
}

export function resetSharedPostsState() {
  sharedRepo = null;
  sharedInitPromise = null;
  sharedPosts = [];
  sharedLoading = true;
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
 * Subscribe to shared post-list change notifications (loads, mutations).
 * Returns an unsubscribe function. Used by useFilteredPosts.
 */
export function subscribeToPostChanges(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Exposed so sibling hooks can share the same DB connection. */
export { initSharedRepo };

async function sharedLoadPosts(r?: PostRepository): Promise<void> {
  console.debug('Loading posts...');
  sharedLoading = true;
  notifyListeners();
  const repository = r ?? sharedRepo;
  if (!repository) return;
  const all = await repository.getAllListItems();
  sharedPosts = all;
  sharedLoading = false;
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

  const getPostById = useCallback(async (id: number): Promise<Post | null> => {
    const repo = await initSharedRepo();
    return repo.getById(id);
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
      similarityThreshold = 0.8,
      skipDuplicateCheck = false,
      skipSimilarCheck = false,
    } = options;

    const reportError = (err: Error) => {
      if (onError) {
        onError(err);
        return;
      }
      Alert.alert('Error', `Failed to add post: ${err.message}`);
    };

    const defaultDuplicatePrompt = (duplicates: PostListItem[], proceed: () => void) => {
      Alert.alert(
        'Duplicate Post',
        'This post appears to already exist. Add anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add Anyway',
            onPress: proceed,
          },
        ],
      );
    };

    const defaultSimilarPrompt = (similarPosts: Post[], proceed: () => void) => {
      const similarTitles = similarPosts
        .slice(0, 2)
        .map((p) => `"${p.title}"`)
        .join('\n');
      Alert.alert(
        'Similar Content Found',
        `Found ${similarPosts.length} post(s) with similar content:\n\n${similarTitles}${
          similarPosts.length > 3 ? '\n...and more' : ''
        }\n\nAdd anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add Anyway',
            onPress: proceed,
          },
        ],
      );
    };

    try {
      const postData = await getPostData(url);
      const addAndSync = async () => {
        const created = await addPost(postData);
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

      const exactDuplicates = skipDuplicateCheck
        ? []
        : sharedPosts.filter((p) => p.redditId === postData.redditId);


      if (!skipDuplicateCheck && exactDuplicates.length > 0) {
        (onDuplicateFound ?? defaultDuplicatePrompt)(
          exactDuplicates,
          safeAddAndSync,
        );
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

  const toggleRead = useCallback(async (id: number) => {
    console.debug('Toggling read status for post:', id);
    const repo = await initSharedRepo();
    const newIsRead = await repo.toggleReadById(id);

    // Optimistic: update local state without reloading
    sharedPosts = sharedPosts.map(p =>
      p.id === id
        ? { ...p, isRead: newIsRead, readAt: newIsRead ? new Date() : p.readAt }
        : p
    );
    notifyListeners();
  }, []);

  const toggleFavorite = useCallback(async (id: number) => {
    console.debug('Toggling favorite status for post:', id);
    const repo = await initSharedRepo();
    const newIsFavorite = await repo.toggleFavoriteById(id);

    // Optimistic: update local state without reloading
    sharedPosts = sharedPosts.map(p =>
      p.id === id ? { ...p, isFavorite: newIsFavorite } : p
    );
    notifyListeners();
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
    addPost,
    handleAddPost,
    updatePost,
    deletePost,
    toggleRead,
    toggleFavorite,
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
  sharedRepo = null;
  sharedInitPromise = null;
  listeners.clear();
}
