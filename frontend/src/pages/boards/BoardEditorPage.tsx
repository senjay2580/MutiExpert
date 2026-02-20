import {
  useState,
  useCallback,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  type DragEvent,
  type ClipboardEvent,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  BackgroundVariant,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { boardService } from '@/services/boardService';
import { useBoardEditorStore } from '@/stores/useBoardEditorStore';
import { useBreadcrumbStore } from '@/stores/useBreadcrumbStore';
import { nodeTypes, type BoardNodeType } from '@/components/board/nodes';
import { BoardTopBar } from '@/components/board/BoardTopBar';
import { BoardToolbar } from '@/components/board/BoardToolbar';
import type { Board } from '@/services/boardService';

/* ------------------------------------------------------------------ */
/*  Mock Board (for testing without backend)                           */
/* ------------------------------------------------------------------ */

const MOCK_BOARDS: Record<string, Board> = {
  'board-1': {
    id: 'board-1',
    name: 'Q1 产品路线图',
    description: '2026 年第一季度产品功能规划与优先级排列',
    thumbnail_url: null,
    nodes: [
      { id: 'n1', type: 'sticky', position: { x: 50, y: 50 }, data: { text: '🚀 核心功能\n画板模块上线\nAI 对话增强', color: 'yellow' } },
      { id: 'n2', type: 'sticky', position: { x: 280, y: 50 }, data: { text: '📊 数据看板\n可视化报表\n实时监控', color: 'green' } },
      { id: 'n3', type: 'sticky', position: { x: 510, y: 50 }, data: { text: '🔗 第三方集成\n飞书同步\n钉钉推送', color: 'blue' } },
      { id: 'n4', type: 'task', position: { x: 50, y: 250 }, data: { title: '完成画板 CRUD', priority: 'high', completed: true } },
      { id: 'n5', type: 'task', position: { x: 280, y: 250 }, data: { title: '实现拖拽编排', priority: 'high', completed: false } },
      { id: 'n6', type: 'task', position: { x: 510, y: 250 }, data: { title: '导入导出 JSON', priority: 'medium', completed: false } },
      { id: 'n7', type: 'text', position: { x: 200, y: 400 }, data: { text: '💡 Q1 目标：上线 MVP 版本，覆盖核心工作流' } },
      { id: 'n8', type: 'task', position: { x: 50, y: 400 }, data: { title: '模板系统', priority: 'low', completed: false } },
      { id: 'n9', type: 'sticky', position: { x: 510, y: 400 }, data: { text: '⚠️ 风险项\n性能优化\n大量节点渲染', color: 'pink' } },
      { id: 'n10', type: 'task', position: { x: 280, y: 520 }, data: { title: '操作指引', priority: 'medium', completed: true } },
      { id: 'n11', type: 'sticky', position: { x: 50, y: 520 }, data: { text: '📝 备忘\n记得写单元测试', color: 'violet' } },
      { id: 'n12', type: 'text', position: { x: 510, y: 520 }, data: { text: '截止日期: 2026-03-31' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n4', animated: true },
      { id: 'e2', source: 'n2', target: 'n5' },
      { id: 'e3', source: 'n3', target: 'n6' },
      { id: 'e4', source: 'n4', target: 'n7' },
      { id: 'e5', source: 'n5', target: 'n7' },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
    created_at: '2026-01-15T08:00:00Z',
    updated_at: '2026-02-20T09:30:00Z',
  },
  'board-2': {
    id: 'board-2',
    name: '头脑风暴 - 新功能',
    description: '团队头脑风暴会议记录',
    thumbnail_url: null,
    nodes: [
      { id: 'b1', type: 'text', position: { x: 300, y: 200 }, data: { text: '🎯 主题：下一版本功能规划' } },
      { id: 'b2', type: 'sticky', position: { x: 50, y: 50 }, data: { text: '实时协作编辑', color: 'yellow' } },
      { id: 'b3', type: 'sticky', position: { x: 550, y: 50 }, data: { text: 'AI 智能排版', color: 'green' } },
      { id: 'b4', type: 'sticky', position: { x: 50, y: 350 }, data: { text: '语音输入转节点', color: 'blue' } },
      { id: 'b5', type: 'sticky', position: { x: 550, y: 350 }, data: { text: '思维导图模式', color: 'pink' } },
      { id: 'b6', type: 'sticky', position: { x: 300, y: 400 }, data: { text: '移动端适配', color: 'violet' } },
      { id: 'b7', type: 'task', position: { x: 300, y: 50 }, data: { title: '整理投票结果', priority: 'high', completed: false } },
      { id: 'b8', type: 'image', position: { x: 680, y: 200 }, data: { src: '', alt: '参考截图' } },
    ],
    edges: [
      { id: 'be1', source: 'b1', target: 'b2' },
      { id: 'be2', source: 'b1', target: 'b3' },
      { id: 'be3', source: 'b1', target: 'b4' },
      { id: 'be4', source: 'b1', target: 'b5' },
      { id: 'be5', source: 'b1', target: 'b6' },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
    created_at: '2026-02-01T10:00:00Z',
    updated_at: '2026-02-19T14:00:00Z',
  },
  'board-3': {
    id: 'board-3',
    name: '系统架构设计',
    description: '后端微服务架构拆分方案',
    thumbnail_url: null,
    nodes: [
      { id: 'a1', type: 'text', position: { x: 250, y: 0 }, data: { text: '🏗️ API Gateway' } },
      { id: 'a2', type: 'sticky', position: { x: 0, y: 120 }, data: { text: 'Auth Service\nJWT + OAuth2', color: 'blue' } },
      { id: 'a3', type: 'sticky', position: { x: 220, y: 120 }, data: { text: 'Knowledge Service\nCRUD + Search', color: 'green' } },
      { id: 'a4', type: 'sticky', position: { x: 440, y: 120 }, data: { text: 'AI Service\nLLM + Embedding', color: 'violet' } },
      { id: 'a5', type: 'text', position: { x: 100, y: 280 }, data: { text: '📦 PostgreSQL + pgvector' } },
      { id: 'a6', type: 'text', position: { x: 380, y: 280 }, data: { text: '📦 Redis Cache' } },
      { id: 'a7', type: 'task', position: { x: 0, y: 380 }, data: { title: 'Docker Compose 编排', priority: 'high', completed: true } },
      { id: 'a8', type: 'task', position: { x: 250, y: 380 }, data: { title: 'CI/CD Pipeline', priority: 'medium', completed: true } },
      { id: 'a9', type: 'sticky', position: { x: 500, y: 380 }, data: { text: '🔒 安全策略\nRate Limit\nCORS\nCSP', color: 'pink' } },
    ],
    edges: [
      { id: 'ae1', source: 'a1', target: 'a2' },
      { id: 'ae2', source: 'a1', target: 'a3' },
      { id: 'ae3', source: 'a1', target: 'a4' },
      { id: 'ae4', source: 'a2', target: 'a5' },
      { id: 'ae5', source: 'a3', target: 'a5' },
      { id: 'ae6', source: 'a4', target: 'a6', animated: true },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
    created_at: '2026-01-20T08:00:00Z',
    updated_at: '2026-02-18T16:00:00Z',
  },
};

/** Fallback for any mock board id not in MOCK_BOARDS */
const DEFAULT_MOCK_BOARD: Board = {
  id: 'board-mock',
  name: '示例画板',
  description: '这是一个模拟画板',
  thumbnail_url: null,
  nodes: [
    { id: 'dm1', type: 'sticky', position: { x: 100, y: 100 }, data: { text: '欢迎使用画板！\n双击编辑文字', color: 'yellow' } },
    { id: 'dm2', type: 'task', position: { x: 350, y: 100 }, data: { title: '试试拖拽我', priority: 'medium', completed: false } },
    { id: 'dm3', type: 'text', position: { x: 200, y: 280 }, data: { text: '从左侧工具栏拖拽更多组件' } },
  ],
  edges: [
    { id: 'de1', source: 'dm1', target: 'dm3' },
    { id: 'de2', source: 'dm2', target: 'dm3' },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
  created_at: '2026-02-20T00:00:00Z',
  updated_at: '2026-02-20T00:00:00Z',
};

/* ------------------------------------------------------------------ */
/*  Templates                                                          */
/* ------------------------------------------------------------------ */

interface BoardTemplate {
  name: string;
  icon: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
}

const TEMPLATES: BoardTemplate[] = [
  {
    name: '空白画板',
    icon: 'lucide:file',
    description: '从零开始创建',
    nodes: [],
    edges: [],
  },
  {
    name: '头脑风暴',
    icon: 'lucide:lightbulb',
    description: '中心主题 + 4 个便签',
    nodes: [
      { id: 't-center', type: 'text', position: { x: 300, y: 200 }, data: { text: '主题' } },
      { id: 't-s1', type: 'sticky', position: { x: 50, y: 50 }, data: { text: '想法 1', color: 'yellow' } },
      { id: 't-s2', type: 'sticky', position: { x: 550, y: 50 }, data: { text: '想法 2', color: 'green' } },
      { id: 't-s3', type: 'sticky', position: { x: 50, y: 350 }, data: { text: '想法 3', color: 'blue' } },
      { id: 't-s4', type: 'sticky', position: { x: 550, y: 350 }, data: { text: '想法 4', color: 'pink' } },
    ],
    edges: [
      { id: 'te-1', source: 't-center', target: 't-s1' },
      { id: 'te-2', source: 't-center', target: 't-s2' },
      { id: 'te-3', source: 't-center', target: 't-s3' },
      { id: 'te-4', source: 't-center', target: 't-s4' },
    ],
  },
  {
    name: '看板流程',
    icon: 'lucide:kanban',
    description: 'To Do → Doing → Done',
    nodes: [
      { id: 'k-todo', type: 'text', position: { x: 0, y: 0 }, data: { text: '📋 To Do' } },
      { id: 'k-doing', type: 'text', position: { x: 280, y: 0 }, data: { text: '🔨 Doing' } },
      { id: 'k-done', type: 'text', position: { x: 560, y: 0 }, data: { text: '✅ Done' } },
      { id: 'k-t1', type: 'task', position: { x: 0, y: 80 }, data: { title: '任务 1', priority: 'high' } },
      { id: 'k-t2', type: 'task', position: { x: 0, y: 180 }, data: { title: '任务 2', priority: 'medium' } },
      { id: 'k-t3', type: 'task', position: { x: 280, y: 80 }, data: { title: '进行中的任务', priority: 'high' } },
    ],
    edges: [],
  },
  {
    name: '项目规划',
    icon: 'lucide:gantt-chart',
    description: '目标 → 里程碑 → 任务',
    nodes: [
      { id: 'p-goal', type: 'sticky', position: { x: 250, y: 0 }, data: { text: '🎯 项目目标', color: 'violet' } },
      { id: 'p-m1', type: 'sticky', position: { x: 50, y: 150 }, data: { text: '里程碑 1', color: 'blue' } },
      { id: 'p-m2', type: 'sticky', position: { x: 450, y: 150 }, data: { text: '里程碑 2', color: 'green' } },
      { id: 'p-t1', type: 'task', position: { x: 0, y: 300 }, data: { title: '子任务 A', priority: 'high' } },
      { id: 'p-t2', type: 'task', position: { x: 230, y: 300 }, data: { title: '子任务 B', priority: 'medium' } },
      { id: 'p-t3', type: 'task', position: { x: 460, y: 300 }, data: { title: '子任务 C', priority: 'low' } },
    ],
    edges: [
      { id: 'pe-1', source: 'p-goal', target: 'p-m1' },
      { id: 'pe-2', source: 'p-goal', target: 'p-m2' },
      { id: 'pe-3', source: 'p-m1', target: 'p-t1' },
      { id: 'pe-4', source: 'p-m1', target: 'p-t2' },
      { id: 'pe-5', source: 'p-m2', target: 'p-t3' },
    ],
  },
];

type TemplateDialogHandle = {
  open: () => void;
  close: () => void;
};

type TemplateDialogProps = {
  onSelect: (template: BoardTemplate) => void;
};

const TemplateDialog = forwardRef<TemplateDialogHandle, TemplateDialogProps>(
  function TemplateDialog({ onSelect }, ref) {
    const [open, setOpen] = useState(false);

    useImperativeHandle(
      ref,
      () => ({
        open: () => setOpen(true),
        close: () => setOpen(false),
      }),
      [],
    );

    const handleSelect = useCallback(
      (template: BoardTemplate) => {
        onSelect(template);
        setOpen(false);
      },
      [onSelect],
    );

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>选择模板</DialogTitle>
            <DialogDescription>选择一个模板快速开始，当前内容将被替换</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.name}
                onClick={() => handleSelect(tpl)}
                className="flex flex-col items-center gap-2 rounded-xl border p-4 transition-all hover:border-primary/30 hover:bg-accent hover:shadow-sm"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon icon={tpl.icon} className="size-5 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">{tpl.name}</span>
                <span className="text-[11px] text-muted-foreground text-center">
                  {tpl.description}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    );
  },
);
TemplateDialog.displayName = 'TemplateDialog';

/* ------------------------------------------------------------------ */
/*  Guide Overlay                                                      */
/* ------------------------------------------------------------------ */

function GuideOverlay({ onClose }: { onClose: () => void }) {
  const steps = [
    { icon: 'lucide:mouse-pointer-click', text: '从左侧工具栏拖拽组件到画布' },
    { icon: 'lucide:mouse-pointer-2', text: '双击节点编辑内容' },
    { icon: 'lucide:move', text: '拖拽节点自由排列' },
    { icon: 'lucide:spline', text: '从节点手柄拖出连线' },
    { icon: 'lucide:keyboard', text: 'Ctrl+Z 撤销 / Ctrl+Shift+Z 重做' },
    { icon: 'lucide:clipboard-paste', text: 'Ctrl+V 粘贴剪贴板中的图片' },
  ];

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[380px] rounded-xl border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-foreground mb-1">画板操作指引</h2>
        <p className="text-sm text-muted-foreground mb-4">快速上手你的可视化画板</p>
        <div className="space-y-3">
          {steps.map((step) => (
            <div key={step.text} className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon icon={step.icon} className="size-4 text-primary" />
              </div>
              <span className="text-[13px] text-foreground">{step.text}</span>
            </div>
          ))}
        </div>
        <Button className="mt-5 w-full" onClick={onClose}>
          开始使用
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Inner Editor (needs ReactFlowProvider)                             */
/* ------------------------------------------------------------------ */

function BoardEditorInner() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reactFlowInstance = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const templateDialogRef = useRef<TemplateDialogHandle>(null);
  const setDynamicLabel = useBreadcrumbStore((s) => s.setDynamicLabel);

  const store = useBoardEditorStore();

  const { data: fetchedBoard, isLoading } = useQuery({
    queryKey: ['board', boardId],
    queryFn: () => boardService.get(boardId!),
    enabled: !!boardId,
  });

  // Fallback to mock data when backend is unavailable
  const board = fetchedBoard ?? MOCK_BOARDS[boardId!] ?? DEFAULT_MOCK_BOARD;

  const saveMutation = useMutation({
    mutationFn: (data: Parameters<typeof boardService.update>[1]) =>
      boardService.update(boardId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      queryClient.invalidateQueries({ queryKey: ['boards'] });
      store.setDirty(false);
      store.setSaving(false);
    },
    onError: () => store.setSaving(false),
  });

  // Inject onDataChange into node data
  const injectCallbacks = useCallback(
    (ns: Node[]) =>
      ns.map((n) => ({
        ...n,
        data: { ...n.data, onDataChange: handleNodeDataChange },
      })),
    [],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Initialize from board data
  useEffect(() => {
    if (board) {
      const initialNodes = injectCallbacks((board.nodes as Node[]) ?? []);
      setNodes(initialNodes);
      setEdges((board.edges as Edge[]) ?? []);
      setDynamicLabel(board.name);

      // Show guide on first visit
      const guideKey = `board-guide-${boardId}`;
      if (!localStorage.getItem(guideKey)) {
        store.setShowGuide(true);
        localStorage.setItem(guideKey, '1');
      }
    }
    return () => {
      store.reset();
      setDynamicLabel(null);
    };
  }, [board]);

  /* ---- Node data change handler ---- */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  function handleNodeDataChange(nodeId: string, dataUpdate: Record<string, unknown>) {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, ...dataUpdate, onDataChange: handleNodeDataChange } }
          : n,
      ),
    );
    store.setDirty(true);
  }

  /* ---- History tracking ---- */
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const hasDragEnd = changes.some(
        (c) => c.type === 'position' && 'dragging' in c && c.dragging === false,
      );
      if (hasDragEnd) {
        store.pushHistory({ nodes, edges });
      }
      onNodesChange(changes);
      if (changes.some((c) => c.type === 'remove' || c.type === 'add')) {
        store.setDirty(true);
      }
    },
    [onNodesChange, nodes, edges, store],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
      if (changes.some((c) => c.type === 'remove' || c.type === 'add')) {
        store.pushHistory({ nodes, edges });
        store.setDirty(true);
      }
    },
    [onEdgesChange, nodes, edges, store],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      store.pushHistory({ nodes, edges });
      setEdges((eds) => addEdge({ ...params, animated: true }, eds));
      store.setDirty(true);
    },
    [setEdges, nodes, edges, store],
  );

  /* ---- Drag & Drop from toolbar ---- */
  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/reactflow') as BoardNodeType;
      if (!type) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const id = `${type}-${Date.now()}`;
      const defaults: Record<string, Record<string, unknown>> = {
        sticky: { text: '', color: 'yellow' },
        task: { title: '', priority: 'medium', completed: false },
        text: { text: '' },
        image: { src: '' },
      };

      const newNode: Node = {
        id,
        type,
        position,
        data: { ...defaults[type], onDataChange: handleNodeDataChange },
      };

      store.pushHistory({ nodes, edges });
      setNodes((nds) => [...nds, newNode]);
      store.setDirty(true);
    },
    [reactFlowInstance, setNodes, nodes, edges, store, handleNodeDataChange],
  );

  /* ---- Image paste ---- */
  const onPaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) return;

          const reader = new FileReader();
          reader.onload = () => {
            const src = reader.result as string;
            const center = reactFlowInstance.screenToFlowPosition({
              x: window.innerWidth / 2,
              y: window.innerHeight / 2,
            });

            const newNode: Node = {
              id: `image-${Date.now()}`,
              type: 'image',
              position: center,
              data: { src, onDataChange: handleNodeDataChange },
            };

            store.pushHistory({ nodes, edges });
            setNodes((nds) => [...nds, newNode]);
            store.setDirty(true);
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    },
    [reactFlowInstance, setNodes, nodes, edges, store, handleNodeDataChange],
  );

  /* ---- Undo / Redo ---- */
  const handleUndo = useCallback(() => {
    const prev = store.undo({ nodes, edges });
    if (prev) {
      setNodes(injectCallbacks(prev.nodes));
      setEdges(prev.edges);
    }
  }, [nodes, edges, store, setNodes, setEdges, injectCallbacks]);

  const handleRedo = useCallback(() => {
    const next = store.redo({ nodes, edges });
    if (next) {
      setNodes(injectCallbacks(next.nodes));
      setEdges(next.edges);
    }
  }, [nodes, edges, store, setNodes, setEdges, injectCallbacks]);

  /* ---- Save ---- */
  const handleSave = useCallback(() => {
    if (!boardId) return;
    store.setSaving(true);
    const cleanNodes = nodes.map((n) => {
      const { onDataChange: onDataChangeUnused, ...rest } = n.data as Record<string, unknown>;
      void onDataChangeUnused;
      return { id: n.id, type: n.type ?? 'text', position: n.position, data: rest };
    });
    const cleanEdges = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type,
      animated: e.animated,
      label: typeof e.label === 'string' ? e.label : undefined,
    }));
    const viewport = reactFlowInstance.getViewport();
    saveMutation.mutate({ nodes: cleanNodes, edges: cleanEdges, viewport });
  }, [boardId, nodes, edges, reactFlowInstance, saveMutation, store]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo, handleSave]);

  /* ---- Auto-save (2s debounce) ---- */
  useEffect(() => {
    if (!store.isDirty || !boardId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      handleSave();
    }, 2000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [store.isDirty, nodes, edges, boardId, handleSave]);

  /* ---- Export / Import ---- */
  const handleExport = useCallback(() => {
    const cleanNodes = nodes.map((n) => {
      const { onDataChange: onDataChangeUnused, ...rest } = n.data as Record<string, unknown>;
      void onDataChangeUnused;
      return { id: n.id, type: n.type ?? 'text', position: n.position, data: rest };
    });
    const cleanEdges = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type,
      animated: e.animated,
      label: typeof e.label === 'string' ? e.label : undefined,
    }));
    const data = JSON.stringify(
      { nodes: cleanNodes, edges: cleanEdges, viewport: reactFlowInstance.getViewport() },
      null,
      2,
    );
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${board?.name ?? 'board'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, reactFlowInstance, board]);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const json = JSON.parse(reader.result as string);
          if (json.nodes && Array.isArray(json.nodes)) {
            store.pushHistory({ nodes, edges });
            setNodes(injectCallbacks(json.nodes));
            setEdges(json.edges ?? []);
            if (json.viewport) {
              reactFlowInstance.setViewport(json.viewport);
            }
            store.setDirty(true);
          }
        } catch {
          // ignore invalid JSON
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [nodes, edges, setNodes, setEdges, reactFlowInstance, store, injectCallbacks],
  );

  /* ---- Template ---- */
  const applyTemplate = useCallback(
    (template: BoardTemplate) => {
      store.pushHistory({ nodes, edges });
      setNodes(injectCallbacks(template.nodes));
      setEdges(template.edges);
      store.setDirty(true);
      setTimeout(() => reactFlowInstance.fitView({ padding: 0.2 }), 100);
    },
    [nodes, edges, setNodes, setEdges, store, reactFlowInstance, injectCallbacks],
  );

  const openTemplateDialog = useCallback(
    () => templateDialogRef.current?.open(),
    [templateDialogRef],
  );

  /* ---- Delete selected ---- */
  const onDelete = useCallback(() => {
    store.pushHistory({ nodes, edges });
  }, [nodes, edges, store]);

  /* ---- Loading state ---- */
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-4 w-32 rounded-md" />
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <Icon icon="lucide:alert-circle" className="size-8 opacity-40" />
        <span>画板不存在</span>
        <Button variant="outline" size="sm" onClick={() => navigate('/boards')}>
          返回列表
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" onPaste={onPaste}>
      <BoardTopBar
        name={board.name}
        onBack={() => navigate('/boards')}
        onSave={handleSave}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onExport={handleExport}
        onImport={handleImport}
        onTemplate={openTemplateDialog}
      />

      <div className="relative flex-1">
        {store.showToolbar && <BoardToolbar />}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onNodesDelete={onDelete}
          onEdgesDelete={onDelete}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          deleteKeyCode={['Backspace', 'Delete']}
          className="bg-background"
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            className="!bg-background"
          />
          <Controls className="!rounded-xl !border !bg-background/95 !shadow-lg [&>button]:!rounded-lg [&>button]:!border-0 [&>button]:!bg-transparent [&>button]:!text-muted-foreground hover:[&>button]:!bg-accent hover:[&>button]:!text-foreground" />
          {store.showMiniMap && (
            <MiniMap
              className="!rounded-xl !border !bg-background/95 !shadow-lg"
              nodeColor={(n) => {
                switch (n.type) {
                  case 'sticky':
                    return '#fbbf24';
                  case 'task':
                    return '#34d399';
                  case 'text':
                    return '#94a3b8';
                  case 'image':
                    return '#a78bfa';
                  default:
                    return '#94a3b8';
                }
              }}
              maskColor="rgba(0,0,0,0.08)"
              pannable
              zoomable
            />
          )}
        </ReactFlow>

        {store.showGuide && <GuideOverlay onClose={() => store.setShowGuide(false)} />}
      </div>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={onFileImport}
      />

      <TemplateDialog ref={templateDialogRef} onSelect={applyTemplate} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Wrapper with ReactFlowProvider                                     */
/* ------------------------------------------------------------------ */

export default function BoardEditorPage() {
  return (
    <ReactFlowProvider>
      <BoardEditorInner />
    </ReactFlowProvider>
  );
}
