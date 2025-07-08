import * as SQLite from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Post } from '../models/Post';

export const usePostStore = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);

  // Initialize database
  useEffect(() => {
    const initDatabase = async () => {
      try {
        const database = await SQLite.openDatabaseAsync('posts.db');
        setDb(database);

        // Create table if it doesn't exist
        await database.execAsync(`
          CREATE TABLE IF NOT EXISTS posts (
            id TEXT PRIMARY KEY,
            url TEXT NOT NULL,
            title TEXT NOT NULL,
            dateAdded INTEGER NOT NULL,
            rating REAL NOT NULL DEFAULT 0,
            read INTEGER NOT NULL DEFAULT 0
          );
        `);

        // Load existing posts
        const result = await database.getAllAsync('SELECT * FROM posts ORDER BY dateAdded DESC');
        const loadedPosts: Post[] = result.map((row: any) => ({
          id: row.id,
          url: row.url,
          title: row.title,
          dateAdded: row.dateAdded,
          rating: row.rating,
          read: Boolean(row.read),
        }));

        setPosts(loadedPosts);
        setIsLoading(false);
      } catch (error) {
        console.error('Database initialization failed:', error);
        setIsLoading(false);
      }
    };

    initDatabase();
  }, []);

  const addPost = async (url: string, title: string): Promise<string> => {
    if (!db) throw new Error('Database not initialized');

    const newPost: Post = {
      id: uuidv4(),
      url,
      title,
      dateAdded: Date.now(),
      rating: 0,
      read: false,
    };

    try {
      await db.runAsync(
        'INSERT INTO posts (id, url, title, dateAdded, rating, read) VALUES (?, ?, ?, ?, ?, ?)',
        [newPost.id, newPost.url, newPost.title, newPost.dateAdded, newPost.rating, newPost.read ? 1 : 0]
      );

      setPosts(prev => [newPost, ...prev]);
      return newPost.id;
    } catch (error) {
      console.error('Failed to add post:', error);
      throw error;
    }
  };

  const toggleRead = async (id: string): Promise<void> => {
    if (!db) throw new Error('Database not initialized');

    const post = posts.find(p => p.id === id);
    if (!post) return;

    const newReadStatus = !post.read;

    try {
      await db.runAsync('UPDATE posts SET read = ? WHERE id = ?', [newReadStatus ? 1 : 0, id]);

      setPosts(prev =>
        prev.map(p => (p.id === id ? { ...p, read: newReadStatus } : p))
      );
    } catch (error) {
      console.error('Failed to toggle read status:', error);
      throw error;
    }
  };

  const setRating = async (id: string, rating: number): Promise<void> => {
    if (!db) throw new Error('Database not initialized');

    // Clamp rating between 0 and 5
    const clampedRating = Math.max(0, Math.min(5, rating));

    try {
      await db.runAsync('UPDATE posts SET rating = ? WHERE id = ?', [clampedRating, id]);

      setPosts(prev =>
        prev.map(p => (p.id === id ? { ...p, rating: clampedRating } : p))
      );
    } catch (error) {
      console.error('Failed to set rating:', error);
      throw error;
    }
  };

  const getAllPosts = (): Post[] => {
    return posts;
  };

  return {
    posts,
    isLoading,
    addPost,
    toggleRead,
    setRating,
    getAllPosts,
  };
};
