import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@iconify/react';
import { PageHeader } from '@/components/composed/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { SolidButton } from '@/components/composed/solid-button';
import {
  listStorageFiles,
  deleteStorageFiles,
  getStorageStats,
} from '@/services/storageService';

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

export default function StorageManagementPage() {
  const queryClient = useQueryClient();
  const [prefix, setPrefix] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewUrl, setPreviewUrl] = useState('');

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
    onSuccess: () => {
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ['storage-files'] });
      queryClient.invalidateQueries({ queryKey: ['storage-stats'] });
    },
  });

  const files = filesData?.files ?? [];
  const stats = statsData?.stats;

  // 从文件列表提取子目录（id 为 null 的是文件夹）
  const folders = files.filter((f) => f.id === null);
  const realFiles = files.filter((f) => f.id !== null);

  const breadcrumbs = prefix ? prefix.split('/').filter(Boolean) : [];

  const navigateTo = (p: string) => {
    setPrefix(p);
    setSelected(new Set());
  };

  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === realFiles.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(realFiles.map((f) => (prefix ? `${prefix}/${f.name}` : f.name))));
    }
  };

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

      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-sm">
          <button onClick={() => navigateTo('')} className="text-primary hover:underline">
            根目录
          </button>
          {breadcrumbs.map((seg, i) => {
            const path = breadcrumbs.slice(0, i + 1).join('/');
            return (
              <span key={path} className="flex items-center gap-1">
                <Icon icon="lucide:chevron-right" className="size-3 text-muted-foreground" />
                <button onClick={() => navigateTo(path)} className="text-primary hover:underline">
                  {seg}
                </button>
              </span>
            );
          })}
        </div>
        {selected.size > 0 && (
          <SolidButton
            color="destructive"
            icon="lucide:trash-2"
            onClick={() => deleteMutation.mutate([...selected])}
            loading={deleteMutation.isPending}
            loadingText="删除中..."
          >
            删除 ({selected.size})
          </SolidButton>
        )}
      </div>
// __CONTINUE_HERE__

      {/* File table */}
      <Card className="py-0">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">加载中...</div>
          ) : !filesData?.success ? (
            <div className="flex items-center justify-center py-12 text-sm text-destructive">
              {filesData?.error || 'Supabase Storage 未配置，请先在「第三方集成」中配置'}
            </div>
          ) : files.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">暂无文件</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="w-10 px-3 py-2">
                    {realFiles.length > 0 && (
                      <Checkbox checked={selected.size === realFiles.length && realFiles.length > 0} onCheckedChange={toggleAll} />
                    )}
                  </th>
                  <th className="px-3 py-2">文件名</th>
                  <th className="w-24 px-3 py-2">大小</th>
                  <th className="w-32 px-3 py-2">类型</th>
                  <th className="w-20 px-3 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {folders.map((f) => (
                  <tr
                    key={f.name}
                    className="border-b hover:bg-muted/30 cursor-pointer"
                    onClick={() => navigateTo(prefix ? `${prefix}/${f.name}` : f.name)}
                  >
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 flex items-center gap-2">
                      <Icon icon="lucide:folder" className="size-4 text-amber-500" />
                      <span>{f.name}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">—</td>
                    <td className="px-3 py-2 text-muted-foreground">文件夹</td>
                    <td className="px-3 py-2" />
                  </tr>
                ))}
                {realFiles.map((f) => {
                  const key = prefix ? `${prefix}/${f.name}` : f.name;
                  const size = f.metadata?.size ?? 0;
                  const mime = f.metadata?.mimetype ?? '';
                  return (
                    <tr key={f.name} className="border-b hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <Checkbox checked={selected.has(key)} onCheckedChange={() => toggleSelect(key)} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Icon
                            icon={isImage(f.name) ? 'lucide:image' : 'lucide:file'}
                            className={`size-4 ${isImage(f.name) ? 'text-pink-500' : 'text-blue-500'}`}
                          />
                          <span className="truncate max-w-[300px]">{f.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{formatSize(size)}</td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[120px]">{mime || '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          {isImage(f.name) && (
                            <button
                              onClick={() => setPreviewUrl(key)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                              title="预览"
                            >
                              <Icon icon="lucide:eye" className="size-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteMutation.mutate([key])}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            title="删除"
                          >
                            <Icon icon="lucide:trash-2" className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Image preview overlay */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setPreviewUrl('')}
        >
          <div className="relative max-w-[80vw] max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewUrl}
              alt="preview"
              className="max-w-full max-h-[80vh] rounded-lg shadow-xl"
            />
            <button
              onClick={() => setPreviewUrl('')}
              className="absolute -top-3 -right-3 flex h-7 w-7 items-center justify-center rounded-full bg-background shadow border"
            >
              <Icon icon="lucide:x" className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
