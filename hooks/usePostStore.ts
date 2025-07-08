import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Folder, Tag } from '../models/Folder';
import { Post } from '../models/Post';

interface PostStore {
  // State
  posts: Post[];
  folders: Folder[];
  tags: Tag[];
  searchQuery: string;
  selectedFolderId: number | null;
  selectedTagIds: number[];
  showFavoritesOnly: boolean;
  showUnreadOnly: boolean;
  
  // Post actions
  addPost: (post: Omit<Post, 'id' | 'addedAt'>) => void;
  updatePost: (id: number, updates: Partial<Post>) => void;
  deletePost: (id: number) => void;
  togglePostRead: (id: number) => void;
  togglePostFavorite: (id: number) => void;
  setPostRating: (id: number, rating: number) => void;
  movePostToFolder: (postId: number, folderId: number | null) => void;
  addTagToPost: (postId: number, tagId: number) => void;
  removeTagFromPost: (postId: number, tagId: number) => void;
  
  // Folder actions
  addFolder: (folder: Omit<Folder, 'id' | 'createdAt'>) => void;
  updateFolder: (id: number, updates: Partial<Folder>) => void;
  deleteFolder: (id: number) => void;
  
  // Tag actions
  addTag: (tag: Omit<Tag, 'id' | 'createdAt'>) => void;
  updateTag: (id: number, updates: Partial<Tag>) => void;
  deleteTag: (id: number) => void;
  
  // Filter actions
  setSearchQuery: (query: string) => void;
  setSelectedFolder: (folderId: number | null) => void;
  setSelectedTags: (tagIds: number[]) => void;
  toggleFavoritesFilter: () => void;
  toggleUnreadFilter: () => void;
  clearAllFilters: () => void;
  
  // Computed getters
  getFilteredPosts: () => Post[];
  getPostById: (id: number) => Post | undefined;
  getFolderById: (id: number) => Folder | undefined;
  getTagById: (id: number) => Tag | undefined;
  getFolderPosts: (folderId: number) => Post[];
  getTagPosts: (tagId: number) => Post[];
  getUnreadPosts: () => Post[];
  getFavoritePosts: () => Post[];
  getPostsByAuthor: (author: string) => Post[];
  getPostsBySubreddit: (subreddit: string) => Post[];
  
  // Utility functions
  searchPosts: (query: string) => Post[];
  detectDuplicates: (newPost: Omit<Post, 'id' | 'addedAt'>) => Post[];
  exportPosts: (postIds: number[], format: 'json' | 'markdown') => string;
  getPostStats: () => {
    total: number;
    read: number;
    unread: number;
    favorites: number;
    byFolder: Record<number, number>;
    byTag: Record<number, number>;
  };
}

