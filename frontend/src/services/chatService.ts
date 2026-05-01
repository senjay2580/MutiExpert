import api from './api';
import type { Conversation, Message } from '../types';

export const chatService = {
  listConversations: () =>
    api.get<Conversation[]>('/conversations').then((r) => r.data),

  createConversation: (data: { title?: string; knowledge_base_ids: string[]; model_provider: string; default_modes?: string[] }) =>
    api.post<Conversation>('/conversations', data).then((r) => r.data),

  getConversation: (id: string) =>
    api.get<Conversation>(`/conversations/${id}`).then((r) => r.data),

  listMessages: (convId: string) =>
    api.get<Message[]>(`/conversations/${convId}/messages`).then((r) => r.data),

  deleteConversation: (id: string) =>
    api.delete(`/conversations/${id}`),

  updateConversation: (
    id: string,
    data: { title?: string | null; knowledge_base_ids?: string[]; is_pinned?: boolean; default_modes?: string[] },
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
  tool_calls?: Array<{ name: string; args: Record<string, unknown>; result: string; success: boolean }>;
};

type StreamCallbacks = {
  onChunk: (text: string) => void;
  onThinking: (text: string) => void;
  onSources: (sources: Array<{ chunk_id: string; document_id?: string; document_title: string; snippet: string; score: number }>) => void;
  onDone: (messageId: string, meta?: StreamDoneMeta) => void;
  onError: (error: string) => void;
  onToolStart?: (data: { name: string; args: Record<string, unknown> }) => void;
  onToolResult?: (data: { name: string; result: string; success: boolean }) => void;
  onWebSearch?: (data: { results: Array<{ title: string; url: string; content: string }> }) => void;
  onFileAttachment?: (data: { filename: string; path: string; size: number; mime_type: string; url: string }) => void;
};

/** 解析单个 SSE event 块（"event: xxx\ndata: yyy"） */
function processEvent(eventBlock: string, callbacks: StreamCallbacks) {
  let eventType = '';
  let dataStr = '';
  for (const line of eventBlock.split('\n')) {
    if (line.startsWith('event: ')) {
      eventType = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      // 多行 data 用换行拼接（SSE 标准支持，但我们 backend 不会这么发）
      dataStr += (dataStr ? '\n' : '') + line.slice(6);
    }
  }
  if (!eventType || !dataStr) return;
  let data: any;
  try {
    data = JSON.parse(dataStr);
  } catch (e) {
    // 跳过解析失败的 event，不要中断整个流
    console.warn('[SSE] JSON parse failed', { eventType, dataStr: dataStr.slice(0, 200), error: e });
    return;
  }
  if (eventType === 'chunk') callbacks.onChunk(data.content);
  else if (eventType === 'thinking') callbacks.onThinking(data.content);
  else if (eventType === 'sources') callbacks.onSources(data.sources);
  else if (eventType === 'tool_start') callbacks.onToolStart?.(data);
  else if (eventType === 'tool_result') callbacks.onToolResult?.(data);
  else if (eventType === 'web_search') callbacks.onWebSearch?.(data);
  else if (eventType === 'file_attachment') callbacks.onFileAttachment?.(data);
  else if (eventType === 'done') callbacks.onDone(data.message_id, {
    latency_ms: data.latency_ms,
    tokens_used: data.tokens_used ?? null,
    prompt_tokens: data.prompt_tokens ?? null,
    completion_tokens: data.completion_tokens ?? null,
    cost_usd: data.cost_usd ?? null,
    tool_calls: data.tool_calls ?? undefined,
  });
  else if (eventType === 'error') callbacks.onError(data.error);
}

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
      if (done) {
        // 处理流结束时还在 buffer 里的最后一个 event（如果有）
        if (buffer.trim()) {
          processEvent(buffer, callbacks);
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      // SSE 标准：event 之间用 \n\n 分隔。按 event 边界切，不要按单 \n 切，
      // 避免 event 内的多行被拆散导致 type/data 错位。
      const events = buffer.split('\n\n');
      buffer = events.pop() || ''; // 最后一个不完整的 event 留作 buffer

      for (const eventBlock of events) {
        if (eventBlock.trim()) {
          processEvent(eventBlock, callbacks);
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
  modelProvider: string,
  callbacks: StreamCallbacks,
  modes?: string[],
  attachments?: Array<{ filename: string; path: string; size: number; mime_type: string; url: string }>,
): () => void {
  const baseUrl = api.defaults.baseURL || '/api/v1';
  const url = `${baseUrl}/conversations/${convId}/messages`;
  const body: Record<string, unknown> = { content, model_provider: modelProvider };
  if (modes && modes.length) body.modes = modes;
  if (attachments && attachments.length) body.attachments = attachments;
  return streamConversationRequest(url, body, callbacks);
}

export function streamRegenerate(
  convId: string,
  modelProvider: string,
  callbacks: StreamCallbacks,
): () => void {
  const baseUrl = api.defaults.baseURL || '/api/v1';
  const url = `${baseUrl}/conversations/${convId}/regenerate`;
  return streamConversationRequest(url, { model_provider: modelProvider }, callbacks);
}

export function streamEditMessage(
  convId: string,
  messageId: string,
  content: string,
  modelProvider: string,
  callbacks: StreamCallbacks,
): () => void {
  const baseUrl = api.defaults.baseURL || '/api/v1';
  const url = `${baseUrl}/conversations/${convId}/messages/${messageId}/edit`;
  return streamConversationRequest(url, { content, model_provider: modelProvider }, callbacks);
}
