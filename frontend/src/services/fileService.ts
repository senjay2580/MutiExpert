import api from './api';
import type { FileAttachment } from '@/types';

/** 上传图片到 sm.ms 图床 */
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
    headers: { 'Content-Type': 'multipart/form-data' },
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
    headers: { 'Content-Type': 'multipart/form-data' },
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

/** 智能上传：图片走图床，其他文件走工作区 */
export async function uploadFile(file: File): Promise<FileAttachment> {
  const isImage = file.type.startsWith('image/');
  if (isImage) {
    return uploadToImageHost(file);
  }
  return uploadToWorkspace(file, 'chat_uploads');
}
