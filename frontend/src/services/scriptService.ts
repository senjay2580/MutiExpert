import api from './api';
import type { UserScript } from '../types';

export const scriptService = {
  list: () => api.get<UserScript[]>('/scripts').then((r) => r.data),
  get: (id: string) => api.get<UserScript>(`/scripts/${id}`).then((r) => r.data),
  create: (data: { name: string; description?: string; script_content: string }) =>
    api.post<UserScript>('/scripts', data).then((r) => r.data),
  update: (id: string, data: Partial<UserScript>) =>
    api.put<UserScript>(`/scripts/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/scripts/${id}`),
  test: (id: string) =>
    api.post<{ success: boolean; output: string; error: string; timed_out: boolean }>(`/scripts/${id}/test`).then((r) => r.data),
};
