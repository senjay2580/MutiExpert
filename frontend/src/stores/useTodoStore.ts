import { create } from 'zustand';
import { todoService, type TodoItem } from '@/services/todoService';

export type TodoPriority = 'low' | 'medium' | 'high';
export type { TodoItem };

interface TodoState {
  todos: TodoItem[];
  loading: boolean;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  fetchTodos: () => Promise<void>;
  addTodo: (title: string, priority?: TodoPriority) => Promise<void>;
  toggleTodo: (id: string) => Promise<void>;
  removeTodo: (id: string) => Promise<void>;
  updateTodo: (id: string, title: string) => Promise<void>;
  clearCompleted: () => Promise<void>;
}

export const useTodoStore = create<TodoState>()((set, get) => ({
  todos: [],
  loading: false,
  panelOpen: false,

  setPanelOpen: (open) => {
    set({ panelOpen: open });
    if (open && get().todos.length === 0) get().fetchTodos();
  },

  fetchTodos: async () => {
    set({ loading: true });
    try {
      const todos = await todoService.list();
      set({ todos });
    } catch {
      // keep existing state on error
    } finally {
      set({ loading: false });
    }
  },

  addTodo: async (title, priority = 'medium') => {
    try {
      const todo = await todoService.create({ title, priority });
      set((s) => ({ todos: [todo, ...s.todos] }));
    } catch {
      // silent fail
    }
  },

  toggleTodo: async (id) => {
    // Optimistic update
    set((s) => ({
      todos: s.todos.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    }));
    try {
      await todoService.toggle(id);
    } catch {
      // Revert on error
      set((s) => ({
        todos: s.todos.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
      }));
    }
  },

  removeTodo: async (id) => {
    const prev = get().todos;
    set((s) => ({ todos: s.todos.filter((t) => t.id !== id) }));
    try {
      await todoService.delete(id);
    } catch {
      set({ todos: prev });
    }
  },

  updateTodo: async (id, title) => {
    try {
      const updated = await todoService.update(id, { title });
      set((s) => ({
        todos: s.todos.map((t) => (t.id === id ? updated : t)),
      }));
    } catch {
      // silent fail
    }
  },

  clearCompleted: async () => {
    const prev = get().todos;
    set((s) => ({ todos: s.todos.filter((t) => !t.completed) }));
    try {
      await todoService.clearCompleted();
    } catch {
      set({ todos: prev });
    }
  },
}));
