import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/composed/page-header';
import { StatCard } from '@/components/composed/stat-card';
import { CreateButton, SolidButton, CancelButton } from '@/components/composed/solid-button';
import { DataTable, type DataTableColumn, type DataTableAction } from '@/components/composed/data-table';
import { illustrationPresets } from '@/lib/illustrations';
import { scheduledTaskService } from '@/services/scheduledTaskService';
import type { ScheduledTask } from '@/types';

// ======================== Config ========================

const CRON_PRESETS = [
  { label: '每天 9:00', value: '0 9 * * *' },
  { label: '每周一 9:00', value: '0 9 * * 1' },
  { label: '每小时', value: '0 * * * *' },
  { label: '每天 18:00', value: '0 18 * * *' },
];

type TaskType = 'ai_query' | 'feishu_push' | 'skill_exec';

type FormData = {
  name: string;
  description: string;
  cron_expression: string;
  task_type: TaskType;
  prompt: string;
  push_to_feishu: boolean;
  feishu_title: string;
  feishu_chat_id: string;
  feishu_content: string;
  skill_name: string;
  skill_params: string;
};

const EMPTY_FORM: FormData = {
  name: '',
  description: '',
  cron_expression: '0 9 * * *',
  task_type: 'ai_query',
  prompt: '',
  push_to_feishu: false,
  feishu_title: '',
  feishu_chat_id: '',
  feishu_content: '',
  skill_name: '',
  skill_params: '{}',
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
    key: 'type',
    header: '类型',
    width: '120px',
    render: (task) => (
      <Badge variant="outline" className="text-[10px] capitalize">
        {task.task_type}
      </Badge>
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
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['scheduled-tasks'],
    queryFn: scheduledTaskService.list,
  });

  const toggleMutation = useMutation({
    mutationFn: scheduledTaskService.toggle,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduled-tasks'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: scheduledTaskService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduled-tasks'] }),
  });

  const runMutation = useMutation({
    mutationFn: scheduledTaskService.run,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduled-tasks'] }),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: { id?: string; data: Partial<ScheduledTask> }) =>
      payload.id
        ? scheduledTaskService.update(payload.id, payload.data)
        : scheduledTaskService.create(payload.data as { name: string; cron_expression: string; task_type: string; task_config?: Record<string, unknown>; description?: string }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-tasks'] });
      setShowCreate(false);
      setEditingTask(null);
      setForm(EMPTY_FORM);
    },
  });

  const handleToggle = (id: string) => {
    toggleMutation.mutate(id);
  };

  const handleDelete = (task: ScheduledTask) => {
    if (confirm(`确定删除「${task.name}」？`)) {
      deleteMutation.mutate(task.id);
    }
  };

  const openCreate = () => {
    setEditingTask(null);
    setForm(EMPTY_FORM);
    setShowCreate(true);
  };

  const openEdit = (task: ScheduledTask) => {
    const config = (task.task_config || {}) as Record<string, unknown>;
    setEditingTask(task);
    setForm({
      name: task.name,
      description: task.description || '',
      cron_expression: task.cron_expression,
      task_type: task.task_type as TaskType,
      prompt: String(config.prompt || ''),
      push_to_feishu: Boolean(config.push_to_feishu),
      feishu_title: String(config.feishu_title || config.title || ''),
      feishu_chat_id: String(config.feishu_chat_id || config.chat_id || ''),
      feishu_content: String(config.content || ''),
      skill_name: String(config.skill_name || ''),
      skill_params: JSON.stringify(config.params || {}, null, 2),
    });
    setShowCreate(true);
  };

  const handleCreateOrUpdate = () => {
    if (!form.name.trim()) return;
    const taskConfig: Record<string, unknown> = {};

    if (form.task_type === 'ai_query') {
      taskConfig.prompt = form.prompt;
      if (form.push_to_feishu) {
        taskConfig.push_to_feishu = true;
        if (form.feishu_title) taskConfig.feishu_title = form.feishu_title;
        if (form.feishu_chat_id) taskConfig.feishu_chat_id = form.feishu_chat_id;
      }
    }

    if (form.task_type === 'feishu_push') {
      if (form.feishu_title) taskConfig.title = form.feishu_title;
      taskConfig.content = form.feishu_content;
      if (form.feishu_chat_id) taskConfig.chat_id = form.feishu_chat_id;
    }

    if (form.task_type === 'skill_exec') {
      taskConfig.skill_name = form.skill_name;
      try {
        taskConfig.params = JSON.parse(form.skill_params || '{}');
      } catch {
        taskConfig.params = {};
      }
      if (form.push_to_feishu) {
        taskConfig.push_to_feishu = true;
        if (form.feishu_title) taskConfig.feishu_title = form.feishu_title;
        if (form.feishu_chat_id) taskConfig.feishu_chat_id = form.feishu_chat_id;
      }
    }

    const payload: Partial<ScheduledTask> = {
      name: form.name,
      description: form.description || null,
      cron_expression: form.cron_expression,
      task_type: form.task_type,
      task_config: taskConfig,
      enabled: true,
    };

    saveMutation.mutate({ id: editingTask?.id, data: payload });
  };

  const columns = useMemo(() => buildColumns(handleToggle), [handleToggle]);
  const totalTasks = tasks.length;
  const activeTasks = tasks.filter((task) => task.enabled).length;
  const pausedTasks = totalTasks - activeTasks;

  const actions: DataTableAction<ScheduledTask>[] = [
    {
      label: '立即执行',
      icon: 'lucide:play',
      onClick: (task) => runMutation.mutate(task.id),
    },
    {
      label: '编辑',
      icon: 'lucide:pencil',
      onClick: (task) => openEdit(task),
    },
    {
      label: '删除',
      icon: 'lucide:trash-2',
      variant: 'destructive',
      onClick: handleDelete,
    },
  ];

  return (
    <div className="flex flex-col gap-6 h-full">
      <PageHeader
        title="定时任务"
        description="配置自动执行的周期性任务，让 AI 定期为你工作"
        icon="lucide:clock"
        iconClassName="text-cyan-500"
      >
        <CreateButton onClick={openCreate}>
          新建任务
        </CreateButton>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label="任务总数"
          value={totalTasks}
          icon="lucide:layers"
          iconColor="#3b82f6"
          description="当前配置的所有任务"
        />
        <StatCard
          label="启用中"
          value={activeTasks}
          icon="lucide:check-circle-2"
          iconColor="#10b981"
          description="正在运行的任务"
        />
        <StatCard
          label="已暂停"
          value={pausedTasks}
          icon="lucide:pause-circle"
          iconColor="#f59e0b"
          description="暂时关闭的任务"
        />
      </div>

      <DataTable<ScheduledTask>
        data={tasks}
        columns={columns}
        rowKey={(t) => t.id}
        searchPlaceholder="搜索任务名称..."
        searchAccessor={(t) => t.name + (t.description ?? '')}
        actions={actions}
        emptyIcon="lucide:clock"
        emptyIllustration={illustrationPresets.emptySchedule}
        emptyTitle={isLoading ? '加载中...' : '还没有定时任务'}
        emptyDescription="创建自动化任务，让系统帮你定时处理工作"
        emptyActionLabel="创建第一个任务"
        emptyActionClick={openCreate}
        emptyActionColor="create"
        defaultRowsPerPage={10}
        cardClassName="card-glow-cyan"
      />

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask ? '编辑定时任务' : '新建定时任务'}</DialogTitle>
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
              <label className="text-xs text-muted-foreground mb-1 block">任务类型</label>
              <Select
                value={form.task_type}
                onValueChange={(value) => setForm({ ...form, task_type: value as TaskType })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择任务类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ai_query">AI 问答</SelectItem>
                  <SelectItem value="feishu_push">飞书推送</SelectItem>
                  <SelectItem value="skill_exec">技能执行</SelectItem>
                </SelectContent>
              </Select>
            </div>
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

            {form.task_type === 'ai_query' && (
              <div className="space-y-2">
                <Textarea
                  placeholder="任务内容 / Prompt"
                  value={form.prompt}
                  onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                  rows={3}
                />
                <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2">
                  <div>
                    <div className="text-xs font-medium text-foreground">推送到飞书</div>
                    <div className="text-[11px] text-muted-foreground">执行后自动发送结果</div>
                  </div>
                  <Switch
                    checked={form.push_to_feishu}
                    onCheckedChange={(checked) => setForm({ ...form, push_to_feishu: checked })}
                  />
                </div>
                {form.push_to_feishu && (
                  <div className="space-y-2">
                    <Input
                      placeholder="飞书消息标题（可选）"
                      value={form.feishu_title}
                      onChange={(e) => setForm({ ...form, feishu_title: e.target.value })}
                    />
                    <Input
                      placeholder="飞书 Chat ID（可选）"
                      value={form.feishu_chat_id}
                      onChange={(e) => setForm({ ...form, feishu_chat_id: e.target.value })}
                    />
                  </div>
                )}
              </div>
            )}

            {form.task_type === 'feishu_push' && (
              <div className="space-y-2">
                <Input
                  placeholder="飞书消息标题"
                  value={form.feishu_title}
                  onChange={(e) => setForm({ ...form, feishu_title: e.target.value })}
                />
                <Textarea
                  placeholder="飞书消息内容"
                  value={form.feishu_content}
                  onChange={(e) => setForm({ ...form, feishu_content: e.target.value })}
                  rows={3}
                />
                <Input
                  placeholder="飞书 Chat ID（可选）"
                  value={form.feishu_chat_id}
                  onChange={(e) => setForm({ ...form, feishu_chat_id: e.target.value })}
                />
              </div>
            )}

            {form.task_type === 'skill_exec' && (
              <div className="space-y-2">
                <Input
                  placeholder="技能名称"
                  value={form.skill_name}
                  onChange={(e) => setForm({ ...form, skill_name: e.target.value })}
                />
                <Textarea
                  placeholder="技能参数 JSON"
                  value={form.skill_params}
                  onChange={(e) => setForm({ ...form, skill_params: e.target.value })}
                  rows={3}
                  className="font-mono"
                />
                <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2">
                  <div>
                    <div className="text-xs font-medium text-foreground">推送到飞书</div>
                    <div className="text-[11px] text-muted-foreground">执行后自动发送结果</div>
                  </div>
                  <Switch
                    checked={form.push_to_feishu}
                    onCheckedChange={(checked) => setForm({ ...form, push_to_feishu: checked })}
                  />
                </div>
                {form.push_to_feishu && (
                  <div className="space-y-2">
                    <Input
                      placeholder="飞书消息标题（可选）"
                      value={form.feishu_title}
                      onChange={(e) => setForm({ ...form, feishu_title: e.target.value })}
                    />
                    <Input
                      placeholder="飞书 Chat ID（可选）"
                      value={form.feishu_chat_id}
                      onChange={(e) => setForm({ ...form, feishu_chat_id: e.target.value })}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <CancelButton onClick={() => setShowCreate(false)} />
            <SolidButton
              color="cyan"
              onClick={handleCreateOrUpdate}
              disabled={!form.name.trim() || saveMutation.isPending}
            >
              {editingTask ? '保存修改' : '创建任务'}
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
