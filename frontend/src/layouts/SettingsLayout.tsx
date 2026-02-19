import { NavLink, Outlet } from 'react-router-dom';
import { Cpu, Plug, Database } from 'lucide-react';
import clsx from 'clsx';

const settingsTabs = [
  { path: 'ai-models', label: 'AI 模型配置', icon: Cpu },
  { path: 'integrations', label: '第三方集成', icon: Plug },
  { path: 'data', label: '数据管理', icon: Database },
];

export default function SettingsLayout() {
  return (
    <div className="flex gap-6">
      <nav className="w-52 shrink-0 space-y-0.5">
        {settingsTabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer',
              isActive
                ? 'text-[var(--accent-text)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
            style={({ isActive }) => ({
              background: isActive ? 'var(--accent-subtle)' : 'transparent',
              transitionDuration: 'var(--duration-fast)',
            })}
          >
            <tab.icon size={18} strokeWidth={1.8} />
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
