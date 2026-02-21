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

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: MessageSource[];
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
  sources: MessageSource[];
  isStreaming: boolean;
  abort: (() => void) | null;
  finalMessageId?: string;
  meta?: StreamDoneMeta;
  error?: string;
  modelUsed: string;
  onUpdate: ((entry: StreamEntry) => void) | null;
};

const streams = new Map<string, StreamEntry>();

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

export function setSources(conversationId: string, sources: MessageSource[]): void {
  const entry = streams.get(conversationId);
  if (!entry) return;
  entry.sources = sources;
  entry.onUpdate?.(entry);
}

export function markDone(conversationId: string, messageId: string, meta?: StreamDoneMeta): void {
  const entry = streams.get(conversationId);
  if (!entry) return;
  entry.isStreaming = false;
  entry.finalMessageId = messageId;
  entry.meta = meta;
  entry.onUpdate?.(entry);
}

export function markError(conversationId: string, error: string): void {
  const entry = streams.get(conversationId);
  if (!entry) return;
  entry.isStreaming = false;
  entry.error = error;
  entry.onUpdate?.(entry);
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
