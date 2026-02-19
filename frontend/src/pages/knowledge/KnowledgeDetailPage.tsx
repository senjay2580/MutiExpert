import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Upload, FileText, Trash2, Loader2, RefreshCw, BookOpen,
  Link as LinkIcon, PenLine, X, ExternalLink, Globe,
} from 'lucide-react';
import { knowledgeBaseService, documentService } from '../../services/knowledgeBaseService';
import type { Document as DocType } from '../../types';
import TiptapEditor from '../../components/editor/TiptapEditor';

type AddMode = null | 'file' | 'link' | 'article';

export default function KnowledgeDetailPage() {
  const { industryId: kbId } = useParams<{ industryId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>(null);
  // Link form
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  // Article form
  const [articleTitle, setArticleTitle] = useState('');
  const [articleHtml, setArticleHtml] = useState('');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['kb-documents', kbId] });
    queryClient.invalidateQueries({ queryKey: ['knowledge-bases'] });
  };

  const { data: kb } = useQuery({
    queryKey: ['knowledge-base', kbId],
    queryFn: () => knowledgeBaseService.get(kbId!),
    enabled: !!kbId,
  });

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['kb-documents', kbId],
    queryFn: () => knowledgeBaseService.listDocuments(kbId!),
    enabled: !!kbId,
  });

  const deleteMutation = useMutation({ mutationFn: documentService.delete, onSuccess: invalidate });
  const reprocessMutation = useMutation({ mutationFn: documentService.reprocess, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kb-documents', kbId] }) });

  const handleUpload = async (files: FileList | null) => {
    if (!files || !kbId) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) await knowledgeBaseService.uploadDocument(kbId, file);
      invalidate();
    } finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
    setAddMode(null);
  };

  const linkMutation = useMutation({
    mutationFn: () => knowledgeBaseService.createLinkDocument(kbId!, { title: linkTitle.trim(), source_url: linkUrl.trim() }),
    onSuccess: () => { invalidate(); setAddMode(null); setLinkTitle(''); setLinkUrl(''); },
  });

  const articleMutation = useMutation({
    mutationFn: () => knowledgeBaseService.createArticleDocument(kbId!, { title: articleTitle.trim(), content_html: articleHtml }),
    onSuccess: () => { invalidate(); setAddMode(null); setArticleTitle(''); setArticleHtml(''); },
  });

  const closeForm = () => { setAddMode(null); setLinkTitle(''); setLinkUrl(''); setArticleTitle(''); setArticleHtml(''); };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/knowledge')} className="p-1.5 rounded-md cursor-pointer transition-colors hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={18} strokeWidth={1.8} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] sm:text-[16px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{kb?.name ?? '加载中...'}</h2>
          {kb?.description && <p className="text-[12px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{kb.description}</p>}
        </div>
      </div>

      {/* Add buttons */}
      <div className="grid grid-cols-3 gap-3">
        {([
          { mode: 'file' as const, icon: Upload, label: '上传文档', desc: 'PDF / Word / Markdown' },
          { mode: 'link' as const, icon: LinkIcon, label: '添加链接', desc: '网页链接自动摘要' },
          { mode: 'article' as const, icon: PenLine, label: '写文章', desc: 'tiptap 富文本编辑' },
        ]).map((item) => (
          <button
            key={item.mode}
            onClick={() => item.mode === 'file' ? fileInputRef.current?.click() : setAddMode(item.mode)}
            className="flex flex-col items-center gap-2 p-4 sm:p-5 rounded-xl cursor-pointer transition-colors text-center"
            style={{ background: addMode === item.mode ? 'var(--accent-subtle)' : 'var(--bg-surface)', border: addMode === item.mode ? '1px solid var(--accent)' : '1px solid var(--border-default)' }}
          >
            <item.icon size={20} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
            <span className="text-[12px] sm:text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{item.label}</span>
            <span className="text-[10px] sm:text-[11px] hidden sm:block" style={{ color: 'var(--text-muted)' }}>{item.desc}</span>
          </button>
        ))}
        <input ref={fileInputRef} type="file" accept=".pdf,.docx,.md" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
      </div>

      {uploading && <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-muted)' }}><Loader2 size={14} className="animate-spin" /> 上传中...</div>}

      {/* Link form */}
      {addMode === 'link' && (
        <FormCard title="添加链接" onClose={closeForm}>
          <input placeholder="标题" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg text-[13px] bg-transparent outline-none" style={{ border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
          <input placeholder="https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="w-full px-3 py-2 rounded-lg text-[13px] bg-transparent outline-none" style={{ border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
          <button onClick={() => linkMutation.mutate()} disabled={!linkTitle.trim() || !linkUrl.trim() || linkMutation.isPending} className="px-4 py-2 rounded-lg text-[13px] font-medium cursor-pointer disabled:opacity-50" style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}>
            {linkMutation.isPending ? '添加中...' : '添加链接'}
          </button>
        </FormCard>
      )}

      {/* Article form */}
      {addMode === 'article' && (
        <FormCard title="写文章" onClose={closeForm}>
          <input placeholder="文章标题" value={articleTitle} onChange={(e) => setArticleTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg text-[13px] bg-transparent outline-none" style={{ border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
          <TiptapEditor content={articleHtml} onChange={setArticleHtml} placeholder="开始编写文章内容..." />
          <button onClick={() => articleMutation.mutate()} disabled={!articleTitle.trim() || !articleHtml.trim() || articleMutation.isPending} className="px-4 py-2 rounded-lg text-[13px] font-medium cursor-pointer disabled:opacity-50" style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}>
            {articleMutation.isPending ? '保存中...' : '保存文章'}
          </button>
        </FormCard>
      )}

      {/* Stats */}
      <div className="flex gap-3">
        <StatBadge label="文档总数" value={documents.length} />
        <StatBadge label="已就绪" value={documents.filter(d => d.status === 'ready').length} />
        <StatBadge label="处理中" value={documents.filter(d => d.status === 'processing' || d.status === 'uploading').length} />
      </div>

      {/* Document List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
          <BookOpen size={36} strokeWidth={1.2} style={{ color: 'var(--text-muted)' }} />
          <p className="mt-3 text-[13px]" style={{ color: 'var(--text-muted)' }}>暂无资料，使用上方按钮添加</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden divide-y" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderColor: 'var(--border-default)' }}>
          {documents.map((doc) => (
            <DocRow key={doc.id} doc={doc} onDelete={() => { if (confirm('确定删除？')) deleteMutation.mutate(doc.id); }} onReprocess={() => reprocessMutation.mutate(doc.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function FormCard({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--accent)' }}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</span>
        <button onClick={onClose} className="p-1 rounded-md cursor-pointer" style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
      </div>
      {children}
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-3 py-2 rounded-lg text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
      <div className="text-[16px] font-bold" style={{ color: 'var(--text-primary)' }}>{value}</div>
      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}

const typeIcons: Record<string, typeof FileText> = { pdf: FileText, docx: FileText, md: FileText, link: Globe, article: PenLine };
const statusMap: Record<string, { label: string; color: string; bg: string }> = {
  ready: { label: '就绪', color: 'var(--success)', bg: 'var(--success-subtle)' },
  processing: { label: '处理中', color: 'var(--warning)', bg: 'var(--warning-subtle)' },
  uploading: { label: '上传中', color: 'var(--info)', bg: 'var(--info-subtle)' },
  error: { label: '错误', color: 'var(--error)', bg: 'var(--error-subtle)' },
};

function DocRow({ doc, onDelete, onReprocess }: { doc: DocType; onDelete: () => void; onReprocess: () => void }) {
  const status = statusMap[doc.status] ?? statusMap.processing;
  const Icon = typeIcons[doc.file_type] ?? FileText;
  const sizeStr = doc.file_size ? (doc.file_size > 1048576 ? (doc.file_size / 1048576).toFixed(1) + ' MB' : (doc.file_size / 1024).toFixed(0) + ' KB') : '';

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-3.5 transition-colors group"
      style={{ transitionDuration: 'var(--duration-fast)' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon size={18} strokeWidth={1.5} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{doc.title}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] uppercase" style={{ color: 'var(--text-muted)' }}>{doc.file_type}</span>
          {sizeStr && <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{sizeStr}</span>}
          {doc.source_url && (
            <a href={doc.source_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-0.5 text-[11px]" style={{ color: 'var(--accent)' }}>
              <ExternalLink size={10} /> 链接
            </a>
          )}
          {doc.chunk_count > 0 && <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{doc.chunk_count} chunks</span>}
        </div>
      </div>
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0" style={{ background: status.bg, color: status.color }}>{status.label}</span>
      {doc.status === 'error' && (
        <button onClick={onReprocess} className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" style={{ color: 'var(--text-muted)' }} title="重新处理">
          <RefreshCw size={14} strokeWidth={1.8} />
        </button>
      )}
      <button
        onClick={onDelete}
        className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--error)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
      >
        <Trash2 size={14} strokeWidth={1.8} />
      </button>
    </div>
  );
}
