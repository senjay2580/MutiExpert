import api from './api';
import type { BotTool } from '../types';

export interface SyncResult {
  created: number;
  updated: number;
  removed: number;
  total: number;
}

export const botToolService = {
  list: () => api.get<BotTool[]>('/bot-tools').then((r) => r.data),
  toggle: (id: string) => api.post<{ enabled: boolean }>(`/bot-tools/${id}/toggle`).then((r) => r.data),
  bulkEnable: (ids: string[], enabled: boolean) =>
    api.post<{ updated: number }>('/bot-tools/bulk-enable', { ids, enabled }).then((r) => r.data),
  sync: () => api.post<SyncResult>('/bot-tools/sync').then((r) => r.data),
};
