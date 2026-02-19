import api from './api';
import type { Industry } from '../types';

export const industryService = {
  list: () => api.get<Industry[]>('/industries').then((r) => r.data),
  create: (data: Partial<Industry>) => api.post<Industry>('/industries', data).then((r) => r.data),
  update: (id: string, data: Partial<Industry>) => api.put<Industry>(`/industries/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/industries/${id}`),
};
