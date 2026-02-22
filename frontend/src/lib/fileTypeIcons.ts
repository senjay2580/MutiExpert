/** 文件类型图标映射 — 根据 MIME type / 扩展名返回对应图标、颜色、标签 */

export type FileTypeInfo = { icon: string; color: string; label: string };

const DEFAULT: FileTypeInfo = { icon: 'streamline-color:new-file', color: '#6B7280', label: '文件' };

const MIME_MAP: Record<string, FileTypeInfo> = {
  'application/pdf': { icon: 'streamline-color:pdf-1', color: '#EF4444', label: 'PDF' },
  'application/msword': { icon: 'streamline-color:word', color: '#2563EB', label: 'Word' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: 'streamline-color:word', color: '#2563EB', label: 'Word' },
  'application/vnd.ms-excel': { icon: 'streamline-color:excel', color: '#16A34A', label: 'Excel' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { icon: 'streamline-color:excel', color: '#16A34A', label: 'Excel' },
  'application/vnd.ms-powerpoint': { icon: 'streamline-color:presentation-projector-screen', color: '#EA580C', label: 'PPT' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { icon: 'streamline-color:presentation-projector-screen', color: '#EA580C', label: 'PPT' },
  'application/zip': { icon: 'streamline-color:local-storage-folder', color: '#A855F7', label: 'ZIP' },
  'application/x-rar-compressed': { icon: 'streamline-color:local-storage-folder', color: '#A855F7', label: 'RAR' },
  'application/gzip': { icon: 'streamline-color:local-storage-folder', color: '#A855F7', label: 'GZ' },
  'text/markdown': { icon: 'streamline-color:pen-draw', color: '#6B7280', label: 'Markdown' },
  'text/plain': { icon: 'streamline-color:new-file', color: '#6B7280', label: '文本' },
  'text/csv': { icon: 'streamline-color:excel', color: '#16A34A', label: 'CSV' },
  'application/json': { icon: 'streamline-color:curly-brackets', color: '#F59E0B', label: 'JSON' },
  'text/html': { icon: 'streamline-color:programming-browser', color: '#F97316', label: 'HTML' },
  'audio/': { icon: 'streamline-color:button-play', color: '#EC4899', label: '音频' },
  'video/': { icon: 'streamline-color:button-play', color: '#8B5CF6', label: '视频' },
};

const EXT_MAP: Record<string, FileTypeInfo> = {
  '.pdf': MIME_MAP['application/pdf'],
  '.doc': MIME_MAP['application/msword'],
  '.docx': MIME_MAP['application/msword'],
  '.xls': MIME_MAP['application/vnd.ms-excel'],
  '.xlsx': MIME_MAP['application/vnd.ms-excel'],
  '.csv': MIME_MAP['text/csv'],
  '.ppt': MIME_MAP['application/vnd.ms-powerpoint'],
  '.pptx': MIME_MAP['application/vnd.ms-powerpoint'],
  '.md': MIME_MAP['text/markdown'],
  '.txt': MIME_MAP['text/plain'],
  '.json': MIME_MAP['application/json'],
  '.html': MIME_MAP['text/html'],
  '.zip': MIME_MAP['application/zip'],
  '.rar': MIME_MAP['application/x-rar-compressed'],
  '.gz': MIME_MAP['application/gzip'],
  '.tar': { icon: 'streamline-color:local-storage-folder', color: '#A855F7', label: 'TAR' },
  '.7z': { icon: 'streamline-color:local-storage-folder', color: '#A855F7', label: '7Z' },
  '.js': { icon: 'streamline-color:curly-brackets', color: '#F59E0B', label: 'JS' },
  '.ts': { icon: 'streamline-color:curly-brackets', color: '#3B82F6', label: 'TS' },
  '.py': { icon: 'streamline-color:curly-brackets', color: '#3B82F6', label: 'Python' },
  '.java': { icon: 'streamline-color:curly-brackets', color: '#EA580C', label: 'Java' },
  '.cpp': { icon: 'streamline-color:curly-brackets', color: '#6366F1', label: 'C++' },
  '.c': { icon: 'streamline-color:curly-brackets', color: '#6366F1', label: 'C' },
  '.go': { icon: 'streamline-color:curly-brackets', color: '#06B6D4', label: 'Go' },
  '.rs': { icon: 'streamline-color:curly-brackets', color: '#EA580C', label: 'Rust' },
  '.sql': { icon: 'streamline-color:database', color: '#6366F1', label: 'SQL' },
  '.xml': { icon: 'streamline-color:curly-brackets', color: '#F97316', label: 'XML' },
  '.yaml': { icon: 'streamline-color:curly-brackets', color: '#EC4899', label: 'YAML' },
  '.yml': { icon: 'streamline-color:curly-brackets', color: '#EC4899', label: 'YAML' },
  '.sh': { icon: 'streamline-color:curly-brackets', color: '#16A34A', label: 'Shell' },
  '.mp3': { icon: 'streamline-color:button-play', color: '#EC4899', label: 'MP3' },
  '.wav': { icon: 'streamline-color:button-play', color: '#EC4899', label: 'WAV' },
  '.mp4': { icon: 'streamline-color:button-play', color: '#8B5CF6', label: 'MP4' },
  '.avi': { icon: 'streamline-color:button-play', color: '#8B5CF6', label: 'AVI' },
  '.mov': { icon: 'streamline-color:button-play', color: '#8B5CF6', label: 'MOV' },
};

export function getFileTypeIcon(filename: string, mimeType: string): FileTypeInfo {
  if (mimeType && MIME_MAP[mimeType]) return MIME_MAP[mimeType];
  if (mimeType) {
    const prefix = mimeType.split('/')[0] + '/';
    if (MIME_MAP[prefix]) return MIME_MAP[prefix];
  }
  const ext = filename.includes('.') ? '.' + filename.split('.').pop()!.toLowerCase() : '';
  if (ext && EXT_MAP[ext]) return EXT_MAP[ext];
  return DEFAULT;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}
