import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Zap, Play, Loader2, ToggleLeft, ToggleRight, Search, Plus, X, Trash2, Pencil } from 'lucide-react';
import { skillService } from '../../services/skillService';
import type { Skill } from '../../types';

type CreateForm = { name: string; type: 'yaml' | 'python'; prompt: string };

export default function SkillsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [execSkill, setExecSkill] = useState<Skill | null>(null);
  const [execInput, setExecInput] = useState('');
  const [execResult, setExecResult] = useState('');
  const [execLoading, setExecLoading] = useState(false);
  const [form, setForm] = useState<CreateForm>({ name: '', type: 'yaml', prompt: '' });
  const [editSkill, setEditSkill] = useState<Skill | null>(null);
  const [editForm, setEditForm] = useState<CreateForm>({ name: '', type: 'yaml', prompt: '' });

  const { data: skills = [], isLoading } = useQuery({
    queryKey: ['skills'],
    queryFn: skillService.list,
  });

  const toggleMutation = useMutation({
    mutationFn: (s: Skill) => skillService.update(s.id, { enabled: !s.enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['skills'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: skillService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['skills'] }),
  });

  const createMutation = useMutation({
    mutationFn: () => skillService.create({
      name: form.name, type: form.type,
      config: { prompt: form.prompt },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      setShowCreate(false);
      setForm({ name: '', type: 'yaml', prompt: '' });
    },
  });

  const editMutation = useMutation({
    mutationFn: () => skillService.update(editSkill!.id, {
      name: editForm.name, type: editForm.type,
      config: { prompt: editForm.prompt },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      setEditSkill(null);
    },
  });

  const openEdit = (skill: Skill) => {
    setEditSkill(skill);
    setEditForm({ name: skill.name, type: skill.type, prompt: (skill.config?.prompt as string) || '' });
  };

  const handleExec = async () => {
    if (!execSkill || !execInput.trim()) return;
    setExecLoading(true);
    setExecResult('');
    try {
      const res = await skillService.execute(execSkill.id, {}, execInput);
      setExecResult(res.result);
    } catch { setExecResult('执行失败'); }
    setExecLoading(false);
  };

  const filtered = skills.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
        <div
          className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border-default)' }}
        >
          <Search size={15} strokeWidth={1.8} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text" placeholder="搜索技能..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[13px]"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-colors shrink-0"
          style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
        >
          <Plus size={15} strokeWidth={2} />
          <span className="hidden sm:inline">新建技能</span>
        </button>
      </div>

      {/* Skills grid */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
            <Zap size={24} strokeWidth={1.5} />
          </div>
          <p className="text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>
            {search ? '没有匹配的技能' : '还没有技能'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((skill) => (
            <SkillCard
              key={skill.id} skill={skill}
              onToggle={() => toggleMutation.mutate(skill)}
              onExec={() => { setExecSkill(skill); setExecResult(''); setExecInput(''); }}
              onEdit={() => openEdit(skill)}
              onDelete={() => { if (confirm(`确定删除技能「${skill.name}」？`)) deleteMutation.mutate(skill.id); }}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <Modal onClose={() => setShowCreate(false)} title="新建技能">
          <div className="space-y-3">
            <input placeholder="技能名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-[13px] bg-transparent outline-none"
              style={{ border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'yaml' | 'python' })}
              className="w-full px-3 py-2 rounded-lg text-[13px] bg-transparent outline-none cursor-pointer"
              style={{ border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
              <option value="yaml">YAML (Prompt 模板)</option>
              <option value="python">Python (自定义脚本)</option>
            </select>
            <textarea placeholder="Prompt 模板内容，用 {content} 作为输入占位符" value={form.prompt}
              onChange={(e) => setForm({ ...form, prompt: e.target.value })} rows={5}
              className="w-full px-3 py-2 rounded-lg text-[13px] bg-transparent outline-none resize-none"
              style={{ border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
            <button onClick={() => createMutation.mutate()} disabled={!form.name.trim() || createMutation.isPending}
              className="w-full py-2 rounded-lg text-[13px] font-medium cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}>
              {createMutation.isPending ? '创建中...' : '创建技能'}
            </button>
          </div>
        </Modal>
      )}

      {/* Execute modal */}
      {execSkill && (
        <Modal onClose={() => setExecSkill(null)} title={`执行: ${execSkill.name}`}>
          <div className="space-y-3">
            <textarea placeholder="输入内容..." value={execInput} onChange={(e) => setExecInput(e.target.value)}
              rows={4} className="w-full px-3 py-2 rounded-lg text-[13px] bg-transparent outline-none resize-none"
              style={{ border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
            <button onClick={handleExec} disabled={!execInput.trim() || execLoading}
              className="w-full py-2 rounded-lg text-[13px] font-medium cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}>
              {execLoading ? '执行中...' : '执行'}
            </button>
            {execResult && (
              <div className="p-3 rounded-lg text-[13px] whitespace-pre-wrap leading-relaxed"
                style={{ background: 'var(--bg-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}>
                {execResult}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Edit modal */}
      {editSkill && (
        <Modal onClose={() => setEditSkill(null)} title={`编辑: ${editSkill.name}`}>
          <div className="space-y-3">
            <input placeholder="技能名称" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-[13px] bg-transparent outline-none"
              style={{ border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
            <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value as 'yaml' | 'python' })}
              className="w-full px-3 py-2 rounded-lg text-[13px] bg-transparent outline-none cursor-pointer"
              style={{ border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
              <option value="yaml">YAML (Prompt 模板)</option>
              <option value="python">Python (自定义脚本)</option>
            </select>
            <textarea placeholder="Prompt 模板内容" value={editForm.prompt}
              onChange={(e) => setEditForm({ ...editForm, prompt: e.target.value })} rows={5}
              className="w-full px-3 py-2 rounded-lg text-[13px] bg-transparent outline-none resize-none"
              style={{ border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
            <button onClick={() => editMutation.mutate()} disabled={!editForm.name.trim() || editMutation.isPending}
              className="w-full py-2 rounded-lg text-[13px] font-medium cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}>
              {editMutation.isPending ? '保存中...' : '保存修改'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function SkillCard({ skill, onToggle, onExec, onEdit, onDelete }: {
  skill: Skill; onToggle: () => void; onExec: () => void; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-3 transition-colors"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
            <Zap size={16} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{skill.name}</div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{skill.type.toUpperCase()}</div>
          </div>
        </div>
        <button onClick={onToggle} className="cursor-pointer shrink-0" style={{ color: skill.enabled ? 'var(--accent)' : 'var(--text-muted)' }}>
          {skill.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
        </button>
      </div>
      <div className="flex items-center gap-2 mt-auto">
        <button onClick={onExec} disabled={!skill.enabled}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer transition-colors disabled:opacity-40"
          style={{ background: 'var(--accent-subtle)', color: 'var(--accent-text)' }}>
          <Play size={12} /> 执行
        </button>
        <button onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer transition-colors"
          style={{ background: 'var(--bg-sunken)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
          <Pencil size={12} /> 编辑
        </button>
        <button onClick={onDelete}
          className="p-1.5 rounded-md cursor-pointer transition-colors ml-auto"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--error)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</span>
          <button onClick={onClose} className="p-1 rounded-md cursor-pointer" style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
