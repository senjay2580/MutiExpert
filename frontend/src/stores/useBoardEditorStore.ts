import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';

interface HistoryEntry {
  nodes: Node[];
  edges: Edge[];
}

interface BoardEditorState {
  /* ---- undo / redo ---- */
  past: HistoryEntry[];
  future: HistoryEntry[];
  pushHistory: (entry: HistoryEntry) => void;
  undo: (current: HistoryEntry) => HistoryEntry | null;
  redo: (current: HistoryEntry) => HistoryEntry | null;
  canUndo: () => boolean;
  canRedo: () => boolean;

  /* ---- UI toggles ---- */
  showMiniMap: boolean;
  toggleMiniMap: () => void;
  showToolbar: boolean;
  toggleToolbar: () => void;
  showGuide: boolean;
  setShowGuide: (v: boolean) => void;

  /* ---- dirty / saving ---- */
  isDirty: boolean;
  setDirty: (v: boolean) => void;
  isSaving: boolean;
  setSaving: (v: boolean) => void;

  /* ---- reset ---- */
  reset: () => void;
}

const MAX_HISTORY = 50;

export const useBoardEditorStore = create<BoardEditorState>((set, get) => ({
  past: [],
  future: [],
  pushHistory: (entry) =>
    set((s) => ({
      past: [...s.past.slice(-MAX_HISTORY), entry],
      future: [],
      isDirty: true,
    })),
  undo: (current) => {
    const { past } = get();
    if (!past.length) return null;
    const prev = past[past.length - 1];
    set((s) => ({
      past: s.past.slice(0, -1),
      future: [current, ...s.future],
      isDirty: true,
    }));
    return prev;
  },
  redo: (current) => {
    const { future } = get();
    if (!future.length) return null;
    const next = future[0];
    set((s) => ({
      past: [...s.past, current],
      future: s.future.slice(1),
      isDirty: true,
    }));
    return next;
  },
  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  showMiniMap: true,
  toggleMiniMap: () => set((s) => ({ showMiniMap: !s.showMiniMap })),
  showToolbar: true,
  toggleToolbar: () => set((s) => ({ showToolbar: !s.showToolbar })),
  showGuide: false,
  setShowGuide: (v) => set({ showGuide: v }),

  isDirty: false,
  setDirty: (v) => set({ isDirty: v }),
  isSaving: false,
  setSaving: (v) => set({ isSaving: v }),

  reset: () =>
    set({
      past: [],
      future: [],
      showMiniMap: true,
      showToolbar: true,
      showGuide: false,
      isDirty: false,
      isSaving: false,
    }),
}));
