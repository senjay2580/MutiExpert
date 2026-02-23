import { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@iconify/react';
import { PageHeader } from '@/components/composed/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/composed/confirm-dialog';
import { DataTable } from '@/components/composed/data-table';
import type { DataTableColumn, DataTableAction, BulkAction } from '@/components/composed/data-table';
import { workspaceService } from '@/services/workspaceService';
import { uploadToWorkspace } from '@/services/fileService';
import type { WorkspaceEntry } from '@/services/workspaceService';

function formatSize(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function isImage(name: string) {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(name);
}

function getFileIcon(name: string): { icon: string; color: string } {
  if (isImage(name)) return { icon: 'lucide:image', color: 'text-pink-500' };
  if (/\.(pdf)$/i.test(name)) return { icon: 'lucide:file-text', color: 'text-red-500' };
  if (/\.(docx?|xlsx?|pptx?|csv)$/i.test(name)) return { icon: 'lucide:file-spreadsheet', color: 'text-green-500' };
  if (/\.(js|ts|py|sh|json|yaml|yml|md|html|css)$/i.test(name)) return { icon: 'lucide:file-code', color: 'text-violet-500' };
  if (/\.(zip|tar|gz|rar|7z)$/i.test(name)) return { icon: 'lucide:file-archive', color: 'text-amber-500' };
  return { icon: 'lucide:file', color: 'text-blue-500' };
}

export default function WorkspaceFilesPage() {
  const queryClient = useQueryClient();
  const [prefix, setPrefix] = useState('.');
  const [previewUrl, setPreviewUrl] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: statsData } = useQuery({
    queryKey: ['workspace-stats'],
    queryFn: workspaceService.getStats,
  });

  const { data: listData, isLoading } = useQuery({
    queryKey: ['workspace-files', prefix],
    queryFn: () => workspaceService.listFiles(prefix),
  });

  const deleteMutation = useMutation({
    mutationFn: async (paths: string[]) => {
      for (const p of paths) await workspaceService.deleteFile(p);
    },
    onSuccess: (_data, paths) => {
      toast.success(`已删除 ${paths.length} 个文件`);
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['workspace-files'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-stats'] });
    },
    onError: () => toast.error('删除失败，请重试'),
  });

  const entries = listData?.entries ?? [];
  const folders = entries.filter((e) => e.type === 'dir');
  const files = entries.filter((e) => e.type === 'file');
  const stats = statsData?.success ? statsData : undefined;

  const breadcrumbs = prefix === '.' ? [] : prefix.split('/').filter(Boolean);

  const navigateTo = (p: string) => setPrefix(p || '.');

  const getFilePath = (name: string) => prefix === '.' ? name : `${prefix}/${name}`;
  const getDownloadUrl = (name: string) => workspaceService.getDownloadUrl(getFilePath(name));

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      const uploadPath = prefix === '.' ? '' : prefix;
      for (const file of Array.from(fileList)) {
        await uploadToWorkspace(file, uploadPath);
      }
      toast.success(`已上传 ${fileList.length} 个文件`);
      queryClient.invalidateQueries({ queryKey: ['workspace-files'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-stats'] });
    } catch {
      toast.error('上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const columns = useMemo((): DataTableColumn<WorkspaceEntry>[] => [
    {
      key: 'name',
      header: '文件名',
      sortable: true,
      accessor: (f) => f.name,
      render: (f) => {
        const fi = getFileIcon(f.name);
        return (
          <div className="flex items-center gap-2">
            <Icon icon={fi.icon} className={`size-4 ${fi.color}`} />
            <span className="truncate max-w-[300px]">{f.name}</span>
          </div>
        );
      },
    },
    {
      key: 'size',
      header: '大小',
      sortable: true,
      width: '100px',
      accessor: (f) => f.size ?? 0,
      render: (f) => <span className="text-muted-foreground">{formatSize(f.size ?? 0)}</span>,
    },
    {
      key: 'type',
      header: '类型',
      width: '140px',
      accessor: (f) => f.mime_type ?? '',
      render: (f) => <span className="text-muted-foreground truncate">{f.mime_type || '—'}</span>,
    },
    {
      key: 'modified',
      header: '修改时间',
      sortable: true,
      width: '160px',
      accessor: (f) => f.modified ?? '',
      render: (f) => (
        <span className="text-muted-foreground">
          {f.modified ? new Date(f.modified).toLocaleString('zh-CN') : '—'}
        </span>
      ),
    },
  ], []);

  const actions = useMemo((): DataTableAction<WorkspaceEntry>[] => [
    {
      label: '下载',
      icon: 'lucide:download',
      onClick: (f) => { window.open(getDownloadUrl(f.name), '_blank'); },
    },
    {
      label: '预览',
      icon: 'lucide:eye',
      onClick: (f) => setPreviewUrl(getDownloadUrl(f.name)),
      hidden: (f) => !isImage(f.name),
    },
    {
      label: '删除',
      icon: 'lucide:trash-2',
      variant: 'destructive',
      onClick: (f) => setDeleteTarget([getFilePath(f.name)]),
    },
  ], [prefix]);

  const bulkActions = useMemo((): BulkAction[] => [
    {
      label: '批量删除',
      icon: 'lucide:trash-2',
      variant: 'destructive',
      onClick: (keys) => setDeleteTarget(keys),
    },
  ], []);

  return (
    <div className="space-y-4">
      <PageHeader title="工作区文件" description="管理 AI 沙箱工作区中的文件">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
        <Button
          size="sm"
          className="gap-1.5"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <Icon icon={uploading ? 'lucide:loader-2' : 'lucide:upload'} width={14} height={14} className={uploading ? 'animate-spin' : ''} />
          {uploading ? '上传中...' : '上传文件'}
        </Button>
      </PageHeader>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="py-3">
            <CardContent className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                <Icon icon="lucide:files" className="size-4 text-blue-500" />
              </div>
              <div>
                <div className="text-lg font-semibold">{stats.total_files}</div>
                <div className="text-xs text-muted-foreground">总文件数</div>
              </div>
            </CardContent>
          </Card>
          <Card className="py-3">
            <CardContent className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                <Icon icon="lucide:hard-drive" className="size-4 text-emerald-500" />
              </div>
              <div>
                <div className="text-lg font-semibold">{formatSize(stats.total_size)}</div>
                <div className="text-xs text-muted-foreground">总大小</div>
              </div>
            </CardContent>
          </Card>
          <Card className="py-3">
            <CardContent className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
                <Icon icon="lucide:folder" className="size-4 text-amber-500" />
              </div>
              <div>
                <div className="text-lg font-semibold">{stats.total_dirs}</div>
                <div className="text-xs text-muted-foreground">目录数</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm">
        <button onClick={() => navigateTo('.')} className="text-primary hover:underline">根目录</button>
        {breadcrumbs.map((seg, i) => {
          const path = breadcrumbs.slice(0, i + 1).join('/');
          return (
            <span key={path} className="flex items-center gap-1">
              <Icon icon="lucide:chevron-right" className="size-3 text-muted-foreground" />
              <button onClick={() => navigateTo(path)} className="text-primary hover:underline">{seg}</button>
            </span>
          );
        })}
      </div>

      {/* Folders */}
      {folders.length > 0 && (
        <Card className="py-0">
          <CardContent className="p-0">
            {folders.map((f) => (
              <div
                key={f.name}
                className="flex items-center gap-2 px-4 py-2.5 border-b last:border-b-0 hover:bg-muted/30 cursor-pointer"
                onClick={() => navigateTo(prefix === '.' ? f.name : `${prefix}/${f.name}`)}
              >
                <Icon icon="lucide:folder" className="size-4 text-amber-500" />
                <span className="text-sm flex-1">{f.name}</span>
                <span className="text-xs text-muted-foreground">{f.child_count ?? 0} 项</span>
                <Icon icon="lucide:chevron-right" className="size-3.5 text-muted-foreground" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* File table */}
      <DataTable<WorkspaceEntry>
        data={files}
        columns={columns}
        rowKey={(f) => getFilePath(f.name)}
        isLoading={isLoading}
        searchPlaceholder="搜索文件名..."
        searchAccessor={(f) => f.name}
        actions={actions}
        selectable
        bulkActions={bulkActions}
        emptyIcon="lucide:folder-open"
        emptyTitle="暂无文件"
        emptyDescription="当前目录下没有文件"
        defaultRowsPerPage={20}
      />

      {/* Image preview */}
      {previewUrl && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60" onClick={() => setPreviewUrl('')}>
          <div className="relative max-w-[80vw] max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <img src={previewUrl} alt="preview" className="max-w-full max-h-[80vh] rounded-lg shadow-xl" />
            <button
              onClick={() => setPreviewUrl('')}
              className="absolute -top-3 -right-3 flex h-7 w-7 items-center justify-center rounded-full bg-background shadow border"
            >
              <Icon icon="lucide:x" className="size-4" />
            </button>
          </div>
        </div>,
        document.body,
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={`删除 ${deleteTarget?.length ?? 0} 个文件？`}
        description="此操作不可撤销，文件将被永久删除。"
        confirmLabel="确认删除"
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
