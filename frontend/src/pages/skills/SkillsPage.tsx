import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/composed/page-header';
import { StatCard } from '@/components/composed/stat-card';
import { CreateButton, SolidButton } from '@/components/composed/solid-button';
import { ConfirmDialog } from '@/components/composed/confirm-dialog';
import {
  DataTable,
  type BulkAction,
  type DataTableAction,
  type DataTableColumn,
  type FacetedFilterDef,
} from '@/components/composed/data-table';
import TiptapEditor from '@/components/editor/TiptapEditor';
import { skillsService } from '@/services/skillsService';
import { scriptService } from '@/services/scriptService';
import type { Skill } from '@/types';

type FormData = {
  name: string;
  description: string;
  skill_type: 'prompt' | 'script' | 'hybrid';
  content: string;
  icon: string;
};

const EMPTY_FORM: FormData = {
  name: '',
  description: '',
  skill_type: 'prompt',
  content: '',
  icon: 'lucide:sparkles',
};

const SKILL_TYPE_LABELS: Record<string, string> = {
  prompt: '提示词',
  script: '脚本',
  hybrid: '混合',
};

const SKILL_ICONS = [
  'lucide:sparkles', 'lucide:brain', 'lucide:code', 'lucide:search',
  'lucide:file-text', 'lucide:database', 'lucide:globe', 'lucide:zap',
  'lucide:shield', 'lucide:bar-chart', 'lucide:message-square', 'lucide:settings',
];

// ── Ref Form ────────────────────────────────────────────────
type RefFormData = { name: string; ref_type: string; content: string };
const EMPTY_REF: RefFormData = { name: '', ref_type: 'markdown', content: '' };

