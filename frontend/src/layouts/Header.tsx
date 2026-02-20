import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DayNightToggle } from '@/components/ui/DayNightToggle';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/stores/useAppStore';
import { useBreadcrumbStore } from '@/stores/useBreadcrumbStore';
import { useTodoStore } from '@/stores/useTodoStore';
import { TodoPanel } from '@/components/dashboard/TodoPanel';

const quickActions = [
  {
    label: '新建知识库',
    desc: '创建行业知识库，构建专属知识体系',
    icon: 'streamline-color:module-puzzle-3',
    to: '/knowledge',
  },
  {
    label: '上传文档',
    desc: '支持 PDF、Word、Markdown 等格式',
    icon: 'streamline-color:upload-box-1',
    to: '/knowledge',
  },
  {
    label: '定时任务',
    desc: '配置自动化任务，让 AI 定期工作',
    icon: 'streamline-color:circle-clock',
    to: '/scheduler',
  },
];

/**
 * 已知路由段 → 中文标签
 * 新增页面时只需在此处加一行即可自动出现在面包屑中
 */
const segmentLabels: Record<string, string> = {
  dashboard: '仪表盘',
  assistant: 'AI 问答',
  knowledge: '知识库',
  scheduler: '定时任务',
  boards: '画板',
  settings: '系统管理',
  'ai-models': 'AI 模型配置',
  integrations: '第三方集成',
  data: '数据管理',
  help: '帮助中心',
};

/** 单段路由的默认子标签（如 /dashboard → 仪表盘 > 概览） */
const defaultSubLabels: Record<string, string> = {
  dashboard: '概览',
  knowledge: '总览',
  scheduler: '任务列表',
};

interface Crumb {
  label: string;
  path: string;
}

function buildCrumbs(pathname: string, dynamicLabel: string | null): Crumb[] {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return [];

  const crumbs: Crumb[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const path = '/' + segments.slice(0, i + 1).join('/');
    const isLast = i === segments.length - 1;

    // 尝试从已知标签表中查找
    const knownLabel = segmentLabels[seg];

    if (knownLabel) {
      crumbs.push({ label: knownLabel, path });
    } else {
      // 动态段（UUID、数字 ID 等），使用 store 中的动态标签
      crumbs.push({
        label: isLast && dynamicLabel ? dynamicLabel : '详情',
        path,
      });
    }
  }

  // 若只有一段（如 /dashboard），追加默认子标签
  if (crumbs.length === 1) {
    const sub = defaultSubLabels[segments[0]];
    if (sub) {
      crumbs.push({ label: sub, path: crumbs[0].path });
    }
  }

  return crumbs;
}

