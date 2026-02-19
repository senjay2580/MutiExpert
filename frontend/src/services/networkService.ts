import api from './api';
import type { GraphData, Insight } from '../types';

export const networkService = {
  scan: () => api.post<{ message: string; links_created: number; insights_generated: number }>('/knowledge-network/scan').then((r) => r.data),

  getGraph: (kbIds?: string[]) => {
    const params = kbIds?.length ? { kb_ids: kbIds.join(',') } : {};
    return api.get<GraphData>('/knowledge-network/graph', { params }).then((r) => r.data);
  },

  listInsights: () => api.get<Insight[]>('/knowledge-network/insights').then((r) => r.data),

  getInsight: (id: string) => api.get<Insight>(`/knowledge-network/insights/${id}`).then((r) => r.data),

  pushToFeishu: (id: string) => api.post(`/knowledge-network/insights/${id}/push-feishu`).then((r) => r.data),
};
