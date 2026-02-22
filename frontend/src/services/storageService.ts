import api from './api';

export interface StorageFile {
  name: string;
  id?: string;
  metadata?: {
    size?: number;
    mimetype?: string;
    lastModified?: string;
  };
}

export interface StorageStats {
  total_files: number;
  total_size: number;
  categories: Record<string, number>;
}

export async function listStorageFiles(prefix = '', limit = 100, offset = 0) {
  const { data } = await api.get<{ success: boolean; error: string; files: StorageFile[] }>(
    '/sandbox/storage/list',
    { params: { prefix, limit, offset } },
  );
  return data;
}

export async function deleteStorageFiles(keys: string[]) {
  const { data } = await api.delete<{ success: boolean; error: string }>(
    '/sandbox/storage/delete',
    { data: keys },
  );
  return data;
}

export async function testStorageConnection() {
  const { data } = await api.get<{ success: boolean; url: string; error: string }>(
    '/sandbox/storage/test',
  );
  return data;
}

export async function getStorageStats() {
  const { data } = await api.get<{ success: boolean; error: string; stats: StorageStats }>(
    '/sandbox/storage/stats',
  );
  return data;
}
