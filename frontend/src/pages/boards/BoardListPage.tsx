import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@iconify/react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/composed/page-header';
import { CreateButton, SolidButton, CancelButton } from '@/components/composed/solid-button';
import { EmptyState } from '@/components/composed/empty-state';
import { ConfirmDialog } from '@/components/composed/confirm-dialog';
import { ItemContextMenu, type ItemAction } from '@/components/composed/item-context-menu';
import { AnimatedList, AnimatedItem } from '@/components/composed/animated';
import { boardService, type BoardListItem } from '@/services/boardService';
import { illustrationPresets } from '@/lib/illustrations';
import { cn } from '@/lib/utils';

// ======================== Mock Data ========================

const MOCK_BOARDS: BoardListItem[] = [
  {
    id: 'board-1',
    name: 'Q1 产品路线图',
    description: '2026 年第一季度产品功能规划与优先级排列',
    thumbnail_url: null,
    node_count: 12,
    created_at: '2026-01-15T08:00:00Z',
    updated_at: '2026-02-20T09:30:00Z',
  },
  {
    id: 'board-2',
    name: '头脑风暴 - 新功能',
    description: '团队头脑风暴会议记录，收集新功能创意',
    thumbnail_url: null,
    node_count: 8,
    created_at: '2026-02-01T10:00:00Z',
    updated_at: '2026-02-19T14:00:00Z',
  },
  {
    id: 'board-3',
    name: '系统架构设计',
    description: '后端微服务架构拆分方案与数据流向',
    thumbnail_url: null,
    node_count: 15,
    created_at: '2026-01-20T08:00:00Z',
    updated_at: '2026-02-18T16:00:00Z',
  },
  {
    id: 'board-4',
    name: '每周任务看板',
    description: '本周开发任务追踪，To Do / Doing / Done',
    thumbnail_url: null,
    node_count: 6,
    created_at: '2026-02-10T08:00:00Z',
    updated_at: '2026-02-20T11:00:00Z',
  },
  {
    id: 'board-5',
    name: '用户旅程地图',
    description: '新用户从注册到首次使用的完整路径',
    thumbnail_url: null,
    node_count: 10,
    created_at: '2026-02-05T08:00:00Z',
    updated_at: '2026-02-17T10:00:00Z',
  },
  {
    id: 'board-6',
    name: '竞品分析',
    description: '主要竞品功能对比与差异化策略',
    thumbnail_url: null,
    node_count: 9,
    created_at: '2026-01-25T08:00:00Z',
    updated_at: '2026-02-16T12:00:00Z',
  },
];

