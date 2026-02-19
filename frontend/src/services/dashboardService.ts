import api from './api';
import type { DashboardOverview } from '../types';

export const dashboardService = {
  getOverview: () => api.get<DashboardOverview>('/dashboard/overview').then((r) => r.data),

  getAIUsage: () => api.get<{ claude_calls: number; openai_calls: number; total_tokens: number }>('/dashboard/ai-usage').then((r) => r.data),

  getActivityTimeline: () => api.get<Array<{ type: string; id: string; title: string; time: string; status?: string }>>('/dashboard/activity-timeline').then((r) => r.data),

  getKnowledgeHeatmap: () => api.get<Array<{ id: string; name: string; count: number }>>('/dashboard/knowledge-heatmap').then((r) => r.data),
};
