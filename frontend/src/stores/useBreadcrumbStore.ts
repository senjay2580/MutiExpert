import { create } from 'zustand';

interface BreadcrumbState {
  /** 动态页面标题，如 "医疗知识库"、"与 Claude 的对话" */
  dynamicLabel: string | null;
  setDynamicLabel: (label: string | null) => void;
}

export const useBreadcrumbStore = create<BreadcrumbState>()((set) => ({
  dynamicLabel: null,
  setDynamicLabel: (label) => set({ dynamicLabel: label }),
}));
