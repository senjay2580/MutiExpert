import { useState, useRef, useEffect, useCallback, type PointerEvent as ReactPointerEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@iconify/react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/composed/empty-state';
import { SolidButton } from '@/components/composed/solid-button';
import { AnimatedList, AnimatedItem } from '@/components/composed/animated';
import { ConfirmDialog } from '@/components/composed/confirm-dialog';
import { cn } from '@/lib/utils';
import { knowledgeBaseService, documentService } from '@/services/knowledgeBaseService';
import { illustrationPresets } from '@/lib/illustrations';
import type { Document as DocType } from '@/types';
import { useBreadcrumbStore } from '@/stores/useBreadcrumbStore';
import { ChatPanel } from '@/components/composed/chat-panel';
import { FloatingEditor } from '@/components/composed/floating-editor';
import { toast } from 'sonner';

/* ---------------------------------------------------------------- */
/*  Helpers                                                          */
/* ---------------------------------------------------------------- */

function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const resp = (error as { response?: { data?: { detail?: string } } }).response;
    if (resp?.data?.detail) return resp.data.detail;
  }
  if (error instanceof Error) return error.message;
  return '操作失败，请重试';
}

/* ================================================================ */
/*  useResizablePanel — VSCode-style drag-to-resize hook             */
/* ================================================================ */

const PANEL_MIN = 280;
const PANEL_MAX = 600;
const PANEL_DEFAULT = 380;

