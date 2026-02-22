import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
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
import { FloatingEditor } from '@/components/composed/floating-editor';
import { skillsService } from '@/services/skillsService';
import { scriptService } from '@/services/scriptService';
import type { Skill } from '@/types';

type FormData = {
  name: string;
  description: string;
  content: string;
  icon: string;
};

const EMPTY_FORM: FormData = {
  name: '',
  description: '',
  content: '',
  icon: 'lucide:sparkles',
};

// ── Expanded Row Content ─────────────────────────────────────
function SkillExpandedRow({ skillId }: { skillId: string }) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ['skills', skillId],
    queryFn: () => skillsService.get(skillId),
  });

  if (isLoading) return <div className="text-xs text-muted-foreground py-2">加载中...</div>;
  if (!detail) return null;

  const hasRefs = detail.references.length > 0;
  const hasScripts = detail.scripts.length > 0;

  if (!hasRefs && !hasScripts && !detail.content) {
    return <div className="text-xs text-muted-foreground py-1">暂无引用、脚本或内容</div>;
  }

  return (
    <div className="space-y-2 py-1">
      {detail.content && (
        <div className="prose prose-sm dark:prose-invert max-h-32 overflow-y-auto rounded-lg border p-2 text-xs" dangerouslySetInnerHTML={{ __html: detail.content }} />
      )}
      {hasRefs && (
        <div>
          <div className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <Icon icon="lucide:file-text" className="size-3" />引用资料 ({detail.references.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {detail.references.map((ref) => (
              <Badge key={ref.id} variant="outline" className="text-[10px] gap-1">
                <Icon icon={ref.ref_type === 'url' ? 'lucide:link' : 'lucide:file-text'} className="size-2.5" />
                {ref.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {hasScripts && (
        <div>
          <div className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <Icon icon="lucide:code" className="size-3" />关联脚本 ({detail.scripts.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {detail.scripts.map((link) => (
              <Badge key={link.id} variant="outline" className="text-[10px] gap-1">
                <Icon icon="lucide:code" className="size-2.5" />
                {link.script_name || '未知脚本'}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SkillsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null);
  // Detail panel
  const [detailId, setDetailId] = useState<string | null>(null);
  // Script link
  const [showScriptPicker, setShowScriptPicker] = useState(false);
  // Content editor
  const [showContentEditor, setShowContentEditor] = useState(false);
  const refFileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    enabled: !!detailId,
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

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => skillsService.bulkDelete(ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['skills'] }),
  });

  const addRefMutation = useMutation({
    mutationFn: (data: { name: string; ref_type: string; content: string }) =>
      skillsService.createRef(detailId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills', detailId] });
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
    setDetailId(s.id);
    setForm({ name: s.name, description: s.description || '', content: s.content || '', icon: s.icon || 'lucide:sparkles' });
    setShowForm(true);
  };
  const handleSave = () => {
    if (!form.name.trim()) return;
    saveMutation.mutate({ id: editingSkill?.id, data: { ...form } });
  };
  const handleRefFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    Array.from(files).forEach((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const refType = ext === 'pdf' ? 'pdf' : ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) ? 'image' : 'markdown';
      const reader = new FileReader();
      reader.onload = () => {
        addRefMutation.mutate({ name: file.name, ref_type: refType, content: reader.result as string });
      };
      reader.readAsText(file);
    });
    e.target.value = '';
  };
  const handleMdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, content: reader.result as string }));
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── Stats ─────────────────────────────────────────────────
  const total = skills.length;
  const enabled = skills.filter((s) => s.enabled).length;
  const refTotal = skills.reduce((sum, s) => sum + (s.ref_count ?? 0), 0);
  const scriptTotal = skills.reduce((sum, s) => sum + (s.script_count ?? 0), 0);

  const facetedFilters = useMemo((): FacetedFilterDef<Skill>[] => [
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
    {
      label: '批量删除',
      icon: 'lucide:trash-2',
      variant: 'destructive',
      onClick: (ids) => bulkDeleteMutation.mutate(ids),
    },
  ], [bulkEnableMutation, bulkDeleteMutation]);

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
        <StatCard label="引用资料" value={refTotal} icon="lucide:file-text" iconColor="#3b82f6" description="关联引用" />
        <StatCard label="关联脚本" value={scriptTotal} icon="lucide:code" iconColor="#f59e0b" description="脚本执行" />
      </div>

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
        getRowExpandedContent={(s) => <SkillExpandedRow skillId={s.id} />}
        emptyIcon="lucide:sparkles"
        emptyTitle={isLoading ? '加载中...' : '还没有技能'}
        emptyDescription="创建技能让 AI 获得专业能力"
        emptyActionLabel="创建第一个技能"
        emptyActionClick={openCreate}
        emptyActionColor="create"
        defaultRowsPerPage={10}
        cardClassName="card-glow-violet"
      />

      {/* Detail Dialog */}
      <Dialog open={!!detailId && !!detail} onOpenChange={(open) => { if (!open) { setDetailId(null); setShowScriptPicker(false); } }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Icon icon={detail.icon || 'lucide:sparkles'} className="size-5 text-violet-500" />
                  {detail.name}
                </DialogTitle>
              </DialogHeader>
              {detail.description && <p className="text-sm text-muted-foreground">{detail.description}</p>}
              {detail.content && (
                <div className="prose prose-sm dark:prose-invert max-h-48 overflow-y-auto rounded-lg border p-3" dangerouslySetInnerHTML={{ __html: detail.content }} />
              )}

              {/* References & Scripts — side by side */}
              <div className="grid grid-cols-2 gap-4">
                {/* Left: References */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium flex items-center gap-1"><Icon icon="lucide:file-text" className="size-3.5" />引用资料</h4>
                    <SolidButton color="secondary" size="sm" onClick={() => refFileInputRef.current?.click()}>
                      <Icon icon="lucide:upload" className="size-3" />上传
                    </SolidButton>
                    <input ref={refFileInputRef} type="file" accept=".md,.markdown,.txt,.pdf,.png,.jpg,.jpeg,.gif,.webp,.svg" multiple className="hidden" onChange={handleRefFileUpload} />
                  </div>
                  {detail.references.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">暂无引用</p>
                  ) : (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
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

                {/* Right: Scripts */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium flex items-center gap-1"><Icon icon="lucide:code" className="size-3.5" />关联脚本</h4>
                    <SolidButton color="secondary" size="sm" onClick={() => setShowScriptPicker((v) => !v)}>
                      <Icon icon={showScriptPicker ? 'lucide:x' : 'lucide:plus'} className="size-3" />{showScriptPicker ? '收起' : '关联'}
                    </SolidButton>
                  </div>
                  {detail.scripts.length === 0 && !showScriptPicker ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">暂无关联脚本</p>
                  ) : (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {detail.scripts.map((link) => (
                        <div key={link.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                          <span className="text-sm truncate">{link.script_name || '未知脚本'}</span>
                          <button onClick={() => unlinkScriptMutation.mutate(link.id)} className="text-muted-foreground hover:text-destructive">
                            <Icon icon="lucide:unlink" className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {showScriptPicker && (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-lg border p-2">
                      <p className="text-[11px] text-muted-foreground mb-1">选择脚本关联：</p>
                      {allScripts.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2 text-center">暂无可用脚本</p>
                      ) : allScripts.map((s) => (
                        <button key={s.id} onClick={() => linkScriptMutation.mutate(s.id)}
                          className="flex items-center gap-2 w-full rounded-lg border px-3 py-1.5 text-left hover:bg-accent transition-colors">
                          <Icon icon="lucide:code" className="size-3.5 text-amber-500 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{s.name}</div>
                            {s.description && <div className="text-[11px] text-muted-foreground truncate">{s.description}</div>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSkill ? '编辑技能' : '新建技能'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">技能名称 *</label>
              <Input placeholder="例如：代码审查" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">描述（AI 根据描述判断何时调用）</label>
              <Input placeholder="简要描述技能用途" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">技能内容</label>
              <div className="flex items-center gap-2">
                <SolidButton color="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Icon icon="lucide:upload" className="size-3.5" />上传 MD 文件
                </SolidButton>
                <SolidButton color="secondary" size="sm" onClick={() => setShowContentEditor(true)}>
                  <Icon icon="lucide:edit-3" className="size-3.5" />打开编辑器
                </SolidButton>
                {form.content && <span className="text-xs text-emerald-500 flex items-center gap-1"><Icon icon="lucide:check-circle-2" className="size-3" />已有内容</span>}
              </div>
              <input ref={fileInputRef} type="file" accept=".md,.markdown,.txt" className="hidden" onChange={handleMdUpload} />
            </div>

            {/* 编辑模式下显示引用和脚本管理 */}
            {editingSkill && detail && (
              <>
                {/* References */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-muted-foreground flex items-center gap-1"><Icon icon="lucide:file-text" className="size-3.5" />引用资料</label>
                    <SolidButton color="secondary" size="sm" onClick={() => refFileInputRef.current?.click()}>
                      <Icon icon="lucide:upload" className="size-3" />上传
                    </SolidButton>
                  </div>
                  {detail.references.length > 0 && (
                    <div className="space-y-1">
                      {detail.references.map((ref) => (
                        <div key={ref.id} className="flex items-center justify-between rounded-lg border px-3 py-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <Icon icon={ref.ref_type === 'url' ? 'lucide:link' : 'lucide:file-text'} className="size-3 shrink-0 text-muted-foreground" />
                            <span className="text-xs truncate">{ref.name}</span>
                            <Badge variant="outline" className="text-[9px]">{ref.ref_type}</Badge>
                          </div>
                          <button onClick={() => deleteRefMutation.mutate(ref.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                            <Icon icon="lucide:trash-2" className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Scripts */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-muted-foreground flex items-center gap-1"><Icon icon="lucide:code" className="size-3.5" />关联脚本</label>
                    <SolidButton color="secondary" size="sm" onClick={() => setShowScriptPicker(true)}>
                      <Icon icon="lucide:plus" className="size-3" />关联
                    </SolidButton>
                  </div>
                  {detail.scripts.length > 0 && (
                    <div className="space-y-1">
                      {detail.scripts.map((link) => (
                        <div key={link.id} className="flex items-center justify-between rounded-lg border px-3 py-1.5">
                          <span className="text-xs">{link.script_name || '未知脚本'}</span>
                          <button onClick={() => unlinkScriptMutation.mutate(link.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                            <Icon icon="lucide:unlink" className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <SolidButton color="secondary" onClick={() => { setShowForm(false); setEditingSkill(null); setForm(EMPTY_FORM); }}>取消</SolidButton>
            <SolidButton color="primary" onClick={handleSave} disabled={!form.name.trim() || saveMutation.isPending} loading={saveMutation.isPending} loadingText="保存中...">
              {editingSkill ? '保存修改' : '创建技能'}
            </SolidButton>
          </DialogFooter>
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

      <FloatingEditor
        open={showContentEditor}
        onClose={() => setShowContentEditor(false)}
        title={form.name || '技能内容'}
        onTitleChange={(v) => setForm((f) => ({ ...f, name: v }))}
        html={form.content}
        onHtmlChange={(html) => setForm((f) => ({ ...f, content: html }))}
        onSave={() => setShowContentEditor(false)}
      />
    </div>
  );
}
