import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@iconify/react';
import { dashboardService } from '@/services/dashboardService';
import { dataManagementService } from '@/services/dataManagementService';
import { PageHeader } from '@/components/composed/page-header';
import { StatCard } from '@/components/composed/stat-card';
import { CardSkeleton } from '@/components/composed/loading-skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const MOCK_OVERVIEW = {
  total_knowledge_bases: 12,
  total_documents: 1756,
  total_conversations: 342,
  total_insights: 89,
};

export default function DataManagementPage() {
  const { data: rawOverview, isLoading } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: dashboardService.getOverview,
  });
  const overview = rawOverview ?? MOCK_OVERVIEW;

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setActionLoading('export');
    setMessage(null);
    try {
      const data = await dataManagementService.export();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mutiexpert-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: '数据导出成功' });
    } catch {
      setMessage({ type: 'error', text: '导出失败，请重试' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setActionLoading('import');
    setMessage(null);
    try {
      const result = await dataManagementService.import(file);
      setMessage({ type: 'success', text: `导入完成: ${JSON.stringify(result.imported)}` });
    } catch {
      setMessage({ type: 'error', text: '导入失败，请检查文件格式' });
    } finally {
      setActionLoading(null);
      e.target.value = '';
    }
  };

  const handleRebuild = async () => {
    setActionLoading('rebuild');
    setMessage(null);
    try {
      await dataManagementService.rebuildIndexes();
      setMessage({ type: 'success', text: '索引重建成功' });
    } catch {
      setMessage({ type: 'error', text: '索引重建失败' });
    } finally {
      setActionLoading(null);
    }
  };

  const actions = [
    { key: 'export', icon: 'streamline-color:download-box-1', label: '导出数据', desc: '导出所有知识库数据为 JSON', iconClassName: 'text-blue-500', onClick: handleExport },
    { key: 'import', icon: 'streamline-color:upload-box-1', label: '导入数据', desc: '从 JSON 文件导入知识库', iconClassName: 'text-green-500', onClick: () => importRef.current?.click() },
    { key: 'rebuild', icon: 'streamline-color:arrow-reload-horizontal-1', label: '重建索引', desc: '重新生成向量索引', iconClassName: 'text-yellow-500', onClick: handleRebuild },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="数据管理" description="管理知识库数据的导入导出和备份恢复" />
      <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />

      {message && (
        <div className={cn(
          'rounded-lg px-4 py-2 text-sm',
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
        )}>
          {message.text}
        </div>
      )}

      {/* Database Status */}
      <Card className="gap-4 py-5">
        <CardContent>
          <div className="mb-4 flex items-center gap-3">
            <Icon icon="streamline-color:database" width={18} height={18} className="text-primary" />
            <span className="text-sm font-semibold text-foreground">数据库状态</span>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="知识库" value={overview?.total_knowledge_bases ?? 0} icon="streamline-color:open-book" />
              <StatCard label="文档总数" value={overview?.total_documents ?? 0} icon="streamline-color:new-file" />
              <StatCard label="对话数" value={overview?.total_conversations ?? 0} icon="streamline-color:chat-bubble-text-square" />
              <StatCard label="洞察数" value={overview?.total_insights ?? 0} icon="streamline-color:lightbulb" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {actions.map((action) => (
          <Card
            key={action.key}
            className={cn('cursor-pointer gap-0 py-0 card-raised', actionLoading === action.key && 'opacity-60 pointer-events-none')}
            onClick={action.onClick}
          >
            <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
              {actionLoading === action.key ? (
                <Icon icon="lucide:loader-2" width={24} height={24} className="animate-spin text-muted-foreground" />
              ) : (
                <Icon icon={action.icon} width={24} height={24} className={action.iconClassName} />
              )}
              <div>
                <div className="text-sm font-medium text-foreground">{action.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{action.desc}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
