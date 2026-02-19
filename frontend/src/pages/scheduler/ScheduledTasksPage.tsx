import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Plus, Trash2, Loader2, ToggleLeft, ToggleRight, Search, X } from 'lucide-react';
import { scheduledTaskService } from '../../services/scheduledTaskService';
import type { ScheduledTask } from '../../types';

const TASK_TYPES = [
  { value: 'ai_query', label: 'AI 问答', desc: '定时向 AI 提问并推送结果' },
  { value: 'skill_exec', label: '技能执行', desc: '定时执行指定技能' },
  { value: 'feishu_push', label: '飞书推送', desc: '定时推送内容到飞书' },
];

const CRON_PRESETS = [
  { label: '每天 9:00', value: '0 9 * * *' },
  { label: '每周一 9:00', value: '0 9 * * 1' },
  { label: '每小时', value: '0 * * * *' },
  { label: '每天 18:00', value: '0 18 * * *' },
];

type FormData = { name: string; description: string; cron_expression: string; task_type: string; prompt: string };

export default function ScheduledTasksPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormData>({ name: '', description: '', cron_expression: '0 9 * * *', task_type: 'ai_query', prompt: '' });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['scheduled-tasks'],
    queryFn: scheduledTaskService.list,
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => scheduledTaskService.toggle(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduled-tasks'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: scheduledTaskService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduled-tasks'] }),
  });

  const createMutation = useMutation({
    mutationFn: () => scheduledTaskService.create({
      name: form.name, description: form.description || undefined,
      cron_expression: form.cron_expression, task_type: form.task_type,
      task_config: { prompt: form.prompt },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-tasks'] });
      setShowCreate(false);
      setForm({ name: '', description: '', cron_expression: '0 9 * * *', task_type: 'ai_query', prompt: '' });
    },
  });

  const filtered = tasks.filter((t) => !search || t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
        <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border-default)' }}>
          <Search size={15} strokeWidth={1.8} style={{ color: 'var(--text-muted)' }} />
          <input type="text" placeholder="搜索任务..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[13px]" style={{ color: 'var(--text-primary)' }} />
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-colors shrink-0"
          style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}>
          <Plus size={15} strokeWidth={2} /><span className="hidden sm:inline">新建任务</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
            <Clock size={24} strokeWidth={1.5} />
          </div>
          <p className="text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>{search ? '没有匹配的任务' : '还没有定时任务'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => (
            <TaskCard key={task.id} task={task}
              onToggle={() => toggleMutation.mutate(task.id)}
              onDelete={() => { if (confirm(`确定删除「${task.name}」？`)) deleteMutation.mutate(task.id); }} />
          ))}
        </div>
      )}

      {showCreate && <CreateModal form={form} setForm={setForm} onClose={() => setShowCreate(false)}
        onSubmit={() => createMutation.mutate()} loading={createMutation.isPending} />}
    </div>
  );
}
function TaskCard({ task, onToggle, onDelete }: { task: ScheduledTask; onToggle: () => void; onDelete: () => void }) {
  const typeLabel = TASK_TYPES.find((t) => t.value === task.task_type)?.label || task.task_type;
  return (
    <div className="rounded-xl p-4 flex items-center gap-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
        <Clock size={18} strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{task.name}</div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-sunken)', color: 'var(--text-secondary)' }}>{typeLabel}</span>
          <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{task.cron_expression}</span>
          {task.last_run_at && (
            <span className="text-[11px]" style={{ color: task.last_run_status === 'success' ? 'var(--success)' : 'var(--error)' }}>
              {task.last_run_status === 'success' ? '上次成功' : '上次失败'}
            </span>
          )}
        </div>
      </div>
      <button onClick={onToggle} className="cursor-pointer shrink-0" style={{ color: task.enabled ? 'var(--accent)' : 'var(--text-muted)' }}>
        {task.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
      </button>
      <button onClick={onDelete} className="p-1.5 rounded-md cursor-pointer" style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--error)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function CreateModal({ form, setForm, onClose, onSubmit, loading }: {
  form: FormData; setForm: (f: FormData) => void; onClose: () => void; onSubmit: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>新建定时任务</span>
          <button onClick={onClose} className="p-1 rounded-md cursor-pointer" style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <input placeholder="任务名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 rounded-lg text-[13px] bg-transparent outline-none"
            style={{ border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
          <select value={form.task_type} onChange={(e) => setForm({ ...form, task_type: e.target.value })}
            className="w-full px-3 py-2 rounded-lg text-[13px] bg-transparent outline-none cursor-pointer"
            style={{ border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
            {TASK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label} - {t.desc}</option>)}
          </select>
          <div>
            <label className="text-[12px] mb-1 block" style={{ color: 'var(--text-secondary)' }}>执行频率</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {CRON_PRESETS.map((p) => (
                <button key={p.value} onClick={() => setForm({ ...form, cron_expression: p.value })}
                  className="px-2 py-1 rounded text-[11px] cursor-pointer"
                  style={{ background: form.cron_expression === p.value ? 'var(--accent-subtle)' : 'var(--bg-sunken)',
                    color: form.cron_expression === p.value ? 'var(--accent-text)' : 'var(--text-secondary)',
                    border: '1px solid var(--border-default)' }}>{p.label}</button>
              ))}
            </div>
            <input value={form.cron_expression} onChange={(e) => setForm({ ...form, cron_expression: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-[13px] font-mono bg-transparent outline-none"
              style={{ border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
          </div>
          <textarea placeholder="任务内容 / Prompt" value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })}
            rows={3} className="w-full px-3 py-2 rounded-lg text-[13px] bg-transparent outline-none resize-none"
            style={{ border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
          <button onClick={onSubmit} disabled={!form.name.trim() || loading}
            className="w-full py-2 rounded-lg text-[13px] font-medium cursor-pointer disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}>
            {loading ? '创建中...' : '创建任务'}
          </button>
        </div>
      </div>
    </div>
  );
}
