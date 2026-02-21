import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarHeader,
  SidebarFooter,
  useSidebarActions,
  useSidebarState,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavItems, type NavItem } from '@/hooks/useNavItems';

/* ------------------------------------------------------------------ */
/*  Types & Data                                                      */
/* ------------------------------------------------------------------ */

/** 各页面帮助说明 */
const pageHelp: Record<string, { title: string; desc: string }> = {
  '/dashboard': {
    title: '仪表盘',
    desc: '总览平台核心数据：知识库数量、文档总量、AI 对话统计、跨域洞察等关键指标，以及文档上传趋势、AI 调用趋势、行业分布等可视化图表，帮助你快速掌握平台运行状态。',
  },
  '/assistant': {
    title: 'AI 问答',
    desc: '统一调用所有知识库与系统 Skills 的智能问答入口。输入问题后，调度器会自动检索、整合与编排答案，并提供可执行的结论与建议。',
  },
  '/knowledge': {
    title: '知识库',
    desc: '管理所有行业知识库。你可以新建知识库、上传文档（PDF、Word、Markdown 等）、浏览和搜索已有资料，以及查看知识库详情和关联关系。',
  },
  '/scheduler': {
    title: '定时任务',
    desc: '配置和管理自动化任务。设置定时触发规则，让 AI 按计划自动执行数据同步、报告生成、知识更新等工作，减少重复操作。',
  },
  '/boards': {
    title: '画板',
    desc: '可视化画板工具。使用便签、任务卡片、文本块等元素自由组织想法，支持拖拽、连线、模板和导入导出。',
  },
  '/settings/basic': {
    title: '基础参数',
    desc: '配置平台基础信息，包括站点名称、副标题、Logo、导航图标等个性化设置，打造专属的工作空间。',
  },
  '/settings/ai-models': {
    title: 'AI 模型配置',
    desc: '管理 AI 模型的 API 密钥和参数。支持配置多个模型供应商（Claude、OpenAI 等），设置默认模型和调用参数。',
  },
  '/settings/integrations': {
    title: '第三方集成',
    desc: '连接外部服务和平台。配置飞书、钉钉等通讯工具的 Webhook，实现消息推送和双向交互。',
  },
  '/settings/data': {
    title: '数据管理',
    desc: '数据导入导出、备份恢复等操作。管理平台数据的生命周期，确保数据安全和可迁移性。',
  },
};

/* ------------------------------------------------------------------ */
/*  Logo / Workspace Switcher                                         */
/* ------------------------------------------------------------------ */

