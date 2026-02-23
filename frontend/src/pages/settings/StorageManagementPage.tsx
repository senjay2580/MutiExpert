import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icon } from '@iconify/react';
import { PageHeader } from '@/components/composed/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/composed/confirm-dialog';
import { DataTable } from '@/components/composed/data-table';
import type { DataTableColumn, DataTableAction, BulkAction } from '@/components/composed/data-table';
import {
  listStorageFiles,
  deleteStorageFiles,
  getStorageStats,
} from '@/services/storageService';
import type { StorageFile } from '@/services/storageService';

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

function downloadFile(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function StorageManagementPage() {
  const queryClient = useQueryClient();
  const [prefix, setPrefix] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string[] | null>(null);

  const { data: statsData } = useQuery({
    queryKey: ['storage-stats'],
    queryFn: getStorageStats,
  });

  const { data: filesData, isLoading } = useQuery({
    queryKey: ['storage-files', prefix],
    queryFn: () => listStorageFiles(prefix),
  });

  const deleteMutation = useMutation({
    mutationFn: (keys: string[]) => deleteStorageFiles(keys),
    onSuccess: (_data, keys) => {
      toast.success(`已删除 ${keys.length} 个文件`);
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['storage-files'] });
      queryClient.invalidateQueries({ queryKey: ['storage-stats'] });
    },
    onError: () => toast.error('删除失败，请重试'),
  });

  const files = filesData?.files ?? [];
  const publicUrlPrefix = filesData?.public_url_prefix ?? '';
  const stats = statsData?.stats && statsData.stats.total_files !== undefined ? statsData.stats : undefined;

  const folders = files.filter((f) => f.id === null || f.id === undefined);
  const realFiles = files.filter((f) => f.id !== null && f.id !== undefined);

  const breadcrumbs = prefix ? prefix.split('/').filter(Boolean) : [];

  const navigateTo = (p: string) => setPrefix(p);

  const getFileKey = (f: StorageFile) => prefix ? `${prefix}/${f.name}` : f.name;
  const getFileUrl = (f: StorageFile) => `${publicUrlPrefix}/${getFileKey(f)}`;

  const columns = useMemo((): DataTableColumn<StorageFile>[] => [
    {
      key: 'name',
      header: '文件名',
      sortable: true,
      accessor: (f) => f.name,
      render: (f) => (
        <div className="flex items-center gap-2">
          <Icon
            icon={isImage(f.name) ? 'lucide:image' : 'lucide:file'}
            className={`size-4 ${isImage(f.name) ? 'text-pink-500' : 'text-blue-500'}`}
          />
          <span className="truncate max-w-[300px]">{f.name}</span>
        </div>
      ),
    },
    {
      key: 'size',
      header: '大小',
      sortable: true,
      width: '100px',
      accessor: (f) => f.metadata?.size ?? 0,
      render: (f) => <span className="text-muted-foreground">{formatSize(f.metadata?.size ?? 0)}</span>,
    },
    {
      key: 'type',
      header: '类型',
      width: '140px',
      accessor: (f) => f.metadata?.mimetype ?? '',
      render: (f) => <span className="text-muted-foreground truncate">{f.metadata?.mimetype || '—'}</span>,
    },
  ], []);

  const actions = useMemo((): DataTableAction<StorageFile>[] => [
    {
      label: '下载',
      icon: 'lucide:download',
      onClick: (f) => downloadFile(getFileUrl(f), f.name),
    },
    {
      label: '预览',
      icon: 'lucide:eye',
      onClick: (f) => setPreviewUrl(getFileUrl(f)),
      hidden: (f) => !isImage(f.name),
    },
    {
      label: '删除',
      icon: 'lucide:trash-2',
      variant: 'destructive',
      onClick: (f) => setDeleteTarget([getFileKey(f)]),
    },
  ], [publicUrlPrefix, prefix, deleteMutation, setPreviewUrl]);

  const bulkActions = useMemo((): BulkAction[] => [
    {
      label: '批量删除',
      icon: 'lucide:trash-2',
      variant: 'destructive',
      onClick: (keys) => setDeleteTarget(keys),
    },
  ], [deleteMutation]);

  return (
    <div className="space-y-4">
      <PageHeader title="文件存储" description="管理 Supabase Storage 中的文件" />

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
                <div className="text-lg font-semibold">{Object.keys(stats.categories).length}</div>
                <div className="text-xs text-muted-foreground">分类目录</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm">
        <button onClick={() => navigateTo('')} className="text-primary hover:underline">根目录</button>
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
                onClick={() => navigateTo(prefix ? `${prefix}/${f.name}` : f.name)}
              >
                <Icon icon="lucide:folder" className="size-4 text-amber-500" />
                <span className="text-sm">{f.name}</span>
                <Icon icon="lucide:chevron-right" className="size-3.5 text-muted-foreground ml-auto" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* File table */}
      {!filesData?.success && !isLoading ? (
        <Card className="py-12">
          <CardContent className="flex items-center justify-center text-sm text-destructive">
            {filesData?.error || 'Supabase Storage 未配置，请先在「第三方集成」中配置'}
          </CardContent>
        </Card>
      ) : (
        <DataTable<StorageFile>
          data={realFiles}
          columns={columns}
          rowKey={(f) => getFileKey(f)}
          isLoading={isLoading}
          searchPlaceholder="搜索文件名..."
          searchAccessor={(f) => f.name}
          actions={actions}
          selectable
          bulkActions={bulkActions}
          emptyIcon="lucide:file"
          emptyTitle="暂无文件"
          emptyDescription="当前目录下没有文件"
          defaultRowsPerPage={20}
        />
      )}

      {/* Image preview overlay */}
      {previewUrl && (
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
        </div>
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
