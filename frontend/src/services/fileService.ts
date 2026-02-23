import api from './api';
import type { FileAttachment } from '@/types';

/** 上传图片到 sm.ms 图床（可选，失败会 fallback 到工作区） */
export async function uploadToImageHost(file: File): Promise<FileAttachment> {
  const formData = new FormData();
  formData.append('file', file);
  const resp = await api.post<{
    url: string;
    delete_url: string;
    filename: string;
    size: number;
    mime_type: string;
  }>('/sandbox/files/image-host', formData, {
    timeout: 60000,
  });
  return {
    filename: resp.data.filename,
    path: '',
    size: resp.data.size,
    mime_type: resp.data.mime_type,
    url: resp.data.url,
  };
}

/** 上传文件到服务器工作区 */
export async function uploadToWorkspace(file: File, path = ''): Promise<FileAttachment> {
  const formData = new FormData();
  formData.append('file', file);
  const resp = await api.post<{
    filename: string;
    path: string;
    size: number;
    mime_type: string;
    url: string;
  }>('/sandbox/files/upload', formData, {
    timeout: 120000,
    params: path ? { path } : undefined,
  });
  return {
    filename: resp.data.filename,
    path: resp.data.path,
    size: resp.data.size,
    mime_type: resp.data.mime_type,
    url: resp.data.url,
  };
}

/** 上传聊天附件（直传 Supabase，不写入服务器工作区） */
export async function uploadFile(file: File): Promise<FileAttachment> {
  const formData = new FormData();
  formData.append('file', file);
  const resp = await api.post<{
    filename: string;
    path: string;
    size: number;
    mime_type: string;
    url: string;
  }>('/sandbox/files/upload-chat', formData, {
    timeout: 120000,
  });
  return {
    filename: resp.data.filename,
    path: resp.data.path,
    size: resp.data.size,
    mime_type: resp.data.mime_type,
    url: resp.data.url,
  };
}
