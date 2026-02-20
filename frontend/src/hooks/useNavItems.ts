import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';

export interface NavItem {
  path: string;
  icon: string;
  label: string;
  iconClass?: string;
}

export function useNavItems() {
  const navIcons = useSiteSettingsStore((s) => s.navIcons);

  const overviewNav: NavItem[] = [
    { path: '/dashboard',  icon: navIcons.dashboard,  label: '仪表盘',  iconClass: 'text-blue-500' },
    { path: '/assistant',  icon: 'streamline-color:chat-bubble-text-square', label: 'AI 问答', iconClass: 'text-rose-500' },
    { path: '/knowledge',  icon: navIcons.knowledge,  label: '知识库',  iconClass: 'text-indigo-500' },
    { path: '/scheduler',  icon: navIcons.scheduler,   label: '定时任务', iconClass: 'text-cyan-500' },
    { path: '/boards',     icon: navIcons.boards,    label: '画板', iconClass: 'text-amber-500' },
  ];

  const systemSubNav: NavItem[] = [
    { path: '/settings/basic',        icon: 'streamline-color:ai-settings-spark',      label: '基础参数' },
    { path: '/settings/ai-models',    icon: navIcons.aiModels,       label: 'AI 模型配置' },
    { path: '/settings/integrations', icon: navIcons.integrations,   label: '第三方集成' },
    { path: '/settings/data',         icon: navIcons.data,           label: '数据管理' },
  ];

  return { overviewNav, systemSubNav, settingsIcon: navIcons.settings };
}
