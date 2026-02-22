import type { FileAttachment } from '@/types';

/**
 * Module-level stream registry — holds active streaming state outside React lifecycle.
 * When the chat component unmounts, streams continue running here.
 * On remount, the component reconnects and picks up accumulated content.
 */

export type MessageSource = {
  document_name: string;
  content_preview: string;
  relevance_score: number;
  document_id: string;
};

export type StreamDoneMeta = {
  latency_ms?: number;
  tokens_used?: number | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  cost_usd?: number | null;
};

export type ToolCallEntry = {
  name: string;
  args: Record<string, unknown>;
  result?: string;
  success?: boolean;
  status: 'running' | 'done';
};

export type WebSearchResult = {
  title: string;
  url: string;
  content: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  isThinkingStreaming?: boolean;
  sources?: MessageSource[];
  attachments?: FileAttachment[];
  toolCalls?: ToolCallEntry[];
  webSearchResults?: WebSearchResult[];
  isStreaming?: boolean;
  model_used?: string | null;
  tokens_used?: number | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  cost_usd?: number | null;
  latency_ms?: number | null;
};

export type StreamEntry = {
  conversationId: string;
  assistantMessageId: string;
  userMessage: ChatMessage;
  content: string;
  thinking: string;
  sources: MessageSource[];
  toolCalls: ToolCallEntry[];
  webSearchResults: WebSearchResult[];
  fileAttachments: FileAttachment[];
  isStreaming: boolean;
  abort: (() => void) | null;
  finalMessageId?: string;
  meta?: StreamDoneMeta;
  error?: string;
  modelUsed: string;
  onUpdate: ((entry: StreamEntry) => void) | null;
};

const streams = new Map<string, StreamEntry>();

// 全局完成回调：流在后台完成时（无 subscriber）自动触发，用于 invalidate 缓存
let _onStreamComplete: ((conversationId: string) => void) | null = null;

export function setOnStreamComplete(cb: (conversationId: string) => void): void {
  _onStreamComplete = cb;
}

export function registerStream(entry: Omit<StreamEntry, 'onUpdate'>): void {
  streams.set(entry.conversationId, { ...entry, onUpdate: null });
}

export function getStream(conversationId: string): StreamEntry | undefined {
  return streams.get(conversationId);
}

export function subscribe(conversationId: string, callback: (entry: StreamEntry) => void): void {
  const entry = streams.get(conversationId);
  if (entry) entry.onUpdate = callback;
}

export function unsubscribe(conversationId: string): void {
  const entry = streams.get(conversationId);
  if (entry) entry.onUpdate = null;
}

export function appendChunk(conversationId: string, chunk: string): void {
  const entry = streams.get(conversationId);
  if (!entry) return;
  entry.content += chunk;
  entry.onUpdate?.(entry);
}

export function appendThinking(conversationId: string, chunk: string): void {
  const entry = streams.get(conversationId);
  if (!entry) return;
  entry.thinking += chunk;
  entry.onUpdate?.(entry);
}

export function setSources(conversationId: string, sources: MessageSource[]): void {
  const entry = streams.get(conversationId);
  if (!entry) return;
  entry.sources = sources;
  entry.onUpdate?.(entry);
}

export function addToolStart(conversationId: string, data: { name: string; args: Record<string, unknown> }): void {
  const entry = streams.get(conversationId);
  if (!entry) return;
  entry.toolCalls.push({ name: data.name, args: data.args, status: 'running' });
  entry.onUpdate?.(entry);
}

export function updateToolResult(conversationId: string, data: { name: string; result: string; success: boolean }): void {
  const entry = streams.get(conversationId);
  if (!entry) return;
  const tc = [...entry.toolCalls].reverse().find((t) => t.name === data.name && t.status === 'running');
  if (tc) {
    tc.result = data.result;
    tc.success = data.success;
    tc.status = 'done';
  }
  entry.onUpdate?.(entry);
}

export function setWebSearchResults(conversationId: string, results: WebSearchResult[]): void {
  const entry = streams.get(conversationId);
  if (!entry) return;
  entry.webSearchResults = results;
  entry.onUpdate?.(entry);
}

export function addFileAttachment(conversationId: string, file: FileAttachment): void {
  const entry = streams.get(conversationId);
  if (!entry) return;
  entry.fileAttachments.push(file);
  entry.onUpdate?.(entry);
}

export function markDone(conversationId: string, messageId: string, meta?: StreamDoneMeta): void {
  const entry = streams.get(conversationId);
  if (!entry) return;
  entry.isStreaming = false;
  entry.finalMessageId = messageId;
  entry.meta = meta;
  if (entry.onUpdate) {
    entry.onUpdate(entry);
  } else {
    // 无 subscriber（用户已切走），触发全局完成回调
    _onStreamComplete?.(conversationId);
  }
}

export function markError(conversationId: string, error: string): void {
  const entry = streams.get(conversationId);
  if (!entry) return;
  entry.isStreaming = false;
  entry.error = error;
  if (entry.onUpdate) {
    entry.onUpdate(entry);
  } else {
    _onStreamComplete?.(conversationId);
  }
}

export function abortAndRemove(conversationId: string): void {
  const entry = streams.get(conversationId);
  if (!entry) return;
  entry.abort?.();
  streams.delete(conversationId);
}

export function removeStream(conversationId: string): void {
  streams.delete(conversationId);
}

export function hasActiveStream(conversationId: string): boolean {
  const entry = streams.get(conversationId);
  return !!entry?.isStreaming;
}
