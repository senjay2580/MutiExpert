import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@iconify/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchBar } from '@/components/composed/search-bar';
import { EmptyState } from '@/components/composed/empty-state';
import { CreateButton, SolidButton } from '@/components/composed/solid-button';
import { AnimatedList, AnimatedItem } from '@/components/composed/animated';
import { ConfirmDialog } from '@/components/composed/confirm-dialog';
import { ItemContextMenu, type ItemAction } from '@/components/composed/item-context-menu';
import { ColorWheel } from '@/components/composed/color-wheel';
import { cn } from '@/lib/utils';
import { industryService } from '@/services/industryService';
import { knowledgeBaseService } from '@/services/knowledgeBaseService';
import { illustrationPresets } from '@/lib/illustrations';
import type { KnowledgeBase, Industry } from '@/types';
import { toast } from 'sonner';

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const resp = (error as { response?: { data?: { detail?: string } } }).response;
    if (resp?.data?.detail) return resp.data.detail;
  }
  if (error instanceof Error) return error.message;
  return '操作失败，请重试';
}

const PAGE_SIZE = 9;

type ViewMode = 'grid' | 'list';

export default function KnowledgePage() {
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [page, setPage] = useState(1);

  // KB dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKBName, setNewKBName] = useState('');
  const [newKBDesc, setNewKBDesc] = useState('');
  const [newKBIndustry, setNewKBIndustry] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeBase | null>(null);

  // Industry dialogs
  const [showIndustryDialog, setShowIndustryDialog] = useState(false);
  const [editingIndustry, setEditingIndustry] = useState<Industry | null>(null);
  const [indName, setIndName] = useState('');
  const [indDesc, setIndDesc] = useState('');
  const [indColor, setIndColor] = useState('#3B82F6');
  const [deleteIndTarget, setDeleteIndTarget] = useState<Industry | null>(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  /* ---- Queries ---- */
  const { data: rawIndustries = [], isLoading: loadingInd } = useQuery({
    queryKey: ['industries'],
    queryFn: industryService.list,
  });
  const industries = rawIndustries;

  const { data: rawKnowledgeBases = [], isLoading: loadingKB } = useQuery({
    queryKey: ['knowledge-bases', selectedIndustry],
    queryFn: () => knowledgeBaseService.list(selectedIndustry ?? undefined),
  });
  const knowledgeBases = rawKnowledgeBases;

  /* ---- KB Mutations ---- */
  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; industry_id?: string }) =>
      knowledgeBaseService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-bases'] });
      setShowCreateDialog(false);
      setNewKBName('');
      setNewKBDesc('');
      setNewKBIndustry('');
      toast.success('知识库创建成功');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: knowledgeBaseService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-bases'] });
      setDeleteTarget(null);
      toast.success('知识库已删除');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });

  /* ---- Industry Mutations ---- */
  const createIndMutation = useMutation({
    mutationFn: (data: Partial<Industry>) => industryService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['industries'] });
      closeIndustryDialog();
      toast.success('行业创建成功');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });

  const updateIndMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Industry> }) =>
      industryService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['industries'] });
      closeIndustryDialog();
      toast.success('行业更新成功');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });

  const deleteIndMutation = useMutation({
    mutationFn: industryService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['industries'] });
      if (deleteIndTarget && selectedIndustry === deleteIndTarget.id) {
        setSelectedIndustry(null);
      }
      setDeleteIndTarget(null);
      toast.success('行业已删除');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });

  /* ---- Derived data ---- */
  const filtered = useMemo(
    () => knowledgeBases.filter(
      (kb) => !searchQuery || kb.name.toLowerCase().includes(searchQuery.toLowerCase()),
    ),
    [knowledgeBases, searchQuery],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const industryMap = useMemo(() => {
    const m = new Map<string, Industry>();
    for (const ind of industries) m.set(ind.id, ind);
    return m;
  }, [industries]);

  const industryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const kb of knowledgeBases) {
      if (kb.industry_id) {
        counts.set(kb.industry_id, (counts.get(kb.industry_id) ?? 0) + 1);
      }
    }
    return counts;
  }, [knowledgeBases]);

  const totalDocs = knowledgeBases.reduce((sum, kb) => sum + kb.document_count, 0);

  /* ---- Handlers ---- */
  const handleCreateKB = () => {
    if (!newKBName.trim()) return;
    createMutation.mutate({
      name: newKBName.trim(),
      description: newKBDesc.trim() || undefined,
      industry_id: newKBIndustry || selectedIndustry || undefined,
    });
  };

  const openCreateIndustry = () => {
    setEditingIndustry(null);
    setIndName('');
    setIndDesc('');
    setIndColor('#3B82F6');
    setShowIndustryDialog(true);
  };

  const openEditIndustry = (ind: Industry) => {
    setEditingIndustry(ind);
    setIndName(ind.name);
    setIndDesc(ind.description ?? '');
    setIndColor(ind.color || '#3B82F6');
    setShowIndustryDialog(true);
  };

  const closeIndustryDialog = () => {
    setShowIndustryDialog(false);
    setEditingIndustry(null);
    setIndName('');
    setIndDesc('');
    setIndColor('#3B82F6');
  };

  const handleSaveIndustry = () => {
    if (!indName.trim()) return;
    const data = { name: indName.trim(), description: indDesc.trim(), color: indColor };
    if (editingIndustry) {
      updateIndMutation.mutate({ id: editingIndustry.id, data });
    } else {
      createIndMutation.mutate(data);
    }
  };

  // Reset page when search/industry changes
  const handleSearchChange = (v: string) => {
    setSearchQuery(v);
    setPage(1);
  };
  const handleIndustryChange = (id: string | null) => {
    setSelectedIndustry(id);
    setPage(1);
  };

  /* ---- Context menu actions for KB ---- */
  const kbActions = (kb: KnowledgeBase): (ItemAction | 'separator')[] => [
    { key: 'open', label: '打开', icon: 'lucide:external-link', onClick: () => navigate(`/knowledge/${kb.id}`) },
    'separator',
    { key: 'delete', label: '删除', icon: 'lucide:trash-2', variant: 'destructive', onClick: () => setDeleteTarget(kb) },
  ];

  /* ---- Context menu actions for Industry ---- */
  const indActions = (ind: Industry): (ItemAction | 'separator')[] => [
    { key: 'edit', label: '编辑', icon: 'lucide:pencil', onClick: () => openEditIndustry(ind) },
    'separator',
    { key: 'delete', label: '删除', icon: 'lucide:trash-2', variant: 'destructive', onClick: () => setDeleteIndTarget(ind) },
  ];

  const indSaving = createIndMutation.isPending || updateIndMutation.isPending;

  return (
    <div className="flex h-full flex-col gap-5">
      {/* ---- Hero ---- */}
      <div className="flex items-center gap-6 px-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-foreground">行业知识库</h1>
          <p className="mt-1 text-sm text-muted-foreground">按行业分类管理你的知识资源，让每一份资料都井然有序</p>
        </div>
        <img
          src={illustrationPresets.knowledgeHero}
          alt="Knowledge illustration"
          className="hidden h-28 w-28 object-contain opacity-90 sm:block lg:h-32 lg:w-32"
          draggable={false}
        />
      </div>

      {/* ---- Stats Chart ---- */}
      <KnowledgeStatsCard
        loading={loadingKB || loadingInd}
        data={[
          { label: '知识库', value: knowledgeBases.length, color: '#6366F1', icon: 'lucide:database' },
          { label: '文档总量', value: totalDocs, color: '#3B82F6', icon: 'lucide:file-text' },
          { label: '行业覆盖', value: industries.length, color: '#10B981', icon: 'lucide:layers' },
        ]}
      />

      {/* ---- Main Content ---- */}
      <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:gap-6">
        {/* Left: Industry Sidebar */}
        <Card className="gap-0 py-0 sm:w-56 shrink-0 overflow-y-auto">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-[13px] font-semibold text-foreground">行业分类</span>
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-primary"
              onClick={openCreateIndustry}
              title="新建行业"
            >
              <Icon icon="lucide:plus" width={14} height={14} />
            </Button>
          </div>
          {loadingInd ? (
            <div className="space-y-2 px-4 py-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : (
            <div className="py-1">
              <IndustryItem
                label="全部"
                icon="streamline-color:local-storage-folder"
                active={!selectedIndustry}
                count={knowledgeBases.length}
                onClick={() => handleIndustryChange(null)}
              />
              {industries.map((ind) => (
                <ItemContextMenu key={ind.id} actions={indActions(ind)}>
                  <IndustryItem
                    label={ind.name}
                    color={ind.color}
                    active={selectedIndustry === ind.id}
                    count={industryCounts.get(ind.id) ?? 0}
                    onClick={() => handleIndustryChange(ind.id)}
                    onEdit={() => openEditIndustry(ind)}
                  />
                </ItemContextMenu>
              ))}
            </div>
          )}
        </Card>

        {/* Right: Knowledge Bases */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Toolbar */}
          <div className="mb-4 flex flex-wrap items-center gap-3 sm:flex-nowrap">
            <SearchBar
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="搜索知识库..."
              className="min-w-0 flex-1"
            />
            <div className="flex rounded-lg border bg-muted/50 p-0.5">
              <Button
                variant="ghost"
                size="icon-xs"
                className={cn('rounded-md', viewMode === 'grid' && 'bg-background shadow-sm')}
                onClick={() => setViewMode('grid')}
              >
                <Icon icon="lucide:layout-grid" width={14} height={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                className={cn('rounded-md', viewMode === 'list' && 'bg-background shadow-sm')}
                onClick={() => setViewMode('list')}
              >
                <Icon icon="lucide:list" width={14} height={14} />
              </Button>
            </div>
            <CreateButton onClick={() => setShowCreateDialog(true)}>
              新建知识库
            </CreateButton>
          </div>

          {/* Content */}
          {loadingKB ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="gap-0 py-0">
                    <CardContent className="space-y-3 px-5 py-5">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <div className="flex gap-2 pt-2">
                        <Skeleton className="h-5 w-16 rounded-full" />
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="flex-1 gap-0 py-0">
                <div className="divide-y">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-4">
                      <Skeleton className="h-9 w-9 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </div>
                  ))}
                </div>
              </Card>
            )
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="streamline-color:open-book"
              illustration={searchQuery ? undefined : illustrationPresets.emptyKnowledge}
              title={searchQuery ? '没有匹配的知识库' : '还没有知识库'}
              description={searchQuery ? undefined : '创建你的第一个知识库，开始管理行业知识'}
              action={
                !searchQuery
                  ? { label: '新建知识库', onClick: () => setShowCreateDialog(true), color: 'create' as const }
                  : undefined
              }
              className="flex-1"
            />
          ) : (
            <div className="flex flex-1 flex-col">
              {viewMode === 'grid' ? (
                <AnimatedList className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {paginated.map((kb) => (
                    <AnimatedItem key={kb.id}>
                      <ItemContextMenu actions={kbActions(kb)} showTriggerButton triggerClassName="absolute right-1.5 top-1.5 rounded-none">
                        <KBCard
                          kb={kb}
                          industry={industryMap.get(kb.industry_id)}
                          onOpen={() => navigate(`/knowledge/${kb.id}`)}
                        />
                      </ItemContextMenu>
                    </AnimatedItem>
                  ))}
                </AnimatedList>
              ) : (
                <Card className="flex-1 gap-0 overflow-y-auto py-0 card-glow-indigo">
                  <AnimatedList className="divide-y">
                    {paginated.map((kb) => (
                      <AnimatedItem key={kb.id}>
                        <ItemContextMenu actions={kbActions(kb)} showTriggerButton>
                          <KBRow
                            kb={kb}
                            industry={industryMap.get(kb.industry_id)}
                            onOpen={() => navigate(`/knowledge/${kb.id}`)}
                          />
                        </ItemContextMenu>
                      </AnimatedItem>
                    ))}
                  </AnimatedList>
                </Card>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <Pagination
                  page={safePage}
                  totalPages={totalPages}
                  totalItems={filtered.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setPage}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---- Create KB Dialog ---- */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建知识库</DialogTitle>
            <DialogDescription>为你的行业知识创建一个专属知识库</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">名称</label>
              <Input
                autoFocus
                placeholder="例如：医疗健康研究资料"
                value={newKBName}
                onChange={(e) => setNewKBName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newKBName.trim()) handleCreateKB(); }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">描述（可选）</label>
              <Input placeholder="简要描述知识库用途..." value={newKBDesc} onChange={(e) => setNewKBDesc(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">所属行业（可选）</label>
              <Select value={newKBIndustry} onValueChange={setNewKBIndustry}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择行业分类..." />
                </SelectTrigger>
                <SelectContent>
                  {industries.map((ind) => (
                    <SelectItem key={ind.id} value={ind.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={ind.color ? { background: ind.color } : undefined} />
                        {ind.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <SolidButton color="indigo" size="sm" onClick={handleCreateKB} disabled={!newKBName.trim()} loading={createMutation.isPending} loadingText="创建中...">
              创建
            </SolidButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Delete KB Confirm ---- */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="确认删除"
        description={`确定要删除知识库「${deleteTarget?.name}」吗？此操作不可恢复。`}
        confirmLabel="删除"
        variant="destructive"
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
        loading={deleteMutation.isPending}
      />

      {/* ---- Industry Create/Edit Dialog ---- */}
      <Dialog open={showIndustryDialog} onOpenChange={(open) => !open && closeIndustryDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingIndustry ? '编辑行业' : '新建行业'}</DialogTitle>
            <DialogDescription>
              {editingIndustry ? '修改行业分类信息' : '创建新的行业分类来组织知识库'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">名称</label>
              <Input
                autoFocus
                placeholder="例如：医疗健康"
                value={indName}
                onChange={(e) => setIndName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && indName.trim()) handleSaveIndustry(); }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">描述（可选）</label>
              <Input placeholder="简要描述行业..." value={indDesc} onChange={(e) => setIndDesc(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">颜色</label>
              <ColorWheel value={indColor} onChange={setIndColor} size={140} />
            </div>
          </div>
          <DialogFooter>
            <SolidButton
              color="indigo"
              size="sm"
              onClick={handleSaveIndustry}
              disabled={!indName.trim()}
              loading={indSaving}
              loadingText={editingIndustry ? '保存中...' : '创建中...'}
            >
              {editingIndustry ? '保存' : '创建'}
            </SolidButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Delete Industry Confirm ---- */}
      <ConfirmDialog
        open={!!deleteIndTarget}
        onOpenChange={(open) => !open && setDeleteIndTarget(null)}
        title="确认删除行业"
        description={`确定要删除行业「${deleteIndTarget?.name}」吗？该行业下的知识库不会被删除，但会失去分类。`}
        confirmLabel="删除"
        variant="destructive"
        onConfirm={() => { if (deleteIndTarget) deleteIndMutation.mutate(deleteIndTarget.id); }}
        loading={deleteIndMutation.isPending}
      />
    </div>
  );
}

/* ================================================================ */
/*  Pagination                                                       */
/* ================================================================ */

function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  // Build visible page numbers (1 ... p-1 p p+1 ... last)
  const pages: (number | 'ellipsis')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== 'ellipsis') {
      pages.push('ellipsis');
    }
  }

  return (
    <div className="mt-4 flex items-center justify-between text-[12px] text-muted-foreground">
      <span>
        {start}-{end} / {totalItems} 条
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <Icon icon="lucide:chevron-left" width={14} height={14} />
        </Button>
        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`e-${i}`} className="px-1 text-muted-foreground/50">...</span>
          ) : (
            <Button
              key={p}
              variant={p === page ? 'default' : 'ghost'}
              size="icon-xs"
              className={cn('text-[11px]', p === page && 'pointer-events-none')}
              onClick={() => onPageChange(p)}
            >
              {p}
            </Button>
          ),
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <Icon icon="lucide:chevron-right" width={14} height={14} />
        </Button>
      </div>
    </div>
  );
}

/* ================================================================ */
/*  Knowledge Stats Card                                             */
/* ================================================================ */

function KnowledgeStatsCard({
  data,
  loading,
}: {
  data: { label: string; value: number; color: string; icon: string }[];
  loading?: boolean;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="px-5 py-4">
        <div className="text-sm font-semibold text-foreground mb-3">知识库统计</div>
        {loading ? (
          <Skeleton className="h-[88px] w-full" />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {data.map((item) => (
              <div
                key={item.label}
                className="flex flex-col items-center gap-1.5 px-3 py-3.5"
              >
                <div
                  className="flex size-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${item.color}15` }}
                >
                  <Icon icon={item.icon} width={18} height={18} style={{ color: item.color }} />
                </div>
                <span
                  className="text-2xl font-bold tabular-nums leading-none"
                  style={{ color: item.color }}
                >
                  {item.value}
                </span>
                <span className="text-[11px] text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ================================================================ */
/*  Industry Sidebar Item                                            */
/* ================================================================ */

function IndustryItem({
  label,
  icon,
  color,
  active,
  count,
  onClick,
  onEdit,
}: {
  label: string;
  icon?: string;
  color?: string;
  active: boolean;
  count: number;
  onClick: () => void;
  onEdit?: () => void;
}) {
  return (
    <button
      className={cn(
        'group/ind flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-medium',
        active && 'bg-primary/8 text-primary border-l-2 border-primary',
        !active && 'border-l-2 border-transparent text-foreground/70',
      )}
      onClick={onClick}
    >
      {icon ? (
        <Icon icon={icon} width={15} height={15} className={active ? 'text-primary' : 'text-muted-foreground'} />
      ) : (
        <div
          className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/5 dark:ring-white/10"
          style={color ? { background: color } : undefined}
        />
      )}
      <span className="truncate flex-1">{label}</span>
      {onEdit && (
        <button
          className="opacity-0 group-hover/ind:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          title="编辑行业"
        >
          <Icon icon="lucide:pencil" width={12} height={12} />
        </button>
      )}
      <span className={cn(
        'text-[11px] tabular-nums',
        active ? 'text-primary/70' : 'text-muted-foreground/60',
      )}>
        {count}
      </span>
    </button>
  );
}

/* ================================================================ */
/*  KB Card (Grid View)                                              */
/* ================================================================ */

function KBCard({
  kb,
  industry,
  onOpen,
}: {
  kb: KnowledgeBase;
  industry?: Industry;
  onOpen: () => void;
}) {
  const accentColor = industry?.color ?? 'var(--color-primary)';

  return (
    <div
      className="group cursor-pointer border border-border bg-[rgb(250,250,252)] dark:bg-card"
      style={{
        boxShadow:
          'rgba(0,0,0,0.4) 0px 2px 4px, rgba(0,0,0,0.3) 0px 7px 13px -3px, rgba(0,0,0,0.2) 0px -3px 0px inset',
      }}
      onClick={onOpen}
    >
      <div className="flex flex-col gap-3 px-5 pb-5 pt-5">
        <h3 className="truncate text-[14px] font-semibold text-foreground">{kb.name}</h3>
        {kb.description && (
          <p className="line-clamp-3 text-[12px] text-muted-foreground leading-relaxed">{kb.description}</p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          {industry && (
            <Badge
              variant="secondary"
              className="gap-1 rounded-none text-[10px]"
              style={{ backgroundColor: `${accentColor}18`, color: accentColor, borderColor: `${accentColor}30` }}
            >
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: accentColor }} />
              {industry.name}
            </Badge>
          )}
          <Badge variant="outline" className="gap-1 rounded-none text-[10px]">
            <Icon icon="streamline-color:new-file" width={10} height={10} />
            {kb.document_count} 篇
          </Badge>
        </div>
        <span className="text-[10px] text-muted-foreground/60">{formatRelativeTime(kb.updated_at)}</span>
      </div>
    </div>
  );
}

/* ================================================================ */
/*  KB Row (List View)                                               */
/* ================================================================ */

function KBRow({
  kb,
  industry,
  onOpen,
}: {
  kb: KnowledgeBase;
  industry?: Industry;
  onOpen: () => void;
}) {
  const accentColor = industry?.color ?? 'var(--color-primary)';

  return (
    <div
      className="group flex cursor-pointer items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4"
      onClick={onOpen}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `linear-gradient(135deg, ${accentColor}20, ${accentColor}08)`, color: accentColor }}
      >
        <Icon icon="streamline-color:open-book" width={16} height={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-foreground">{kb.name}</div>
        {kb.description && (
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{kb.description}</div>
        )}
      </div>
      {industry && (
        <Badge
          variant="secondary"
          className="hidden shrink-0 gap-1 text-[10px] sm:inline-flex"
          style={{ backgroundColor: `${accentColor}12`, color: accentColor }}
        >
          {industry.name}
        </Badge>
      )}
      <Badge variant="secondary" className="shrink-0">{kb.document_count} 篇</Badge>
      <span className="hidden text-[11px] text-muted-foreground/60 sm:inline">{formatRelativeTime(kb.updated_at)}</span>
      <Icon icon="lucide:chevron-right" width={16} height={16} className="hidden shrink-0 text-muted-foreground/40 sm:block" />
    </div>
  );
}

/* ================================================================ */
/*  Helpers                                                          */
/* ================================================================ */

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} 小时前`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} 天前`;
  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth} 个月前`;
}
