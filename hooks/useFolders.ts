// src/hooks/useFolders.ts
import { Folder } from '@/models/models';
import { FolderRepository } from '@/repository/FolderRepository';
import { useCallback, useEffect, useState } from 'react';

export interface UseFoldersResult {
  folders: Folder[];
  loading: boolean;
  refreshFolders: () => Promise<void>;
  createFolder: (name: string, parentId?: number) => Promise<Folder>;
  updateFolder: (id: number, name: string, parentId?: number) => Promise<Folder>;
  deleteFolder: (id: number) => Promise<void>;
}

export function useFolders(): UseFoldersResult {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [repo, setRepo] = useState<FolderRepository | null>(null);

  // initialize repository once
  useEffect(() => {
    let mounted = true;
    (async () => {
      const r = await FolderRepository.create();
      if (mounted) {
        setRepo(r);
        await loadFolders(r);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // load all folders
  const loadFolders = useCallback(async (r?: FolderRepository) => {
    setLoading(true);
    const repository = r ?? repo;
    if (!repository) return;
    const all = await repository.getAll();
    setFolders(all);
    setLoading(false);
  }, [repo]);

  // expose manual refresh
  const refreshFolders = useCallback(() => loadFolders(), [loadFolders]);

  // create
  const createFolder = useCallback(async (name: string, parentId?: number) => {
    if (!repo) throw new Error('FolderRepository not ready');
    const id = await repo.create(name, parentId ?? undefined);
    const newFolder = await repo.getById(id);
    await loadFolders();
    if (!newFolder) throw new Error('Failed to load new folder');
    return newFolder;
  }, [repo, loadFolders]);

  // update
  const updateFolder = useCallback(async (id: number, name: string, parentId?: number) => {
    if (!repo) throw new Error('FolderRepository not ready');
    await repo.update(id, name, parentId);
    const updated = await repo.getById(id);
    await loadFolders();
    if (!updated) throw new Error('Failed to load updated folder');
    return updated;
  }, [repo, loadFolders]);

  // delete
  const deleteFolder = useCallback(async (id: number) => {
    if (!repo) throw new Error('FolderRepository not ready');
    await repo.delete(id);
    await loadFolders();
  }, [repo, loadFolders]);

  return {
    folders,
    loading,
    refreshFolders,
    createFolder,
    updateFolder,
    deleteFolder,
  };
}
