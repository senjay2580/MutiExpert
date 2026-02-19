import { Outlet } from 'react-router-dom';
import { useAppStore } from '../stores/useAppStore';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppLayout() {
  const { sidebarCollapsed } = useAppStore();

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-base)' }}>
      <Sidebar />
      <div
        className="flex flex-col flex-1 min-w-0 transition-all"
        style={{
          marginLeft: sidebarCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)',
          transitionDuration: 'var(--duration-slow)',
          transitionTimingFunction: 'var(--ease-default)',
        }}
      >
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div
            className="mx-auto w-full"
            style={{
              maxWidth: 'var(--content-max-width)',
              padding: 'var(--content-padding)',
            }}
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
