import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@iconify/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import api from '@/services/api';
import { chatService, streamMessage } from '@/services/chatService';
import { useAppStore } from '@/stores/useAppStore';
import { ProviderIcon, getProviderLabel } from '@/components/composed/provider-icon';
import type { ModelProvider } from '@/types';
import ReactMarkdown from 'react-markdown';

/* ================================================================ */
/*  Types                                                            */
/* ================================================================ */

type ModelConfig = { id: string; name: string; provider: string };
type ChatMode = 'knowledge' | 'search' | 'tools';
type PanelTab = 'chat' | 'history';

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
/*  ChatPanel                                                        */
/* ================================================================ */

export function ChatPanel({ knowledgeBaseId, className, onClose }: ChatPanelProps) {
  const queryClient = useQueryClient();
  const currentModel = useAppStore((s) => s.currentModel);
  const normalizedModel = currentModel === 'codex' ? 'openai' : currentModel;
  const setCurrentModel = useAppStore((s) => s.setCurrentModel);
  const providerLabel = getProviderLabel(normalizedModel);

  // Panel state
  const [tab, setTab] = useState<PanelTab>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [modes, setModes] = useState<Set<ChatMode>>(new Set(['knowledge']));

  // History state
  const [searchTerm, setSearchTerm] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const abortRef = useRef<(() => void) | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Queries
  const { data: modelConfigs = [] } = useQuery({
    queryKey: ['ai-models'],
    queryFn: () => api.get<ModelConfig[]>('/config/models').then((r) => r.data),
  });

  const { data: rawConversations = [], isLoading: loadingConversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: chatService.listConversations,
  });

  const trimmedSearch = searchTerm.trim();
  const { data: searchedConversations = [], isFetching: searchingConversations } = useQuery({
    queryKey: ['conversations-search', trimmedSearch],
    queryFn: () => chatService.searchConversations(trimmedSearch),
    enabled: trimmedSearch.length > 0,
  });

  // Mutations
  const deleteConversation = useMutation({
    mutationFn: chatService.deleteConversation,
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (conversationId === deletedId) handleNewChat();
    },
  });

  const updateConversation = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; title?: string | null; is_pinned?: boolean }) =>
      chatService.updateConversation(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  });

  // Derived
  const conversations = useMemo(() => {
    return [...rawConversations].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      if (a.is_pinned && b.is_pinned) {
        const aPinned = a.pinned_at ? new Date(a.pinned_at).getTime() : 0;
        const bPinned = b.pinned_at ? new Date(b.pinned_at).getTime() : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [rawConversations]);

  const filteredConversations = useMemo(() => {
    if (!trimmedSearch) return conversations;
    return [...searchedConversations].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [conversations, searchedConversations, trimmedSearch]);

  const currentModelName =
    modelConfigs.find((m) => m.id === normalizedModel)?.name || providerLabel;

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
        const convs = await chatService.listConversations();
        const existing = convs.find((c) => c.knowledge_base_ids.includes(knowledgeBaseId));
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
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    return conv.id;
  };

  const handleNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setInput('');
    setTab('chat');
    textareaRef.current?.focus();
  };

  const handleSelectConversation = async (convId: string) => {
    setConversationId(convId);
    setMessages([]);
    setTab('chat');
    setIsInitializing(true);
    try {
      const msgs = await chatService.listMessages(convId);
      setMessages(
        msgs
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
    } catch { /* ignore */ }
    finally { setIsInitializing(false); }
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
        () => {},
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
        [...new Set([...modes, 'tools'])],
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

  const toggleMode = (mode: ChatMode) => {
    setModes((prev) => {
      const next = new Set(prev);
      if (next.has(mode)) next.delete(mode);
      else next.add(mode);
      return next;
    });
  };

  // Rename helpers
  const handleStartRename = (id: string, title: string | null) => { setRenamingId(id); setRenameDraft(title || ''); };
  const handleRenameCancel = () => { setRenamingId(null); setRenameDraft(''); };
  const handleRenameSave = () => {
    if (renamingId) updateConversation.mutate({ id: renamingId, title: renameDraft.trim() || null });
    handleRenameCancel();
  };

  useEffect(() => { return () => { abortRef.current?.(); }; }, []);

  return (
    <div className={cn('claude-chat flex flex-col h-full', className)}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-[var(--cc-border)] px-3 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[12px] font-semibold text-[var(--cc-fg)] hover:bg-[var(--cc-bg-elevated)] transition-colors">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--cc-accent)]/15">
                <ProviderIcon provider={normalizedModel} size={12} />
              </div>
              {currentModelName}
              <Icon icon="lucide:chevron-down" width={10} height={10} className="opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel>选择模型</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(modelConfigs.length ? modelConfigs : [
              { id: 'claude', name: 'Claude', provider: 'anthropic' },
              { id: 'openai', name: 'OpenAI', provider: 'openai' },
            ]).map((model) => (
              <DropdownMenuItem key={model.id} className="gap-2" onClick={() => setCurrentModel(model.id as ModelProvider)}>
                <ProviderIcon provider={model.id} size={14} />
                <span className="flex-1">{model.name}</span>
                {model.id === normalizedModel && <Icon icon="lucide:check" width={13} height={13} className="text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setTab(tab === 'history' ? 'chat' : 'history')}
            className={cn(
              'rounded-full',
              tab === 'history' ? 'text-primary' : 'text-[var(--cc-fg-muted)] hover:text-[var(--cc-fg)]',
            )}
            title="会话历史"
          >
            <Icon icon="lucide:message-square" width={14} height={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleNewChat}
            className="rounded-full text-[var(--cc-fg-muted)] hover:text-[var(--cc-fg)]"
            title="新建对话"
          >
            <Icon icon="lucide:plus" width={14} height={14} />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onClose}
              className="rounded-full text-[var(--cc-fg-muted)] hover:text-[var(--cc-fg)]"
              title="收起面板"
            >
              <Icon icon="lucide:panel-right-close" width={14} height={14} />
            </Button>
          )}
        </div>
      </div>

      {tab === 'chat' ? (
        <>
          {/* ── Messages ── */}
          <ScrollArea ref={scrollRef} className="flex-1 bg-[var(--cc-bg)]">
            <div className="space-y-1 px-4 py-4">
              {isInitializing ? (
                <div className="space-y-4 py-8">
                  <Skeleton className="h-4 w-3/4 bg-[var(--cc-border)]" />
                  <Skeleton className="h-4 w-1/2 bg-[var(--cc-border)]" />
                  <Skeleton className="h-4 w-2/3 bg-[var(--cc-border)]" />
                </div>
              ) : messages.length === 0 ? (
                <WelcomeState provider={normalizedModel} providerLabel={providerLabel} />
              ) : (
                messages.map((msg) => (
                  <CCMessage key={msg.id} message={msg} providerLabel={providerLabel} provider={normalizedModel} />
                ))
              )}
            </div>
          </ScrollArea>

          {/* ── Input ── */}
          <div className="border-t border-[var(--cc-border)] bg-[var(--cc-bg-elevated)] px-3 py-2.5">
            <div className="relative">
              <Textarea
                ref={textareaRef}
                placeholder="输入问题，基于知识库问答..."
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

            {/* Mode bar */}
            <div className="mt-2 flex items-center gap-1">
              <div className="flex items-center gap-0.5 rounded-lg bg-[var(--cc-bg)] p-0.5">
                {([
                  { key: 'knowledge' as ChatMode, icon: 'lucide:book-open', label: '知识库' },
                  { key: 'search' as ChatMode, icon: 'lucide:search', label: '搜索' },
                ] as const).map(({ key, icon, label }) => (
                  <Button
                    key={key}
                    variant={modes.has(key) ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                      'h-5 rounded-md px-1.5 text-[10px] transition-all',
                      modes.has(key) && 'bg-emerald-500/15 text-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.25)] dark:text-emerald-400 dark:shadow-[0_0_8px_rgba(16,185,129,0.3)]',
                    )}
                    onClick={() => toggleMode(key)}
                  >
                    <Icon icon={icon} width={10} height={10} className="mr-0.5" />
                    {label}
                  </Button>
                ))}
              </div>
              {messages.length > 0 && (
                <span className="ml-auto text-[10px] text-[var(--cc-fg-muted)]">
                  {messages.filter((m) => m.role === 'user').length} 条对话
                </span>
              )}
            </div>
          </div>
        </>
      ) : (
        /* ── History View ── */
        <div className="flex flex-1 flex-col overflow-hidden bg-[var(--cc-bg)]">
          <div className="space-y-2 px-3 pt-3">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索会话..."
              className="h-7 rounded-full text-xs"
            />
            <Button variant="outline" size="sm" className="w-full gap-1.5 rounded-full text-[11px]" onClick={handleNewChat}>
              <Icon icon="lucide:plus" width={12} height={12} />
              新建会话
            </Button>
            {searchingConversations && trimmedSearch && (
              <div className="text-[10px] text-[var(--cc-fg-muted)]">搜索中...</div>
            )}
          </div>

          <div className="mt-2 flex-1 space-y-1 overflow-y-auto px-3 pb-3">
            {loadingConversations ? (
              <div className="py-6 text-center text-[11px] text-[var(--cc-fg-muted)]">加载中...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="py-6 text-center text-[11px] text-[var(--cc-fg-muted)]">
                {trimmedSearch ? '未找到匹配会话' : '暂无会话记录'}
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    'group flex items-start gap-2 rounded-lg border px-2.5 py-2 transition-colors hover:bg-[var(--cc-bg-elevated)] cursor-pointer',
                    conversationId === conv.id ? 'border-[var(--cc-accent)]/30 bg-[var(--cc-bg-elevated)]' : 'border-transparent',
                  )}
                  onClick={() => { if (renamingId !== conv.id) handleSelectConversation(conv.id); }}
                >
                  <div className="min-w-0 flex-1">
                    {renamingId === conv.id ? (
                      <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSave(); if (e.key === 'Escape') handleRenameCancel(); }}
                          className="h-6 text-[11px]"
                          placeholder="输入会话标题"
                        />
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" className="h-5 rounded-full text-[9px] px-2" onClick={handleRenameSave}>保存</Button>
                          <Button variant="ghost" size="sm" className="h-5 rounded-full text-[9px] px-2" onClick={handleRenameCancel}>取消</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="min-w-0 text-left">
                        <div className="flex items-center gap-1 truncate text-[11px] font-medium text-[var(--cc-fg)]">
                          {conv.is_pinned && <Icon icon="lucide:pin" width={10} height={10} className="shrink-0 text-[var(--cc-fg-muted)]" />}
                          <span className="truncate">{conv.title || '未命名会话'}</span>
                        </div>
                        <div className="mt-0.5 text-[10px] text-[var(--cc-fg-muted)]">
                          {formatRelativeTime(conv.updated_at)}
                        </div>
                      </div>
                    )}
                  </div>
                  {renamingId !== conv.id && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-xs" className="opacity-0 group-hover:opacity-100 text-[var(--cc-fg-muted)]">
                            <Icon icon="lucide:more-vertical" width={11} height={11} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32">
                          <DropdownMenuItem className="text-xs" onClick={() => handleStartRename(conv.id, conv.title)}>重命名</DropdownMenuItem>
                          <DropdownMenuItem className="text-xs" onClick={() => updateConversation.mutate({ id: conv.id, is_pinned: !conv.is_pinned })}>
                            {conv.is_pinned ? '取消置顶' : '置顶'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-xs text-destructive" onClick={() => deleteConversation.mutate(conv.id)}>删除</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================ */
/*  Welcome State                                                    */
/* ================================================================ */

function WelcomeState({ provider, providerLabel }: { provider: string; providerLabel: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--cc-accent)]/10">
        <ProviderIcon provider={provider} size={26} />
      </div>
      <p className="mt-4 text-[15px] font-semibold text-[var(--cc-fg)]">
        {providerLabel}
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
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[var(--cc-user-bg)] px-4 py-2.5">
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--cc-fg)]">
            {message.content}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <ProviderIcon provider={provider} size={12} />
            <span className="text-[11px] font-semibold text-[var(--cc-accent)]">{providerLabel}</span>
          </div>
          <div className="prose-cc text-[13px] leading-relaxed text-[var(--cc-fg)]">
            <ReactMarkdown>{message.content}</ReactMarkdown>
            {message.isStreaming && (
              <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse rounded-sm bg-[var(--cc-accent)]" />
            )}
          </div>
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

/* ================================================================ */
/*  Helpers                                                          */
/* ================================================================ */

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} 小时前`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} 天前`;
  return `${Math.floor(diffDay / 30)} 个月前`;
}
