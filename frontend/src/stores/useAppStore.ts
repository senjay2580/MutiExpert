import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface AppState {
  sidebarCollapsed: boolean;
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  currentModel: 'claude' | 'codex';

  toggleSidebar: () => void;
  setTheme: (theme: Theme) => void;
  setResolvedTheme: (resolved: 'light' | 'dark') => void;
  setCurrentModel: (model: 'claude' | 'codex') => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: 'light',
      resolvedTheme: 'light',
      currentModel: 'claude',

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setTheme: (theme) => set({ theme }),
      setResolvedTheme: (resolved) => set({ resolvedTheme: resolved }),
      setCurrentModel: (model) => set({ currentModel: model }),
    }),
    {
      name: 'mutiexpert-app',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        currentModel: state.currentModel,
      }),
    }
  )
);
