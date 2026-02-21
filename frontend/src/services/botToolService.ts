import api from './api';
import type { BotTool } from '../types';

export interface AvailableEndpoint {
  path: string;
  method: string;
  summary: string;
  tags: string[];
}

export const botToolService = {
  list: () => api.get<BotTool[]>('/bot-tools').then((r) => r.data),
  listEndpoints: () => api.get<AvailableEndpoint[]>('/bot-tools/available-endpoints').then((r) => r.data),
  get: (id: string) => api.get<BotTool>(`/bot-tools/${id}`).then((r) => r.data),
  create: (data: Omit<BotTool, 'id' | 'created_at' | 'updated_at' | 'enabled'>) =>
    api.post<BotTool>('/bot-tools', data).then((r) => r.data),
  update: (id: string, data: Partial<BotTool>) =>
    api.put<BotTool>(`/bot-tools/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/bot-tools/${id}`),
  toggle: (id: string) => api.post<{ enabled: boolean }>(`/bot-tools/${id}/toggle`).then((r) => r.data),
};