function useResizablePanel(defaultWidth = PANEL_DEFAULT) {
  const [width, setWidth] = useState(defaultWidth);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startW.current = width;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    if (!isDragging.current) return;
    // Dragging left → panel gets wider (resize handle is on the left edge of panel)
    const delta = startX.current - e.clientX;
    const next = Math.min(PANEL_MAX, Math.max(PANEL_MIN, startW.current + delta));
    setWidth(next);
  }, []);

  const onPointerUp = useCallback((e: ReactPointerEvent) => {
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  return { width, onPointerDown, onPointerMove, onPointerUp };
}

type AddMode = null | 'file' | 'link' | 'article';
type DocFilter = 'all' | 'file' | 'link' | 'article';

export default function KnowledgeDetailPage() {
  const { industryId: kbId } = useParams<{ industryId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [docFilter, setDocFilter] = useState<DocFilter>('all');
  const panel = useResizablePanel();
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

  const { data: rawKb } = useQuery({
    queryKey: ['knowledge-base', kbId],
    queryFn: () => knowledgeBaseService.get(kbId!),
    enabled: !!kbId,
  });
  const kb = rawKb ?? null;

  const setDynamicLabel = useBreadcrumbStore((s) => s.setDynamicLabel);
  useEffect(() => {
    if (kb?.name) setDynamicLabel(kb.name);
    return () => setDynamicLabel(null);
  }, [kb?.name, setDynamicLabel]);

  const { data: rawDocuments = [], isLoading } = useQuery({
    queryKey: ['kb-documents', kbId],
    queryFn: () => knowledgeBaseService.listDocuments(kbId!),
    enabled: !!kbId,
  });
  const documents = rawDocuments;

  const deleteMutation = useMutation({
    mutationFn: documentService.delete,
    onSuccess: () => {
      invalidate();
      setDeleteDocId(null);
      toast.success('文档已删除');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || !kbId) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) await knowledgeBaseService.uploadDocument(kbId, file);
      invalidate();
      toast.success('文档上传成功');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
    setAddMode(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kbId]);

  const linkMutation = useMutation({
    mutationFn: () =>
      knowledgeBaseService.createLinkDocument(kbId!, {
        title: linkTitle.trim(),
        source_url: linkUrl.trim(),
      }),
    onSuccess: () => {
      invalidate();
      setAddMode(null);
      setLinkTitle('');
      setLinkUrl('');
      toast.success('链接添加成功');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });

  const articleMutation = useMutation({
    mutationFn: () =>
      knowledgeBaseService.createArticleDocument(kbId!, {
        title: articleTitle.trim(),
        content_html: articleHtml,
      }),
    onSuccess: () => {
      invalidate();
      setAddMode(null);
      setArticleTitle('');
      setArticleHtml('');
      toast.success('文章创建成功');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });

  const closeForm = () => {
    setAddMode(null);
    setLinkTitle('');
    setLinkUrl('');
    setArticleTitle('');
    setArticleHtml('');
  };

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      handleUpload(e.dataTransfer.files);
    },
    [handleUpload],
  );

  // Delete target doc for confirm dialog
  const deleteTargetDoc = deleteDocId ? documents.find((d) => d.id === deleteDocId) : null;

  // Stats by type
  const fileCount = documents.filter((d) => d.file_type === 'md').length;
  const linkCount = documents.filter((d) => d.file_type === 'link').length;
  const articleCount = documents.filter((d) => d.file_type === 'article').length;
  const totalChunks = documents.reduce((sum, d) => sum + (d.chunk_count || 0), 0);

  // Filtered documents
  const filteredDocs = docFilter === 'all'
    ? documents
    : docFilter === 'file'
      ? documents.filter((d) => d.file_type === 'md')
      : documents.filter((d) => d.file_type === docFilter);

  return (
    <div className="flex h-full">
      {/* ══════════ Left Column: KB Info + Actions ══════════ */}
      <div className="w-[280px] shrink-0 border-r border-border overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Back + KB Name */}
          <div className="flex items-start gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/knowledge')}
              className="shrink-0 text-muted-foreground hover:text-foreground -ml-1 mt-0.5 h-7 w-7"
            >
              <Icon icon="lucide:arrow-left" width={16} height={16} />
            </Button>
            <div className="min-w-0 flex-1">
              {kb ? (
                <>
                  <h2 className="text-sm font-bold leading-tight">{kb.name}</h2>
                  {kb.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{kb.description}</p>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              )}
            </div>
          </div>

          {/* Stats Grid — clickable filters */}
          <div className="grid grid-cols-2 gap-2">
            <StatCard icon="lucide:file-text" label="全部文档" value={documents.length} color="text-blue-500" active={docFilter === 'all'} onClick={() => setDocFilter('all')} />
            <StatCard icon="lucide:puzzle" label="知识块" value={totalChunks} color="text-indigo-500" />
            <StatCard icon="streamline-color:new-file" label="文档" value={fileCount} color="text-sky-500" active={docFilter === 'file'} onClick={() => setDocFilter('file')} />
            <StatCard icon="streamline-color:earth-1" label="链接" value={linkCount} color="text-emerald-500" active={docFilter === 'link'} onClick={() => setDocFilter('link')} />
            <StatCard icon="streamline-color:pen-draw" label="文章" value={articleCount} color="text-violet-500" active={docFilter === 'article'} onClick={() => setDocFilter('article')} />
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Action Buttons */}
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">添加资料</p>
            <SolidButton
              color="indigo"
              size="sm"
              icon="streamline-color:upload-box-1"
              onClick={() => fileInputRef.current?.click()}
              className="w-full justify-start"
            >
              上传文档
            </SolidButton>
            <SolidButton
              color={addMode === 'link' ? 'primary' : 'secondary'}
              size="sm"
              icon="streamline-color:link-chain"
              onClick={() => setAddMode(addMode === 'link' ? null : 'link')}
              className="w-full justify-start"
            >
              添加链接
            </SolidButton>
            <SolidButton
              color={addMode === 'article' ? 'primary' : 'secondary'}
              size="sm"
              icon="streamline-color:pen-draw"
              onClick={() => setAddMode(addMode === 'article' ? null : 'article')}
              className="w-full justify-start"
            >
              写文章
            </SolidButton>
            {uploading && (
              <div className="flex items-center gap-2 text-xs text-primary px-1">
                <Icon icon="lucide:loader" width={12} height={12} className="animate-spin" />
                上传中...
              </div>
            )}
          </div>

          {/* Link Form (inline in sidebar) */}
          {addMode === 'link' && (
            <SidebarFormCard title="添加链接" onClose={closeForm}>
              <Input
                autoFocus
                placeholder="标题"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                className="h-8 text-xs"
              />
              <Input
                placeholder="https://..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="h-8 text-xs"
              />
              {linkUrl.trim() && !isValidHttpUrl(linkUrl.trim()) && (
                <p className="text-[11px] text-destructive">请输入有效的 HTTP/HTTPS 链接</p>
              )}
              <SolidButton
                color="indigo"
                size="sm"
                onClick={() => linkMutation.mutate()}
                disabled={!linkTitle.trim() || !isValidHttpUrl(linkUrl.trim())}
                loading={linkMutation.isPending}
                loadingText="添加中..."
                className="w-full"
              >
                添加链接
              </SolidButton>
            </SidebarFormCard>
          )}

          {/* Article form is now a floating editor — see FloatingEditor below */}

          <input
            ref={fileInputRef}
            type="file"
            accept=".md"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>
      </div>

      {/* ══════════ Center Column: Document List ══════════ */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="p-4 space-y-3">
          {/* Drop Zone */}
          <div
            className={cn(
              'relative rounded-xl border-2 border-dashed transition-all duration-200',
              isDragOver
                ? 'border-primary bg-primary/5 scale-[1.005]'
                : 'border-border hover:border-muted-foreground/30',
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Icon
                  icon={isDragOver ? 'streamline-color:download-box-1' : 'streamline-color:upload-box-1'}
                  width={16}
                  height={16}
                  className="text-primary"
                />
              </div>
              <div>
                <p className="text-[13px] font-medium text-foreground">
                  {isDragOver ? '松手即可上传' : '拖拽文件到此处上传'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  支持 Markdown（.md）格式
                </p>
              </div>
            </div>
          </div>

          {/* Document List */}
          {isLoading ? (
            <Card className="gap-0 py-0">
              <div className="divide-y">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                ))}
              </div>
            </Card>
          ) : documents.length === 0 ? (
            <EmptyState
              icon="streamline-color:open-book"
              illustration={illustrationPresets.emptyDocuments}
              title="暂无资料"
              description="上传文档或添加链接，开始构建知识库"
              action={{
                label: '上传文档',
                onClick: () => fileInputRef.current?.click(),
                color: 'indigo' as const,
              }}
            />
          ) : (
            <Card className="gap-0 overflow-hidden py-0 card-glow-indigo">
              {/* List header */}
              <div className="flex items-center justify-between border-b px-5 py-3">
                <span className="text-[13px] font-semibold text-foreground">
                  文档列表
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {docFilter !== 'all' ? `${filteredDocs.length} / ${documents.length} 篇` : `共 ${documents.length} 篇`}
                </span>
              </div>
              {filteredDocs.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                  <Icon icon="lucide:search-x" width={24} height={24} />
                  <span className="text-[13px]">该分类下暂无文档</span>
                </div>
              ) : (
                <AnimatedList className="divide-y">
                  {filteredDocs.map((doc) => (
                    <AnimatedItem key={doc.id}>
                      <DocRow
                        doc={doc}
                        onDelete={() => setDeleteDocId(doc.id)}
                      />
                    </AnimatedItem>
                  ))}
                </AnimatedList>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* ══════════ Right Column: AI Chat Panel (VSCode-style resizable) ══════════ */}
      {chatOpen ? (
        <div
          className="hidden lg:flex shrink-0 h-full"
          style={{ width: panel.width }}
        >
          {/* ── Resize handle ── */}
          <div
            className="group relative w-[3px] shrink-0 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors"
            onPointerDown={panel.onPointerDown}
            onPointerMove={panel.onPointerMove}
            onPointerUp={panel.onPointerUp}
          >
            {/* Visual indicator on hover */}
            <div className="absolute inset-y-0 -left-[2px] -right-[2px] group-hover:bg-primary/20 group-active:bg-primary/30" />
          </div>

          {/* ── Panel content ── */}
          <div className="flex-1 min-w-0 flex flex-col border-l border-border">
            <div className="flex-1 min-h-0">
              <ChatPanel knowledgeBaseId={kbId!} onClose={() => setChatOpen(false)} />
            </div>
          </div>
        </div>
      ) : (
        /* ── Collapsed strip ── */
        <button
          onClick={() => setChatOpen(true)}
          className="hidden lg:flex shrink-0 w-9 h-full flex-col items-center gap-2 pt-3 border-l border-border bg-muted/20 text-muted-foreground hover:text-primary hover:bg-muted/40 transition-colors"
          title="展开 AI 助手"
        >
          <Icon icon="lucide:sparkles" width={15} height={15} className="text-primary" />
          <span
            className="text-[10px] font-medium"
            style={{ writingMode: 'vertical-rl' }}
          >
            AI 助手
          </span>
          <Icon icon="lucide:chevron-left" width={13} height={13} className="mt-1" />
        </button>
      )}

      {/* ---- Floating Article Editor ---- */}
      <FloatingEditor
        open={addMode === 'article'}
        onClose={closeForm}
        title={articleTitle}
        onTitleChange={setArticleTitle}
        html={articleHtml}
        onHtmlChange={setArticleHtml}
        onSave={() => articleMutation.mutate()}
        saving={articleMutation.isPending}
      />

      {/* ---- Delete Confirm ---- */}
      <ConfirmDialog
        open={!!deleteDocId}
        onOpenChange={(open) => !open && setDeleteDocId(null)}
        title="确认删除"
        description={`确定要删除文档「${deleteTargetDoc?.title}」吗？此操作不可恢复。`}
        confirmLabel="删除"
        variant="destructive"
        onConfirm={() => {
          if (deleteDocId) deleteMutation.mutate(deleteDocId);
        }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

/* ================================================================ */
/*  Stat Card (left sidebar)                                         */
/* ================================================================ */

function StatCard({
  icon,
  label,
  value,
  color,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  value: number;
  color: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const isClickable = !!onClick;
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2 transition-colors',
        active
          ? 'border-primary bg-primary/8 ring-1 ring-primary/20'
          : 'border-border bg-muted/30',
        isClickable && 'cursor-pointer hover:border-primary/50 hover:bg-primary/5',
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5">
        <Icon icon={icon} width={12} height={12} className={active ? 'text-primary' : color} />
        <span className={cn('text-[10px]', active ? 'text-primary font-medium' : 'text-muted-foreground')}>{label}</span>
      </div>
      <p className={cn('mt-0.5 text-lg font-bold tabular-nums', active && 'text-primary')}>{value}</p>
    </div>
  );
}

/* ================================================================ */
/*  Sidebar Form Card                                                */
/* ================================================================ */

function SidebarFormCard({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-0 border-primary py-0">
      <CardHeader className="flex-row items-center justify-between px-3 py-2">
        <CardTitle className="text-xs">{title}</CardTitle>
        <Button variant="ghost" size="icon-xs" onClick={onClose} className="text-muted-foreground h-5 w-5">
          <Icon icon="lucide:x" width={12} height={12} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3">
        {children}
      </CardContent>
    </Card>
  );
}

/* ================================================================ */
/*  Document Row                                                     */
/* ================================================================ */

const typeIconConfig: Record<string, { icon: string; color: string }> = {
  md: { icon: 'streamline-color:new-file', color: '#6B7280' },
  link: { icon: 'streamline-color:earth-1', color: '#10B981' },
  article: { icon: 'streamline-color:pen-draw', color: '#8B5CF6' },
};

function DocRow({
  doc,
  onDelete,
}: {
  doc: DocType;
  onDelete: () => void;
}) {
  const typeConf = typeIconConfig[doc.file_type] ?? { icon: 'streamline-color:new-file', color: '#6B7280' };
  const sizeStr = doc.file_size && doc.file_type !== 'link'
    ? doc.file_size > 1048576
      ? (doc.file_size / 1048576).toFixed(1) + ' MB'
      : (doc.file_size / 1024).toFixed(0) + ' KB'
    : '';

  const canPreview = true;
  const canDownload = doc.file_type !== 'link';

  const handlePreview = () => {
    if (doc.file_type === 'link' && doc.source_url) {
      window.open(doc.source_url, '_blank');
    } else {
      window.open(documentService.previewUrl(doc.id), '_blank');
    }
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = documentService.downloadUrl(doc.id);
    a.download = doc.title;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="group flex items-center gap-3 px-5 py-3.5">
          {/* Type icon with color */}
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: `linear-gradient(135deg, ${typeConf.color}18, ${typeConf.color}08)`,
              color: typeConf.color,
            }}
          >
            <Icon icon={typeConf.icon} width={18} height={18} />
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-foreground">{doc.title}</div>
            <div className="mt-0.5 flex items-center gap-2">
              <span
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: typeConf.color }}
              >
                {doc.file_type}
              </span>
              {sizeStr && (
                <span className="text-[11px] text-muted-foreground">{sizeStr}</span>
              )}
              {doc.source_url && (
                <a
                  href={doc.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
                >
                  <Icon icon="streamline-color:share-link" width={10} height={10} /> 链接
                </a>
              )}
              {doc.chunk_count > 0 && (
                <span className="text-[11px] text-muted-foreground">{doc.chunk_count} chunks</span>
              )}
              {doc.status === 'error' && doc.error_message && (
                <span className="text-[10px] text-destructive truncate max-w-[150px]" title={doc.error_message}>
                  {doc.error_message}
                </span>
              )}
            </div>
          </div>

          {/* Preview */}
          <Button
            variant="ghost"
            size="icon-xs"
            className="shrink-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            title="预览"
            onClick={handlePreview}
          >
            <Icon icon="streamline-color:magnifying-glass" width={14} height={14} />
          </Button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handlePreview} disabled={!canPreview}>
          <Icon icon="streamline-color:magnifying-glass" width={14} height={14} />
          预览
        </ContextMenuItem>
        <ContextMenuItem onClick={handleDownload} disabled={!canDownload}>
          <Icon icon="streamline-color:download-box-1" width={14} height={14} />
          下载
        </ContextMenuItem>
        {doc.source_url && (
          <ContextMenuItem onClick={() => window.open(doc.source_url, '_blank')}>
            <Icon icon="streamline-color:share-link" width={14} height={14} />
            打开链接
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          <Icon icon="lucide:trash-2" width={14} height={14} />
          删除
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}