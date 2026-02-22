import api from './api';
import type { DashboardOverview } from '../types';

export const dashboardService = {
  getOverview: () => api.get<DashboardOverview>('/dashboard/overview').then((r) => r.data),

  getAIUsage: () => api.get<{ claude_calls: number; openai_calls: number; total_tokens: number }>('/dashboard/ai-usage').then((r) => r.data),

  getActivityTimeline: () => api.get<Array<{ type: string; id: string; title: string; time: string; status?: string }>>('/dashboard/activity-timeline').then((r) => r.data),

  getKnowledgeHeatmap: () => api.get<Array<{ id: string; name: string; count: number }>>('/dashboard/knowledge-heatmap').then((r) => r.data),

  getUsageTrend: (months = 6) =>
    api.get<Array<{ month: string; local_ai: number; feishu: number }>>('/dashboard/usage-trend', { params: { months } }).then((r) => r.data),

  getAIModelTrend: (months = 6) =>
    api.get<Array<{ month: string; claude: number; openai: number }>>('/dashboard/ai-model-trend', { params: { months } }).then((r) => r.data),

  getIndustryDistribution: () =>
    api.get<Array<{ name: string; color: string | null; value: number }>>('/dashboard/industry-distribution').then((r) => r.data),
};
