import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/composed/page-header';
import { CreateButton, SolidButton, CancelButton } from '@/components/composed/solid-button';
import { DataTable, type DataTableColumn, type DataTableAction } from '@/components/composed/data-table';
import { illustrationPresets } from '@/lib/illustrations';
import type { ScheduledTask } from '@/types';

// ======================== Mock Data ========================

const MOCK_TASKS: ScheduledTask[] = [
  {
    id: '1', name: '每日行业资讯摘要', description: '自动抓取医疗健康领域最新资讯并生成摘要推送',
    cron_expression: '0 9 * * *', task_type: 'ai_query', task_config: { prompt: '总结今日医疗健康行业要闻' },
    enabled: true, last_run_at: '2026-02-20T09:00:00Z', last_run_status: 'success',
    created_at: '2026-01-15T08:00:00Z', updated_at: '2026-02-20T09:00:00Z',
  },
  {
    id: '2', name: '金融市场周报生成', description: '每周一自动生成金融市场周报并推送到飞书群',
    cron_expression: '0 9 * * 1', task_type: 'feishu_push', task_config: { prompt: '生成本周金融市场周报' },
    enabled: true, last_run_at: '2026-02-17T09:00:00Z', last_run_status: 'success',
    created_at: '2026-01-10T08:00:00Z', updated_at: '2026-02-17T09:00:00Z',
  },
  {
    id: '3', name: '法规变更监控', description: '每日检查法律法规库的最新变更动态',
    cron_expression: '0 8 * * *', task_type: 'skill_exec', task_config: { skill_id: 'legal-monitor' },
    enabled: true, last_run_at: '2026-02-20T08:00:00Z', last_run_status: 'success',
    created_at: '2026-01-20T08:00:00Z', updated_at: '2026-02-20T08:00:00Z',
  },
  {
    id: '4', name: '竞品分析报告', description: '每周五自动生成竞品对比分析报告',
    cron_expression: '0 17 * * 5', task_type: 'ai_query', task_config: { prompt: '分析本周竞品动态' },
    enabled: false, last_run_at: '2026-02-14T17:00:00Z', last_run_status: 'success',
    created_at: '2026-01-05T08:00:00Z', updated_at: '2026-02-14T17:00:00Z',
  },
  {
    id: '5', name: '知识库自动备份', description: '每天凌晨自动备份所有知识库数据',
    cron_expression: '0 2 * * *', task_type: 'skill_exec', task_config: { skill_id: 'db-backup' },
    enabled: true, last_run_at: '2026-02-20T02:00:00Z', last_run_status: 'success',
    created_at: '2026-01-01T08:00:00Z', updated_at: '2026-02-20T02:00:00Z',
  },
  {
    id: '6', name: '飞书日报推送', description: '每天下班前推送当日工作进展到飞书群',
    cron_expression: '0 18 * * 1-5', task_type: 'feishu_push', task_config: { prompt: '总结今日工作进展' },
    enabled: true, last_run_at: '2026-02-19T18:00:00Z', last_run_status: 'success',
    created_at: '2026-01-18T08:00:00Z', updated_at: '2026-02-19T18:00:00Z',
  },
  {
    id: '7', name: '技术文档更新检查', description: '每小时检查技术文档库是否有更新',
    cron_expression: '0 * * * *', task_type: 'skill_exec', task_config: { skill_id: 'doc-check' },
    enabled: false, last_run_at: '2026-02-18T14:00:00Z', last_run_status: 'error',
    created_at: '2026-02-01T08:00:00Z', updated_at: '2026-02-18T14:00:00Z',
  },
  {
    id: '8', name: 'AI 模型性能基准测试', description: '每周日凌晨运行 AI 模型性能基准测试',
    cron_expression: '0 3 * * 0', task_type: 'ai_query', task_config: { prompt: '运行性能基准测试' },
    enabled: true, last_run_at: '2026-02-16T03:00:00Z', last_run_status: 'success',
    created_at: '2026-02-05T08:00:00Z', updated_at: '2026-02-16T03:00:00Z',
  },
  {
    id: '9', name: '教育资源同步', description: '每天中午同步最新教育培训资源',
    cron_expression: '0 12 * * *', task_type: 'skill_exec', task_config: { skill_id: 'edu-sync' },
    enabled: true, last_run_at: '2026-02-20T12:00:00Z', last_run_status: 'success',
    created_at: '2026-02-10T08:00:00Z', updated_at: '2026-02-20T12:00:00Z',
  },
  {
    id: '10', name: '月度数据分析报告', description: '每月 1 号生成上月数据分析报告',
    cron_expression: '0 9 1 * *', task_type: 'ai_query', task_config: { prompt: '生成上月数据分析报告' },
    enabled: false, last_run_at: '2026-02-01T09:00:00Z', last_run_status: 'success',
    created_at: '2026-01-01T08:00:00Z', updated_at: '2026-02-01T09:00:00Z',
  },
  {
    id: '11', name: '客户反馈收集', description: '每天收集并整理客户反馈信息',
    cron_expression: '0 20 * * *', task_type: 'feishu_push', task_config: { prompt: '整理今日客户反馈' },
    enabled: true, last_run_at: '2026-02-19T20:00:00Z', last_run_status: 'success',
    created_at: '2026-01-25T08:00:00Z', updated_at: '2026-02-19T20:00:00Z',
  },
  {
    id: '12', name: '安全漏洞扫描', description: '每周三凌晨执行安全漏洞扫描任务',
    cron_expression: '0 3 * * 3', task_type: 'skill_exec', task_config: { skill_id: 'security-scan' },
    enabled: false, last_run_at: '2026-02-12T03:00:00Z', last_run_status: 'error',
    created_at: '2026-02-01T08:00:00Z', updated_at: '2026-02-12T03:00:00Z',
  },
];

