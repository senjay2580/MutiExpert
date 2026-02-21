import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/composed/page-header';
import { StatCard } from '@/components/composed/stat-card';
import { SolidButton } from '@/components/composed/solid-button';
import {
  DataTable,
  type BulkAction,
  type DataTableAction,
  type DataTableColumn,
  type FacetedFilterDef,
} from '@/components/composed/data-table';
import { botToolService } from '@/services/botToolService';
import type { BotTool } from '@/types';

function ParamBadges({ parameters }: { parameters: Record<string, unknown> | null }) {
  const props = (parameters as { properties?: Record<string, { type?: string }> })?.properties;
  if (!props || !Object.keys(props).length) return <span className="text-[10px] text-muted-foreground/50">无参数</span>;
  const required = new Set((parameters as { required?: string[] })?.required ?? []);
  const entries = Object.entries(props).slice(0, 5);
  const overflow = Object.keys(props).length - entries.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {entries.map(([name, schema]) => (
        <span key={name} className={cn('inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono text-[10px]', required.has(name) ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
          {name}<span className="opacity-50">:{schema?.type || '?'}</span>
        </span>
      ))}
      {overflow > 0 && <span className="text-[10px] text-muted-foreground">+{overflow}</span>}
    </div>
  );
}

export default function BotToolsPage() {
  const queryClient = useQueryClient();
  const [detailTool, setDetailTool] = useState<BotTool | null>(null);

  const { data: tools = [], isLoading } = useQuery({
    queryKey: ['bot-tools'],
    queryFn: botToolService.list,
  });

  const toggleMutation = useMutation({
    mutationFn: botToolService.toggle,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bot-tools'] }),
  });

  const bulkEnableMutation = useMutation({
    mutationFn: (p: { ids: string[]; enabled: boolean }) => botToolService.bulkEnable(p.ids, p.enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bot-tools'] }),
  });

  const syncMutation = useMutation({
    mutationFn: botToolService.sync,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bot-tools'] }),
  });

  const totalTools = tools.length;
  const enabledTools = tools.filter((t) => t.enabled).length;
  const queryTools = tools.filter((t) => t.action_type === 'query').length;
  const mutationTools = tools.filter((t) => t.action_type === 'mutation').length;

  const facetedFilters = useMemo((): FacetedFilterDef<BotTool>[] => [
    {
      key: 'action_type',
      label: '类型',
      icon: 'lucide:tag',
      options: [
        { value: 'query', label: '查询', icon: 'lucide:search' },
        { value: 'mutation', label: '修改', icon: 'lucide:pencil' },
      ],
      accessor: (t) => t.action_type,
    },
    {
      key: 'enabled',
      label: '状态',
      icon: 'lucide:toggle-right',
      options: [
        { value: 'enabled', label: '启用', icon: 'lucide:check-circle-2' },
        { value: 'disabled', label: '禁用', icon: 'lucide:x-circle' },
      ],
      accessor: (t) => (t.enabled ? 'enabled' : 'disabled'),
    },
  ], []);

  const bulkActions = useMemo((): BulkAction[] => [
    {
      label: '批量启用',
      icon: 'lucide:check-circle-2',
      onClick: (ids) => bulkEnableMutation.mutate({ ids, enabled: true }),
    },
    {
      label: '批量禁用',
      icon: 'lucide:x-circle',
      onClick: (ids) => bulkEnableMutation.mutate({ ids, enabled: false }),
    },
  ], [bulkEnableMutation]);

  const columns = useMemo((): DataTableColumn<BotTool>[] => [
    {
      key: 'name',
      header: '工具名称',
      sortable: true,
      width: '200px',
      render: (t) => (
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground font-mono truncate">{t.name}</div>
          {t.description && <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">{t.description}</div>}
        </div>
      ),
    },
    {
      key: 'action_type',
      header: '类型',
      width: '80px',
      render: (t) => (
        <Badge variant="outline" className={cn('text-[10px]', t.action_type === 'query' ? 'text-blue-600 border-blue-200 dark:border-blue-800 dark:text-blue-400' : 'text-amber-600 border-amber-200 dark:border-amber-800 dark:text-amber-400')}>
          {t.action_type === 'query' ? '查询' : '修改'}
        </Badge>
      ),
    },
    {
      key: 'endpoint',
      header: '端点',
      width: '220px',
      render: (t) => (
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[9px] font-mono px-1.5 shrink-0">{t.method}</Badge>
          <span className="text-xs font-mono text-muted-foreground truncate max-w-[160px]">{t.endpoint}</span>
        </div>
      ),
    },
    {
      key: 'parameters',
      header: '参数签名',
      width: '260px',
      render: (t) => <ParamBadges parameters={t.parameters} />,
    },
    {
      key: 'toggle',
      header: '开关',
      width: '60px',
      render: (t) => (
        <Switch checked={t.enabled} onCheckedChange={() => toggleMutation.mutate(t.id)} className="scale-90" />
      ),
    },
  ], [toggleMutation]);

  const actions: DataTableAction<BotTool>[] = [
    { label: '查看签名', icon: 'lucide:code-2', onClick: (t) => setDetailTool(t) },
  ];

  return (
    <div className="flex flex-col gap-6 h-full">
      <PageHeader
        title="Bot Tools"
        description="从后端 API 自动发现工具定义，AI 根据签名智能调用"
        icon="lucide:wrench"
        iconClassName="text-orange-500"
      >
        <SolidButton
          color="primary"
          icon="lucide:refresh-cw"
          onClick={() => syncMutation.mutate()}
          loading={syncMutation.isPending}
          loadingText="同步中..."
        >
          同步工具
        </SolidButton>
      </PageHeader>

      {syncMutation.isSuccess && syncMutation.data && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
          同步完成：新增 {syncMutation.data.created} · 更新 {syncMutation.data.updated} · 移除 {syncMutation.data.removed} · 共 {syncMutation.data.total} 个端点
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="工具总数" value={totalTools} icon="lucide:layers" iconColor="#f97316" description="已发现的接口" />
        <StatCard label="启用中" value={enabledTools} icon="lucide:check-circle-2" iconColor="#10b981" description="AI 可调用" />
        <StatCard label="查询类" value={queryTools} icon="lucide:search" iconColor="#3b82f6" description="GET 只读" />
        <StatCard label="修改类" value={mutationTools} icon="lucide:pencil" iconColor="#f59e0b" description="POST/PUT/DELETE" />
      </div>

      <DataTable<BotTool>
        data={tools}
        columns={columns}
        rowKey={(t) => t.id}
        searchPlaceholder="搜索工具名称或端点..."
        searchAccessor={(t) => t.name + (t.description ?? '') + t.endpoint}
        actions={actions}
        facetedFilters={facetedFilters}
        selectable
        bulkActions={bulkActions}
        emptyIcon="lucide:wrench"
        emptyTitle={isLoading ? '加载中...' : '还没有工具'}
        emptyDescription="点击「同步工具」从后端 API 自动发现接口定义"
        emptyActionLabel="同步工具"
        emptyActionClick={() => syncMutation.mutate()}
        emptyActionColor="create"
        defaultRowsPerPage={15}
        cardClassName="card-glow-orange"
      />

      {/* 签名详情 Dialog */}
      <Dialog open={!!detailTool} onOpenChange={(open) => { if (!open) setDetailTool(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">{detailTool?.name}</DialogTitle>
          </DialogHeader>
          {detailTool && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">{detailTool.method}</Badge>
                <span className="font-mono text-sm text-muted-foreground">{detailTool.endpoint}</span>
              </div>
              {detailTool.description && (
                <p className="text-sm text-muted-foreground">{detailTool.description}</p>
              )}
              <div>
                <div className="mb-2 text-[11px] font-medium text-muted-foreground">参数定义（JSON Schema）</div>
                <pre className="overflow-x-auto rounded-lg bg-[#22272e] p-4 text-[11px] leading-relaxed text-zinc-300 font-mono">
                  {JSON.stringify(detailTool.parameters, null, 2)}
                </pre>
              </div>
              {detailTool.param_mapping && Object.keys(detailTool.param_mapping).length > 0 && (
                <div>
                  <div className="mb-2 text-[11px] font-medium text-muted-foreground">参数映射</div>
                  <pre className="overflow-x-auto rounded-lg bg-[#22272e] p-4 text-[11px] leading-relaxed text-zinc-300 font-mono">
                    {JSON.stringify(detailTool.param_mapping, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
