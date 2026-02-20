import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { router } from './routes';
import { useTheme } from './hooks/useTheme';
import { useSiteSettingsStore } from './stores/useSiteSettingsStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function ThemeProvider({ children }: { children: React.ReactNode }) {
  useTheme();
  useSyncSiteMeta();
  return <>{children}</>;
}

/** 同步基础参数中的 Logo 到浏览器 favicon 和页面标题 */
function useSyncSiteMeta() {
  const logoUrl = useSiteSettingsStore((s) => s.logoUrl);
  const siteName = useSiteSettingsStore((s) => s.siteName);
  const siteSubtitle = useSiteSettingsStore((s) => s.siteSubtitle);

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (link) link.href = logoUrl;
  }, [logoUrl]);

  useEffect(() => {
    document.title = siteSubtitle
      ? `${siteName} - ${siteSubtitle}`
      : siteName;
  }, [siteName, siteSubtitle]);
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RouterProvider router={router} />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
