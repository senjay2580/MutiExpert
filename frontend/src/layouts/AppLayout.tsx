import { Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { useAppStore } from '../stores/useAppStore';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppLayout() {
  const { sidebarCollapsed } = useAppStore();

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-base)' }}>
      <Sidebar />
      <div
        className={clsx(
          'flex flex-col flex-1 min-w-0 transition-all sidebar-offset',
          sidebarCollapsed && 'collapsed'
        )}
        style={{
          transitionDuration: 'var(--duration-slow)',
          transitionTimingFunction: 'var(--ease-default)',
        }}
      >
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[var(--content-max-width)] px-4 py-4 sm:p-[var(--content-padding)]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
