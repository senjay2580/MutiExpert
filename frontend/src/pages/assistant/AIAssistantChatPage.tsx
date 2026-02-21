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
import type { ModelProvider } from '@/types';
import { ProviderIcon, getProviderLabel } from '@/components/composed/provider-icon';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark-dimmed.css';
import { illustrations } from '@/lib/illustrations';
import { ThinkingBlock } from '@/components/composed/thinking-block';
import * as streamRegistry from '@/lib/streamRegistry';
import type { ChatMessage, MessageSource } from '@/lib/streamRegistry';

type ModelConfig = { id: string; name: string; provider: string };

type LocationState = { initialPrompt?: string };
type ChatMode = 'knowledge' | 'search' | 'tools';

/* ── Clipboard fallback for HTTP contexts ── */
function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  return Promise.resolve();
}

/* ── Code block with copy button ── */
function CodeBlock({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const code = String(children).replace(/\n$/, '');
  const lang = className?.replace('hljs language-', '')?.replace('language-', '') || '';

  const handleCopy = async () => {
    await copyToClipboard(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group/code relative my-3 overflow-hidden rounded-lg border border-border/50 bg-[#22272e]">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-1.5 text-[11px] text-zinc-400">
        <span>{lang || 'code'}</span>
        <button onClick={handleCopy} className="flex items-center gap-1 transition-colors hover:text-zinc-200">
          <Icon icon={copied ? 'lucide:check' : 'lucide:copy'} width={12} height={12} />
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre className="!m-0 !rounded-none !border-0 !bg-transparent p-4"><code className={className} {...props}>{children}</code></pre>
    </div>
  );
}

/* ── Source references collapsible ── */
function SourceReferences({ sources }: { sources: MessageSource[] }) {
  const [open, setOpen] = useState(false);
  if (!sources.length) return null;
  return (
    <div className="mt-2.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <Icon icon="lucide:file-text" width={12} height={12} />
        <span>引用了 {sources.length} 个来源</span>
        <Icon icon={open ? 'lucide:chevron-up' : 'lucide:chevron-down'} width={12} height={12} />
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5">
          {sources.map((s, i) => (
            <div key={i} className="rounded-md border border-border/40 bg-muted/30 px-3 py-2 text-[11px]">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Icon icon="lucide:file" width={11} height={11} className="shrink-0 text-primary/70" />
                {s.document_name}
                <span className="ml-auto text-[10px] text-muted-foreground">{(s.relevance_score * 100).toFixed(0)}% 相关</span>
              </div>
              <p className="mt-1 line-clamp-2 text-muted-foreground">{s.content_preview}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const markdownComponents = {
  code({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
    const isBlock = className?.includes('language-') || className?.includes('hljs');
    if (isBlock) return <CodeBlock className={className} {...props}>{children}</CodeBlock>;
    return <code className={cn('rounded bg-muted/60 px-1.5 py-0.5 text-[12px] font-mono', className)} {...props}>{children}</code>;
  },
  pre({ children }: { children?: React.ReactNode }) {
    return <>{children}</>;
  },
};

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
  const [modes, setModes] = useState<Set<ChatMode>>(new Set(['knowledge']));
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  // 用 useState 持有初始 prompt，StrictMode 下 state 会被正确保留（ref 不会）
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(
    () => (location.state as LocationState | null)?.initialPrompt ?? null,
  );

  const abortRef = useRef<(() => void) | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);
  const currentConvIdRef = useRef<string | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);
  const creatingConvRef = useRef(false);

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

  // 注册全局完成回调：流在后台完成时自动 invalidate 缓存（更新标题等）
  useEffect(() => {
    streamRegistry.setOnStreamComplete(() => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });
  }, [queryClient]);

  useEffect(() => {
    if (!activeConvId) {
      // Don't clear messages while a conversation is being created
      if (!creatingConvRef.current) { setMessages([]); currentConvIdRef.current = null; }
      return;
    }
    if (currentConvIdRef.current === activeConvId) return;
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
          thinking: m.thinking_content || undefined,
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
      // Restore stream from registry if one was running in background
      const entry = streamRegistry.getStream(activeConvId);
      if (entry) {
        if (entry.isStreaming) {
          // 流仍在进行：追加临时消息并重新订阅
          const assistantMsg: ChatMessage = {
            id: entry.finalMessageId || entry.assistantMessageId,
            role: 'assistant',
            content: entry.content,
            thinking: entry.thinking || undefined,
            sources: entry.sources,
            isStreaming: true,
            model_used: entry.modelUsed,
          };
          const hasUser = mapped.some((m) => m.id === entry.userMessage.id);
          setMessages(hasUser ? [...mapped, assistantMsg] : [...mapped, entry.userMessage, assistantMsg]);
          setIsSending(true);
          abortRef.current = entry.abort;
          streamRegistry.subscribe(activeConvId, (updated) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === entry.assistantMessageId || m.id === updated.finalMessageId
                  ? { ...m, id: updated.finalMessageId || m.id, content: updated.content, thinking: updated.thinking || undefined, sources: updated.sources, isStreaming: updated.isStreaming, latency_ms: updated.meta?.latency_ms ?? null, tokens_used: updated.meta?.tokens_used ?? null, prompt_tokens: updated.meta?.prompt_tokens ?? null, completion_tokens: updated.meta?.completion_tokens ?? null, cost_usd: updated.meta?.cost_usd ?? null }
                  : m,
              ),
            );
            if (!updated.isStreaming) {
              setIsSending(false);
              abortRef.current = null;
              streamRegistry.removeStream(activeConvId);
              queryClient.invalidateQueries({ queryKey: ['conversations'] });
            }
          });
        } else {
          // 流已在后台完成：API 返回的 mapped 已包含完整消息，直接清理
          streamRegistry.removeStream(activeConvId);
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      }
    }).catch(() => { if (!cancelled) setMessages([]); })
      .finally(() => { if (!cancelled) setLoadingMessages(false); });
    return () => { cancelled = true; };
  }, [activeConvId]);

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

  const restoredConvRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeConvId) { restoredConvRef.current = null; return; }
    if (restoredConvRef.current === activeConvId) return;
    const conv = conversations.find((c) => c.id === activeConvId);
    if (!conv) return;
    restoredConvRef.current = activeConvId;
    const restored = new Set<ChatMode>();
    const dm = conv.default_modes as string[] | undefined;
    if (dm?.length) {
      dm.forEach((m) => restored.add(m as ChatMode));
    } else if (conv.knowledge_base_ids?.length) {
      restored.add('knowledge');
    }
    setModes(restored);
    setSelectedKbIds(conv.knowledge_base_ids ?? []);
  }, [activeConvId, conversations]);

  useEffect(() => {
    if (!messageListRef.current || userScrolledUpRef.current) return;
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    return () => {
      // Don't abort stream on unmount — let it complete in background
      if (activeConvId) streamRegistry.unsubscribe(activeConvId);
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
    };
  }, [activeConvId]);

  // 清除 location.state 防止浏览器后退时重复触发
  useEffect(() => {
    const state = location.state as LocationState | null;
    if (state?.initialPrompt) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  /* ── Handlers ── */
  const cancelStreaming = () => {
    if (activeConvId) streamRegistry.abortAndRemove(activeConvId);
    if (abortRef.current) { abortRef.current(); abortRef.current = null; }
    setMessages((prev) => prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)));
    setIsSending(false);
  };

  // 切换/新建会话时：只 unsubscribe，不 abort 流，让后台继续完成
  const detachStreaming = () => {
    if (activeConvId) streamRegistry.unsubscribe(activeConvId);
    abortRef.current = null;
    setIsSending(false);
  };

  const handleNewConversation = () => {
    detachStreaming();
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
    detachStreaming();
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

  const toggleMode = (mode: ChatMode) => {
    setModes((prev) => {
      const next = new Set(prev);
      if (next.has(mode)) next.delete(mode); else next.add(mode);
      return next;
    });
    if (!activeConvId) return;
    if (mode === 'knowledge') {
      const willHaveKb = !modes.has('knowledge');
      if (!willHaveKb) {
        updateConversation.mutate({ id: activeConvId, knowledge_base_ids: [] });
      } else {
        const fallbackIds = knowledgeBases.map((kb) => kb.id);
        const knowledgeIds = selectedKbIds.length ? selectedKbIds : fallbackIds;
        if (!selectedKbIds.length && fallbackIds.length) setSelectedKbIds(fallbackIds);
        updateConversation.mutate({ id: activeConvId, knowledge_base_ids: knowledgeIds });
      }
    }
  };

  const handleTogglePin = (convId: string, nextPinned: boolean) => {
    updateConversation.mutate({ id: convId, is_pinned: nextPinned });
  };

  const handleRegenerate = () => {
    if (!activeConvId || isSending) return;
    const lastUserIndex = [...messages].map((m) => m.role).lastIndexOf('user');
    if (lastUserIndex < 0) return;
    const lastUserMsg = messages[lastUserIndex];
    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev) => {
      const trimmed = prev.slice(0, lastUserIndex + 1);
      return [...trimmed, { id: assistantId, role: 'assistant', content: '', isStreaming: true, model_used: normalizedCurrent }];
    });
    setIsSending(true);
    const cb = registryCallbacks(assistantId, activeConvId, lastUserMsg);
    const abort = streamRegenerate(activeConvId, normalizedCurrent, cb.onChunk, cb.onThinking, cb.onSources, cb.onDone, cb.onError);
    abortRef.current = abort;
    const entry = streamRegistry.getStream(activeConvId);
    if (entry) entry.abort = abort;
  };

  const handleStartEditMessage = (messageId: string, content: string) => {
    if (isSending) return;
    setEditingMessageId(messageId);
    setInput(content);
  };

  const handleCancelEdit = () => { setEditingMessageId(null); setInput(''); };

  const handleCopyMessage = async (messageId: string, content: string) => {
    try {
      await copyToClipboard(content);
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
    try { await copyToClipboard(buildMarkdownExport()); } catch { /* ignore */ }
  };

  const registryCallbacks = (assistantId: string, convId: string, userMsg: ChatMessage) => {
    streamRegistry.registerStream({
      conversationId: convId,
      assistantMessageId: assistantId,
      userMessage: userMsg,
      content: '',
      thinking: '',
      sources: [],
      isStreaming: true,
      abort: null,
      modelUsed: normalizedCurrent,
    });
    streamRegistry.subscribe(convId, (updated) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId || m.id === updated.finalMessageId
            ? { ...m, id: updated.finalMessageId || m.id, content: updated.content, thinking: updated.thinking || undefined, isThinkingStreaming: updated.isStreaming && !!updated.thinking && !updated.content, sources: updated.sources, isStreaming: updated.isStreaming, latency_ms: updated.meta?.latency_ms ?? null, tokens_used: updated.meta?.tokens_used ?? null, prompt_tokens: updated.meta?.prompt_tokens ?? null, completion_tokens: updated.meta?.completion_tokens ?? null, cost_usd: updated.meta?.cost_usd ?? null }
            : m,
        ),
      );
      if (!updated.isStreaming) {
        setIsSending(false);
        abortRef.current = null;
        streamRegistry.removeStream(convId);
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        if (updated.error) setSendError(updated.error);
      }
    });
    return {
      onChunk: (chunk: string) => streamRegistry.appendChunk(convId, chunk),
      onThinking: (chunk: string) => streamRegistry.appendThinking(convId, chunk),
      onSources: (sources: Array<{ chunk_id: string; document_id?: string; document_title: string; snippet: string; score: number }>) =>
        streamRegistry.setSources(convId, sources.map((s) => ({ document_name: s.document_title, content_preview: s.snippet, relevance_score: s.score, document_id: s.document_id ?? '' }))),
      onDone: (messageId: string, meta?: { latency_ms?: number; tokens_used?: number | null; prompt_tokens?: number | null; completion_tokens?: number | null; cost_usd?: number | null }) =>
        streamRegistry.markDone(convId, messageId, meta),
      onError: (error: string) => streamRegistry.markError(convId, error),
    };
  };

  const handleSend = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || isSending) return;
    setInput('');
    setSendError(null);
    userScrolledUpRef.current = false;

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
        const editedUserMsg: ChatMessage = { id: editingMessageId, role: 'user', content: text };
        const cb = registryCallbacks(aId, activeConvId, editedUserMsg);
        const abort = streamEditMessage(activeConvId, editingMessageId, text, normalizedCurrent, cb.onChunk, cb.onThinking, cb.onSources, cb.onDone, cb.onError);
        abortRef.current = abort;
        const entry = streamRegistry.getStream(activeConvId);
        if (entry) entry.abort = abort;
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
        creatingConvRef.current = true;
        const shouldUseKb = modes.has('knowledge');
        const fallbackIds = knowledgeBases.map((kb) => kb.id);
        const kbIds = shouldUseKb ? (selectedKbIds.length ? selectedKbIds : fallbackIds) : [];
        if (shouldUseKb && !selectedKbIds.length && fallbackIds.length) setSelectedKbIds(fallbackIds);
        const conv = await chatService.createConversation({ knowledge_base_ids: kbIds, model_provider: normalizedCurrent, default_modes: [...modes] });
        convId = conv.id;
        currentConvIdRef.current = convId;
        creatingConvRef.current = false;
        setActiveConvId(convId);
        navigate(`/assistant/chat/${convId}`, { replace: true });
        // 乐观更新：立即把新会话插入缓存，侧边栏即时可见
        queryClient.setQueryData<import('@/types').Conversation[]>(['conversations'], (old) => [conv, ...(old ?? [])]);
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      } else { currentConvIdRef.current = convId; }
      const cb = registryCallbacks(assistantMsg.id, convId, userMsg);
      const abort = streamMessage(convId, text, normalizedCurrent, cb.onChunk, cb.onThinking, cb.onSources, cb.onDone, cb.onError, [...modes]);
      abortRef.current = abort;
      const entry = streamRegistry.getStream(convId);
      if (entry) entry.abort = abort;
    } catch (e) { creatingConvRef.current = false; setSendError(e instanceof Error ? e.message : '发送失败'); setIsSending(false); }
  }, [activeConvId, editingMessageId, modes, input, isSending, knowledgeBases, navigate, normalizedCurrent, queryClient, selectedKbIds]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if (!isSending) handleSend(); }
  };

  const handlePrimaryAction = () => { if (isSending) { cancelStreaming(); return; } handleSend(); };

  useEffect(() => {
    if (!pendingPrompt || isSending || loadingKnowledge) return;
    const prompt = pendingPrompt;
    setPendingPrompt(null);
    handleSend(prompt);
  }, [pendingPrompt, handleSend, isSending, loadingKnowledge]);

  const currentModelName = modelConfigs.find((m) => m.id === normalizedCurrent)?.name || (normalizedCurrent === 'openai' ? 'OpenAI' : 'Claude');
  const totalKbCount = knowledgeBases.length;
  const effectiveKbCount = modes.has('knowledge') ? (selectedKbIds.length ? selectedKbIds.length : totalKbCount) : 0;

  /* ── JSX ── */
  return (
    <div className="flex h-[calc(100svh-var(--topbar-height))]">
      {/* ── Main chat area ── */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        {/* Grid background */}
        <div className="grid-bg" />
        {/* Header */}
        <div className="relative z-[1] flex items-center justify-between border-b border-border/40 bg-background/80 px-4 py-2.5 backdrop-blur-sm">
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
              <div className="text-[11px] text-muted-foreground">{currentModelName} · {[...modes].map((m) => m === 'knowledge' ? `知识库(${effectiveKbCount})` : m === 'search' ? '搜索' : '工具').join(' + ') || '纯模型'}</div>
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
        <div
          ref={messageListRef}
          className="relative z-[1] flex-1 overflow-y-auto"
          onScroll={() => {
            const el = messageListRef.current;
            if (!el) return;
            const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            userScrolledUpRef.current = !nearBottom;
          }}
        >
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
            <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
              {messages.map((msg) => (
                <div key={msg.id} className={cn('group/msg flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {/* AI 头像 */}
                  {msg.role === 'assistant' && (
                    <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted/60 ring-1 ring-border/20">
                      <ProviderIcon provider={msg.model_used || normalizedCurrent} size={16} />
                    </div>
                  )}

                  {msg.role === 'user' ? (
                    /* ── 用户消息：气泡 + 按钮在气泡外下方 ── */
                    <div className="flex max-w-[80%] flex-col items-end">
                      <div className="rounded-2xl bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground shadow-sm">
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      {!msg.isStreaming && (
                        <div className="mt-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100">
                          <TooltipProvider>
                            <Tooltip><TooltipTrigger asChild>
                              <button onClick={() => handleCopyMessage(msg.id, msg.content)} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" disabled={isSending}>
                                <Icon icon={copiedMessageId === msg.id ? 'lucide:check' : 'lucide:copy'} width={13} height={13} />
                              </button>
                            </TooltipTrigger><TooltipContent side="bottom" className="text-xs">{copiedMessageId === msg.id ? '已复制' : '复制'}</TooltipContent></Tooltip>
                          </TooltipProvider>
                          {msg.id === lastUserMessageId && (
                            <TooltipProvider>
                              <Tooltip><TooltipTrigger asChild>
                                <button onClick={() => handleStartEditMessage(msg.id, msg.content)} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" disabled={isSending}>
                                  <Icon icon="lucide:pencil" width={13} height={13} />
                                </button>
                              </TooltipTrigger><TooltipContent side="bottom" className="text-xs">编辑</TooltipContent></Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* ── AI 消息：无气泡，直接展示内容 ── */
                    <div className="max-w-[80%] text-sm leading-relaxed">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        {msg.thinking && (
                          <ThinkingBlock content={msg.thinking} isStreaming={msg.isThinkingStreaming} />
                        )}
                        <ReactMarkdown rehypePlugins={[rehypeHighlight]} components={markdownComponents}>{msg.content}</ReactMarkdown>
                        {msg.isStreaming && !msg.isThinkingStreaming && (
                          <span className="ml-0.5 inline-flex items-center gap-0.5">
                            <span className="inline-block size-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:0ms]" />
                            <span className="inline-block size-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:150ms]" />
                            <span className="inline-block size-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:300ms]" />
                          </span>
                        )}
                      </div>
                      {msg.sources?.length ? <SourceReferences sources={msg.sources} /> : null}
                      {!msg.isStreaming && (
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          <TooltipProvider>
                            <Tooltip><TooltipTrigger asChild>
                              <button onClick={() => handleCopyMessage(msg.id, msg.content)} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" disabled={isSending}>
                                <Icon icon={copiedMessageId === msg.id ? 'lucide:check' : 'lucide:copy'} width={13} height={13} />
                              </button>
                            </TooltipTrigger><TooltipContent side="bottom" className="text-xs">{copiedMessageId === msg.id ? '已复制' : '复制'}</TooltipContent></Tooltip>
                          </TooltipProvider>
                          {msg.id === lastAssistantMessageId && (
                            <TooltipProvider>
                              <Tooltip><TooltipTrigger asChild>
                                <button onClick={handleRegenerate} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" disabled={isSending}>
                                  <Icon icon="lucide:refresh-cw" width={13} height={13} />
                                </button>
                              </TooltipTrigger><TooltipContent side="bottom" className="text-xs">重新生成</TooltipContent></Tooltip>
                            </TooltipProvider>
                          )}
                          <span className="ml-1 flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                            <span>{getProviderLabel(msg.model_used || normalizedCurrent)}</span>
                            <span>·</span>
                            <span>{formatLatency(msg.latency_ms)}</span>
                            {msg.tokens_used ? <><span>·</span><span>{msg.tokens_used} tokens</span></> : null}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {sendError && (
          <div className="relative z-[1] mx-auto max-w-4xl px-4">
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">发送失败：{sendError}</div>
          </div>
        )}

        {/* Input */}
        <div className="relative z-[1] border-t border-border/40 bg-background/80 backdrop-blur-sm">
          <div className="mx-auto max-w-4xl px-4 py-3">
            {editingMessageId && (
              <div className="mb-2 flex items-center justify-between rounded-lg bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                <span className="flex items-center gap-1.5">
                  <Icon icon="lucide:pencil" width={12} height={12} />
                  正在编辑上一条消息
                </span>
                <button onClick={handleCancelEdit} className="rounded px-1.5 py-0.5 transition-colors hover:bg-amber-500/20">取消</button>
              </div>
            )}
            <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/20 shadow-sm transition-colors focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入问题，Enter 发送，Shift+Enter 换行..."
                className="!min-h-[44px] !max-h-[200px] resize-none !border-0 !bg-transparent !px-4 !py-3 !text-sm !leading-relaxed !shadow-none !ring-0 focus-visible:!ring-0 focus-visible:!bg-transparent"
              />
              <div className="flex items-center gap-1.5 border-t border-border/30 px-3 py-2">
                {/* 左侧：模型选择器 + 模式按钮 */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 gap-1.5 rounded-full px-2.5 text-[11px] font-medium">
                      <ProviderIcon provider={normalizedCurrent} size={14} />
                      {currentModelName}
                      <Icon icon="lucide:chevron-down" width={10} height={10} className="opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>选择模型</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {(modelConfigs.length ? modelConfigs : [
                      { id: 'claude', name: 'Claude', provider: 'anthropic' },
                      { id: 'openai', name: 'OpenAI', provider: 'openai' },
                    ]).map((model) => (
                      <DropdownMenuItem key={model.id} className="gap-2" onClick={() => setCurrentModel(model.id as ModelProvider)}>
                        <ProviderIcon provider={model.id} size={16} />
                        <span className="flex-1">{model.name}</span>
                        {model.id === normalizedCurrent && <Icon icon="lucide:check" width={14} height={14} className="text-primary" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="h-4 w-px bg-border/40" />
                <div className="flex items-center gap-1 rounded-lg bg-muted/40 p-0.5">
                  <Button
                    variant={modes.has('knowledge') ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                      'h-6 rounded-md px-2.5 text-[11px] transition-all',
                      modes.has('knowledge') && 'bg-emerald-500/15 text-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.25)] dark:text-emerald-400 dark:shadow-[0_0_8px_rgba(16,185,129,0.3)]',
                    )}
                    onClick={() => toggleMode('knowledge')}
                  >
                    <Icon icon="lucide:book-open" width={12} height={12} className="mr-1" />
                    知识库
                  </Button>
                  <Button
                    variant={modes.has('search') ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                      'h-6 rounded-md px-2.5 text-[11px] transition-all',
                      modes.has('search') && 'bg-emerald-500/15 text-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.25)] dark:text-emerald-400 dark:shadow-[0_0_8px_rgba(16,185,129,0.3)]',
                    )}
                    onClick={() => toggleMode('search')}
                  >
                    <Icon icon="lucide:search" width={12} height={12} className="mr-1" />
                    搜索
                  </Button>
                  <Button
                    variant={modes.has('tools') ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                      'h-6 rounded-md px-2.5 text-[11px] transition-all',
                      modes.has('tools') && 'bg-emerald-500/15 text-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.25)] dark:text-emerald-400 dark:shadow-[0_0_8px_rgba(16,185,129,0.3)]',
                    )}
                    onClick={() => toggleMode('tools')}
                  >
                    <Icon icon="lucide:wrench" width={12} height={12} className="mr-1" />
                    工具
                  </Button>
                </div>
                {modes.has('knowledge') && (
                  <span className="text-[10px] text-muted-foreground">{effectiveKbCount} 个知识库</span>
                )}
                <div className="ml-auto">
                  <Button variant="default" size="icon-sm" className="size-7 rounded-full shadow-sm" disabled={!input.trim() && !isSending} onClick={handlePrimaryAction}>
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
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
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
                    'group flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 transition-colors hover:bg-muted/50',
                    activeConvId === conv.id ? 'border-primary/30 bg-muted/50' : 'border-transparent',
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
                          className="h-7 text-xs"
                          placeholder="输入会话标题"
                        />
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" className="h-6 rounded-full text-[10px]" onClick={handleRenameSave}>保存</Button>
                          <Button variant="ghost" size="sm" className="h-6 rounded-full text-[10px]" onClick={handleRenameCancel}>取消</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="min-w-0 text-left">
                        <div className="flex items-center gap-1 truncate text-xs font-medium text-foreground">
                          {conv.is_pinned && <Icon icon="lucide:pin" width={11} height={11} className="shrink-0 text-muted-foreground" />}
                          <span className="truncate">{conv.title || '未命名会话'}</span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {formatRelativeTime(conv.updated_at)}
                        </div>
                      </div>
                    )}
                  </div>
                  {renamingId !== conv.id && (
                    <div onClick={(e) => e.stopPropagation()}>
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
                    </div>
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
