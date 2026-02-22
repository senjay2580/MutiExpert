import api from './api';
import type { Skill, SkillDetail, SkillReference, SkillScriptLink } from '../types';

export const skillsService = {
  list: () => api.get<Skill[]>('/skills').then((r) => r.data),
  get: (id: string) => api.get<SkillDetail>(`/skills/${id}`).then((r) => r.data),
  create: (data: { name: string; description?: string; content?: string; icon?: string }) =>
    api.post<Skill>('/skills', data).then((r) => r.data),
  update: (id: string, data: Partial<Skill>) =>
    api.put<Skill>(`/skills/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/skills/${id}`),
  toggle: (id: string) =>
    api.post<{ enabled: boolean }>(`/skills/${id}/toggle`).then((r) => r.data),
  bulkEnable: (ids: string[], enabled: boolean) =>
    api.post<{ updated: number }>('/skills/bulk-enable', { ids, enabled }).then((r) => r.data),
  bulkDelete: (ids: string[]) =>
    api.post<{ deleted: number }>('/skills/bulk-delete', { ids }).then((r) => r.data),

  // References
  listRefs: (skillId: string) =>
    api.get<SkillReference[]>(`/skills/${skillId}/references`).then((r) => r.data),
  createRef: (skillId: string, data: { name: string; ref_type?: string; content?: string; file_path?: string }) =>
    api.post<SkillReference>(`/skills/${skillId}/references`, data).then((r) => r.data),
  updateRef: (skillId: string, refId: string, data: Partial<SkillReference>) =>
    api.put<SkillReference>(`/skills/${skillId}/references/${refId}`, data).then((r) => r.data),
  deleteRef: (skillId: string, refId: string) =>
    api.delete(`/skills/${skillId}/references/${refId}`),

  // Script links
  listScripts: (skillId: string) =>
    api.get<SkillScriptLink[]>(`/skills/${skillId}/scripts`).then((r) => r.data),
  linkScript: (skillId: string, scriptId: string) =>
    api.post(`/skills/${skillId}/scripts`, { script_id: scriptId }).then((r) => r.data),
  unlinkScript: (skillId: string, linkId: string) =>
    api.delete(`/skills/${skillId}/scripts/${linkId}`),
};
