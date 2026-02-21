import { useState, useRef, useEffect, useCallback } from 'react';
import { Icon } from '@iconify/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { chatService, streamMessage } from '@/services/chatService';
import { useAppStore } from '@/stores/useAppStore';
import { ProviderIcon, getProviderLabel } from '@/components/composed/provider-icon';
import ReactMarkdown from 'react-markdown';

/* ================================================================ */
/*  Types                                                            */
/* ================================================================ */

interface MessageSource {
  document_name: string;
  content_preview: string;
  relevance_score: number;
  document_id: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: MessageSource[];
  isStreaming?: boolean;
}

interface ChatPanelProps {
  knowledgeBaseId: string;
  className?: string;
  onClose?: () => void;
}

/* ================================================================ */
/*  ChatPanel — Claude Code VSCode Style                             */
/* ================================================================ */

export function ChatPanel({ knowledgeBaseId, className, onClose }: ChatPanelProps) {
  const currentModel = useAppStore((s) => s.currentModel);
  const normalizedModel = currentModel === 'codex' ? 'openai' : currentModel;
  const providerLabel = getProviderLabel(normalizedModel);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const abortRef = useRef<(() => void) | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-slot="scroll-area-viewport"]');
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Init: load existing conversation
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const conversations = await chatService.listConversations();
        const existing = conversations.find((c) => c.knowledge_base_ids.includes(knowledgeBaseId));
        if (cancelled) return;
        if (existing) {
          setConversationId(existing.id);
          const existingProvider = existing.model_provider === 'codex' ? 'openai' : existing.model_provider;
          if (existingProvider !== normalizedModel) {
            await chatService.switchModel(existing.id, normalizedModel);
          }
          const existingMessages = await chatService.listMessages(existing.id);
          if (cancelled) return;
          setMessages(
            existingMessages
              .filter((m) => m.role === 'user' || m.role === 'assistant')
              .map((m) => ({
                id: m.id,
                role: m.role as 'user' | 'assistant',
                content: m.content,
                sources: m.sources?.map((s) => ({
                  document_name: s.document_title,
                  content_preview: s.snippet,
                  relevance_score: s.score,
                  document_id: s.document_id,
                })),
              })),
          );
        }
      } catch { /* user can start a new conversation */ }
      finally { if (!cancelled) setIsInitializing(false); }
    }
    init();
    return () => { cancelled = true; };
  }, [knowledgeBaseId, normalizedModel]);

  const ensureConversation = async (): Promise<string> => {
    if (conversationId) return conversationId;
    const conv = await chatService.createConversation({
      title: '知识库问答',
      knowledge_base_ids: [knowledgeBaseId],
      model_provider: normalizedModel,
    });
    setConversationId(conv.id);
    return conv.id;
  };

  const handleNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setInput('');
    textareaRef.current?.focus();
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setInput('');
    setIsSending(true);

    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: text };
    const assistantMsg: ChatMessage = { id: `assistant-${Date.now()}`, role: 'assistant', content: '', isStreaming: true };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      const convId = await ensureConversation();
      const aId = assistantMsg.id;
      abortRef.current = streamMessage(
        convId, text, normalizedModel,
        (chunk) => setMessages((p) => p.map((m) => m.id === aId ? { ...m, content: m.content + chunk } : m)),
        (sources) => {
          const mapped: MessageSource[] = sources.map((s) => ({
            document_name: s.document_title, content_preview: s.snippet,
            relevance_score: s.score, document_id: s.document_id ?? '',
          }));
          setMessages((p) => p.map((m) => m.id === aId ? { ...m, sources: mapped } : m));
        },
        (messageId, _meta) => {
          setMessages((p) => p.map((m) => m.id === aId ? { ...m, id: messageId, isStreaming: false } : m));
          setIsSending(false);
          abortRef.current = null;
          textareaRef.current?.focus();
        },
        (error) => {
          setMessages((p) => p.map((m) => m.id === aId ? { ...m, content: `Error: ${error}`, isStreaming: false } : m));
          setIsSending(false);
          abortRef.current = null;
        },
      );
    } catch {
      setMessages((p) => p.map((m) => m.id === assistantMsg.id ? { ...m, content: 'Error: Failed to start conversation', isStreaming: false } : m));
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => { return () => { abortRef.current?.(); }; }, []);

  return (
    <div className={cn('claude-chat flex flex-col h-full', className)}>
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between border-b border-[var(--cc-border)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--cc-accent)]/15">
            <ProviderIcon provider={normalizedModel} size={14} />
          </div>
          <span className="text-[13px] font-semibold text-[var(--cc-fg)]">{providerLabel}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleNewChat}
            className="text-[var(--cc-fg-muted)] hover:text-[var(--cc-fg)]"
            title="新建对话"
          >
            <Icon icon="lucide:plus" width={14} height={14} />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onClose}
              className="text-[var(--cc-fg-muted)] hover:text-[var(--cc-fg)]"
              title="收起面板"
            >
              <Icon icon="lucide:panel-right-close" width={14} height={14} />
            </Button>
          )}
        </div>
      </div>

      {/* ---- Messages ---- */}
      <ScrollArea ref={scrollRef} className="flex-1 bg-[var(--cc-bg)]">
        <div className="space-y-1 px-4 py-4">
          {isInitializing ? (
            <div className="space-y-4 py-8">
              <Skeleton className="h-4 w-3/4 bg-[var(--cc-border)]" />
              <Skeleton className="h-4 w-1/2 bg-[var(--cc-border)]" />
              <Skeleton className="h-4 w-2/3 bg-[var(--cc-border)]" />
            </div>
          ) : messages.length === 0 ? (
            <WelcomeState />
          ) : (
            messages.map((msg) => (
              <CCMessage key={msg.id} message={msg} providerLabel={providerLabel} provider={normalizedModel} />
            ))
          )}
        </div>
      </ScrollArea>

      {/* ---- Input ---- */}
      <div className="border-t border-[var(--cc-border)] bg-[var(--cc-bg-elevated)] px-3 py-3">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            placeholder="Ask about your knowledge base..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending || isInitializing}
            className={cn(
              'min-h-[42px] max-h-[160px] resize-none rounded-xl border-[var(--cc-border)] bg-[var(--cc-bg)] text-[13px] text-[var(--cc-fg)] placeholder:text-[var(--cc-fg-muted)] pr-10',
              'focus-visible:ring-[var(--cc-accent)]/30',
              isSending && 'opacity-60',
            )}
            rows={1}
          />
          <Button
            size="icon-xs"
            onClick={handleSend}
            disabled={!input.trim() || isSending || isInitializing}
            className={cn(
              'absolute right-2 bottom-2 rounded-lg transition-all',
              input.trim()
                ? 'bg-[var(--cc-accent)] text-white hover:brightness-110'
                : 'bg-transparent text-[var(--cc-fg-muted)]',
            )}
          >
            {isSending ? (
              <Icon icon="lucide:loader-2" width={14} height={14} className="animate-spin" />
            ) : (
              <Icon icon="lucide:arrow-up" width={14} height={14} />
            )}
          </Button>
        </div>
        <div className="mt-1.5 flex items-center justify-between px-1">
          <span className="text-[10px] text-[var(--cc-fg-muted)]">
            Shift+Enter 换行
          </span>
          {messages.length > 0 && (
            <span className="text-[10px] text-[var(--cc-fg-muted)]">
              {messages.filter((m) => m.role === 'user').length} 条对话
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================ */
/*  Welcome State                                                    */
/* ================================================================ */

function WelcomeState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--cc-accent)]/10">
        <Icon icon="lucide:sparkles" width={26} height={26} className="text-[var(--cc-accent)]" />
      </div>
      <p className="mt-4 text-[15px] font-semibold text-[var(--cc-fg)]">
        Knowledge AI
      </p>
      <p className="mt-1.5 max-w-[260px] text-[12px] leading-relaxed text-[var(--cc-fg-muted)]">
        基于知识库文档进行智能问答。输入你的问题，AI 将结合文档内容为你解答。
      </p>
      <div className="mt-6 flex flex-col gap-2">
        {['这个知识库包含哪些主题？', '帮我总结核心要点', '有哪些关键结论？'].map((q) => (
          <div
            key={q}
            className="rounded-lg border border-[var(--cc-border)] px-3 py-1.5 text-[11px] text-[var(--cc-fg-muted)] hover:bg-[var(--cc-bg-elevated)] hover:text-[var(--cc-fg)] transition-colors cursor-pointer"
          >
            {q}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================ */
/*  Claude Code Style Message                                        */
/* ================================================================ */

function CCMessage({ message, providerLabel, provider }: { message: ChatMessage; providerLabel: string; provider: string }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('py-2', isUser ? 'flex justify-end' : '')}>
      {isUser ? (
        /* User: right-aligned with subtle background */
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[var(--cc-user-bg)] px-4 py-2.5">
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--cc-fg)]">
            {message.content}
          </p>
        </div>
      ) : (
        /* Assistant: left-aligned, no bubble, direct markdown */
        <div className="space-y-2">
          {/* Role label */}
          <div className="flex items-center gap-1.5">
            <Icon icon="lucide:sparkles" width={12} height={12} className="text-[var(--cc-accent)]" />
            <ProviderIcon provider={provider} size={12} />
            <span className="text-[11px] font-semibold text-[var(--cc-accent)]">{providerLabel}</span>
          </div>

          {/* Content */}
          <div className="prose-cc text-[13px] leading-relaxed text-[var(--cc-fg)]">
            <ReactMarkdown>{message.content}</ReactMarkdown>
            {message.isStreaming && (
              <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse rounded-sm bg-[var(--cc-accent)]" />
            )}
          </div>

          {/* Sources */}
          {message.sources && message.sources.length > 0 && (
            <SourcesCollapsible sources={message.sources} />
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================ */
/*  Sources Collapsible                                              */
/* ================================================================ */

function SourcesCollapsible({ sources }: { sources: MessageSource[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--cc-fg-muted)] hover:text-[var(--cc-fg)] transition-colors">
        <Icon icon="lucide:file-text" width={11} height={11} />
        <span>{sources.length} 个引用来源</span>
        <Icon
          icon="lucide:chevron-down"
          width={11}
          height={11}
          className={cn('transition-transform', open && 'rotate-180')}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-1.5">
          {sources.map((src, i) => (
            <div
              key={`${src.document_id}-${i}`}
              className="rounded-lg border border-[var(--cc-border)] bg-[var(--cc-bg-elevated)] p-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-medium text-[var(--cc-fg)]">
                  {src.document_name}
                </span>
                <span className="shrink-0 rounded-md bg-[var(--cc-accent)]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[var(--cc-accent)]">
                  {Math.round(src.relevance_score * 100)}%
                </span>
              </div>
              {src.content_preview && (
                <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-[var(--cc-fg-muted)]">
                  {src.content_preview}
                </p>
              )}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