// ======================== Config ========================

const CRON_PRESETS = [
  { label: '每天 9:00', value: '0 9 * * *' },
  { label: '每周一 9:00', value: '0 9 * * 1' },
  { label: '每小时', value: '0 * * * *' },
  { label: '每天 18:00', value: '0 18 * * *' },
];

type FormData = {
  name: string;
  description: string;
  cron_expression: string;
  prompt: string;
};

// ======================== Columns ========================

const buildColumns = (
  onToggle: (id: string) => void,
): DataTableColumn<ScheduledTask>[] => [
  {
    key: 'name',
    header: '任务名称',
    sortable: true,
    width: '300px',
    render: (task) => (
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{task.name}</div>
        {task.description && (
          <div className="text-[11px] text-muted-foreground truncate max-w-[260px]">
            {task.description}
          </div>
        )}
      </div>
    ),
  },
  {
    key: 'cron',
    header: '执行频率',
    sortable: true,
    width: '140px',
    render: (task) => (
      <div>
        <div className="text-xs text-foreground">{describeCron(task.cron_expression)}</div>
        <div className="text-[10px] font-mono text-muted-foreground">{task.cron_expression}</div>
      </div>
    ),
  },
  {
    key: 'status',
    header: '状态',
    width: '90px',
    render: (task) => (
      <Badge
        variant={task.enabled ? 'default' : 'outline'}
        className={cn(
          'text-[11px]',
          task.enabled
            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800 dark:text-emerald-400'
            : 'text-muted-foreground',
        )}
      >
        <span className={cn(
          'mr-1 inline-block h-1.5 w-1.5 rounded-full',
          task.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40',
        )} />
        {task.enabled ? '活跃' : '已暂停'}
      </Badge>
    ),
  },
  {
    key: 'last_run',
    header: '上次执行',
    width: '160px',
    render: (task) =>
      task.last_run_at ? (
        <div>
          <div className="text-xs text-foreground">{formatTime(task.last_run_at)}</div>
          <div className={cn(
            'text-[10px]',
            task.last_run_status === 'success'
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-destructive',
          )}>
            {task.last_run_status === 'success' ? '执行成功' : '执行失败'}
          </div>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">尚未执行</span>
      ),
  },
  {
    key: 'enabled',
    header: '开关',
    width: '60px',
    render: (task) => (
      <Switch
        checked={task.enabled}
        onCheckedChange={() => onToggle(task.id)}
        className="scale-90"
      />
    ),
  },
];

// ======================== Main Component ========================