function SidebarLogo() {
  const { state } = useSidebarState();
  const collapsed = state === 'collapsed';
  const siteName = useSiteSettingsStore((s) => s.siteName);
  const siteSubtitle = useSiteSettingsStore((s) => s.siteSubtitle);
  const logoUrl = useSiteSettingsStore((s) => s.logoUrl);

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-sidebar-accent/60',
      collapsed && 'justify-center px-0',
    )}>
      <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-sidebar-border/60 bg-sidebar-accent/70">
        <img src={logoUrl} alt={siteName} className="size-6 object-contain" />
      </div>
      {!collapsed && (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-sm font-semibold leading-tight text-sidebar-foreground">
              {siteName}
            </span>
            {siteSubtitle ? (
              <span className="inline-flex w-fit max-w-full items-center rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[9px] font-semibold text-sidebar-foreground/60">
                {siteSubtitle}
              </span>
            ) : null}
          </div>
          <Icon icon="lucide:chevron-down" className="ml-auto size-4 shrink-0 text-sidebar-foreground/40" />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Help Button (appears on hover)                                    */
/* ------------------------------------------------------------------ */

function HelpButton({ path, onHelp }: { path: string; onHelp: (path: string) => void }) {
  if (!pageHelp[path]) return null;
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onHelp(path);
            }}
            className="ml-auto size-5 shrink-0 items-center justify-center rounded text-sidebar-foreground/30 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors cursor-pointer hidden group-hover/item:inline-flex"
          >
            <Icon icon="lucide:circle-help" className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">页面说明</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ------------------------------------------------------------------ */
/*  Flat Nav Group                                                    */
/* ------------------------------------------------------------------ */

function NavGroup({
  label,
  items,
  isActive,
  onNav,
  onHelp,
}: {
  label: string;
  items: NavItem[];
  isActive: (path: string) => boolean;
  onNav: (path: string) => void;
  onHelp: (path: string) => void;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/30">
        {label}
      </SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const active = isActive(item.path);
          return (
            <SidebarMenuItem key={item.path} className="group/item">
              <SidebarMenuButton
                isActive={active}
                tooltip={item.label}
                onClick={() => onNav(item.path)}
                className={cn(
                  'transition-all duration-150',
                  active && 'bg-sidebar-accent font-medium',
                )}
              >
                <Icon icon={item.icon} className={cn(
                  'transition-colors duration-150',
                  item.iconClass || 'text-sidebar-foreground/50',
                )} />
                <span>{item.label}</span>
                <HelpButton path={item.path} onHelp={onHelp} />
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

/* ------------------------------------------------------------------ */
/*  Collapsible System Group                                          */
/* ------------------------------------------------------------------ */

function SystemGroup({
  isActive,
  onNav,
  onHelp,
  items,
  settingsIcon,
}: {
  isActive: (path: string) => boolean;
  onNav: (path: string) => void;
  onHelp: (path: string) => void;
  items: { path: string; icon: string; label: string }[];
  settingsIcon: string;
}) {
  const systemActive = isActive('/settings');
  const [open, setOpen] = useState(systemActive);

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/30">
        系统
      </SidebarGroupLabel>
      <SidebarMenu>
        <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                tooltip="系统管理"
                className={cn(
                  'transition-all duration-150',
                  systemActive && 'bg-sidebar-accent font-medium',
                )}
              >
                <Icon icon={settingsIcon} className={cn(
                  'transition-colors duration-150',
                  systemActive ? 'text-sidebar-foreground' : 'text-sidebar-foreground/50',
                )} />
                <span>系统管理</span>
                <Icon icon="lucide:chevron-right" className="ml-auto size-4 text-sidebar-foreground/30 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {items.map((sub) => {
                  const active = isActive(sub.path);
                  return (
                    <SidebarMenuSubItem key={sub.path} className="group/item">
                      <SidebarMenuSubButton
                        isActive={active}
                        onClick={() => onNav(sub.path)}
                        className={cn(
                          'cursor-pointer transition-colors duration-150',
                          active && 'font-medium',
                        )}
                      >
                        <Icon icon={sub.icon} />
                        <span>{sub.label}</span>
                        <HelpButton path={sub.path} onHelp={onHelp} />
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  );
                })}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      </SidebarMenu>
    </SidebarGroup>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Sidebar                                                      */
/* ------------------------------------------------------------------ */

export default function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setOpenMobile } = useSidebarActions();
  const { overviewNav, systemSubNav, settingsIcon } = useNavItems();
  const [helpPath, setHelpPath] = useState<string | null>(null);

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const handleNav = (path: string) => {
    navigate(path);
    setOpenMobile(false);
  };

  const helpInfo = helpPath ? pageHelp[helpPath] : null;

  return (
    <>
      <ShadcnSidebar collapsible="icon">
        <SidebarHeader>
          <SidebarLogo />
        </SidebarHeader>

        <SidebarContent>
          <NavGroup label="概览" items={overviewNav} isActive={isActive} onNav={handleNav} onHelp={setHelpPath} />
          <SystemGroup isActive={isActive} onNav={handleNav} onHelp={setHelpPath} items={systemSubNav} settingsIcon={settingsIcon} />
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="帮助中心"
                isActive={isActive('/help')}
                onClick={() => handleNav('/help')}
                className={cn(
                  'transition-all duration-150',
                  isActive('/help') && 'bg-sidebar-accent font-medium',
                )}
              >
                <Icon icon="streamline-color:customer-support-1" className="text-sidebar-foreground/50" />
                <span>帮助中心</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </ShadcnSidebar>

      <Sheet open={!!helpInfo} onOpenChange={(open) => { if (!open) setHelpPath(null); }}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Icon icon="lucide:info" className="size-5 text-primary" />
              {helpInfo?.title}
            </SheetTitle>
            <SheetDescription className="text-sm leading-relaxed">
              {helpInfo?.desc}
            </SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    </>
  );
}
