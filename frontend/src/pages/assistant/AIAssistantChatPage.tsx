import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import api from '@/services/api';
import { knowledgeBaseService } from '@/services/knowledgeBaseService';
import { chatService, streamEditMessage, streamMessage, streamRegenerate } from '@/services/chatService';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/useAppStore';
import ReactMarkdown from 'react-markdown';
import { illustrations } from '@/lib/illustrations';

type ModelConfig = { id: string; name: string; provider: string };

type MessageSource = {
  document_name: string;
  content_preview: string;
  relevance_score: number;
  document_id: string;
};

type ChatMessage = {
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

type LocationState = { initialPrompt?: string };
type FocusMode = 'knowledge' | 'model';

export default function AIAssistantChatPage() {
  const { conversationId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentModel = useAppStore((s) => s.currentModel);
  const normalizedCurrent = currentModel === 'codex' ? 'openai' : currentModel;
  const setCurrentModel = useAppStore((s) => s.setCurrentModel);

  const [input, setInput] = useState('');
  const [activeConvId, setActiveConvId] = useState<string | null>(conversationId ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [focusMode, setFocusMode] = useState<FocusMode>('knowledge');
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const abortRef = useRef<(() => void) | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const currentConvIdRef = useRef<string | null>(null);
  const pendingPromptRef = useRef<string | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);

  const { data: knowledgeBases = [], isLoading: loadingKnowledge } = useQuery({
    queryKey: ['knowledge-bases', 'all'],
    queryFn: () => knowledgeBaseService.list(),
  });

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

  const deleteConversation = useMutation({
    mutationFn: chatService.deleteConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (activeConvId && activeConvId === deleteConversation.variables) {
        handleNewConversation();
      }
    },
  });

  const updateConversation = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; title?: string | null; knowledge_base_ids?: string[]; is_pinned?: boolean }) =>
      chatService.updateConversation(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

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

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConvId) || null,
    [conversations, activeConvId],
  );

  const lastUserMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'user') return messages[i].id;
    }
    return null;
  }, [messages]);

  const lastAssistantMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'assistant') return messages[i].id;
    }
    return null;
  }, [messages]);

  /* ── Effects ── */
  useEffect(() => { setActiveConvId(conversationId ?? null); }, [conversationId]);

  useEffect(() => {
    if (!activeConvId) { setMessages([]); currentConvIdRef.current = null; return; }
    if (currentConvIdRef.current === activeConvId && messages.length > 0) return;
    let cancelled = false;
    setLoadingMessages(true);
    chatService.listMessages(activeConvId).then((items) => {
      if (cancelled) return;
      const mapped = items
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
          model_used: m.model_used,
          tokens_used: m.tokens_used ?? null,
          prompt_tokens: m.prompt_tokens ?? null,
          completion_tokens: m.completion_tokens ?? null,
          cost_usd: m.cost_usd ?? null,
          latency_ms: m.latency_ms ?? null,
        }));
      currentConvIdRef.current = activeConvId;
      setMessages(mapped);
    }).catch(() => { if (!cancelled) setMessages([]); })
      .finally(() => { if (!cancelled) setLoadingMessages(false); });
    return () => { cancelled = true; };
  }, [activeConvId, messages.length]);

  useEffect(() => {
    if (!activeConvId) return;
    const conv = conversations.find((c) => c.id === activeConvId);
    if (!conv) return;
    const convProvider = conv.model_provider === 'codex' ? 'openai' : conv.model_provider;
    if (convProvider !== normalizedCurrent) {
      chatService.switchModel(activeConvId, normalizedCurrent)
        .then(() => queryClient.invalidateQueries({ queryKey: ['conversations'] }))
        .catch(() => undefined);
    }
  }, [activeConvId, conversations, normalizedCurrent, queryClient]);

  useEffect(() => {
    if (!activeConvId) return;
    const conv = conversations.find((c) => c.id === activeConvId);
    if (!conv) return;
    setFocusMode(conv.knowledge_base_ids?.length ? 'knowledge' : 'model');
    setSelectedKbIds(conv.knowledge_base_ids ?? []);
  }, [activeConvId, conversations]);

  useEffect(() => {
    if (!messageListRef.current) return;
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    return () => { abortRef.current?.(); if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current); };
  }, []);

  useEffect(() => {
    const state = location.state as LocationState | null;
    if (state?.initialPrompt) {
      pendingPromptRef.current = state.initialPrompt;
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  /* ── Handlers ── */
  const cancelStreaming = () => {
    if (abortRef.current) { abortRef.current(); abortRef.current = null; }
    setMessages((prev) => prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)));
    setIsSending(false);
  };

  const handleNewConversation = () => {
    cancelStreaming();
    setActiveConvId(null);
    currentConvIdRef.current = null;
    setMessages([]);
    setInput('');
    setSendError(null);
    setEditingMessageId(null);
    setRenamingId(null);
    navigate('/assistant/chat', { replace: true });
  };

  const handleSelectConversation = (convId: string) => {
    cancelStreaming();
    setSendError(null);
    setEditingMessageId(null);
    navigate(`/assistant/chat/${convId}`);
  };

  const handleStartRename = (convId: string, currentTitle: string | null) => {
    setRenamingId(convId);
    setRenameDraft(currentTitle || '');
  };

  const handleRenameSave = () => {
    if (!renamingId) return;
    const title = renameDraft.trim();
    updateConversation.mutate({ id: renamingId, title: title ? title : null });
    setRenamingId(null);
    setRenameDraft('');
  };

  const handleRenameCancel = () => { setRenamingId(null); setRenameDraft(''); };

  const handleTogglePin = (convId: string, nextPinned: boolean) => {
    updateConversation.mutate({ id: convId, is_pinned: nextPinned });
  };

  const handleFocusModeChange = (mode: FocusMode) => {
    setFocusMode(mode);
    if (!activeConvId) return;
    if (mode === 'model') {
      updateConversation.mutate({ id: activeConvId, knowledge_base_ids: [] });
      return;
    }
    const fallbackIds = knowledgeBases.map((kb) => kb.id);
    const knowledgeIds = selectedKbIds.length ? selectedKbIds : fallbackIds;
    if (!selectedKbIds.length && fallbackIds.length) setSelectedKbIds(fallbackIds);
    updateConversation.mutate({ id: activeConvId, knowledge_base_ids: knowledgeIds });
  };

  const handleRegenerate = () => {
    if (!activeConvId || isSending) return;
    const lastUserIndex = [...messages].map((m) => m.role).lastIndexOf('user');
    if (lastUserIndex < 0) return;
    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev) => {
      const trimmed = prev.slice(0, lastUserIndex + 1);
      return [...trimmed, { id: assistantId, role: 'assistant', content: '', isStreaming: true, model_used: normalizedCurrent }];
    });
    setIsSending(true);
    abortRef.current = streamRegenerate(
      activeConvId,
      (chunk) => setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m))),
      (sources) => setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, sources: sources.map((s) => ({ document_name: s.document_title, content_preview: s.snippet, relevance_score: s.score, document_id: s.document_id ?? '' })) } : m)),
      (messageId, meta) => {
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, id: messageId, isStreaming: false, latency_ms: meta?.latency_ms ?? null, tokens_used: meta?.tokens_used ?? null, prompt_tokens: meta?.prompt_tokens ?? null, completion_tokens: meta?.completion_tokens ?? null, cost_usd: meta?.cost_usd ?? null } : m));
        setIsSending(false);
        abortRef.current = null;
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      },
      (error) => {
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: `Error: ${error}`, isStreaming: false } : m));
        setSendError(error);
        setIsSending(false);
        abortRef.current = null;
      },
    );
  };

  const handleStartEditMessage = (messageId: string, content: string) => {
    if (isSending) return;
    setEditingMessageId(messageId);
    setInput(content);
  };

  const handleCancelEdit = () => { setEditingMessageId(null); setInput(''); };

  const handleCopyMessage = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = window.setTimeout(() => setCopiedMessageId(null), 1600);
    } catch { setCopiedMessageId(null); }
  };

  const buildMarkdownExport = () => {
    const title = activeConversation?.title || '未命名会话';
    const lines: string[] = [`# ${title}`, '', `导出时间：${new Date().toLocaleString()}`, ''];
    messages.forEach((msg) => {
      lines.push(`## ${msg.role === 'user' ? '用户' : '助手'}`);
      lines.push(msg.content || '');
      if (msg.sources?.length) { lines.push('', '来源：'); msg.sources.forEach((s) => lines.push(`- ${s.document_name}：${s.content_preview}`)); }
      lines.push('');
    });
    return lines.join('\n');
  };

  const handleExportMarkdown = () => {
    if (!messages.length) return;
    const md = buildMarkdownExport();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeConversation?.title || 'conversation'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyMarkdown = async () => {
    if (!messages.length) return;
    try { await navigator.clipboard.writeText(buildMarkdownExport()); } catch { /* ignore */ }
  };

  const streamCallbacks = (assistantId: string) => ({
    onChunk: (chunk: string) => setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m))),
    onSources: (sources: Array<{ chunk_id: string; document_id?: string; document_title: string; snippet: string; score: number }>) =>
      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, sources: sources.map((s) => ({ document_name: s.document_title, content_preview: s.snippet, relevance_score: s.score, document_id: s.document_id ?? '' })) } : m)),
    onDone: (messageId: string, meta?: { latency_ms?: number; tokens_used?: number | null; prompt_tokens?: number | null; completion_tokens?: number | null; cost_usd?: number | null }) => {
      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, id: messageId, isStreaming: false, latency_ms: meta?.latency_ms ?? null, tokens_used: meta?.tokens_used ?? null, prompt_tokens: meta?.prompt_tokens ?? null, completion_tokens: meta?.completion_tokens ?? null, cost_usd: meta?.cost_usd ?? null } : m));
      setIsSending(false);
      abortRef.current = null;
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: string) => {
      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: `Error: ${error}`, isStreaming: false } : m));
      setSendError(error);
      setIsSending(false);
      abortRef.current = null;
    },
  });

  const handleSend = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || isSending) return;
    setInput('');
    setSendError(null);

    if (editingMessageId && activeConvId) {
      setIsSending(true);
      setEditingMessageId(null);
      const aId = `assistant-${Date.now()}`;
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === editingMessageId);
        if (idx < 0) return prev;
        const updated = [...prev.slice(0, idx + 1)];
        updated[idx] = { ...updated[idx], content: text };
        updated.push({ id: aId, role: 'assistant', content: '', isStreaming: true, model_used: normalizedCurrent });
        return updated;
      });
      try {
        const cb = streamCallbacks(aId);
        abortRef.current = streamEditMessage(activeConvId, editingMessageId, text, cb.onChunk, cb.onSources, cb.onDone, cb.onError);
      } catch (e) { setSendError(e instanceof Error ? e.message : '发送失败'); setIsSending(false); }
      return;
    }

    setIsSending(true);
    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: text };
    const assistantMsg: ChatMessage = { id: `assistant-${Date.now()}`, role: 'assistant', content: '', isStreaming: true, model_used: normalizedCurrent };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      let convId = activeConvId;
      if (!convId) {
        const shouldUseKb = focusMode === 'knowledge';
        const fallbackIds = knowledgeBases.map((kb) => kb.id);
        const kbIds = shouldUseKb ? (selectedKbIds.length ? selectedKbIds : fallbackIds) : [];
        if (shouldUseKb && !selectedKbIds.length && fallbackIds.length) setSelectedKbIds(fallbackIds);
        const conv = await chatService.createConversation({ knowledge_base_ids: kbIds, model_provider: normalizedCurrent });
        convId = conv.id;
        currentConvIdRef.current = convId;
        setActiveConvId(convId);
        navigate(`/assistant/chat/${convId}`, { replace: true });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      } else { currentConvIdRef.current = convId; }
      const cb = streamCallbacks(assistantMsg.id);
      abortRef.current = streamMessage(convId, text, cb.onChunk, cb.onSources, cb.onDone, cb.onError);
    } catch (e) { setSendError(e instanceof Error ? e.message : '发送失败'); setIsSending(false); }
  }, [activeConvId, editingMessageId, focusMode, input, isSending, knowledgeBases, navigate, normalizedCurrent, queryClient, selectedKbIds]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if (!isSending) handleSend(); }
  };

  const handlePrimaryAction = () => { if (isSending) { cancelStreaming(); return; } handleSend(); };

  useEffect(() => {
    if (!pendingPromptRef.current || isSending || loadingKnowledge) return;
    const prompt = pendingPromptRef.current;
    pendingPromptRef.current = null;
    handleSend(prompt);
  }, [handleSend, isSending, loadingKnowledge]);

  const currentModelName = modelConfigs.find((m) => m.id === normalizedCurrent)?.name || (normalizedCurrent === 'openai' ? 'OpenAI' : 'Claude');
  const totalKbCount = knowledgeBases.length;
  const effectiveKbCount = focusMode === 'knowledge' ? (selectedKbIds.length ? selectedKbIds.length : totalKbCount) : 0;

  /* ── JSX ── */
  return (
    <div className="flex h-[calc(100svh-var(--topbar-height))]">
      {/* ── Main chat area ── */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 bg-background/80 px-4 py-2.5 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" onClick={() => navigate('/assistant')} className="rounded-full">
                    <Icon icon="lucide:arrow-left" width={16} height={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">返回</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div>
              <div className="text-sm font-semibold text-foreground">{activeConversation?.title || '新建会话'}</div>
              <div className="text-[11px] text-muted-foreground">{currentModelName} · {focusMode === 'knowledge' ? `${effectiveKbCount} 个知识库` : '纯模型'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" className="rounded-full" disabled={!messages.length}>
                        <Icon icon="lucide:share-2" width={15} height={15} />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">导出</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>导出与分享</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleExportMarkdown}>导出 Markdown</DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyMarkdown}>复制 Markdown</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" onClick={handleNewConversation} className="rounded-full">
                    <Icon icon="lucide:plus" width={16} height={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">新建会话</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" onClick={() => setSidebarOpen((v) => !v)} className="rounded-full">
                    <Icon icon={sidebarOpen ? 'lucide:panel-right-close' : 'lucide:panel-right-open'} width={16} height={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{sidebarOpen ? '收起侧栏' : '展开侧栏'}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Messages */}
        <div ref={messageListRef} className="flex-1 overflow-y-auto">
          {loadingMessages ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">加载对话中...</div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-5 text-center select-none">
              <img src={illustrations.aiChat} alt="开始对话" className="h-48 w-48 object-contain opacity-90" draggable={false} />
              <div className="space-y-2">
                <div className="text-base font-semibold text-foreground">开始新的对话</div>
                <div className="text-sm text-muted-foreground">输入问题，AI 会实时为你生成回答</div>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
              {messages.map((msg) => (
                <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {msg.role === 'assistant' && (
                    <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon icon="lucide:sparkles" width={14} height={14} />
                    </div>
                  )}
                  <div className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                    msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted/50',
                  )}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                        {msg.isStreaming && <span className="ml-1 inline-block h-4 w-[2px] animate-pulse rounded-sm bg-current" />}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                    {!msg.isStreaming && (
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        {msg.role === 'assistant' && (
                          <button onClick={() => handleCopyMessage(msg.id, msg.content)} className="transition-colors hover:text-foreground" disabled={isSending}>
                            {copiedMessageId === msg.id ? '已复制' : '复制'}
                          </button>
                        )}
                        {msg.role === 'user' && msg.id === lastUserMessageId && (
                          <button onClick={() => handleStartEditMessage(msg.id, msg.content)} className="transition-colors hover:text-foreground" disabled={isSending}>编辑</button>
                        )}
                        {msg.role === 'assistant' && msg.id === lastAssistantMessageId && (
                          <button onClick={handleRegenerate} className="transition-colors hover:text-foreground" disabled={isSending}>重新生成</button>
                        )}
                        {msg.role === 'assistant' && (
                          <span className="text-[10px] opacity-60">{formatModelLabel(msg.model_used || normalizedCurrent)} · {formatLatency(msg.latency_ms)}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {sendError && (
          <div className="mx-auto max-w-3xl px-4">
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">发送失败：{sendError}</div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-border/40 bg-background">
          <div className="mx-auto max-w-3xl px-4 py-3">
            {editingMessageId && (
              <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>正在编辑上一条消息</span>
                <button onClick={handleCancelEdit} className="transition-colors hover:text-foreground">取消编辑</button>
              </div>
            )}
            <div className="rounded-xl border border-border bg-muted/20 px-3 py-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入问题，Enter 发送，Shift+Enter 换行..."
                className="!min-h-[40px] !max-h-[200px] resize-none !border-0 !bg-transparent !px-0 !py-1.5 !text-sm !leading-relaxed !shadow-none !ring-0 focus-visible:!ring-0 focus-visible:!bg-transparent"
              />
              <div className="mt-1.5 flex items-center gap-1.5">
                <Button variant={focusMode === 'knowledge' ? 'secondary' : 'ghost'} size="sm" className="h-7 rounded-full px-2.5 text-[10px]" onClick={() => handleFocusModeChange('knowledge')}>
                  知识库
                </Button>
                <Button variant={focusMode === 'model' ? 'secondary' : 'ghost'} size="sm" className="h-7 rounded-full px-2.5 text-[10px]" onClick={() => handleFocusModeChange('model')}>
                  纯模型
                </Button>
                <div className="ml-auto flex items-center gap-1.5">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 rounded-full px-2 text-[10px]">
                        <Icon icon="lucide:cpu" width={10} height={10} />
                        {currentModelName}
                        <Icon icon="lucide:chevron-down" width={10} height={10} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>选择模型</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {(modelConfigs.length ? modelConfigs : [
                        { id: 'claude', name: 'Claude', provider: 'anthropic' },
                        { id: 'openai', name: 'OpenAI', provider: 'openai' },
                      ]).map((model) => (
                        <DropdownMenuItem key={model.id} className="justify-between" onClick={() => setCurrentModel(model.id as 'claude' | 'openai' | 'codex')}>
                          <span>{model.name}</span>
                          {model.id === normalizedCurrent && <Icon icon="lucide:check" width={14} height={14} />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="default" size="icon-sm" className="size-7 rounded-full" disabled={!input.trim() && !isSending} onClick={handlePrimaryAction}>
                    {isSending ? <Icon icon="lucide:square" width={14} height={14} /> : <Icon icon="lucide:arrow-up" width={14} height={14} />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right sidebar ── */}
      <div className={cn(
        'h-full w-[300px] shrink-0 border-l border-border/40 bg-background/50 backdrop-blur-sm transition-all duration-300',
        sidebarOpen ? 'translate-x-0' : 'hidden',
      )}>
        <div className="flex h-full flex-col p-4">
          {/* Sidebar header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
                <Icon icon="lucide:message-square" width={16} height={16} />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">会话历史</div>
                <div className="text-[11px] text-muted-foreground">管理最近对话</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-xs" onClick={() => queryClient.invalidateQueries({ queryKey: ['conversations'] })}>
                      <Icon icon="lucide:refresh-cw" width={14} height={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">刷新</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-xs" onClick={() => setSidebarOpen(false)}>
                      <Icon icon="lucide:x" width={14} height={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">关闭</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Search + new */}
          <div className="mt-3">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索会话..."
              className="h-8 rounded-full text-xs"
            />
          </div>
          <Button variant="outline" size="sm" className="mt-2 w-full gap-1.5 rounded-full text-xs" onClick={handleNewConversation}>
            <Icon icon="lucide:plus" width={14} height={14} />
            新建会话
          </Button>
          {searchingConversations && trimmedSearch && <div className="mt-2 text-[11px] text-muted-foreground">搜索中...</div>}

          {/* Conversation list */}
          <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto pr-1">
            {loadingConversations ? (
              <div className="text-xs text-muted-foreground">加载会话中...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                {trimmedSearch ? '未找到匹配会话' : '暂无会话记录'}
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    'group flex items-start gap-2 rounded-lg border px-3 py-2 transition-colors hover:bg-muted/50',
                    activeConvId === conv.id ? 'border-primary/30 bg-muted/50' : 'border-transparent',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    {renamingId === conv.id ? (
                      <div className="space-y-1.5">
                        <Input
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSave(); if (e.key === 'Escape') handleRenameCancel(); }}
                          className="h-7 text-xs"
                          placeholder="输入会话标题"
                        />
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" className="h-6 rounded-full text-[10px]" onClick={handleRenameSave}>保存</Button>
                          <Button variant="ghost" size="sm" className="h-6 rounded-full text-[10px]" onClick={handleRenameCancel}>取消</Button>
                        </div>
                      </div>
                    ) : (
                      <button className="min-w-0 text-left" onClick={() => handleSelectConversation(conv.id)}>
                        <div className="flex items-center gap-1 truncate text-xs font-medium text-foreground">
                          {conv.is_pinned && <Icon icon="lucide:pin" width={11} height={11} className="shrink-0 text-muted-foreground" />}
                          <span className="truncate">{conv.title || '未命名会话'}</span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {formatRelativeTime(conv.updated_at)}
                        </div>
                      </button>
                    )}
                  </div>
                  {renamingId !== conv.id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-xs" className="opacity-0 group-hover:opacity-100">
                          <Icon icon="lucide:more-vertical" width={12} height={12} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem onClick={() => handleStartRename(conv.id, conv.title)}>重命名</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleTogglePin(conv.id, !conv.is_pinned)}>{conv.is_pinned ? '取消置顶' : '置顶'}</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => deleteConversation.mutate(conv.id)} className="text-destructive">删除</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

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

function formatLatency(ms: number | null | undefined): string {
  if (!ms) return '--';
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatModelLabel(provider: string | null | undefined): string {
  if (!provider) return '未知';
  if (provider === 'openai') return 'OpenAI';
  if (provider === 'claude') return 'Claude';
  if (provider === 'codex') return 'OpenAI';
  return provider;
}