export default function SkillsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null);
  // Detail panel
  const [detailId, setDetailId] = useState<string | null>(null);
  // Ref form
  const [showRefForm, setShowRefForm] = useState(false);
  const [refForm, setRefForm] = useState<RefFormData>(EMPTY_REF);
  // Script link
  const [showScriptPicker, setShowScriptPicker] = useState(false);

  const { data: skills = [], isLoading } = useQuery({
    queryKey: ['skills'],
    queryFn: skillsService.list,
  });

  const { data: detail } = useQuery({
    queryKey: ['skills', detailId],
    queryFn: () => skillsService.get(detailId!),
    enabled: !!detailId,
  });

  const { data: allScripts = [] } = useQuery({
    queryKey: ['scripts'],
    queryFn: scriptService.list,
    enabled: showScriptPicker,
  });

  // ── Mutations ─────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (p: { id?: string; data: Partial<Skill> }) =>
      p.id ? skillsService.update(p.id, p.data) : skillsService.create(p.data as Parameters<typeof skillsService.create>[0]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      setShowForm(false);
      setEditingSkill(null);
      setForm(EMPTY_FORM);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: skillsService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      setDeleteTarget(null);
      if (deleteTarget && detailId === deleteTarget.id) setDetailId(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: skillsService.toggle,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['skills'] }),
  });

  const bulkEnableMutation = useMutation({
    mutationFn: (p: { ids: string[]; enabled: boolean }) => skillsService.bulkEnable(p.ids, p.enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['skills'] }),
  });

  const addRefMutation = useMutation({
    mutationFn: (data: { name: string; ref_type: string; content: string }) =>
      skillsService.createRef(detailId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills', detailId] });
      setShowRefForm(false);
      setRefForm(EMPTY_REF);
    },
  });

  const deleteRefMutation = useMutation({
    mutationFn: (refId: string) => skillsService.deleteRef(detailId!, refId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['skills', detailId] }),
  });

  const linkScriptMutation = useMutation({
    mutationFn: (scriptId: string) => skillsService.linkScript(detailId!, scriptId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills', detailId] });
      setShowScriptPicker(false);
    },
  });

  const unlinkScriptMutation = useMutation({
    mutationFn: (linkId: string) => skillsService.unlinkScript(detailId!, linkId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['skills', detailId] }),
  });

  // ── Handlers ──────────────────────────────────────────────
  const openCreate = () => { setEditingSkill(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (s: Skill) => {
    setEditingSkill(s);
    setForm({ name: s.name, description: s.description || '', skill_type: s.skill_type, content: s.content || '', icon: s.icon || 'lucide:sparkles' });
    setShowForm(true);
  };
  const handleSave = () => {
    if (!form.name.trim()) return;
    saveMutation.mutate({ id: editingSkill?.id, data: { ...form } });
  };

  // ── Stats ─────────────────────────────────────────────────
  const total = skills.length;
  const enabled = skills.filter((s) => s.enabled).length;
  const promptCount = skills.filter((s) => s.skill_type === 'prompt').length;
  const scriptCount = skills.filter((s) => s.skill_type === 'script' || s.skill_type === 'hybrid').length;

  const facetedFilters = useMemo((): FacetedFilterDef<Skill>[] => [
    {
      key: 'skill_type',
      label: '类型',
      icon: 'lucide:tag',
      options: [
        { value: 'prompt', label: '提示词', icon: 'lucide:message-square' },
        { value: 'script', label: '脚本', icon: 'lucide:code' },
        { value: 'hybrid', label: '混合', icon: 'lucide:layers' },
      ],
      accessor: (s) => s.skill_type,
    },
    {
      key: 'enabled',
      label: '状态',
      icon: 'lucide:toggle-right',
      options: [
        { value: 'enabled', label: '启用', icon: 'lucide:check-circle-2' },
        { value: 'disabled', label: '禁用', icon: 'lucide:x-circle' },
      ],
      accessor: (s) => (s.enabled ? 'enabled' : 'disabled'),
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

  // ── Columns ────────────────────────────────────────────────
  const columns = useMemo((): DataTableColumn<Skill>[] => [
    {
      key: 'name',
      header: '技能名称',
      sortable: true,
      width: '240px',
      render: (s) => (
        <button className="min-w-0 text-left" onClick={() => setDetailId(s.id)}>
          <div className="flex items-center gap-2">
            <Icon icon={s.icon || 'lucide:sparkles'} className="size-4 shrink-0 text-violet-500" />
            <span className="text-sm font-medium text-foreground truncate">{s.name}</span>
          </div>
          {s.description && (
            <div className="text-[11px] text-muted-foreground truncate max-w-[220px] mt-0.5">{s.description}</div>
          )}
        </button>
      ),
    },
    {
      key: 'skill_type',
      header: '类型',
      width: '80px',
      render: (s) => (
        <Badge variant="outline" className={cn('text-[10px]',
          s.skill_type === 'prompt' ? 'text-blue-600 border-blue-200 dark:border-blue-800 dark:text-blue-400'
            : s.skill_type === 'script' ? 'text-amber-600 border-amber-200 dark:border-amber-800 dark:text-amber-400'
            : 'text-purple-600 border-purple-200 dark:border-purple-800 dark:text-purple-400'
        )}>
          {SKILL_TYPE_LABELS[s.skill_type] || s.skill_type}
        </Badge>
      ),
    },
    {
      key: 'refs',
      header: '引用/脚本',
      width: '100px',
      render: (s) => (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-0.5"><Icon icon="lucide:file-text" className="size-3" />{s.ref_count ?? 0}</span>
          <span className="flex items-center gap-0.5"><Icon icon="lucide:code" className="size-3" />{s.script_count ?? 0}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: '状态',
      width: '80px',
      render: (s) => (
        <Badge variant={s.enabled ? 'default' : 'outline'} className={cn('text-[11px]',
          s.enabled ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800 dark:text-emerald-400' : 'text-muted-foreground'
        )}>
          <span className={cn('mr-1 inline-block h-1.5 w-1.5 rounded-full', s.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
          {s.enabled ? '启用' : '禁用'}
        </Badge>
      ),
    },
    {
      key: 'toggle',
      header: '开关',
      width: '60px',
      render: (s) => <Switch checked={s.enabled} onCheckedChange={() => toggleMutation.mutate(s.id)} className="scale-90" />,
    },
  ], [toggleMutation]);

  const actions: DataTableAction<Skill>[] = [
    { label: '详情', icon: 'lucide:eye', onClick: (s) => setDetailId(s.id) },
    { label: '编辑', icon: 'lucide:pencil', onClick: openEdit },
    { label: '删除', icon: 'lucide:trash-2', variant: 'destructive', onClick: (s) => setDeleteTarget(s) },
  ];

  return (
    <div className="flex flex-col gap-6 h-full">
      <PageHeader title="Skills 技能" description="管理 AI 可调用的技能，支持提示词模板、脚本执行和引用资料" icon="lucide:sparkles" iconClassName="text-violet-500">
        <CreateButton onClick={openCreate}>新建技能</CreateButton>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="技能总数" value={total} icon="lucide:layers" iconColor="#8b5cf6" description="已注册" />
        <StatCard label="启用中" value={enabled} icon="lucide:check-circle-2" iconColor="#10b981" description="当前可用" />
        <StatCard label="提示词类" value={promptCount} icon="lucide:message-square" iconColor="#3b82f6" description="Prompt 模板" />
        <StatCard label="脚本类" value={scriptCount} icon="lucide:code" iconColor="#f59e0b" description="含脚本执行" />
      </div>

      <div className={cn('flex gap-4', detailId ? 'flex-col lg:flex-row' : '')}>
        <div className={cn(detailId ? 'lg:w-1/2' : 'w-full')}>
          <DataTable<Skill>
            data={skills}
            columns={columns}
            rowKey={(s) => s.id}
            searchPlaceholder="搜索技能名称..."
            searchAccessor={(s) => s.name + (s.description || '')}
            actions={actions}
            facetedFilters={facetedFilters}
            selectable
            bulkActions={bulkActions}
            emptyIcon="lucide:sparkles"
            emptyTitle={isLoading ? '加载中...' : '还没有技能'}
            emptyDescription="创建技能让 AI 获得专业能力"
            emptyActionLabel="创建第一个技能"
            emptyActionClick={openCreate}
            emptyActionColor="create"
            defaultRowsPerPage={10}
            cardClassName="card-glow-violet"
          />
        </div>

        {/* Detail Panel */}
        {detailId && detail && (
          <div className="lg:w-1/2 rounded-xl border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon icon={detail.icon || 'lucide:sparkles'} className="size-5 text-violet-500" />
                <h3 className="text-base font-semibold">{detail.name}</h3>
                <Badge variant="outline" className="text-[10px]">{SKILL_TYPE_LABELS[detail.skill_type]}</Badge>
              </div>
              <button onClick={() => setDetailId(null)} className="text-muted-foreground hover:text-foreground">
                <Icon icon="lucide:x" className="size-4" />
              </button>
            </div>
            {detail.description && <p className="text-sm text-muted-foreground">{detail.description}</p>}
            {detail.content && (
              <div className="prose prose-sm dark:prose-invert max-h-48 overflow-y-auto rounded-lg border p-3" dangerouslySetInnerHTML={{ __html: detail.content }} />
            )}

            {/* References */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium flex items-center gap-1"><Icon icon="lucide:file-text" className="size-3.5" />引用资料</h4>
                <SolidButton color="secondary" size="sm" onClick={() => { setRefForm(EMPTY_REF); setShowRefForm(true); }}>
                  <Icon icon="lucide:plus" className="size-3" />添加
                </SolidButton>
              </div>
              {detail.references.length === 0 ? (
                <p className="text-xs text-muted-foreground">暂无引用</p>
              ) : (
                <div className="space-y-1.5">
                  {detail.references.map((ref) => (
                    <div key={ref.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon icon={ref.ref_type === 'url' ? 'lucide:link' : ref.ref_type === 'pdf' ? 'lucide:file' : 'lucide:file-text'} className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="text-sm truncate">{ref.name}</span>
                        <Badge variant="outline" className="text-[9px]">{ref.ref_type}</Badge>
                      </div>
                      <button onClick={() => deleteRefMutation.mutate(ref.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                        <Icon icon="lucide:trash-2" className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Scripts */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium flex items-center gap-1"><Icon icon="lucide:code" className="size-3.5" />关联脚本</h4>
                <SolidButton color="secondary" size="sm" onClick={() => setShowScriptPicker(true)}>
                  <Icon icon="lucide:plus" className="size-3" />关联
                </SolidButton>
              </div>
              {detail.scripts.length === 0 ? (
                <p className="text-xs text-muted-foreground">暂无关联脚本</p>
              ) : (
                <div className="space-y-1.5">
                  {detail.scripts.map((link) => (
                    <div key={link.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                      <span className="text-sm">{link.script_name || '未知脚本'}</span>
                      <button onClick={() => unlinkScriptMutation.mutate(link.id)} className="text-muted-foreground hover:text-destructive">
                        <Icon icon="lucide:unlink" className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSkill ? '编辑技能' : '新建技能'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">技能名称 *</label>
                <Input placeholder="例如：代码审查" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">类型</label>
                <Select value={form.skill_type} onValueChange={(v) => setForm({ ...form, skill_type: v as FormData['skill_type'] })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prompt">提示词模板</SelectItem>
                    <SelectItem value="script">脚本执行</SelectItem>
                    <SelectItem value="hybrid">混合（脚本+AI）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">描述（AI 根据描述判断何时调用）</label>
              <Input placeholder="简要描述技能用途" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">图标</label>
              <div className="flex flex-wrap gap-1.5">
                {SKILL_ICONS.map((icon) => (
                  <button key={icon} type="button" onClick={() => setForm({ ...form, icon })}
                    className={cn('p-1.5 rounded-md border transition-colors', form.icon === icon ? 'border-violet-500 bg-violet-500/10' : 'border-transparent hover:bg-accent')}>
                    <Icon icon={icon} className="size-4" />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">技能内容</label>
              <div className="min-h-[200px]">
                <TiptapEditor content={form.content} onChange={(html) => setForm({ ...form, content: html })} placeholder="编写技能的提示词模板或说明..." />
              </div>
            </div>
          </div>
          <DialogFooter>
            <SolidButton color="secondary" onClick={() => { setShowForm(false); setEditingSkill(null); setForm(EMPTY_FORM); }}>取消</SolidButton>
            <SolidButton color="primary" onClick={handleSave} disabled={!form.name.trim() || saveMutation.isPending} loading={saveMutation.isPending} loadingText="保存中...">
              {editingSkill ? '保存修改' : '创建技能'}
            </SolidButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Reference Dialog */}
      <Dialog open={showRefForm} onOpenChange={setShowRefForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>添加引用资料</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">名称 *</label>
              <Input placeholder="引用名称" value={refForm.name} onChange={(e) => setRefForm({ ...refForm, name: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">类型</label>
              <Select value={refForm.ref_type} onValueChange={(v) => setRefForm({ ...refForm, ref_type: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="markdown">Markdown 文本</SelectItem>
                  <SelectItem value="url">URL 链接</SelectItem>
                  <SelectItem value="pdf">PDF 文件</SelectItem>
                  <SelectItem value="image">图片</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{refForm.ref_type === 'url' ? 'URL' : '内容'}</label>
              <Textarea value={refForm.content} onChange={(e) => setRefForm({ ...refForm, content: e.target.value })} rows={5} placeholder={refForm.ref_type === 'url' ? 'https://...' : '输入 Markdown 内容...'} className="font-mono text-xs" />
            </div>
          </div>
          <DialogFooter>
            <SolidButton color="secondary" onClick={() => setShowRefForm(false)}>取消</SolidButton>
            <SolidButton color="primary" onClick={() => addRefMutation.mutate(refForm)} disabled={!refForm.name.trim() || addRefMutation.isPending} loading={addRefMutation.isPending}>添加</SolidButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Script Picker Dialog */}
      <Dialog open={showScriptPicker} onOpenChange={setShowScriptPicker}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>关联脚本</DialogTitle></DialogHeader>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {allScripts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">暂无可用脚本，请先在脚本管理中创建</p>
            ) : allScripts.map((s) => (
              <button key={s.id} onClick={() => linkScriptMutation.mutate(s.id)}
                className="flex items-center gap-2 w-full rounded-lg border px-3 py-2 text-left hover:bg-accent transition-colors">
                <Icon icon="lucide:code" className="size-4 text-amber-500 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{s.name}</div>
                  {s.description && <div className="text-[11px] text-muted-foreground truncate">{s.description}</div>}
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={`删除「${deleteTarget?.name}」？`}
        description="此操作不可撤销，技能及其引用和脚本关联将被永久删除。"
        confirmLabel="确认删除"
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
