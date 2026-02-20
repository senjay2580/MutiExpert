import api from './api';
import type { Conversation, Message } from '../types';

export const chatService = {
  listConversations: () =>
    api.get<Conversation[]>('/conversations').then((r) => r.data),

  createConversation: (data: { title?: string; knowledge_base_ids: string[]; model_provider: string }) =>
    api.post<Conversation>('/conversations', data).then((r) => r.data),

  getConversation: (id: string) =>
    api.get<Conversation>(`/conversations/${id}`).then((r) => r.data),

  listMessages: (convId: string) =>
    api.get<Message[]>(`/conversations/${convId}/messages`).then((r) => r.data),

  deleteConversation: (id: string) =>
    api.delete(`/conversations/${id}`),

  updateConversation: (
    id: string,
    data: { title?: string | null; knowledge_base_ids?: string[]; is_pinned?: boolean },
  ) => api.patch<Conversation>(`/conversations/${id}`, data).then((r) => r.data),

  searchConversations: (query: string) =>
    api.get<Conversation[]>('/conversations/search', { params: { q: query } }).then((r) => r.data),

  switchModel: (convId: string, model_provider: string) =>
    api.put<Conversation>(`/conversations/${convId}/model`, { model_provider }).then((r) => r.data),

  getMemory: (convId: string) =>
    api.get<{ conversation_id: string; memory_summary: string | null; memory_enabled: boolean }>(
      `/conversations/${convId}/memory`,
    ).then((r) => r.data),

  updateMemory: (
    convId: string,
    data: { memory_summary?: string | null; memory_enabled?: boolean },
  ) =>
    api.put<{ conversation_id: string; memory_summary: string | null; memory_enabled: boolean }>(
      `/conversations/${convId}/memory`,
      data,
    ).then((r) => r.data),

  refreshMemory: (convId: string) =>
    api.post<{ conversation_id: string; memory_summary: string | null; memory_enabled: boolean }>(
      `/conversations/${convId}/memory/refresh`,
    ).then((r) => r.data),
};

type StreamDoneMeta = {
  latency_ms?: number;
  tokens_used?: number | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  cost_usd?: number | null;
};

type StreamCallbacks = {
  onChunk: (text: string) => void;
  onSources: (sources: Array<{ chunk_id: string; document_id?: string; document_title: string; snippet: string; score: number }>) => void;
  onDone: (messageId: string, meta?: StreamDoneMeta) => void;
  onError: (error: string) => void;
};

function streamConversationRequest(
  url: string,
  body: unknown,
  callbacks: StreamCallbacks,
): () => void {
  const controller = new AbortController();

  const apiKey = (import.meta.env.VITE_API_KEY as string | undefined) || localStorage.getItem('MUTIEXPERT_API_KEY');

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-API-Key': apiKey } : {}),
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).then(async (response) => {
    if (!response.ok || !response.body) {
      callbacks.onError(`HTTP ${response.status}`);
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let eventType = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          if (eventType === 'chunk') callbacks.onChunk(data.content);
          else if (eventType === 'sources') callbacks.onSources(data.sources);
          else if (eventType === 'done') callbacks.onDone(data.message_id, {
            latency_ms: data.latency_ms,
            tokens_used: data.tokens_used ?? null,
            prompt_tokens: data.prompt_tokens ?? null,
            completion_tokens: data.completion_tokens ?? null,
            cost_usd: data.cost_usd ?? null,
          });
          else if (eventType === 'error') callbacks.onError(data.error);
        }
      }
    }
  }).catch((err) => {
    if (err.name !== 'AbortError') callbacks.onError(err.message);
  });

  return () => controller.abort();
}

export function streamMessage(
  convId: string,
  content: string,
  onChunk: (text: string) => void,
  onSources: (sources: Array<{ chunk_id: string; document_id?: string; document_title: string; snippet: string; score: number }>) => void,
  onDone: (messageId: string, meta?: StreamDoneMeta) => void,
  onError: (error: string) => void,
): () => void {
  const baseUrl = api.defaults.baseURL || '/api/v1';
  const url = `${baseUrl}/conversations/${convId}/messages`;
  return streamConversationRequest(url, { content }, { onChunk, onSources, onDone, onError });
}

export function streamRegenerate(
  convId: string,
  onChunk: (text: string) => void,
  onSources: (sources: Array<{ chunk_id: string; document_id?: string; document_title: string; snippet: string; score: number }>) => void,
  onDone: (messageId: string, meta?: StreamDoneMeta) => void,
  onError: (error: string) => void,
): () => void {
  const baseUrl = api.defaults.baseURL || '/api/v1';
  const url = `${baseUrl}/conversations/${convId}/regenerate`;
  return streamConversationRequest(url, {}, { onChunk, onSources, onDone, onError });
}

export function streamEditMessage(
  convId: string,
  messageId: string,
  content: string,
  onChunk: (text: string) => void,
  onSources: (sources: Array<{ chunk_id: string; document_id?: string; document_title: string; snippet: string; score: number }>) => void,
  onDone: (messageId: string, meta?: StreamDoneMeta) => void,
  onError: (error: string) => void,
): () => void {
  const baseUrl = api.defaults.baseURL || '/api/v1';
  const url = `${baseUrl}/conversations/${convId}/messages/${messageId}/edit`;
  return streamConversationRequest(url, { content }, { onChunk, onSources, onDone, onError });
}
