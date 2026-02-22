import api from './api';

export interface EmbeddingInfo {
  model: string;
  api_base: string;
  total_chunks: number;
}

export interface TestEmbeddingResult {
  ok: boolean;
  dimension?: number;
  detail?: string;
}

export const dataManagementService = {
  getEmbeddingInfo: () => api.get<EmbeddingInfo>('/data/embedding-info').then((r) => r.data),
  testEmbedding: () => api.post<TestEmbeddingResult>('/data/test-embedding').then((r) => r.data),
  rebuildIndexes: () => api.post('/data/rebuild-indexes').then((r) => r.data),
};