export default function BoardListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editBoard, setEditBoard] = useState<BoardListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BoardListItem | null>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const { data: rawBoards = [], isLoading } = useQuery({
    queryKey: ['boards'],
    queryFn: boardService.list,
  });
  const boards = rawBoards.length > 0 ? rawBoards : MOCK_BOARDS;

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) => boardService.create(data),
    onSuccess: (board) => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
      closeDialog();
      navigate(`/boards/${board.id}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string; description?: string }) =>
      boardService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: boardService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
      setDeleteTarget(null);
    },
  });

  const closeDialog = () => {
    setCreateOpen(false);
    setEditBoard(null);
    setName('');
    setDesc('');
  };

  const openCreate = () => {
    setName('');
    setDesc('');
    setCreateOpen(true);
  };

  const openEdit = (board: BoardListItem) => {
    setEditBoard(board);
    setName(board.name);
    setDesc(board.description ?? '');
  };

  const handleSave = () => {
    if (!name.trim()) return;
    if (editBoard) {
      updateMutation.mutate({ id: editBoard.id, name: name.trim(), description: desc.trim() || undefined });
    } else {
      createMutation.mutate({ name: name.trim(), description: desc.trim() || undefined });
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  const boardActions = (board: BoardListItem): (ItemAction | 'separator')[] => [
    { key: 'open', label: '打开编辑', icon: 'lucide:external-link', onClick: () => navigate(`/boards/${board.id}`) },
    { key: 'edit', label: '修改信息', icon: 'lucide:pencil', onClick: () => openEdit(board) },
    'separator',
    { key: 'delete', label: '删除', icon: 'lucide:trash-2', variant: 'destructive', onClick: () => setDeleteTarget(board) },
  ];

  const BOARD_COLORS = [
    'from-violet-500/10 via-violet-500/5 to-transparent',
    'from-cyan-500/10 via-cyan-500/5 to-transparent',
    'from-amber-500/10 via-amber-500/5 to-transparent',
    'from-emerald-500/10 via-emerald-500/5 to-transparent',
    'from-rose-500/10 via-rose-500/5 to-transparent',
    'from-indigo-500/10 via-indigo-500/5 to-transparent',
  ];

  return (
    <div className="flex h-full flex-col gap-6">
      <PageHeader
        title="画板"
        description="使用可视化画板自由组织想法、规划任务"
        icon="streamline-color:paint-palette"
        iconClassName="text-violet-500"
      >
        <CreateButton onClick={openCreate}>
          新建画板
        </CreateButton>
      </PageHeader>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="gap-0 py-0">
              <Skeleton className="h-28 rounded-t-xl" />
              <CardContent className="space-y-2 px-4 py-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex gap-2 pt-1">
                  <Skeleton className="h-4 w-16 rounded-full" />
                  <Skeleton className="h-4 w-20 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !boards.length ? (
        <EmptyState
          icon="streamline-color:paint-palette"
          illustration={illustrationPresets.emptyBoards}
          title="还没有画板"
          description="创建你的第一个画板，开始可视化规划"
          action={{ label: '新建画板', onClick: openCreate, color: 'create' }}
          className="flex-1"
        />
      ) : (
        <AnimatedList className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {boards.map((board, i) => (
            <AnimatedItem key={board.id}>
              <ItemContextMenu actions={boardActions(board)} showTriggerButton triggerClassName="absolute right-1.5 top-1.5 rounded-none">
                <Card
                  className={cn(
                    'group cursor-pointer gap-0 py-0 transition-all hover:shadow-md hover:border-primary/30',
                  )}
                  onClick={() => navigate(`/boards/${board.id}`)}
                >
                  <div className={cn(
                    'flex h-28 items-center justify-center rounded-t-xl bg-gradient-to-br',
                    BOARD_COLORS[i % BOARD_COLORS.length],
                  )}>
                    <Icon
                      icon="streamline-color:paint-palette"
                      className="size-12 opacity-30 group-hover:opacity-50 transition-opacity"
                    />
                  </div>
                  <CardContent className="px-4 py-3">
                    <h3 className="truncate text-[14px] font-semibold text-foreground">{board.name}</h3>
                    <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                      {board.description || '暂无描述'}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground/70">
                      <span className="flex items-center gap-1">
                        <Icon icon="lucide:shapes" className="size-3" />
                        {board.node_count} 个节点
                      </span>
                      <span>{formatRelativeTime(board.updated_at)}</span>
                    </div>
                  </CardContent>
                </Card>
              </ItemContextMenu>
            </AnimatedItem>
          ))}
        </AnimatedList>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={createOpen || !!editBoard} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{editBoard ? '修改画板' : '新建画板'}</DialogTitle>
            <DialogDescription>
              {editBoard ? '修改画板名称或描述' : '创建一个新的可视化画板'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">画板名称</label>
              <Input
                autoFocus
                placeholder="如：Q1 产品规划"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) handleSave(); }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">描述（可选）</label>
              <Input
                placeholder="简要描述画板用途"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <CancelButton size="sm" onClick={closeDialog} />
            <SolidButton
              color="violet"
              size="sm"
              onClick={handleSave}
              disabled={!name.trim()}
              loading={saving}
              loadingText={editBoard ? '保存中...' : '创建中...'}
            >
              {editBoard ? '保存' : '创建并打开'}
            </SolidButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="确认删除"
        description={`确定要删除画板「${deleteTarget?.name}」吗？此操作不可恢复。`}
        confirmLabel="删除"
        variant="destructive"
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

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
