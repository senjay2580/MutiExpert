/** 文件类型图标映射 — 根据 MIME type / 扩展名返回对应图标、颜色、标签 */

export type FileTypeInfo = { icon: string; color: string; label: string };

const DEFAULT: FileTypeInfo = { icon: 'vscode-icons:default-file', color: '#6B7280', label: '文件' };

const MIME_MAP: Record<string, FileTypeInfo> = {
  'application/pdf': { icon: 'vscode-icons:file-type-pdf2', color: '#EF4444', label: 'PDF' },
  'application/msword': { icon: 'vscode-icons:file-type-word', color: '#2563EB', label: 'Word' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: 'vscode-icons:file-type-word', color: '#2563EB', label: 'Word' },
  'application/vnd.ms-excel': { icon: 'vscode-icons:file-type-excel', color: '#16A34A', label: 'Excel' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { icon: 'vscode-icons:file-type-excel', color: '#16A34A', label: 'Excel' },
  'application/vnd.ms-powerpoint': { icon: 'vscode-icons:file-type-powerpoint', color: '#EA580C', label: 'PPT' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { icon: 'vscode-icons:file-type-powerpoint', color: '#EA580C', label: 'PPT' },
  'application/zip': { icon: 'vscode-icons:file-type-zip', color: '#A855F7', label: 'ZIP' },
  'application/x-rar-compressed': { icon: 'vscode-icons:file-type-zip', color: '#A855F7', label: 'RAR' },
  'application/gzip': { icon: 'vscode-icons:file-type-zip', color: '#A855F7', label: 'GZ' },
  'text/markdown': { icon: 'vscode-icons:file-type-markdown', color: '#6B7280', label: 'Markdown' },
  'text/plain': { icon: 'vscode-icons:file-type-text', color: '#6B7280', label: '文本' },
  'text/csv': { icon: 'vscode-icons:file-type-excel', color: '#16A34A', label: 'CSV' },
  'application/json': { icon: 'vscode-icons:file-type-json', color: '#F59E0B', label: 'JSON' },
  'text/html': { icon: 'vscode-icons:file-type-html', color: '#F97316', label: 'HTML' },
  'audio/': { icon: 'vscode-icons:file-type-audio', color: '#EC4899', label: '音频' },
  'video/': { icon: 'vscode-icons:file-type-video', color: '#8B5CF6', label: '视频' },
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
  '.tar': { icon: 'vscode-icons:file-type-zip', color: '#A855F7', label: 'TAR' },
  '.7z': { icon: 'vscode-icons:file-type-zip', color: '#A855F7', label: '7Z' },
  '.js': { icon: 'vscode-icons:file-type-js-official', color: '#F59E0B', label: 'JS' },
  '.ts': { icon: 'vscode-icons:file-type-typescript-official', color: '#3B82F6', label: 'TS' },
  '.py': { icon: 'vscode-icons:file-type-python', color: '#3B82F6', label: 'Python' },
  '.java': { icon: 'vscode-icons:file-type-java', color: '#EA580C', label: 'Java' },
  '.cpp': { icon: 'vscode-icons:file-type-cpp3', color: '#6366F1', label: 'C++' },
  '.c': { icon: 'vscode-icons:file-type-c3', color: '#6366F1', label: 'C' },
  '.go': { icon: 'vscode-icons:file-type-go', color: '#06B6D4', label: 'Go' },
  '.rs': { icon: 'vscode-icons:file-type-rust', color: '#EA580C', label: 'Rust' },
  '.sql': { icon: 'vscode-icons:file-type-sql', color: '#6366F1', label: 'SQL' },
  '.xml': { icon: 'vscode-icons:file-type-xml', color: '#F97316', label: 'XML' },
  '.yaml': { icon: 'vscode-icons:file-type-yaml', color: '#EC4899', label: 'YAML' },
  '.yml': { icon: 'vscode-icons:file-type-yaml', color: '#EC4899', label: 'YAML' },
  '.sh': { icon: 'vscode-icons:file-type-shell', color: '#16A34A', label: 'Shell' },
  '.mp3': { icon: 'vscode-icons:file-type-audio', color: '#EC4899', label: 'MP3' },
  '.wav': { icon: 'vscode-icons:file-type-audio', color: '#EC4899', label: 'WAV' },
  '.mp4': { icon: 'vscode-icons:file-type-video', color: '#8B5CF6', label: 'MP4' },
  '.avi': { icon: 'vscode-icons:file-type-video', color: '#8B5CF6', label: 'AVI' },
  '.mov': { icon: 'vscode-icons:file-type-video', color: '#8B5CF6', label: 'MOV' },
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
