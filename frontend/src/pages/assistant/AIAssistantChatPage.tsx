import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
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

type ModelConfig = {
  id: string;
  name: string;
  provider: string;
};

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

type LocationState = {
  initialPrompt?: string;
};

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [focusMode, setFocusMode] = useState<FocusMode>('knowledge');
  const [memoryDraft, setMemoryDraft] = useState('');
  const [memoryEditing, setMemoryEditing] = useState(false);
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

  const { data: memoryData } = useQuery({
    queryKey: ['conversation-memory', activeConvId],
    queryFn: () => chatService.getMemory(activeConvId as string),
    enabled: !!activeConvId,
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

  const updateMemory = useMutation({
    mutationFn: (payload: { memory_summary?: string | null; memory_enabled?: boolean }) =>
      chatService.updateMemory(activeConvId as string, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversation-memory', activeConvId] });
      if (data.memory_summary !== undefined && data.memory_summary !== null) {
        setMemoryDraft(data.memory_summary);
      }
      setMemoryEditing(false);
    },
  });

  const refreshMemory = useMutation({
    mutationFn: () => chatService.refreshMemory(activeConvId as string),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversation-memory', activeConvId] });
      setMemoryDraft(data.memory_summary ?? '');
      setMemoryEditing(false);
    },
  });

  const conversations = useMemo(() => {
    return [...rawConversations].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) {
        return a.is_pinned ? -1 : 1;
      }
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
      if (a.is_pinned !== b.is_pinned) {
        return a.is_pinned ? -1 : 1;
      }
      const aPinned = a.pinned_at ? new Date(a.pinned_at).getTime() : 0;
      const bPinned = b.pinned_at ? new Date(b.pinned_at).getTime() : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [conversations, searchedConversations, trimmedSearch]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConvId) || null,
    [conversations, activeConvId],
  );

  const latestSources = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i];
      if (msg.role === 'assistant' && msg.sources && msg.sources.length) {
        return msg.sources;
      }
    }
    return [];
  }, [messages]);

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

  const usageSummary = useMemo(() => {
    const summary = {
      totalTokens: 0,
      totalLatencyMs: 0,
      modelCounts: new Map<string, number>(),
      assistantCount: 0,
    };
    messages.forEach((msg) => {
      if (msg.role !== 'assistant') return;
      summary.assistantCount += 1;
      if (typeof msg.tokens_used === 'number') summary.totalTokens += msg.tokens_used;
      if (typeof msg.latency_ms === 'number') summary.totalLatencyMs += msg.latency_ms;
      const model = msg.model_used || 'unknown';
      summary.modelCounts.set(model, (summary.modelCounts.get(model) || 0) + 1);
    });
    return summary;
  }, [messages]);

  useEffect(() => {
    setActiveConvId(conversationId ?? null);
  }, [conversationId]);

  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      currentConvIdRef.current = null;
      return;
    }
    if (currentConvIdRef.current === activeConvId && messages.length > 0) {
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    chatService
      .listMessages(activeConvId)
      .then((items) => {
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
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingMessages(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeConvId, messages.length]);

  useEffect(() => {
    if (!activeConvId) return;
    const conv = conversations.find((c) => c.id === activeConvId);
    if (!conv) return;
    const convProvider = conv.model_provider === 'codex' ? 'openai' : conv.model_provider;
    if (convProvider !== normalizedCurrent) {
      chatService
        .switchModel(activeConvId, normalizedCurrent)
        .then(() => queryClient.invalidateQueries({ queryKey: ['conversations'] }))
        .catch(() => undefined);
    }
  }, [activeConvId, conversations, normalizedCurrent, queryClient]);

  useEffect(() => {
    if (!activeConvId) return;
    const conv = conversations.find((c) => c.id === activeConvId);
    if (!conv) return;
    setFocusMode(conv.knowledge_base_ids?.length ? 'knowledge' : 'model');
  }, [activeConvId, conversations]);

  useEffect(() => {
    if (!activeConvId) return;
    const conv = conversations.find((c) => c.id === activeConvId);
    if (!conv) return;
    setSelectedKbIds(conv.knowledge_base_ids ?? []);
  }, [activeConvId, conversations]);

  useEffect(() => {
    if (!activeConvId) {
      setMemoryDraft('');
      setMemoryEditing(false);
    }
  }, [activeConvId]);

  useEffect(() => {
    if (memoryData?.memory_summary !== undefined) {
      setMemoryDraft(memoryData.memory_summary ?? '');
    }
  }, [memoryData?.memory_summary]);

  useEffect(() => {
    if (!messageListRef.current) return;
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    return () => {
      abortRef.current?.();
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const state = location.state as LocationState | null;
    if (state?.initialPrompt) {
      pendingPromptRef.current = state.initialPrompt;
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  const cancelStreaming = () => {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
    }
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

  const handleRenameCancel = () => {
    setRenamingId(null);
    setRenameDraft('');
  };

  const handleTogglePin = (convId: string, nextPinned: boolean) => {
    updateConversation.mutate({ id: convId, is_pinned: nextPinned });
  };

  const handleToggleKnowledge = (kbId: string) => {
    const next = selectedKbIds.includes(kbId)
      ? selectedKbIds.filter((id) => id !== kbId)
      : [...selectedKbIds, kbId];
    setSelectedKbIds(next);
    if (activeConvId && focusMode === 'knowledge') {
      updateConversation.mutate({ id: activeConvId, knowledge_base_ids: next });
    }
  };

  const handleSelectAllKnowledge = () => {
    const allIds = knowledgeBases.map((kb) => kb.id);
    setSelectedKbIds(allIds);
    if (activeConvId && focusMode === 'knowledge') {
      updateConversation.mutate({ id: activeConvId, knowledge_base_ids: allIds });
    }
  };

  const handleClearKnowledge = () => {
    setSelectedKbIds([]);
    if (activeConvId && focusMode === 'knowledge') {
      updateConversation.mutate({ id: activeConvId, knowledge_base_ids: [] });
    }
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
    if (!selectedKbIds.length && fallbackIds.length) {
      setSelectedKbIds(fallbackIds);
    }
    updateConversation.mutate({ id: activeConvId, knowledge_base_ids: knowledgeIds });
  };

  const handleRegenerate = () => {
    if (!activeConvId || isSending) return;
    const lastUserIndex = [...messages].map((m) => m.role).lastIndexOf('user');
    if (lastUserIndex < 0) return;
    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev) => {
      const trimmed = prev.slice(0, lastUserIndex + 1);
      return [
        ...trimmed,
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          isStreaming: true,
          model_used: normalizedCurrent,
        },
      ];
    });
    setIsSending(true);
    abortRef.current = streamRegenerate(
      activeConvId,
      (chunk) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m)),
        ),
      (sources) =>
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  sources: sources.map((s) => ({
                    document_name: s.document_title,
                    content_preview: s.snippet,
                    relevance_score: s.score,
                    document_id: s.document_id ?? '',
                  })),
                }
              : m,
          ),
        ),
      (messageId, meta) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  id: messageId,
                  isStreaming: false,
                  latency_ms: meta?.latency_ms ?? null,
                  tokens_used: meta?.tokens_used ?? null,
                  prompt_tokens: meta?.prompt_tokens ?? null,
                  completion_tokens: meta?.completion_tokens ?? null,
                  cost_usd: meta?.cost_usd ?? null,
                }
              : m,
          ),
        );
        setIsSending(false);
        abortRef.current = null;
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      },
      (error) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: `Error: ${error}`, isStreaming: false } : m,
          ),
        );
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

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setInput('');
  };

  const handleCopyMessage = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => setCopiedMessageId(null), 1600);
    } catch {
      setCopiedMessageId(null);
    }
  };

  const buildMarkdownExport = () => {
    const title = activeConversation?.title || '未命名会话';
    const lines: string[] = [
      `# ${title}`,
      '',
      `导出时间：${new Date().toLocaleString()}`,
      '',
    ];
    messages.forEach((msg) => {
      const roleLabel = msg.role === 'user' ? '用户' : '助手';
      lines.push(`## ${roleLabel}`);
      lines.push(msg.content || '');
      if (msg.sources && msg.sources.length) {
        lines.push('');
        lines.push('来源：');
        msg.sources.forEach((source) => {
          lines.push(`- ${source.document_name}：${source.content_preview}`);
        });
      }
      lines.push('');
    });
    return lines.join('\n');
  };

  const handleExportMarkdown = () => {
    if (!messages.length) return;
    const markdown = buildMarkdownExport();
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeConversation?.title || 'conversation'}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyMarkdown = async () => {
    if (!messages.length) return;
    const markdown = buildMarkdownExport();
    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      // ignore
    }
  };

  const handleCopyLink = async () => {
    if (!activeConvId) return;
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // ignore
    }
  };

  const handleSend = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || isSending) return;
    setInput('');
    setSendError(null);

    if (editingMessageId && activeConvId) {
      setIsSending(true);
      setEditingMessageId(null);
      const assistantId = `assistant-${Date.now()}`;
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === editingMessageId);
        if (idx < 0) return prev;
        const updated = [...prev.slice(0, idx + 1)];
        updated[idx] = { ...updated[idx], content: text };
        updated.push({
          id: assistantId,
          role: 'assistant',
          content: '',
          isStreaming: true,
          model_used: normalizedCurrent,
        });
        return updated;
      });

      try {
        abortRef.current = streamEditMessage(
          activeConvId,
          editingMessageId,
          text,
          (chunk) =>
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m)),
            ),
          (sources) =>
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      sources: sources.map((s) => ({
                        document_name: s.document_title,
                        content_preview: s.snippet,
                        relevance_score: s.score,
                        document_id: s.document_id ?? '',
                      })),
                    }
                  : m,
              ),
            ),
          (messageId, meta) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      id: messageId,
                      isStreaming: false,
                  latency_ms: meta?.latency_ms ?? null,
                  tokens_used: meta?.tokens_used ?? null,
                  prompt_tokens: meta?.prompt_tokens ?? null,
                  completion_tokens: meta?.completion_tokens ?? null,
                  cost_usd: meta?.cost_usd ?? null,
                }
              : m,
          ),
        );
            setIsSending(false);
            abortRef.current = null;
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
          },
          (error) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: `Error: ${error}`, isStreaming: false } : m,
              ),
            );
            setSendError(error);
            setIsSending(false);
            abortRef.current = null;
          },
        );
      } catch (error) {
        setSendError(error instanceof Error ? error.message : '发送失败');
        setIsSending(false);
      }
      return;
    }

    setIsSending(true);

    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: text };
    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      isStreaming: true,
      model_used: normalizedCurrent,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      let convId = activeConvId;
      if (!convId) {
        const shouldUseKnowledge = focusMode === 'knowledge';
        const fallbackIds = knowledgeBases.map((kb) => kb.id);
        const knowledgeIds = shouldUseKnowledge
          ? (selectedKbIds.length ? selectedKbIds : fallbackIds)
          : [];
        if (shouldUseKnowledge && selectedKbIds.length === 0 && fallbackIds.length) {
          setSelectedKbIds(fallbackIds);
        }
        const conv = await chatService.createConversation({
          knowledge_base_ids: knowledgeIds,
          model_provider: normalizedCurrent,
        });
        convId = conv.id;
        currentConvIdRef.current = convId;
        setActiveConvId(convId);
        navigate(`/assistant/chat/${convId}`, { replace: true });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      } else {
        currentConvIdRef.current = convId;
      }

      const assistantId = assistantMsg.id;
      abortRef.current = streamMessage(
        convId,
        text,
        (chunk) =>
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m)),
          ),
        (sources) =>
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    sources: sources.map((s) => ({
                      document_name: s.document_title,
                      content_preview: s.snippet,
                      relevance_score: s.score,
                      document_id: s.document_id ?? '',
                    })),
                  }
                : m,
            ),
          ),
        (messageId, meta) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    id: messageId,
                    isStreaming: false,
                    latency_ms: meta?.latency_ms ?? null,
                    tokens_used: meta?.tokens_used ?? null,
                    prompt_tokens: meta?.prompt_tokens ?? null,
                    completion_tokens: meta?.completion_tokens ?? null,
                    cost_usd: meta?.cost_usd ?? null,
                  }
                : m,
            ),
          );
          setIsSending(false);
          abortRef.current = null;
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        },
        (error) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: `Error: ${error}`, isStreaming: false } : m,
            ),
          );
          setSendError(error);
          setIsSending(false);
          abortRef.current = null;
        },
      );
    } catch (error) {
      setSendError(error instanceof Error ? error.message : '发送失败');
      setIsSending(false);
    }
  }, [activeConvId, editingMessageId, focusMode, input, isSending, knowledgeBases, navigate, normalizedCurrent, queryClient, selectedKbIds]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!isSending) handleSend();
    }
  };

  const handlePrimaryAction = () => {
    if (isSending) {
      cancelStreaming();
      return;
    }
    handleSend();
  };

  useEffect(() => {
    if (!pendingPromptRef.current || isSending || loadingKnowledge) return;
    const prompt = pendingPromptRef.current;
    pendingPromptRef.current = null;
    handleSend(prompt);
  }, [handleSend, isSending, loadingKnowledge]);

  const currentModelName =
    modelConfigs.find((m) => m.id === normalizedCurrent)?.name
    || (normalizedCurrent === 'openai' ? 'OpenAI' : 'Claude');
  const totalKbCount = knowledgeBases.length;
  const effectiveKbCount =
    focusMode === 'knowledge'
      ? (selectedKbIds.length ? selectedKbIds.length : totalKbCount)
      : 0;

  return (
    <div
      className="relative min-h-[calc(100svh-var(--topbar-height))] pb-6 pt-6 [--cc-bg-elevated:rgba(15,23,42,0.7)] [--cc-border:rgba(148,163,184,0.2)] [--cc-accent:#60a5fa]"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-slate-950/80 via-slate-900/50 to-slate-950/90" />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-60 [background:radial-gradient(circle_at_10%_15%,rgba(79,70,229,0.25),transparent_55%),radial-gradient(circle_at_85%_10%,rgba(14,116,144,0.18),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(59,130,246,0.18),transparent_55%)]" />

      <div className="relative mx-auto flex min-h-[calc(100svh-var(--topbar-height)-48px)] w-full max-w-[1600px] px-4 sm:px-6 lg:pl-[300px] lg:pr-[340px]">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mx-auto flex w-full max-w-4xl flex-1 min-h-0 flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => navigate('/assistant')}
                  className="rounded-full border border-white/10 bg-white/5 text-white/70 hover:text-white"
                >
                  <Icon icon="lucide:arrow-left" width={16} height={16} />
                </Button>
                <div>
                  <div className="text-sm font-semibold text-white">AI 对话</div>
                  <div className="text-xs text-white/50">
                    {activeConversation?.title || '新建会话'}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                  {currentModelName}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full border-white/20 bg-white/5 text-xs text-white/80"
                      disabled={!messages.length}
                    >
                      <Icon icon="lucide:share-2" width={14} height={14} />
                      导出
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>导出与分享</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleExportMarkdown}>
                      导出 Markdown
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCopyMarkdown}>
                      复制 Markdown
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleCopyLink} disabled={!activeConvId}>
                      复制分享链接
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setSidebarOpen(true)}
                  className="rounded-full border border-white/10 bg-white/5 text-white/70 hover:text-white lg:hidden"
                >
                  <Icon icon="lucide:panel-left-open" width={16} height={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setContextOpen(true)}
                  className="rounded-full border border-white/10 bg-white/5 text-white/70 hover:text-white lg:hidden"
                >
                  <Icon icon="lucide:panel-right-open" width={16} height={16} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full border-white/20 bg-white/5 text-xs text-white/80"
                  onClick={handleNewConversation}
                >
                  <Icon icon="lucide:plus" width={14} height={14} />
                  新建会话
                </Button>
              </div>
            </div>

            <div
              ref={messageListRef}
              className="flex-1 min-h-0 space-y-6 overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl"
            >
              {loadingMessages ? (
                <div className="text-xs text-white/50">加载对话中...</div>
              ) : messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-white/60">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-white/5">
                    <Icon icon="lucide:sparkles" width={20} height={20} />
                  </div>
                  <div className="text-sm font-medium text-white">开始新的对话</div>
                  <div className="text-xs text-white/50">输入问题，AI 会实时为你生成回答。</div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm',
                        msg.role === 'user'
                          ? 'bg-white/15 text-white'
                          : 'border border-white/10 bg-white/5 text-white/90',
                      )}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="prose-cc text-[13px] leading-relaxed text-white">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                          {msg.isStreaming && (
                            <span className="ml-1 inline-block h-4 w-[2px] animate-pulse rounded-sm bg-white/70" />
                          )}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                      {msg.sources && msg.sources.length > 0 && (
                        <button
                          onClick={() => setContextOpen(true)}
                          className="mt-2 text-[11px] text-white/60 transition-colors hover:text-white"
                        >
                          查看引用 · {msg.sources.length}
                        </button>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/50">
                        {msg.role === 'assistant' && (
                          <button
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            className="transition-colors hover:text-white"
                            disabled={isSending}
                          >
                            {copiedMessageId === msg.id ? '已复制' : '复制'}
                          </button>
                        )}
                        {msg.role === 'user' && msg.id === lastUserMessageId && (
                          <button
                            onClick={() => handleStartEditMessage(msg.id, msg.content)}
                            className="transition-colors hover:text-white"
                            disabled={isSending}
                          >
                            编辑
                          </button>
                        )}
                        {msg.role === 'assistant' && msg.id === lastAssistantMessageId && (
                          <button
                            onClick={handleRegenerate}
                            className="transition-colors hover:text-white"
                            disabled={isSending}
                          >
                            重新生成
                          </button>
                        )}
                      </div>
                      {msg.role === 'assistant' && (
                        <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-white/40">
                          <span>模型：{formatModelLabel(msg.model_used || normalizedCurrent)}</span>
                          <span>耗时：{formatLatency(msg.latency_ms)}</span>
                          <span>Tokens：{formatTokens(msg)}</span>
                          <span>费用：{formatCost(msg.cost_usd)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {sendError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">
                发送失败：{sendError}
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur-xl">
              {editingMessageId && (
                <div className="mb-2 flex items-center justify-between text-[11px] text-white/60">
                  <span>正在编辑上一条消息</span>
                  <button
                    onClick={handleCancelEdit}
                    className="text-white/60 transition-colors hover:text-white"
                  >
                    取消编辑
                  </button>
                </div>
              )}
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入问题，Enter 发送，Shift+Enter 换行..."
                className="min-h-[90px] resize-none border-none bg-transparent p-0 text-sm text-white placeholder:text-white/40 focus-visible:ring-0"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-white/50">
                    来源
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'rounded-full border-white/10 bg-white/5 text-[10px] text-white/80',
                      focusMode === 'knowledge' && 'border-white/30 bg-white/10 text-white',
                    )}
                    onClick={() => handleFocusModeChange('knowledge')}
                  >
                    知识库
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'rounded-full border-white/10 bg-white/5 text-[10px] text-white/80',
                      focusMode === 'model' && 'border-white/30 bg-white/10 text-white',
                    )}
                    onClick={() => handleFocusModeChange('model')}
                  >
                    纯模型
                  </Button>
                  {activeConvId && (
                    <span className="text-[10px] text-white/40">当前会话已同步</span>
                  )}
                </div>

                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-white/50">
                    模型
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 rounded-full border-white/10 bg-white/5 text-[10px] text-white/80"
                      >
                        <Icon icon="lucide:cpu" width={10} height={10} />
                        {currentModelName}
                        <Icon icon="lucide:chevron-down" width={12} height={12} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      <DropdownMenuLabel>选择模型</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {(modelConfigs.length ? modelConfigs : [
                        { id: 'claude', name: 'Claude', provider: 'anthropic' },
                        { id: 'openai', name: 'OpenAI', provider: 'openai' },
                      ]).map((model) => {
                        const isActive = model.id === normalizedCurrent;
                        return (
                          <DropdownMenuItem
                            key={model.id}
                            className="justify-between"
                            onClick={() => setCurrentModel(model.id as 'claude' | 'openai' | 'codex')}
                          >
                            <span>{model.name}</span>
                            {isActive && <Icon icon="lucide:check" width={14} height={14} />}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Badge variant="secondary" className="gap-1 rounded-full text-[10px]">
                    <Icon icon="streamline-color:open-book" width={10} height={10} />
                    {focusMode === 'knowledge'
                      ? `${effectiveKbCount}/${totalKbCount} 个知识库`
                      : '纯模型模式'}
                  </Badge>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="rounded-full border-white/20 bg-white/10 text-white"
                    disabled={!input.trim() && !isSending}
                    onClick={handlePrimaryAction}
                  >
                    {isSending ? (
                      <Icon icon="lucide:square" width={14} height={14} />
                    ) : (
                      <Icon icon="lucide:arrow-up" width={14} height={14} />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {(sidebarOpen || contextOpen) && (
        <button
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => {
            setSidebarOpen(false);
            setContextOpen(false);
          }}
        />
      )}

      <div
        className={cn(
          'fixed left-4 top-[calc(var(--topbar-height)+16px)] z-40 h-[calc(100svh-var(--topbar-height)-32px)] w-[260px] transform rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-2xl backdrop-blur-2xl transition-transform duration-300 ease-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-[120%]',
          'lg:translate-x-0',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-white">会话</div>
            <div className="text-xs text-white/50">最近对话与管理</div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['conversations'] })}
            >
              <Icon icon="lucide:refresh-cw" width={14} height={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setSidebarOpen(false)}
              className="text-white/60 lg:hidden"
            >
              <Icon icon="lucide:x" width={14} height={14} />
            </Button>
          </div>
        </div>

        <div className="mt-3">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索会话"
            className="h-8 rounded-full border border-white/10 bg-white/5 text-xs text-white placeholder:text-white/40"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full gap-1.5 rounded-full border-white/10 bg-white/5 text-xs text-white/80"
          onClick={handleNewConversation}
        >
          <Icon icon="lucide:plus" width={14} height={14} />
          新建会话
        </Button>
        {searchingConversations && trimmedSearch && (
          <div className="mt-2 text-[11px] text-white/40">搜索中...</div>
        )}

        <div className="mt-4 space-y-2 overflow-y-auto pr-1" style={{ maxHeight: 'calc(100% - 168px)' }}>
          {loadingConversations ? (
            <div className="text-xs text-white/50">加载会话中...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-center text-xs text-white/50">
              {trimmedSearch ? '未找到匹配会话' : '暂无会话记录'}
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  'group flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 transition-colors hover:border-white/30 hover:bg-white/10',
                  activeConvId === conv.id && 'border-white/30 bg-white/10',
                )}
              >
                <div className="min-w-0 flex-1">
                  {renamingId === conv.id ? (
                    <div className="space-y-2">
                      <Input
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameSave();
                          if (e.key === 'Escape') handleRenameCancel();
                        }}
                        className="h-8 rounded-md border-white/10 bg-white/5 text-xs text-white"
                        placeholder="输入会话标题"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 rounded-full border-white/10 bg-white/5 text-[10px] text-white/80"
                          onClick={handleRenameSave}
                        >
                          保存
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 rounded-full text-[10px] text-white/60"
                          onClick={handleRenameCancel}
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="min-w-0 text-left"
                      onClick={() => handleSelectConversation(conv.id)}
                    >
                      <div className="flex items-center gap-1 truncate text-xs font-medium text-white">
                        {conv.is_pinned && (
                          <Icon icon="lucide:pin" width={12} height={12} />
                        )}
                        <span className="truncate">{conv.title || '未命名会话'}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-white/50">
                        更新于 {formatRelativeTime(conv.updated_at)}
                      </div>
                    </button>
                  )}
                </div>
                {renamingId !== conv.id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-white/50 hover:text-white"
                      >
                        <Icon icon="lucide:more-vertical" width={12} height={12} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => handleStartRename(conv.id, conv.title)}>
                        重命名
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleTogglePin(conv.id, !conv.is_pinned)}>
                        {conv.is_pinned ? '取消置顶' : '置顶'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => deleteConversation.mutate(conv.id)}
                        className="text-rose-300"
                      >
                        删除会话
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div
        className={cn(
          'fixed right-4 top-[calc(var(--topbar-height)+16px)] z-40 h-[calc(100svh-var(--topbar-height)-32px)] w-[300px] transform rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-2xl backdrop-blur-2xl transition-transform duration-300 ease-out',
          contextOpen ? 'translate-x-0' : 'translate-x-[120%]',
          'lg:translate-x-0',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-white">知识上下文</div>
            <div className="text-xs text-white/50">来源与引用追踪</div>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setContextOpen(false)}
            className="text-white/60 lg:hidden"
          >
            <Icon icon="lucide:x" width={14} height={14} />
          </Button>
        </div>

        <div className="mt-4 space-y-4 overflow-y-auto pr-1" style={{ maxHeight: 'calc(100% - 44px)' }}>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
                  会话记忆
                </div>
                <div className="text-[11px] text-white/40">自动总结当前会话要点</div>
              </div>
              <Switch
                checked={memoryData?.memory_enabled ?? true}
                onCheckedChange={(checked) =>
                  activeConvId && updateMemory.mutate({ memory_enabled: checked })
                }
                disabled={!activeConvId}
              />
            </div>
            {memoryEditing ? (
              <Textarea
                value={memoryDraft}
                onChange={(e) => setMemoryDraft(e.target.value)}
                placeholder="输入会话记忆摘要..."
                rows={4}
                className="mt-3 min-h-[100px] resize-none border-white/10 bg-white/5 text-xs text-white placeholder:text-white/40"
              />
            ) : (
              <div className="mt-3 text-xs text-white/70 whitespace-pre-wrap">
                {memoryData?.memory_summary ? memoryData.memory_summary : '暂无记忆摘要。完成对话后将自动生成。'}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-white/10 bg-white/5 text-[10px] text-white/80"
                onClick={() => setMemoryEditing((prev) => !prev)}
                disabled={!activeConvId}
              >
                {memoryEditing ? '取消编辑' : '编辑记忆'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-white/10 bg-white/5 text-[10px] text-white/80"
                onClick={() => activeConvId && updateMemory.mutate({ memory_summary: '' })}
                disabled={!activeConvId}
              >
                清空记忆
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-white/10 bg-white/5 text-[10px] text-white/80"
                onClick={() => refreshMemory.mutate()}
                disabled={!activeConvId || refreshMemory.isPending}
              >
                重新生成
              </Button>
              {memoryEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full border-white/10 bg-white/10 text-[10px] text-white"
                  onClick={() => updateMemory.mutate({ memory_summary: memoryDraft })}
                  disabled={!activeConvId || updateMemory.isPending}
                >
                  保存
                </Button>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
                  知识库
                </div>
                <div className="text-[11px] text-white/40">
                  {focusMode === 'knowledge' ? '当前会话生效' : '切换到知识库模式后生效'}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={handleSelectAllKnowledge}
                  disabled={loadingKnowledge || knowledgeBases.length === 0}
                >
                  <Icon icon="lucide:check-check" width={14} height={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={handleClearKnowledge}
                  disabled={loadingKnowledge || knowledgeBases.length === 0}
                >
                  <Icon icon="lucide:minus" width={14} height={14} />
                </Button>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {loadingKnowledge ? (
                <div className="text-xs text-white/50">加载中...</div>
              ) : knowledgeBases.length === 0 ? (
                <div className="text-xs text-white/50">暂无知识库</div>
              ) : (
                knowledgeBases.map((kb) => {
                  const selected = selectedKbIds.includes(kb.id);
                  return (
                    <button
                      key={kb.id}
                      onClick={() => handleToggleKnowledge(kb.id)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg border px-2 py-1 text-left text-xs transition-colors',
                        selected
                          ? 'border-white/30 bg-white/10 text-white'
                          : 'border-white/10 bg-white/5 text-white/60 hover:border-white/30 hover:bg-white/10',
                      )}
                    >
                      <span className="truncate">{kb.name}</span>
                      <span className="text-[10px] text-white/50">
                        {selected ? '已选' : `${kb.document_count} 篇`}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
              最新引用
            </div>
            <div className="mt-2 space-y-3">
              {latestSources.length === 0 ? (
                <div className="text-xs text-white/50">暂无引用内容</div>
              ) : (
                latestSources.map((source, idx) => (
                  <div key={`${source.document_id}-${idx}`} className="rounded-lg border border-white/10 bg-white/5 p-2">
                    <div className="text-xs font-medium text-white/80">
                      {source.document_name}
                    </div>
                    <div className="mt-1 text-[11px] text-white/50 line-clamp-2">
                      {source.content_preview}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
              会话统计
            </div>
            <div className="mt-2 space-y-1 text-xs text-white/70">
              <div>回答次数：{usageSummary.assistantCount}</div>
              <div>累计 Tokens：{usageSummary.totalTokens > 0 ? usageSummary.totalTokens : '--'}</div>
              <div>
                平均耗时：
                {usageSummary.assistantCount > 0 && usageSummary.totalLatencyMs > 0
                  ? `${(usageSummary.totalLatencyMs / usageSummary.assistantCount / 1000).toFixed(1)}s`
                  : '--'}
              </div>
              <div className="text-[11px] text-white/50">
                模型分布：
                {Array.from(usageSummary.modelCounts.entries()).length === 0
                  ? ' --'
                  : ` ${Array.from(usageSummary.modelCounts.entries()).map(([model, count]) => `${formatModelLabel(model)} × ${count}`).join(' / ')}`}
              </div>
            </div>
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
  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth} 个月前`;
}

function formatLatency(latencyMs: number | null | undefined): string {
  if (!latencyMs) return '--';
  return `${(latencyMs / 1000).toFixed(1)}s`;
}

function formatCost(cost: number | null | undefined): string {
  if (cost === null || cost === undefined) return '--';
  return `$${cost.toFixed(4)}`;
}

function formatTokens(message: ChatMessage): string {
  if (typeof message.tokens_used === 'number') {
    return `${message.tokens_used}`;
  }
  if (typeof message.prompt_tokens === 'number' || typeof message.completion_tokens === 'number') {
    const prompt = message.prompt_tokens ?? 0;
    const completion = message.completion_tokens ?? 0;
    return `${prompt}/${completion}`;
  }
  return '--';
}

function formatModelLabel(provider: string | null | undefined): string {
  if (!provider) return '未知';
  if (provider === 'openai') return 'OpenAI';
  if (provider === 'claude') return 'Claude';
  if (provider === 'codex') return 'OpenAI';
  return provider;
}
