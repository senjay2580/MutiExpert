import api from './api';
import type { ScheduledTask } from '../types';

export const scheduledTaskService = {
  list: () => api.get<ScheduledTask[]>('/scheduled-tasks').then((r) => r.data),
  get: (id: string) => api.get<ScheduledTask>(`/scheduled-tasks/${id}`).then((r) => r.data),
  create: (data: { name: string; cron_expression: string; task_type: string; task_config?: Record<string, unknown>; description?: string }) =>
    api.post<ScheduledTask>('/scheduled-tasks', data).then((r) => r.data),
  update: (id: string, data: Partial<ScheduledTask>) =>
    api.put<ScheduledTask>(`/scheduled-tasks/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/scheduled-tasks/${id}`),
  toggle: (id: string) => api.post<ScheduledTask>(`/scheduled-tasks/${id}/toggle`).then((r) => r.data),
  run: (id: string) => api.post<{ message: string; status: string }>(`/scheduled-tasks/${id}/run`).then((r) => r.data),
};