export default function ScheduledTasksPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [tasks, setTasks] = useState<ScheduledTask[]>(MOCK_TASKS);
  const [form, setForm] = useState<FormData>({
    name: '',
    description: '',
    cron_expression: '0 9 * * *',
    prompt: '',
  });

  const handleToggle = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)),
    );
  };

  const handleDelete = (task: ScheduledTask) => {
    if (confirm(`确定删除「${task.name}」？`)) {
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    }
  };

  const handleCreate = () => {
    if (!form.name.trim()) return;
    const newTask: ScheduledTask = {
      id: String(Date.now()),
      name: form.name,
      description: form.description || null,
      cron_expression: form.cron_expression,
      task_type: 'ai_query',
      task_config: { prompt: form.prompt },
      enabled: true,
      last_run_at: null,
      last_run_status: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setTasks((prev) => [newTask, ...prev]);
    setShowCreate(false);
    setForm({ name: '', description: '', cron_expression: '0 9 * * *', prompt: '' });
  };

  const columns = buildColumns(handleToggle);

  const actions: DataTableAction<ScheduledTask>[] = [
    {
      label: '立即执行',
      icon: 'streamline-color:button-play',
      onClick: () => { /* TODO */ },
    },
    {
      label: '编辑',
      icon: 'streamline-color:pencil',
      onClick: () => { /* TODO */ },
    },
    {
      label: '删除',
      icon: 'streamline-color:recycle-bin-2',
      variant: 'destructive',
      onClick: handleDelete,
    },
  ];

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Page Header — title left, + Add New right (like screenshot) */}
      <PageHeader
        title="定时任务"
        description="配置自动执行的周期性任务，让 AI 定期为你工作"
        icon="streamline-color:circle-clock"
        iconClassName="text-cyan-500"
      >
        <CreateButton onClick={() => setShowCreate(true)}>
          新建任务
        </CreateButton>
      </PageHeader>

      {/* DataTable — search + View inside card, no create button */}
      <DataTable<ScheduledTask>
        data={tasks}
        columns={columns}
        rowKey={(t) => t.id}
        searchPlaceholder="搜索任务名称..."
        searchAccessor={(t) => t.name + (t.description ?? '')}
        actions={actions}
        emptyIcon="streamline-color:circle-clock"
        emptyIllustration={illustrationPresets.emptySchedule}
        emptyTitle="还没有定时任务"
        emptyDescription="创建自动化任务，让系统帮你定时处理工作"
        emptyActionLabel="创建第一个任务"
        emptyActionClick={() => setShowCreate(true)}
        emptyActionColor="create"
        defaultRowsPerPage={10}
        cardClassName="card-glow-cyan"
      />

      {/* Create Dialog — no type selector */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建定时任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="任务名称"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              placeholder="任务描述（可选）"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">执行频率</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {CRON_PRESETS.map((p) => (
                  <Button
                    key={p.value}
                    variant={form.cron_expression === p.value ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setForm({ ...form, cron_expression: p.value })}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              <Input
                value={form.cron_expression}
                onChange={(e) => setForm({ ...form, cron_expression: e.target.value })}
                className="font-mono"
              />
            </div>
            <Textarea
              placeholder="任务内容 / Prompt"
              value={form.prompt}
              onChange={(e) => setForm({ ...form, prompt: e.target.value })}
              rows={3}
            />
          </div>
          <DialogFooter>
            <CancelButton onClick={() => setShowCreate(false)} />
            <SolidButton
              color="cyan"
              onClick={handleCreate}
              disabled={!form.name.trim()}
            >
              创建任务
            </SolidButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ======================== Helpers ========================

function describeCron(cron: string): string {
  const map: Record<string, string> = {
    '0 * * * *': '每小时',
    '0 9 * * *': '每天 9:00',
    '0 8 * * *': '每天 8:00',
    '0 12 * * *': '每天 12:00',
    '0 18 * * *': '每天 18:00',
    '0 18 * * 1-5': '工作日 18:00',
    '0 20 * * *': '每天 20:00',
    '0 2 * * *': '每天 02:00',
    '0 3 * * 0': '每周日 03:00',
    '0 3 * * 3': '每周三 03:00',
    '0 9 * * 1': '每周一 9:00',
    '0 17 * * 5': '每周五 17:00',
    '0 9 1 * *': '每月 1 号 9:00',
  };
  return map[cron] ?? cron;
}

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
