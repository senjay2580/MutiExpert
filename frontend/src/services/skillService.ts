import api from './api';
import type { Skill } from '../types';

export const skillService = {
  list: () => api.get<Skill[]>('/skills').then((r) => r.data),
  get: (id: string) => api.get<Skill>(`/skills/${id}`).then((r) => r.data),
  create: (data: { name: string; type: string; config: Record<string, unknown>; file_path?: string }) =>
    api.post<Skill>('/skills', data).then((r) => r.data),
  update: (id: string, data: Partial<Skill>) =>
    api.put<Skill>(`/skills/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/skills/${id}`),
  execute: (id: string, params: Record<string, string>, context?: string) =>
    api.post<{ success: boolean; result: string }>(`/skills/${id}/execute`, { params, context }).then((r) => r.data),
};
