import { Outlet, useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import Sidebar from './Sidebar';
import Header from './Header';
import { CommandPalette } from '@/components/composed/command-palette';

/** Routes that need full-width, edge-to-edge layout (no max-w / padding) */
const FULL_WIDTH_PATTERNS = [
  /^\/knowledge\/[^/]+$/, // /knowledge/:id  detail page
  /^\/boards\/[^/]+$/,    // /boards/:id     board editor
  /^\/assistant$/,        // /assistant      AI Q&A full-bleed
  /^\/assistant\/chat(?:\/[^/]+)?$/, // /assistant/chat(/:id)
];

export default function AppLayout() {
  const { pathname } = useLocation();
  const isFullWidth = FULL_WIDTH_PATTERNS.some((re) => re.test(pathname));

  return (
    <SidebarProvider className="!h-svh">
      <Sidebar />
      <SidebarInset className="overflow-hidden">
        <Header />
        <CommandPalette />
        {isFullWidth ? (
          <div className="relative flex-1 min-h-0">
            <Outlet />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
              <Outlet />
            </div>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
