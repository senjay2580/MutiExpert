import { create } from 'zustand';

interface AppState {
  sidebarCollapsed: boolean;
  currentModel: 'claude' | 'codex';
  toggleSidebar: () => void;
  setCurrentModel: (model: 'claude' | 'codex') => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  currentModel: 'claude',
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setCurrentModel: (model) => set({ currentModel: model }),
}));
