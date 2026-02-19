import api from './api';
import type { KnowledgeBase, Document as DocType } from '../types';

export const knowledgeBaseService = {
  list: (industryId?: string) =>
    api.get<KnowledgeBase[]>('/knowledge-bases', { params: industryId ? { industry_id: industryId } : {} }).then((r) => r.data),

  get: (id: string) =>
    api.get<KnowledgeBase>(`/knowledge-bases/${id}`).then((r) => r.data),

  create: (data: { name: string; description?: string; industry_id?: string }) =>
    api.post<KnowledgeBase>('/knowledge-bases', data).then((r) => r.data),

  update: (id: string, data: Partial<KnowledgeBase>) =>
    api.put<KnowledgeBase>(`/knowledge-bases/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/knowledge-bases/${id}`),

  listDocuments: (kbId: string) =>
    api.get<DocType[]>(`/knowledge-bases/${kbId}/documents`).then((r) => r.data),

  uploadDocument: (kbId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<DocType>(`/knowledge-bases/${kbId}/documents/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    }).then((r) => r.data);
  },

  getStats: (kbId: string) =>
    api.get<{ total_documents: number; ready_documents: number }>(`/knowledge-bases/${kbId}/stats`).then((r) => r.data),
};

export const documentService = {
  get: (id: string) =>
    api.get<DocType>(`/documents/${id}`).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/documents/${id}`),

  reprocess: (id: string) =>
    api.post(`/documents/${id}/reprocess`).then((r) => r.data),
};