/* ------------------------------------------------------------------ */
/*  Header Clock                                                       */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function HeaderClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const weekday = WEEKDAYS[now.getDay()];
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');

  return (
    <div className="hidden items-center gap-1.5 text-xs tabular-nums text-muted-foreground sm:flex">
      <Icon icon="lucide:clock" className="size-3.5" />
      <span>{mm}/{dd} 周{weekday}</span>
      <span className="font-medium text-foreground">{hh}:{min}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Header                                                             */
/* ------------------------------------------------------------------ */

export default function Header() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const dynamicLabel = useBreadcrumbStore((s) => s.dynamicLabel);
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const customActions = useAppStore((s) => s.customQuickActions);
  const addQuickAction = useAppStore((s) => s.addQuickAction);
  const removeQuickAction = useAppStore((s) => s.removeQuickAction);
  const [routeInput, setRouteInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const todos = useTodoStore((s) => s.todos);
  const setPanelOpen = useTodoStore((s) => s.setPanelOpen);
  const pendingCount = todos.filter((t) => !t.completed).length;

  const crumbs = buildCrumbs(pathname, dynamicLabel);

  const handleAddAction = () => {
    const raw = routeInput.trim();
    if (!raw) return;
    const route = raw.startsWith('/') ? raw : `/${raw}`;
    const lastSeg = route.split('/').filter(Boolean).pop() ?? route;
    const label = nameInput.trim() || (segmentLabels[lastSeg] ?? lastSeg);
    const desc = descInput.trim() || undefined;
    addQuickAction({ route, label, desc });
    setRouteInput('');
    setNameInput('');
    setDescInput('');
    setAddDialogOpen(false);
  };

  return (
    <>
    <header className="header-glass sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between px-4 sm:px-6">
      {/* Left: Trigger + Breadcrumb */}
      <div className="relative z-10 flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <nav className="flex items-center gap-1 text-sm">
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={crumb.path + i} className="flex items-center gap-1">
                {i > 0 && (
                  <Icon icon="lucide:chevron-right" className="size-3.5 text-muted-foreground/50" />
                )}
                {isLast ? (
                  <span className="font-medium text-foreground">{crumb.label}</span>
                ) : (
                  <Link
                    to={crumb.path}
                    className="font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                )}
              </span>
            );
          })}
        </nav>
      </div>

      {/* Right: Quick Actions + Search + Theme */}
      <div className="relative z-10 flex items-center gap-1">
       <TooltipProvider>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer">
                  <Icon icon="lucide:zap" className="size-4" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">快捷操作</TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-[340px] p-3 rounded-xl"
          >
            <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">快捷操作</p>
            <div className="grid gap-1.5">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => navigate(action.to)}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-accent cursor-pointer"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/5">
                    <Icon icon={action.icon} className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground">{action.label}</div>
                    <div className="text-[11px] text-muted-foreground leading-tight">{action.desc}</div>
                  </div>
                  <Icon icon="lucide:chevron-right" className="size-3.5 text-muted-foreground/40" />
                </button>
              ))}
            </div>
            {/* Custom quick actions */}
            {customActions.length > 0 && (
              <div className="mt-2 border-t pt-2">
                <p className="mb-1.5 px-1 text-[11px] text-muted-foreground">自定义入口</p>
                <div className="grid gap-1">
                 <TooltipProvider>
                  {customActions.map((action) => (
                    <Tooltip key={action.route}>
                      <TooltipTrigger asChild>
                        <div
                          className="group flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent"
                        >
                          <button
                            onClick={() => navigate(action.route)}
                            className="flex flex-1 items-center gap-2 min-w-0 cursor-pointer"
                          >
                            <Icon icon="lucide:link" className="size-3.5 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-foreground">{action.label}</span>
                                <span className="text-[11px] text-muted-foreground truncate">{action.route}</span>
                              </div>
                              {action.desc && (
                                <div className="text-[11px] text-muted-foreground/70 leading-tight truncate">{action.desc}</div>
                              )}
                            </div>
                          </button>
                          <button
                            onClick={() => removeQuickAction(action.route)}
                            className="hidden size-5 items-center justify-center rounded text-muted-foreground/50 hover:text-destructive group-hover:inline-flex cursor-pointer"
                          >
                            <Icon icon="lucide:x" className="size-3" />
                          </button>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <div className="text-xs">
                          <div>{action.label} → {action.route}</div>
                          {action.desc && <div className="text-muted-foreground mt-0.5">{action.desc}</div>}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                 </TooltipProvider>
                </div>
              </div>
            )}
            {/* Add custom route - trigger button */}
            <div className="mt-2 border-t pt-2 px-1">
              <button
                onClick={() => setAddDialogOpen(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
              >
                <Icon icon="lucide:plus" className="size-3.5" />
                添加快捷入口
              </button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="mx-1 h-4" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setPanelOpen(true)}
              className="relative inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
            >
              <Icon icon="lucide:list-todo" className="size-4" />
              {pendingCount > 0 && (
                <Badge variant="secondary" className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full px-1 text-[10px] leading-none">
                  {pendingCount}
                </Badge>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">待办事项</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-4" />

        <HeaderClock />

        <Separator orientation="vertical" className="mx-1 h-4" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="hidden items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
            >
              <Icon icon="streamline-color:magnifying-glass" className="size-3.5" />
              <span>Search...</span>
              <kbd className="ml-2 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                ⌘K
              </kbd>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">搜索 (⌘K)</TooltipContent>
        </Tooltip>

        <DayNightToggle />
       </TooltipProvider>
      </div>
    </header>
    <TodoPanel />

    {/* Add Quick Action Dialog */}
    <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>添加快捷入口</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 pt-1">
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-foreground">
              页面路径 <span className="text-destructive">*</span>
            </label>
            <input
              value={routeInput}
              onChange={(e) => setRouteInput(e.target.value)}
              placeholder="/settings/ai-models"
              className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-foreground">
              名称 <span className="text-[11px] text-muted-foreground font-normal">可选，留空自动识别</span>
            </label>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="如：AI 模型配置"
              className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-foreground">
              说明 <span className="text-[11px] text-muted-foreground font-normal">可选</span>
            </label>
            <input
              value={descInput}
              onChange={(e) => setDescInput(e.target.value)}
              placeholder="简短描述这个入口的用途"
              className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <button
            onClick={handleAddAction}
            disabled={!routeInput.trim()}
            className="mt-1 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            添加
          </button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