export const usePostStore = create<PostStore>()(
  persist(
    (set, get) => ({
      // Initial state
      posts: [],
      folders: [],
      tags: [],
      searchQuery: '',
      selectedFolderId: null,
      selectedTagIds: [],
      showFavoritesOnly: false,
      showUnreadOnly: false,
      
      // Post actions
      addPost: (postData: Omit<Post, 'id' | 'addedAt'>) => {
        const newPost: Post = {
          ...postData,
          id: Date.now(), // Simple ID generation, consider using a proper UUID library
          addedAt: new Date(),
          isRead: false,
          isFavorite: false,
          tagIds: postData.tagIds || [],
        };
        
        set((state: PostStore) => ({
          posts: [...state.posts, newPost],
        }));
      },
      
      updatePost: (id: number, updates: Partial<Post>) => {
        set((state: PostStore) => ({
          posts: state.posts.map((post) =>
            post.id === id ? { ...post, ...updates } : post
          ),
        }));
      },
      
      deletePost: (id: number) => {
        set((state: PostStore) => ({
          posts: state.posts.filter((post) => post.id !== id),
        }));
      },
      
      togglePostRead: (id: number) => {
        set((state: PostStore) => ({
          posts: state.posts.map((post) =>
            post.id === id ? { ...post, isRead: !post.isRead } : post
          ),
        }));
      },
      
      togglePostFavorite: (id: number) => {
        set((state: PostStore) => ({
          posts: state.posts.map((post) =>
            post.id === id ? { ...post, isFavorite: !post.isFavorite } : post
          ),
        }));
      },
      
      setPostRating: (id: number, rating: number) => {
        set((state: PostStore) => ({
          posts: state.posts.map((post) =>
            post.id === id ? { ...post, rating } : post
          ),
        }));
      },
      
      movePostToFolder: (postId: number, folderId: number | null) => {
        set((state: PostStore) => ({
          posts: state.posts.map((post) =>
            post.id === postId ? { ...post, folderId: folderId || undefined } : post
          ),
        }));
      },
      
      addTagToPost: (postId: number, tagId: number) => {
        set((state: PostStore) => ({
          posts: state.posts.map((post) =>
            post.id === postId && !post.tagIds.includes(tagId)
              ? { ...post, tagIds: [...post.tagIds, tagId] }
              : post
          ),
        }));
      },
      
      removeTagFromPost: (postId: number, tagId: number) => {
        set((state: PostStore) => ({
          posts: state.posts.map((post) =>
            post.id === postId
              ? { ...post, tagIds: post.tagIds.filter((id) => id !== tagId) }
              : post
          ),
        }));
      },
      
      // Folder actions
      addFolder: (folderData: Omit<Folder, 'id' | 'createdAt'>) => {
        const newFolder: Folder = {
          ...folderData,
          id: Date.now(),
          createdAt: new Date(),
        };
        
        set((state: PostStore) => ({
          folders: [...state.folders, newFolder],
        }));
      },
      
      updateFolder: (id: number, updates: Partial<Folder>) => {
        set((state: PostStore) => ({
          folders: state.folders.map((folder) =>
            folder.id === id ? { ...folder, ...updates } : folder
          ),
        }));
      },
      
      deleteFolder: (id: number) => {
        set((state: PostStore) => ({
          folders: state.folders.filter((folder) => folder.id !== id),
          // Remove folder association from posts
          posts: state.posts.map((post) =>
            post.folderId === id ? { ...post, folderId: undefined } : post
          ),
        }));
      },
      
      // Tag actions
      addTag: (tagData: Omit<Tag, 'id' | 'createdAt'>) => {
        const newTag: Tag = {
          ...tagData,
          id: Date.now(),
          createdAt: new Date(),
        };
        
        set((state: PostStore) => ({
          tags: [...state.tags, newTag],
        }));
      },
      
      updateTag: (id: number, updates: Partial<Tag>) => {
        set((state: PostStore) => ({
          tags: state.tags.map((tag) =>
            tag.id === id ? { ...tag, ...updates } : tag
          ),
        }));
      },
      
      deleteTag: (id: number) => {
        set((state: PostStore) => ({
          tags: state.tags.filter((tag) => tag.id !== id),
          // Remove tag association from posts
          posts: state.posts.map((post) => ({
            ...post,
            tagIds: post.tagIds.filter((tagId) => tagId !== id),
          })),
        }));
      },
      
      // Filter actions
      setSearchQuery: (query: string) => {
        set({ searchQuery: query });
      },
      
      setSelectedFolder: (folderId: number | null) => {
        set({ selectedFolderId: folderId });
      },
      
      setSelectedTags: (tagIds: number[]) => {
        set({ selectedTagIds: tagIds });
      },
      
      toggleFavoritesFilter: () => {
        set((state: PostStore) => ({
          showFavoritesOnly: !state.showFavoritesOnly,
        }));
      },
      
      toggleUnreadFilter: () => {
        set((state: PostStore) => ({
          showUnreadOnly: !state.showUnreadOnly,
        }));
      },
      
      clearAllFilters: () => {
        set({
          searchQuery: '',
          selectedFolderId: null,
          selectedTagIds: [],
          showFavoritesOnly: false,
          showUnreadOnly: false,
        });
      },
      
      // Computed getters
      getFilteredPosts: () => {
        const state = get();
        let filtered = state.posts;
        
        // Apply search filter
        if (state.searchQuery) {
          const query = state.searchQuery.toLowerCase();
          filtered = filtered.filter((post) =>
            post.title.toLowerCase().includes(query) ||
            post.bodyText.toLowerCase().includes(query) ||
            post.author.toLowerCase().includes(query) ||
            post.subreddit.toLowerCase().includes(query) ||
            post.notes?.toLowerCase().includes(query) ||
            post.customTitle?.toLowerCase().includes(query) ||
            post.customBody?.toLowerCase().includes(query)
          );
        }
        
        // Apply folder filter
        if (state.selectedFolderId !== null) {
          filtered = filtered.filter((post) => post.folderId === state.selectedFolderId);
        }
        
        // Apply tag filter
        if (state.selectedTagIds.length > 0) {
          filtered = filtered.filter((post) =>
            state.selectedTagIds.some((tagId) => post.tagIds.includes(tagId))
          );
        }
        
        // Apply favorites filter
        if (state.showFavoritesOnly) {
          filtered = filtered.filter((post) => post.isFavorite);
        }
        
        // Apply unread filter
        if (state.showUnreadOnly) {
          filtered = filtered.filter((post) => !post.isRead);
        }
        
        return filtered;
      },
      
      getPostById: (id: number) => {
        return get().posts.find((post) => post.id === id);
      },
      
      getFolderById: (id: number) => {
        return get().folders.find((folder) => folder.id === id);
      },
      
      getTagById: (id: number) => {
        return get().tags.find((tag) => tag.id === id);
      },
      
      getFolderPosts: (folderId: number) => {
        return get().posts.filter((post) => post.folderId === folderId);
      },
      
      getTagPosts: (tagId: number) => {
        return get().posts.filter((post) => post.tagIds.includes(tagId));
      },
      
      getUnreadPosts: () => {
        return get().posts.filter((post) => !post.isRead);
      },
      
      getFavoritePosts: () => {
        return get().posts.filter((post) => post.isFavorite);
      },
      
      getPostsByAuthor: (author: string) => {
        return get().posts.filter((post) => post.author === author);
      },
      
      getPostsBySubreddit: (subreddit: string) => {
        return get().posts.filter((post) => post.subreddit === subreddit);
      },
      
      // Utility functions
      searchPosts: (query: string) => {
        const searchQuery = query.toLowerCase();
        return get().posts.filter((post) =>
          post.title.toLowerCase().includes(searchQuery) ||
          post.bodyText.toLowerCase().includes(searchQuery) ||
          post.author.toLowerCase().includes(searchQuery) ||
          post.subreddit.toLowerCase().includes(searchQuery) ||
          post.notes?.toLowerCase().includes(searchQuery) ||
          post.customTitle?.toLowerCase().includes(searchQuery) ||
          post.customBody?.toLowerCase().includes(searchQuery)
        );
      },
      
      detectDuplicates: (newPost: Omit<Post, 'id' | 'addedAt'>) => {
        const posts = get().posts;
        const duplicates: Post[] = [];
        
        // Check for exact URL match
        const urlMatch = posts.find((post) => post.url === newPost.url);
        if (urlMatch) {
          duplicates.push(urlMatch);
        }
        
        // Check for Reddit ID match
        const redditIdMatch = posts.find((post) => post.redditId === newPost.redditId);
        if (redditIdMatch && !duplicates.includes(redditIdMatch)) {
          duplicates.push(redditIdMatch);
        }
        
        // Check for title similarity (>90% word overlap)
        const newWords = newPost.title.toLowerCase().split(/\s+/);
        posts.forEach((post) => {
          if (duplicates.includes(post)) return;
          
          const existingWords = post.title.toLowerCase().split(/\s+/);
          const intersection = newWords.filter((word) => existingWords.includes(word));
          const union = [...new Set([...newWords, ...existingWords])];
          const similarity = intersection.length / union.length;
          
          if (similarity > 0.9) {
            duplicates.push(post);
          }
        });
        
        return duplicates;
      },
      
      exportPosts: (postIds: number[], format: 'json' | 'markdown') => {
        const posts = get().posts.filter((post) => postIds.includes(post.id));
        const folders = get().folders;
        const tags = get().tags;
        
        if (format === 'json') {
          return JSON.stringify({
            posts,
            folders,
            tags,
            exportedAt: new Date().toISOString(),
          }, null, 2);
        } else if (format === 'markdown') {
          let markdown = `# Reddit Posts Export\n\nExported on ${new Date().toLocaleDateString()}\n\n`;
          
          posts.forEach((post) => {
            markdown += `## ${post.customTitle || post.title}\n\n`;
            markdown += `**Author:** u/${post.author}\n`;
            markdown += `**Subreddit:** r/${post.subreddit}\n`;
            markdown += `**URL:** ${post.url}\n`;
            markdown += `**Added:** ${post.addedAt.toLocaleDateString()}\n`;
            markdown += `**Rating:** ${post.rating ? '⭐'.repeat(post.rating) : 'Not rated'}\n`;
            markdown += `**Status:** ${post.isRead ? 'Read' : 'Unread'}${post.isFavorite ? ' ❤️' : ''}\n\n`;
            
            if (post.folderId) {
              const folder = folders.find((f) => f.id === post.folderId);
              markdown += `**Folder:** ${folder?.name || 'Unknown'}\n`;
            }
            
            if (post.tagIds.length > 0) {
              const postTags = tags.filter((tag) => post.tagIds.includes(tag.id));
              markdown += `**Tags:** ${postTags.map((tag) => tag.name).join(', ')}\n`;
            }
            
            markdown += '\n### Content\n\n';
            markdown += post.customBody || post.bodyText || 'No content available';
            
            if (post.notes) {
              markdown += '\n\n### Notes\n\n';
              markdown += post.notes;
            }
            
            markdown += '\n\n---\n\n';
          });
          
          return markdown;
        }
        
        return '';
      },
      
      getPostStats: () => {
        const posts = get().posts;
        const folders = get().folders;
        const tags = get().tags;
        
        const stats = {
          total: posts.length,
          read: posts.filter((post) => post.isRead).length,
          unread: posts.filter((post) => !post.isRead).length,
          favorites: posts.filter((post) => post.isFavorite).length,
          byFolder: {} as Record<number, number>,
          byTag: {} as Record<number, number>,
        };
        
        // Count posts by folder
        folders.forEach((folder) => {
          stats.byFolder[folder.id] = posts.filter((post) => post.folderId === folder.id).length;
        });
        
        // Count posts by tag
        tags.forEach((tag) => {
          stats.byTag[tag.id] = posts.filter((post) => post.tagIds.includes(tag.id)).length;
        });
        
        return stats;
      },
    }),
    {
      name: 'reddit-post-organizer-store',
      version: 1,
    }
  )
);

