import api from './api';

export interface WorkspaceEntry {
  name: string;
  type: 'file' | 'dir';
  size?: number;
  mime_type?: string;
  modified?: string;
  child_count?: number;
}

export interface WorkspaceListResponse {
  success: boolean;
  path: string;
  entries: WorkspaceEntry[];
  error?: string;
}

export interface WorkspaceStats {
  success: boolean;
  total_files: number;
  total_size: number;
  total_dirs: number;
  error?: string;
}

export const workspaceService = {
  async listFiles(path = '.'): Promise<WorkspaceListResponse> {
    const resp = await api.get<WorkspaceListResponse>('/sandbox/files/list-json', { params: { path } });
    return resp.data;
  },

  async getStats(): Promise<WorkspaceStats> {
    const resp = await api.get<WorkspaceStats>('/sandbox/files/workspace-stats');
    return resp.data;
  },

  async deleteFile(path: string): Promise<{ success: boolean; error?: string }> {
    const resp = await api.delete<{ success: boolean; output: string; error: string }>('/sandbox/files/delete', { params: { path } });
    return { success: resp.data.success, error: resp.data.error || undefined };
  },

  getDownloadUrl(path: string): string {
    return `/api/v1/sandbox/files/download?path=${encodeURIComponent(path)}`;
  },
};
