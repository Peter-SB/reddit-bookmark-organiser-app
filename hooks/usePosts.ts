// src/hooks/usePosts.ts
import { Post } from '@/models/models';
import { PostRepository } from '@/repository/PostRepository';
import { useCallback, useEffect, useState } from 'react';

export interface UsePostsResult {
  posts: Post[];
  loading: boolean;
  refresh: () => Promise<void>;
  addPost: (postData: Omit<Post, 'id' | 'tagIds'> & { tagIds?: number[] }) => Promise<Post>;
  updatePost: (post: Post) => Promise<Post>;
  deletePost: (id: number) => Promise<void>;
  toggleRead: (id: number) => Promise<void>;
  toggleFavorite: (id: number) => Promise<void>;
  addTagToPost: (postId: number, tagId: number) => Promise<void>;
  removeTagFromPost: (postId: number, tagId: number) => Promise<void>;
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

  // expose a manual refresh
  const refresh = useCallback(() => loadPosts(), [loadPosts]);

  const addPost = useCallback(async (data: Omit<Post, 'id' | 'tagIds'> & { tagIds?: number[] }) => {
    if (!repo) throw new Error('PostRepository not ready');
    const id = await repo.create(data);
    const newPost = await repo.getById(id);
    await loadPosts();
    if (!newPost) throw new Error('Failed to load new post');
    return newPost;
  }, [repo, loadPosts]);

  const updatePost = useCallback(async (post: Post) => {
    console.debug('Updating post:', post);
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
    await repo.update({ ...p, isRead: !p.isRead });
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

  const addTagToPost = useCallback(async (postId: number, tagId: number) => {
    if (!repo) throw new Error('PostRepository not ready');
    await repo.addTag(postId, tagId);
    await loadPosts();
  }, [repo, loadPosts]);

  const removeTagFromPost = useCallback(async (postId: number, tagId: number) => {
    if (!repo) throw new Error('PostRepository not ready');
    await repo.removeTag(postId, tagId);
    await loadPosts();
  }, [repo, loadPosts]);

  return {
    posts,
    loading,
    refresh,
    addPost,
    updatePost,
    deletePost,
    toggleRead,
    toggleFavorite,
    addTagToPost,
    removeTagFromPost,
  };
}
