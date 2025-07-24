// import type { SQLiteDatabase } from 'expo-sqlite';
// import { DatabaseService } from '../services/DatabaseService';

// export class PostFolderRepository {
//   private db: SQLiteDatabase;

//   private constructor(db: SQLiteDatabase) {
//     this.db = db;
//   }

//   public static async create(): Promise<PostFolderRepository> {
//     console.debug('Creating PostFolderRepository instance');
//     const svc = await DatabaseService.getInstance();
//     return new PostFolderRepository(svc.getDb());
//   }

//   public async getFoldersByPostId(postId: number): Promise<number[]> {
//     const rows = await this.db.getAllAsync<{ folder_id: number }>(
//       'SELECT folder_id FROM post_folders WHERE post_id = ?',
//       postId
//     );
//     return rows.map(r => r.folder_id);
//   }

//   public async getPostsByFolderId(folderId: number): Promise<number[]> {
//     const rows = await this.db.getAllAsync<{ post_id: number }>(
//       'SELECT post_id FROM post_folders WHERE folder_id = ?',
//       folderId
//     );
//     return rows.map(r => r.post_id);
//   }

//   public async addPostToFolder(postId: number, folderId: number): Promise<void> {
//     await this.db.runAsync(
//       'INSERT OR IGNORE INTO post_folders (post_id, folder_id) VALUES (?, ?)',
//       postId,
//       folderId
//     );
//   }

//   public async removePostFromFolder(postId: number, folderId: number): Promise<void> {
//     await this.db.runAsync(
//       'DELETE FROM post_folders WHERE post_id = ? AND folder_id = ?',
//       postId,
//       folderId
//     );
//   }

//   public async removeAllFoldersFromPost(postId: number): Promise<void> {
//     await this.db.runAsync(
//       'DELETE FROM post_folders WHERE post_id = ?',
//       postId
//     );
//   }
// }