// Convenience hooks for common operations
export const usePostActions = () => {
  const addPost = usePostStore((state) => state.addPost);
  const updatePost = usePostStore((state) => state.updatePost);
  const deletePost = usePostStore((state) => state.deletePost);
  const togglePostRead = usePostStore((state) => state.togglePostRead);
  const togglePostFavorite = usePostStore((state) => state.togglePostFavorite);
  const setPostRating = usePostStore((state) => state.setPostRating);
  const movePostToFolder = usePostStore((state) => state.movePostToFolder);
  const addTagToPost = usePostStore((state) => state.addTagToPost);
  const removeTagFromPost = usePostStore((state) => state.removeTagFromPost);
  
  return {
    addPost,
    updatePost,
    deletePost,
    togglePostRead,
    togglePostFavorite,
    setPostRating,
    movePostToFolder,
    addTagToPost,
    removeTagFromPost,
  };
};

export const useFolderActions = () => {
  const addFolder = usePostStore((state) => state.addFolder);
  const updateFolder = usePostStore((state) => state.updateFolder);
  const deleteFolder = usePostStore((state) => state.deleteFolder);
  
  return {
    addFolder,
    updateFolder,
    deleteFolder,
  };
};

export const useTagActions = () => {
  const addTag = usePostStore((state) => state.addTag);
  const updateTag = usePostStore((state) => state.updateTag);
  const deleteTag = usePostStore((state) => state.deleteTag);
  
  return {
    addTag,
    updateTag,
    deleteTag,
  };
};

