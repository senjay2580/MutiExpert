import api from './api';
import type { UserScript } from '../types';

export interface ScriptTestResult {
  success: boolean;
  output: string;
  error: string;
  timed_out: boolean;
  warnings: string[];
}

export interface EnvVarInfo {
  name: string;
  source: string;
  group: string;
}

export const scriptService = {
  list: () => api.get<UserScript[]>('/scripts').then((r) => r.data),
  get: (id: string) => api.get<UserScript>(`/scripts/${id}`).then((r) => r.data),
  create: (data: { name: string; description?: string; script_content: string; script_type?: string }) =>
    api.post<UserScript & { warnings?: string[] }>('/scripts', data).then((r) => r.data),
  update: (id: string, data: Partial<UserScript>) =>
    api.put<UserScript & { warnings?: string[] }>(`/scripts/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/scripts/${id}`),
  /** 测试脚本。timeout 单位秒，默认 600（适配长任务如视频转录）。
   * axios timeout 也设 timeout+30 秒留余量，确保前端等够 */
  test: (id: string, timeout: number = 600) =>
    api
      .post<ScriptTestResult>(`/scripts/${id}/test?timeout=${timeout}`, undefined, {
        timeout: (timeout + 30) * 1000,
      })
      .then((r) => r.data),
  listEnvVars: () =>
    api.get<EnvVarInfo[]>('/scripts/env-vars/available').then((r) => r.data),
};
