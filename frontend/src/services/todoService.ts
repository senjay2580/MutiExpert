import api from './api';

export interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const todoService = {
  list: () => api.get<TodoItem[]>('/todos').then((r) => r.data),
  create: (data: { title: string; priority?: string }) =>
    api.post<TodoItem>('/todos', data).then((r) => r.data),
  update: (id: string, data: Partial<Pick<TodoItem, 'title' | 'priority' | 'sort_order' | 'completed'>>) =>
    api.put<TodoItem>(`/todos/${id}`, data).then((r) => r.data),
  toggle: (id: string) => api.put<TodoItem>(`/todos/${id}/toggle`).then((r) => r.data),
  delete: (id: string) => api.delete(`/todos/${id}`),
  clearCompleted: () => api.delete('/todos/completed'),
};
