import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

export interface CustomQuickAction {
  route: string;
  label: string;
  desc?: string;
}

interface AppState {
  sidebarCollapsed: boolean;
  mobileMenuOpen: boolean;
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  currentModel: 'claude' | 'openai' | 'codex';
  commandPaletteOpen: boolean;
  customQuickActions: CustomQuickAction[];

  toggleSidebar: () => void;
  setMobileMenuOpen: (open: boolean) => void;
  setTheme: (theme: Theme) => void;
  setResolvedTheme: (resolved: 'light' | 'dark') => void;
  setCurrentModel: (model: 'claude' | 'openai' | 'codex') => void;
  setCommandPaletteOpen: (open: boolean) => void;
  addQuickAction: (action: CustomQuickAction) => void;
  removeQuickAction: (route: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileMenuOpen: false,
      theme: 'light',
      resolvedTheme: 'light',
      currentModel: 'claude',
      commandPaletteOpen: false,
      customQuickActions: [],

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
      setTheme: (theme) => set({ theme }),
      setResolvedTheme: (resolved) => set({ resolvedTheme: resolved }),
      setCurrentModel: (model) => set({ currentModel: model }),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      addQuickAction: (action) => set((s) => ({
        customQuickActions: s.customQuickActions.some((a) => a.route === action.route)
          ? s.customQuickActions
          : [...s.customQuickActions, action],
      })),
      removeQuickAction: (route) => set((s) => ({
        customQuickActions: s.customQuickActions.filter((a) => a.route !== route),
      })),
    }),
    {
      name: 'mutiexpert-app',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        currentModel: state.currentModel,
        customQuickActions: state.customQuickActions,
      }),
    }
  )
);
