import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/composed/page-header';
import { StatCard } from '@/components/composed/stat-card';
import { CreateButton, SolidButton } from '@/components/composed/solid-button';
import { ConfirmDialog } from '@/components/composed/confirm-dialog';
import { DataTable, type DataTableColumn, type DataTableAction } from '@/components/composed/data-table';
import { scriptService } from '@/services/scriptService';
import type { ScriptTestResult } from '@/services/scriptService';
import type { UserScript } from '@/types';

// ======================== Types ========================

type FormData = {
  name: string;
  description: string;
  script_content: string;
};

const EMPTY_FORM: FormData = {
  name: '',
  description: '',
  script_content: '// 在此编写你的 TypeScript 脚本\n// 脚本由 Deno 沙箱执行，支持 fetch 等 API\n// 使用 Deno.env.get("CLAUDE_API_KEY") 引用系统配置\n\nconsole.log("Hello, World!");\n',
};

// ======================== Test Result Dialog ========================

interface TestResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scriptName: string;
  result: ScriptTestResult | null;
}

function TestResultDialog({ open, onOpenChange, scriptName, result }: TestResultDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {result?.success ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                测试成功
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-destructive">
                <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
                测试失败
              </span>
            )}
            <span className="text-muted-foreground font-normal text-sm">— {scriptName}</span>
          </DialogTitle>
        </DialogHeader>

        {result?.timed_out && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
            脚本执行超时
          </div>
        )}

        {result?.warnings && result.warnings.length > 0 && (
          <div className="space-y-1">
            {result.warnings.map((w, i) => (
              <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
                {w}
              </div>
            ))}
          </div>
        )}

        {result?.output && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">输出</p>
            <pre className="max-h-60 overflow-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
              {result.output}
            </pre>
          </div>
        )}

        {result?.error && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-destructive">错误</p>
            <pre className="max-h-60 overflow-auto rounded-lg border border-destructive/20 bg-destructive/5 p-3 font-mono text-xs leading-relaxed text-destructive whitespace-pre-wrap break-all">
              {result.error}
            </pre>
          </div>
        )}

        {!result?.output && !result?.error && (
          <p className="text-sm text-muted-foreground">无输出</p>
        )}

        <DialogFooter>
          <SolidButton color="secondary" onClick={() => onOpenChange(false)}>
            关闭
          </SolidButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ======================== Main Component ========================

