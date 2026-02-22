import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';

export default function SettingsLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const navIcons = useSiteSettingsStore((s) => s.navIcons);

  const settingsTabs = [
    { path: 'basic', label: '基础参数', icon: 'streamline-color:ai-settings-spark' },
    { path: 'ai-models', label: 'AI 模型配置', icon: navIcons.aiModels },
    { path: 'integrations', label: '第三方集成', icon: navIcons.integrations },
    { path: 'storage', label: '文件存储', icon: 'lucide:hard-drive' },
    { path: 'data', label: '数据管理', icon: navIcons.data },
  ];

  // Extract the last segment of the path to determine the active tab
  const segments = location.pathname.split('/');
  const activeTab = segments[segments.length - 1] || 'basic';

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        value={activeTab}
        onValueChange={(value) => navigate(value)}
      >
        <TabsList variant="browser">
          {settingsTabs.map((tab) => (
            <TabsTrigger key={tab.path} value={tab.path} className="gap-2">
              <Icon icon={tab.icon} className="size-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
