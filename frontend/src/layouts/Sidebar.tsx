import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  MessageSquare,
  Zap,
  Clock,
  BarChart3,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../stores/useAppStore';
import { ThemeToggle } from '../components/ui/ThemeToggle';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: '仪表盘' },
  { path: '/knowledge', icon: BookOpen, label: '行业知识库' },
  { path: '/chat', icon: MessageSquare, label: 'AI 对话' },
  { path: '/skills', icon: Zap, label: '技能管理' },
  { path: '/scheduler', icon: Clock, label: '定时任务' },
  { path: '/analytics', icon: BarChart3, label: '数据分析' },
  { path: '/settings', icon: Settings, label: '系统管理' },
];

export default function Sidebar() {
  const { sidebarCollapsed, mobileMenuOpen, toggleSidebar, setMobileMenuOpen } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const handleNav = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div
        className="flex items-center justify-between shrink-0 px-4"
        style={{ height: 'var(--topbar-height)', borderBottom: '1px solid var(--border-default)' }}
      >
        <span className="font-bold tracking-tight" style={{ color: 'var(--accent)', fontSize: sidebarCollapsed ? 18 : 20 }}>
          {sidebarCollapsed ? 'ME' : 'MutiExpert'}
        </span>
        {/* Mobile close */}
        <button
          onClick={() => setMobileMenuOpen(false)}
          className="sm:hidden p-1 rounded-md cursor-pointer"
          style={{ color: 'var(--text-muted)' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => handleNav(item.path)}
            title={sidebarCollapsed ? item.label : undefined}
            className={clsx(
              'w-full flex items-center gap-3 rounded-lg text-[13px] font-medium cursor-pointer transition-colors',
              sidebarCollapsed ? 'justify-center px-0 py-2.5 max-sm:justify-start max-sm:px-3' : 'px-3 py-2',
              isActive(item.path)
                ? 'text-[var(--accent-text)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
            style={{
              background: isActive(item.path) ? 'var(--accent-subtle)' : 'transparent',
              transitionDuration: 'var(--duration-fast)',
            }}
            onMouseEnter={(e) => { if (!isActive(item.path)) e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { if (!isActive(item.path)) e.currentTarget.style.background = 'transparent'; }}
          >
            <item.icon size={20} strokeWidth={1.8} />
            {(!sidebarCollapsed || mobileMenuOpen) && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-2 py-3 space-y-1 shrink-0" style={{ borderTop: '1px solid var(--border-default)' }}>
        <ThemeToggle collapsed={sidebarCollapsed && !mobileMenuOpen} />
        <button
          onClick={toggleSidebar}
          className={clsx(
            'w-full hidden sm:flex items-center gap-3 rounded-lg text-[13px] font-medium cursor-pointer',
            'text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors',
            sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'
          )}
          style={{ transitionDuration: 'var(--duration-fast)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {sidebarCollapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          {!sidebarCollapsed && <span>收起侧栏</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex-col border-r transition-all hidden sm:flex',
          sidebarCollapsed ? 'w-[64px]' : 'w-[240px]'
        )}
        style={{
          background: 'var(--bg-sidebar)',
          borderColor: 'var(--border-default)',
          transitionDuration: 'var(--duration-slow)',
          transitionTimingFunction: 'var(--ease-default)',
        }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 sm:hidden"
          onClick={() => setMobileMenuOpen(false)}
          style={{ background: 'rgba(0,0,0,0.4)' }}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-[260px] flex flex-col border-r sm:hidden transition-transform',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{
          background: 'var(--bg-sidebar)',
          borderColor: 'var(--border-default)',
          transitionDuration: 'var(--duration-slow)',
          transitionTimingFunction: 'var(--ease-default)',
        }}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