export default function ScriptsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingScript, setEditingScript] = useState<UserScript | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<UserScript | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    scriptName: string;
    result: ScriptTestResult;
  } | null>(null);
  const [showEnvRef, setShowEnvRef] = useState(false);

  const { data: scripts = [], isLoading } = useQuery({
    queryKey: ['scripts'],
    queryFn: scriptService.list,
  });

  const { data: envVars = [] } = useQuery({
    queryKey: ['script-env-vars'],
    queryFn: scriptService.listEnvVars,
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: { id?: string; data: Partial<UserScript> }) =>
      payload.id
        ? scriptService.update(payload.id, payload.data)
        : scriptService.create({
            name: payload.data.name!,
            description: payload.data.description ?? undefined,
            script_content: payload.data.script_content!,
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
      setShowForm(false);
      setEditingScript(null);
      setForm(EMPTY_FORM);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: scriptService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
      setDeleteTarget(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      scriptService.update(id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scripts'] }),
  });

  const handleTest = async (script: UserScript) => {
    setTestingId(script.id);
    try {
      const result = await scriptService.test(script.id);
      setTestResult({ scriptName: script.name, result });
    } finally {
      setTestingId(null);
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
    }
  };

  const openCreate = () => {
    setEditingScript(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (script: UserScript) => {
    setEditingScript(script);
    setForm({
      name: script.name,
      description: script.description ?? '',
      script_content: script.script_content,
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.script_content.trim()) return;
    saveMutation.mutate({
      id: editingScript?.id,
      data: {
        name: form.name,
        description: form.description || null,
        script_content: form.script_content,
      },
    });
  };

  // ======================== Stats ========================

  const totalScripts = scripts.length;
  const enabledScripts = scripts.filter((s) => s.enabled).length;
  const recentSuccess = scripts.filter((s) => s.last_test_status === 'success').length;
  const recentFailed = scripts.filter(
    (s) => s.last_test_status && s.last_test_status !== 'success',
  ).length;

  // ======================== Columns ========================

  const columns = useMemo((): DataTableColumn<UserScript>[] => [
    {
      key: 'name',
      header: '脚本名称',
      sortable: true,
      width: '260px',
      render: (s) => (
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground truncate">{s.name}</div>
          {s.description && (
            <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">
              {s.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: '状态',
      width: '90px',
      render: (s) => (
        <Badge
          variant={s.enabled ? 'default' : 'outline'}
          className={cn(
            'text-[11px]',
            s.enabled
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800 dark:text-emerald-400'
              : 'text-muted-foreground',
          )}
        >
          <span
            className={cn(
              'mr-1 inline-block h-1.5 w-1.5 rounded-full',
              s.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40',
            )}
          />
          {s.enabled ? '启用' : '禁用'}
        </Badge>
      ),
    },
    {
      key: 'last_test',
      header: '最近测试',
      width: '180px',
      render: (s) =>
        s.last_test_at ? (
          <div>
            <div className="text-xs text-foreground">{formatTime(s.last_test_at)}</div>
            <div
              className={cn(
                'text-[10px]',
                s.last_test_status === 'success'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-destructive',
              )}
            >
              {s.last_test_status === 'success' ? '测试通过' : '测试失败'}
            </div>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">尚未测试</span>
        ),
    },
    {
      key: 'test_action',
      header: '测试',
      width: '80px',
      render: (s) => (
        <button
          onClick={() => handleTest(s)}
          disabled={testingId === s.id}
          className={cn(
            'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-all',
            'border border-violet-200 bg-violet-50 text-violet-700',
            'hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-400 dark:hover:bg-violet-900/40',
            testingId === s.id && 'pointer-events-none opacity-60',
          )}
        >
          {testingId === s.id ? (
            <>
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
              运行中
            </>
          ) : (
            <>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path d="M2 1.5l6 3.5-6 3.5V1.5z" />
              </svg>
              测试
            </>
          )}
        </button>
      ),
    },
    {
      key: 'enabled',
      header: '开关',
      width: '60px',
      render: (s) => (
        <Switch
          checked={s.enabled}
          onCheckedChange={(checked) => toggleMutation.mutate({ id: s.id, enabled: checked })}
          className="scale-90"
        />
      ),
    },
  ], [testingId, toggleMutation]);

  // ======================== Actions ========================

  const actions: DataTableAction<UserScript>[] = [
    {
      label: '编辑',
      icon: 'lucide:pencil',
      onClick: openEdit,
    },
    {
      label: '删除',
      icon: 'lucide:trash-2',
      variant: 'destructive',
      onClick: (s) => setDeleteTarget(s),
    },
  ];

  return (
    <div className="flex flex-col gap-6 h-full">
      <PageHeader
        title="用户脚本"
        description="管理可复用的自动化脚本，供定时任务和 AI 助手调用"
        icon="lucide:file-code"
        iconClassName="text-violet-500"
      >
        <CreateButton onClick={openCreate}>新建脚本</CreateButton>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="脚本总数"
          value={totalScripts}
          icon="lucide:layers"
          iconColor="#6366f1"
          description="当前配置的所有脚本"
        />
        <StatCard
          label="启用中"
          value={enabledScripts}
          icon="lucide:check-circle-2"
          iconColor="#10b981"
          description="正在启用的脚本"
        />
        <StatCard
          label="测试通过"
          value={recentSuccess}
          icon="lucide:check-circle"
          iconColor="#3b82f6"
          description="最近测试成功"
        />
        <StatCard
          label="测试失败"
          value={recentFailed}
          icon="lucide:x-circle"
          iconColor="#ef4444"
          description="最近测试失败"
        />
      </div>

      {/* ======================== Env Var Tip ======================== */}
      <div className="rounded-lg border border-violet-200/60 bg-violet-50/40 px-4 py-2.5 dark:border-violet-800/40 dark:bg-violet-950/20">
        <p className="text-xs text-muted-foreground leading-relaxed">
          脚本中需要 API Key 等敏感配置？使用{' '}
          <code className="rounded bg-violet-100 px-1 py-0.5 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            Deno.env.get("CLAUDE_API_KEY")
          </code>{' '}
          引用系统管理的配置，执行时自动从「AI 模型配置」和「飞书集成」中注入，无需硬编码密钥。
        </p>
      </div>

      <DataTable<UserScript>
        data={scripts}
        columns={columns}
        rowKey={(s) => s.id}
        searchPlaceholder="搜索脚本名称..."
        searchAccessor={(s) => s.name + (s.description ?? '')}
        actions={actions}
        emptyIcon="lucide:file-code"
        emptyTitle={isLoading ? '加载中...' : '还没有脚本'}
        emptyDescription="创建自动化脚本，供定时任务和 AI 助手调用"
        emptyActionLabel="创建第一个脚本"
        emptyActionClick={openCreate}
        emptyActionColor="create"
        defaultRowsPerPage={10}
        cardClassName="card-glow-violet"
      />

      {/* ======================== Create / Edit Dialog ======================== */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingScript ? '编辑脚本' : '新建脚本'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">脚本名称 *</label>
              <Input
                placeholder="例如：每日数据汇总"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground">描述（可选）</label>
              <Input
                placeholder="简要说明脚本的用途"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-muted-foreground">脚本内容 *</label>
                <button
                  type="button"
                  onClick={() => setShowEnvRef((v) => !v)}
                  className="text-[11px] text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 transition-colors"
                >
                  {showEnvRef ? '收起变量参考' : '查看可用环境变量'}
                </button>
              </div>
              {showEnvRef && envVars.length > 0 && (
                <div className="mb-2 rounded-lg border border-violet-200 bg-violet-50/50 p-2.5 dark:border-violet-800 dark:bg-violet-950/20">
                  <p className="text-[11px] text-muted-foreground mb-1.5">
                    在脚本中使用 <code className="rounded bg-violet-100 px-1 py-0.5 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">Deno.env.get("变量名")</code> 引用系统配置，执行时自动注入：
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    {envVars.map((v) => (
                      <div key={v.name} className="flex items-baseline gap-1.5 text-[11px]">
                        <code className="shrink-0 font-mono text-violet-700 dark:text-violet-300">{v.name}</code>
                        <span className="text-muted-foreground truncate">{v.source}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Textarea
                placeholder="在此编写脚本内容..."
                value={form.script_content}
                onChange={(e) => setForm({ ...form, script_content: e.target.value })}
                rows={16}
                className="font-mono text-xs leading-relaxed resize-y min-h-[200px]"
                spellCheck={false}
              />
            </div>
          </div>

          <DialogFooter>
            <SolidButton
              color="secondary"
              onClick={() => { setShowForm(false); setEditingScript(null); setForm(EMPTY_FORM); }}
            >
              取消
            </SolidButton>
            <SolidButton
              color="violet"
              onClick={handleSave}
              disabled={!form.name.trim() || !form.script_content.trim() || saveMutation.isPending}
              loading={saveMutation.isPending}
              loadingText="保存中..."
            >
              {editingScript ? '保存修改' : '创建脚本'}
            </SolidButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================== Delete Confirm ======================== */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={`删除「${deleteTarget?.name}」？`}
        description="此操作不可撤销，脚本将被永久删除。"
        confirmLabel="确认删除"
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
      />

      {/* ======================== Test Result ======================== */}
      <TestResultDialog
        open={!!testResult}
        onOpenChange={(open) => { if (!open) setTestResult(null); }}
        scriptName={testResult?.scriptName ?? ''}
        result={testResult?.result ?? null}
      />
    </div>
  );
}

// ======================== Helpers ========================

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} 小时前`;
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hh}:${mm}`;
}
