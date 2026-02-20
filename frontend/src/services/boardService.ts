import api from './api';

export interface BoardListItem {
  id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  node_count: number;
  created_at: string;
  updated_at: string;
}

export interface Board extends Omit<BoardListItem, 'node_count'> {
  nodes: BoardNode[];
  edges: BoardEdge[];
  viewport: { x: number; y: number; zoom: number };
}

export interface BoardNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  width?: number;
  height?: number;
}

export interface BoardEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  animated?: boolean;
  label?: string;
}

export const boardService = {
  list: () => api.get<BoardListItem[]>('/boards').then((r) => r.data),
  get: (id: string) => api.get<Board>(`/boards/${id}`).then((r) => r.data),
  create: (data: { name: string; description?: string }) =>
    api.post<Board>('/boards', data).then((r) => r.data),
  update: (id: string, data: Partial<Board>) =>
    api.put<Board>(`/boards/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/boards/${id}`),
};
