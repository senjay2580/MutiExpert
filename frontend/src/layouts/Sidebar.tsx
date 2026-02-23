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
interface PageHelpItem {
  title: string;
  icon: string;
  desc: string;
  features: { icon: string; text: string }[];
  tip?: string;
}

const pageHelp: Record<string, PageHelpItem> = {
  '/dashboard': {
    title: '仪表盘',
    icon: 'lucide:layout-dashboard',
    desc: '总览平台核心数据与运行状态，帮助你快速掌握全局。',
    features: [
      { icon: 'lucide:bar-chart-3', text: '知识库数量、文档总量、AI 对话统计等关键指标' },
      { icon: 'lucide:trending-up', text: '文档上传趋势、AI 调用趋势可视化图表' },
      { icon: 'lucide:pie-chart', text: '行业分布与跨域洞察分析' },
      { icon: 'lucide:activity', text: '实时监控平台健康状态' },
    ],
    tip: '点击图表区域可查看详细数据',
  },
  '/assistant': {
    title: 'AI 问答',
    icon: 'lucide:message-square',
    desc: '统一调用所有知识库与系统 Skills 的智能问答入口。',
    features: [
      { icon: 'lucide:search', text: '自动检索关联知识库，整合多源信息' },
      { icon: 'lucide:brain', text: '智能调度器编排答案，提供可执行建议' },
      { icon: 'lucide:paperclip', text: '支持图片、文件附件上传与解析' },
      { icon: 'lucide:history', text: '完整对话历史，随时回溯上下文' },
    ],
    tip: '输入 / 可快速调用 Skills',
  },
  '/knowledge': {
    title: '知识库',
    icon: 'lucide:library',
    desc: '管理所有行业知识库，构建你的专属知识体系。',
    features: [
      { icon: 'lucide:folder-plus', text: '新建知识库，按行业或主题分类管理' },
      { icon: 'lucide:upload', text: '上传文档（PDF、Word、Markdown、网页等）' },
      { icon: 'lucide:search', text: '全文搜索与语义检索已有资料' },
      { icon: 'lucide:link', text: '查看知识库详情与关联关系' },
    ],
    tip: '拖拽文件到知识库页面可快速上传',
  },
  '/scheduler': {
    title: '定时任务',
    icon: 'lucide:clock',
    desc: '配置自动化任务，让 AI 按计划执行重复性工作。',
    features: [
      { icon: 'lucide:calendar', text: '灵活的 Cron 定时触发规则配置' },
      { icon: 'lucide:refresh-cw', text: '自动执行数据同步、报告生成、知识更新' },
      { icon: 'lucide:list-checks', text: '任务执行日志与状态监控' },
      { icon: 'lucide:pause', text: '支持暂停、恢复和手动触发' },
    ],
  },
  '/scripts': {
    title: '用户脚本',
    icon: 'lucide:file-code',
    desc: '编写和管理自定义脚本，扩展平台能力。',
    features: [
      { icon: 'lucide:code', text: '在线编辑器，支持语法高亮与自动补全' },
      { icon: 'lucide:play', text: '一键运行脚本，实时查看输出结果' },
      { icon: 'lucide:repeat', text: '脚本可绑定定时任务自动执行' },
      { icon: 'lucide:share-2', text: '导入导出脚本，方便复用与分享' },
    ],
  },
  '/bot-tools': {
    title: 'Bot Tools',
    icon: 'lucide:wrench',
    desc: '管理 AI Bot 可调用的工具集，增强 Bot 的执行能力。',
    features: [
      { icon: 'lucide:puzzle', text: '注册自定义工具，定义输入输出参数' },
      { icon: 'lucide:zap', text: 'Bot 对话中自动识别并调用匹配工具' },
      { icon: 'lucide:shield', text: '工具权限管理，控制调用范围' },
      { icon: 'lucide:test-tube', text: '工具调试面板，快速验证功能' },
    ],
  },
  '/skills': {
    title: 'Skills',
    icon: 'lucide:sparkles',
    desc: '管理 AI 技能模块，让 Bot 具备专业领域能力。',
    features: [
      { icon: 'lucide:layers', text: '按领域组织技能，模块化管理' },
      { icon: 'lucide:settings', text: '配置技能参数与触发条件' },
      { icon: 'lucide:git-branch', text: '技能编排与组合，构建复杂工作流' },
      { icon: 'lucide:toggle-right', text: '一键启用/禁用，灵活控制' },
    ],
  },
  '/boards': {
    title: '画板',
    icon: 'lucide:layout-grid',
    desc: '可视化画板工具，自由组织和呈现你的想法。',
    features: [
      { icon: 'lucide:sticky-note', text: '便签、任务卡片、文本块等多种元素' },
      { icon: 'lucide:move', text: '自由拖拽布局，连线表达关系' },
      { icon: 'lucide:layout-template', text: '内置模板，快速搭建看板和脑图' },
      { icon: 'lucide:download', text: '支持导入导出，便于协作分享' },
    ],
  },
  '/settings/basic': {
    title: '基础参数',
    icon: 'lucide:sliders-horizontal',
    desc: '配置平台基础信息，打造专属工作空间。',
    features: [
      { icon: 'lucide:type', text: '站点名称、副标题等品牌信息设置' },
      { icon: 'lucide:image', text: 'Logo 与 Favicon 自定义上传' },
      { icon: 'lucide:palette', text: '导航图标与主题风格个性化' },
      { icon: 'lucide:globe', text: '语言与时区等基础偏好配置' },
    ],
  },
  '/settings/ai-models': {
    title: 'AI 模型配置',
    icon: 'lucide:cpu',
    desc: '管理 AI 模型供应商与调用参数。',
    features: [
      { icon: 'lucide:key', text: '配置多个供应商的 API 密钥（Claude、OpenAI 等）' },
      { icon: 'lucide:list-ordered', text: '设置默认模型与优先级策略' },
      { icon: 'lucide:sliders-vertical', text: '调节 Temperature、Top-P 等生成参数' },
      { icon: 'lucide:test-tube', text: '模型连通性测试，验证配置是否生效' },
    ],
  },
  '/settings/integrations': {
    title: '第三方集成',
    icon: 'lucide:plug',
    desc: '连接外部服务，实现消息推送与双向交互。',
    features: [
      { icon: 'lucide:webhook', text: '飞书、钉钉等通讯工具 Webhook 配置' },
      { icon: 'lucide:bell', text: '事件通知规则，按条件触发推送' },
      { icon: 'lucide:arrow-left-right', text: '双向交互，外部平台可回调触发任务' },
      { icon: 'lucide:shield-check', text: '签名验证与安全鉴权机制' },
    ],
  },
  '/settings/storage': {
    title: '文件存储',
    icon: 'lucide:hard-drive',
    desc: '管理文件存储后端，配置上传与访问策略。',
    features: [
      { icon: 'lucide:cloud', text: '支持本地存储、S3、Supabase 等多种后端' },
      { icon: 'lucide:folder-tree', text: '文件目录浏览与管理' },
      { icon: 'lucide:upload-cloud', text: '上传大小限制与文件类型白名单' },
      { icon: 'lucide:link', text: '文件访问链接生成与权限控制' },
    ],
  },
  '/settings/workspace': {
    title: '工作区',
    icon: 'lucide:briefcase',
    desc: '管理工作区配置与成员协作设置。',
    features: [
      { icon: 'lucide:users', text: '工作区成员管理与角色分配' },
      { icon: 'lucide:shield', text: '权限策略配置，细粒度访问控制' },
      { icon: 'lucide:tag', text: '工作区标签与分组管理' },
      { icon: 'lucide:archive', text: '工作区数据隔离与归档' },
    ],
  },
  '/settings/data': {
    title: '数据管理',
    icon: 'lucide:database',
    desc: '数据导入导出与备份恢复，保障数据安全。',
    features: [
      { icon: 'lucide:upload', text: '批量导入数据（JSON、CSV 等格式）' },
      { icon: 'lucide:download', text: '一键导出全量或增量数据' },
      { icon: 'lucide:save', text: '定期自动备份，支持手动快照' },
      { icon: 'lucide:rotate-ccw', text: '备份恢复，快速回滚到指定时间点' },
    ],
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
            <SheetTitle className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                <Icon icon={helpInfo?.icon ?? 'lucide:info'} className="size-5 text-primary" />
              </div>
              {helpInfo?.title}
            </SheetTitle>
            <SheetDescription className="text-sm leading-relaxed">
              {helpInfo?.desc}
            </SheetDescription>
          </SheetHeader>

          {helpInfo && (
            <div className="mt-4 space-y-4 px-6">
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  功能亮点
                </h4>
                <ul className="space-y-2">
                  {helpInfo.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5 text-sm">
                      <Icon icon={f.icon} className="mt-0.5 size-4 shrink-0 text-primary/70" />
                      <span className="text-foreground/80">{f.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {helpInfo.tip && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                  <Icon icon="lucide:lightbulb" className="mt-0.5 size-4 shrink-0 text-amber-500" />
                  <span className="text-sm text-amber-700 dark:text-amber-400">{helpInfo.tip}</span>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
