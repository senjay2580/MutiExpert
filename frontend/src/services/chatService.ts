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

  switchModel: (convId: string, model_provider: string) =>
    api.put<Conversation>(`/conversations/${convId}/model`, { model_provider }).then((r) => r.data),
};

export function streamMessage(
  convId: string,
  content: string,
  onChunk: (text: string) => void,
  onSources: (sources: Array<{ chunk_id: string; document_id?: string; document_title: string; snippet: string; score: number }>) => void,
  onDone: (messageId: string) => void,
  onError: (error: string) => void,
): () => void {
  const baseUrl = api.defaults.baseURL || '/api/v1';
  const url = `${baseUrl}/conversations/${convId}/messages`;

  const controller = new AbortController();

  const apiKey = (import.meta.env.VITE_API_KEY as string | undefined) || localStorage.getItem('MUTIEXPERT_API_KEY');

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-API-Key': apiKey } : {}),
    },
    body: JSON.stringify({ content }),
    signal: controller.signal,
  }).then(async (response) => {
    if (!response.ok || !response.body) {
      onError(`HTTP ${response.status}`);
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
          if (eventType === 'chunk') onChunk(data.content);
          else if (eventType === 'sources') onSources(data.sources);
          else if (eventType === 'done') onDone(data.message_id);
          else if (eventType === 'error') onError(data.error);
        }
      }
    }
  }).catch((err) => {
    if (err.name !== 'AbortError') onError(err.message);
  });

  return () => controller.abort();
}
