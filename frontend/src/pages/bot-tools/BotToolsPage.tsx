import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/composed/page-header';
import { StatCard } from '@/components/composed/stat-card';
import { CreateButton, SolidButton } from '@/components/composed/solid-button';
import { ConfirmDialog } from '@/components/composed/confirm-dialog';
import { DataTable, type DataTableColumn, type DataTableAction } from '@/components/composed/data-table';
import { botToolService } from '@/services/botToolService';
import type { AvailableEndpoint } from '@/services/botToolService';
import type { BotTool } from '@/types';

type FormData = {
  name: string;
  description: string;
  action_type: 'query' | 'mutation';
  endpoint: string;
  method: string;
  param_mapping: string;
  parameters: string;
};

const EMPTY_FORM: FormData = {
  name: '',
  description: '',
  action_type: 'query',
  endpoint: '',
  method: 'GET',
  param_mapping: '{}',
  parameters: '{"type":"object","properties":{}}',
};

export default function BotToolsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingTool, setEditingTool] = useState<BotTool | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<BotTool | null>(null);
  const [showEndpointPicker, setShowEndpointPicker] = useState(false);
  const endpointRef = useRef<HTMLDivElement>(null);

  const { data: tools = [], isLoading } = useQuery({
    queryKey: ['bot-tools'],
    queryFn: botToolService.list,
  });

  const { data: endpoints = [] } = useQuery({
    queryKey: ['bot-tools-endpoints'],
    queryFn: botToolService.listEndpoints,
    enabled: showForm,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: { id?: string; data: Partial<BotTool> }) =>
      payload.id
        ? botToolService.update(payload.id, payload.data)
        : botToolService.create(payload.data as Omit<BotTool, 'id' | 'created_at' | 'updated_at' | 'enabled'>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-tools'] });
      setShowForm(false);
      setEditingTool(null);
      setForm(EMPTY_FORM);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: botToolService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-tools'] });
      setDeleteTarget(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: botToolService.toggle,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bot-tools'] }),
  });

  const openCreate = () => {
    setEditingTool(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (tool: BotTool) => {
    setEditingTool(tool);
    setForm({
      name: tool.name,
      description: tool.description,
      action_type: tool.action_type,
      endpoint: tool.endpoint,
      method: tool.method,
      param_mapping: JSON.stringify(tool.param_mapping || {}, null, 2),
      parameters: JSON.stringify(tool.parameters || {}, null, 2),
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.endpoint.trim()) return;
    let paramMapping = {};
    let parameters = {};
    try { paramMapping = JSON.parse(form.param_mapping); } catch { /* keep empty */ }
    try { parameters = JSON.parse(form.parameters); } catch { /* keep empty */ }
    saveMutation.mutate({
      id: editingTool?.id,
      data: {
        name: form.name,
        description: form.description,
        action_type: form.action_type,
        endpoint: form.endpoint,
        method: form.method,
        param_mapping: paramMapping as Record<string, string>,
        parameters,
      },
    });
  };

  // Stats
  const totalTools = tools.length;
  const enabledTools = tools.filter((t) => t.enabled).length;
  const queryTools = tools.filter((t) => t.action_type === 'query').length;
  const mutationTools = tools.filter((t) => t.action_type === 'mutation').length;

  // Columns
  const columns = useMemo((): DataTableColumn<BotTool>[] => [
    {
      key: 'name',
      header: '工具名称',
      sortable: true,
      width: '220px',
      render: (t) => (
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground font-mono truncate">{t.name}</div>
          {t.description && (
            <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">{t.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'action_type',
      header: '类型',
      width: '90px',
      render: (t) => (
        <Badge
          variant="outline"
          className={cn(
            'text-[10px]',
            t.action_type === 'query'
              ? 'text-blue-600 border-blue-200 dark:border-blue-800 dark:text-blue-400'
              : 'text-amber-600 border-amber-200 dark:border-amber-800 dark:text-amber-400',
          )}
        >
          {t.action_type === 'query' ? '查询' : '修改'}
        </Badge>
      ),
    },
    {
      key: 'endpoint',
      header: '端点',
      width: '200px',
      render: (t) => (
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[9px] font-mono px-1.5">{t.method}</Badge>
          <span className="text-xs font-mono text-muted-foreground truncate max-w-[140px]">{t.endpoint}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: '状态',
      width: '80px',
      render: (t) => (
        <Badge
          variant={t.enabled ? 'default' : 'outline'}
          className={cn(
            'text-[11px]',
            t.enabled
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800 dark:text-emerald-400'
              : 'text-muted-foreground',
          )}
        >
          <span className={cn('mr-1 inline-block h-1.5 w-1.5 rounded-full', t.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
          {t.enabled ? '启用' : '禁用'}
        </Badge>
      ),
    },
    {
      key: 'toggle',
      header: '开关',
      width: '60px',
      render: (t) => (
        <Switch
          checked={t.enabled}
          onCheckedChange={() => toggleMutation.mutate(t.id)}
          className="scale-90"
        />
      ),
    },
  ], [toggleMutation]);

  const actions: DataTableAction<BotTool>[] = [
    { label: '编辑', icon: 'lucide:pencil', onClick: openEdit },
    { label: '删除', icon: 'lucide:trash-2', variant: 'destructive', onClick: (t) => setDeleteTarget(t) },
  ];

  // __RENDER_HERE__

  return (
    <div className="flex flex-col gap-6 h-full">
      <PageHeader
        title="Bot Tools"
        description="管理 AI 机器人可调用的工具能力，支持动态增删"
        icon="lucide:wrench"
        iconClassName="text-orange-500"
      >
        <CreateButton onClick={openCreate}>新建工具</CreateButton>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="工具总数" value={totalTools} icon="lucide:layers" iconColor="#f97316" description="已注册的工具" />
        <StatCard label="启用中" value={enabledTools} icon="lucide:check-circle-2" iconColor="#10b981" description="当前可用" />
        <StatCard label="查询类" value={queryTools} icon="lucide:search" iconColor="#3b82f6" description="只读操作" />
        <StatCard label="修改类" value={mutationTools} icon="lucide:pencil" iconColor="#f59e0b" description="需确认操作" />
      </div>

      <DataTable<BotTool>
        data={tools}
        columns={columns}
        rowKey={(t) => t.id}
        searchPlaceholder="搜索工具名称..."
        searchAccessor={(t) => t.name + t.description}
        actions={actions}
        emptyIcon="lucide:wrench"
        emptyTitle={isLoading ? '加载中...' : '还没有工具'}
        emptyDescription="添加工具让 AI 机器人获得新能力"
        emptyActionLabel="创建第一个工具"
        emptyActionClick={openCreate}
        emptyActionColor="create"
        defaultRowsPerPage={10}
        cardClassName="card-glow-orange"
      />

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTool ? '编辑工具' : '新建工具'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">工具名称 *</label>
                <Input
                  placeholder="例如：list_todos"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="font-mono"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">操作类型</label>
                <Select value={form.action_type} onValueChange={(v) => setForm({ ...form, action_type: v as 'query' | 'mutation' })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="query">查询（直接执行）</SelectItem>
                    <SelectItem value="mutation">修改（需确认）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">描述 *</label>
              <Input
                placeholder="AI 根据描述判断何时调用此工具"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div ref={endpointRef} className="relative">
              <label className="mb-1 block text-xs text-muted-foreground">API 端点 *（点击选择或搜索）</label>
              <button
                type="button"
                onClick={() => setShowEndpointPicker(!showEndpointPicker)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm font-mono',
                  'bg-background hover:bg-accent/50 transition-colors text-left',
                  !form.endpoint && 'text-muted-foreground',
                )}
              >
                {form.endpoint ? (
                  <>
                    <Badge variant="outline" className="text-[9px] font-mono px-1.5 shrink-0">{form.method}</Badge>
                    <span className="truncate">{form.endpoint}</span>
                  </>
                ) : (
                  <span>选择 API 端点...</span>
                )}
                <Icon icon="lucide:chevrons-up-down" className="ml-auto size-4 shrink-0 opacity-50" />
              </button>
              {showEndpointPicker && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
                  <Command>
                    <CommandInput placeholder="搜索端点路径或描述..." />
                    <CommandList className="max-h-[240px]">
                      <CommandEmpty>没有匹配的端点</CommandEmpty>
                      {Object.entries(
                        endpoints.reduce<Record<string, AvailableEndpoint[]>>((acc, ep) => {
                          const tag = ep.tags[0] || 'other';
                          (acc[tag] ??= []).push(ep);
                          return acc;
                        }, {}),
                      ).map(([tag, eps]) => (
                        <CommandGroup key={tag} heading={tag}>
                          {eps.map((ep) => (
                            <CommandItem
                              key={`${ep.method}-${ep.path}`}
                              value={`${ep.method} ${ep.path} ${ep.summary}`}
                              onSelect={() => {
                                setForm({ ...form, method: ep.method, endpoint: ep.path });
                                setShowEndpointPicker(false);
                              }}
                            >
                              <Badge variant="outline" className="text-[9px] font-mono px-1.5 shrink-0">{ep.method}</Badge>
                              <span className="font-mono text-xs truncate">{ep.path}</span>
                              <span className="ml-auto text-[10px] text-muted-foreground truncate max-w-[140px]">{ep.summary}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ))}
                    </CommandList>
                  </Command>
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">参数定义（JSON Schema）</label>
              <Textarea
                value={form.parameters}
                onChange={(e) => setForm({ ...form, parameters: e.target.value })}
                rows={5}
                className="font-mono text-xs resize-y"
                spellCheck={false}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">参数映射（JSON）</label>
              <Textarea
                value={form.param_mapping}
                onChange={(e) => setForm({ ...form, param_mapping: e.target.value })}
                rows={3}
                className="font-mono text-xs resize-y"
                spellCheck={false}
                placeholder='{"title": "body.title", "status": "query.status"}'
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                格式：参数名 → "query.字段" / "body.字段" / "path.字段"
              </p>
            </div>
          </div>
          <DialogFooter>
            <SolidButton color="secondary" onClick={() => { setShowForm(false); setEditingTool(null); setForm(EMPTY_FORM); }}>
              取消
            </SolidButton>
            <SolidButton
              color="warning"
              onClick={handleSave}
              disabled={!form.name.trim() || !form.endpoint.trim() || saveMutation.isPending}
              loading={saveMutation.isPending}
              loadingText="保存中..."
            >
              {editingTool ? '保存修改' : '创建工具'}
            </SolidButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={`删除「${deleteTarget?.name}」？`}
        description="此操作不可撤销，工具将被永久删除。"
        confirmLabel="确认删除"
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
