import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@iconify/react';
import { dashboardService } from '@/services/dashboardService';
import { dataManagementService } from '@/services/dataManagementService';
import { PageHeader } from '@/components/composed/page-header';
import { StatCard } from '@/components/composed/stat-card';
import { CardSkeleton } from '@/components/composed/loading-skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function DataManagementPage() {
  const { data: overview, isLoading } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: dashboardService.getOverview,
  });

  const { data: embeddingInfo, isLoading: embeddingLoading } = useQuery({
    queryKey: ['embedding-info'],
    queryFn: dataManagementService.getEmbeddingInfo,
  });

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const handleTestEmbedding = async () => {
    setActionLoading('test');
    setMessage(null);
    try {
      const result = await dataManagementService.testEmbedding();
      if (result.ok) {
        setMessage({ type: 'success', text: `向量模型连接正常，维度: ${result.dimension}` });
      } else {
        setMessage({ type: 'error', text: `连接失败: ${result.detail}` });
      }
    } catch {
      setMessage({ type: 'error', text: '向量模型连接失败' });
    } finally {
      setActionLoading(null);
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
    { key: 'test', icon: 'streamline-color:ai-generate-variation-spark', label: '测试向量模型', desc: '验证 Embedding API 连通性', onClick: handleTestEmbedding },
    { key: 'rebuild', icon: 'streamline-color:arrow-reload-horizontal-1', label: '重建向量索引', desc: '重新生成 pgvector 索引', onClick: handleRebuild },
  ];
  return (
    <div className="space-y-4">
      <PageHeader title="数据管理" description="向量模型与知识库数据维护" />

      {message && (
        <div className={cn(
          'rounded-lg px-4 py-2 text-sm',
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
        )}>
          {message.text}
        </div>
      )}

      {/* Embedding Model Info */}
      <Card className="gap-4 py-5">
        <CardContent>
          <div className="mb-4 flex items-center gap-3">
            <Icon icon="streamline-color:ai-generate-variation-spark" width={18} height={18} className="text-primary" />
            <span className="text-sm font-semibold text-foreground">向量模型</span>
          </div>
          {embeddingLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <CardSkeleton /><CardSkeleton /><CardSkeleton />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard label="模型" value={embeddingInfo?.model ?? '-'} icon="streamline-color:module-three" />
              <StatCard label="API 地址" value={embeddingInfo?.api_base?.replace('https://', '').replace('/v1', '') ?? '-'} icon="streamline-color:programming-browser" />
              <StatCard label="向量分片数" value={embeddingInfo?.total_chunks ?? 0} icon="streamline-color:database" />
            </div>
          )}
        </CardContent>
      </Card>
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                <Icon icon={action.icon} width={24} height={24} />
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