export const useFilters = () => {
  const searchQuery = usePostStore((state) => state.searchQuery);
  const selectedFolderId = usePostStore((state) => state.selectedFolderId);
  const selectedTagIds = usePostStore((state) => state.selectedTagIds);
  const showFavoritesOnly = usePostStore((state) => state.showFavoritesOnly);
  const showUnreadOnly = usePostStore((state) => state.showUnreadOnly);
  
  const setSearchQuery = usePostStore((state) => state.setSearchQuery);
  const setSelectedFolder = usePostStore((state) => state.setSelectedFolder);
  const setSelectedTags = usePostStore((state) => state.setSelectedTags);
  const toggleFavoritesFilter = usePostStore((state) => state.toggleFavoritesFilter);
  const toggleUnreadFilter = usePostStore((state) => state.toggleUnreadFilter);
  const clearAllFilters = usePostStore((state) => state.clearAllFilters);
  
  return {
    // Current filter values
    searchQuery,
    selectedFolderId,
    selectedTagIds,
    showFavoritesOnly,
    showUnreadOnly,
    
    // Filter actions
    setSearchQuery,
    setSelectedFolder,
    setSelectedTags,
    toggleFavoritesFilter,
    toggleUnreadFilter,
    clearAllFilters,
  };
};

export const usePostsData = () => {
  const posts = usePostStore((state) => state.posts);
  const folders = usePostStore((state) => state.folders);
  const tags = usePostStore((state) => state.tags);
  
  const getFilteredPosts = usePostStore((state) => state.getFilteredPosts);
  const getPostById = usePostStore((state) => state.getPostById);
  const getFolderById = usePostStore((state) => state.getFolderById);
  const getTagById = usePostStore((state) => state.getTagById);
  const getUnreadPosts = usePostStore((state) => state.getUnreadPosts);
  const getFavoritePosts = usePostStore((state) => state.getFavoritePosts);
  const getPostStats = usePostStore((state) => state.getPostStats);
  
  return {
    posts,
    folders,
    tags,
    getFilteredPosts,
    getPostById,
    getFolderById,
    getTagById,
    getUnreadPosts,
    getFavoritePosts,
    getPostStats,
  };
};