// src/hooks/usePosts.ts
import { Alert } from 'react-native';
import { Post } from '@/models/models';
import { PostRepository } from '@/repository/PostRepository';
import { MinHashService } from '@/services/MinHashService';
import { useCallback, useEffect, useState } from 'react';

export type HandleAddPostOptions = {
  getPostData: (url: string) => Promise<Post>;
  syncSinglePost: (postId: number) => Promise<unknown>;
  onBeforeAdd?: () => void;
  onSuccess?: (post: Post) => void | Promise<void>;
  onError?: (error: Error) => void;
  onDuplicateFound?: (duplicates: Post[], proceed: () => void) => void;
  onSimilarFound?: (similarPosts: Post[], proceed: () => void) => void;
  similarityThreshold?: number;
  skipDuplicateCheck?: boolean;
  skipSimilarCheck?: boolean;
};

export interface UsePostsResult {
  posts: Post[];
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
}

export function usePosts(): UsePostsResult {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [repo, setRepo] = useState<PostRepository | null>(null);

  // initialize repository
  useEffect(() => {
    let mounted = true;
    (async () => {
      const r = await PostRepository.create();
      if (mounted) {
        setRepo(r);
        await loadPosts(r);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // helper to reload all posts
  const loadPosts = useCallback(async (r?: PostRepository) => {
    console.debug('Loading posts...');
    setLoading(true);
    const repository = r ?? repo;
    if (!repository) return;
    const all = await repository.getAll();
    setPosts(all);
    setLoading(false);
  }, [repo]);

  const refreshPosts = useCallback(() => loadPosts(), [loadPosts]);

  const checkForSimilarPosts = useCallback(async (bodyText: string, threshold: number = 0.75): Promise<Post[]> => {
    if (!repo) throw new Error('PostRepository not ready');
    console.debug('Checking for similar posts with threshold:', threshold);
    return await repo.findSimilarPosts(bodyText, threshold);
  }, [repo]);

  const addPost = useCallback(async (data: Omit<Post, 'id'>) => {
    if (!repo) throw new Error('PostRepository not ready');   
    const id = await repo.create(data);
    const newPost = await repo.getById(id);
    await loadPosts();
    if (!newPost) throw new Error('Failed to load new post');
    return newPost;
  }, [repo, loadPosts]);

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

    const defaultDuplicatePrompt = (duplicates: Post[], proceed: () => void) => {
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
        : posts.filter((p) => p.redditId === postData.redditId);
      const similarPosts = skipSimilarCheck
        ? []
        : await checkForSimilarPosts(postData.bodyText || '', similarityThreshold);

      if (!skipDuplicateCheck && exactDuplicates.length > 0) {
        (onDuplicateFound ?? defaultDuplicatePrompt)(
          exactDuplicates,
          safeAddAndSync,
        );
        return;
      }

      if (!skipSimilarCheck && similarPosts.length > 0) {
        (onSimilarFound ?? defaultSimilarPrompt)(similarPosts, safeAddAndSync);
        return;
      }

      await addAndSync();
    } catch (err) {
      console.error('Failed to add post:', err);
      reportError(err as Error);
    }
  }, [addPost, checkForSimilarPosts, posts]);

  const updatePost = useCallback(async (post: Post) => {
    // console.debug('Updating post:', post);
    if (!repo) throw new Error('PostRepository not ready');
    await repo.update(post);
    const updated = await repo.getById(post.id);
    await loadPosts();
    if (!updated) throw new Error('Failed to load updated post');
    return updated;
  }, [repo, loadPosts]);

  const deletePost = useCallback(async (id: number) => {
    if (!repo) throw new Error('PostRepository not ready');
    await repo.delete(id);
    await loadPosts();
  }, [repo, loadPosts]);

  const toggleRead = useCallback(async (id: number) => {
    console.debug('Toggling read status for post:', id);
    if (!repo) throw new Error('PostRepository not ready');
    const p = await repo.getById(id);
    if (!p) return;
    const newIsRead = !p.isRead;
    await repo.update({
      ...p,
      isRead: newIsRead,
      readAt: newIsRead ? new Date() : p.readAt,
    });
    await loadPosts();
  }, [repo, loadPosts]);

  const toggleFavorite = useCallback(async (id: number) => {
    console.debug('Toggling favorite status for post:', id);
    if (!repo) throw new Error('PostRepository not ready');
    const p = await repo.getById(id);
    if (!p) return;
    await repo.update({ ...p, isFavorite: !p.isFavorite });
    await loadPosts();
  }, [repo, loadPosts]);

  const setFolders = useCallback(
    async (postId: number, newFolderIds: number[]) => {
      console.debug('Setting folders for post:', postId + " ids:" + newFolderIds);
      if (!repo) throw new Error('Repo not ready');
      await repo.removeAllFoldersFromPost(postId);
      for (const fid of newFolderIds) {
        await repo.addPostToFolder(postId, fid);
      }
      await loadPosts();
    },
    [repo, loadPosts]
  );

  const recomputeMissingMinHashes = useCallback(async () => {
    if (!repo) throw new Error('PostRepository not ready');
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
    await loadPosts();
    return updatedCount;
  }, [repo, loadPosts]);

  return {
    posts,
    loading,
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
  };
}
