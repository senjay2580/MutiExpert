import { useMemo, useState, type KeyboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { chatService } from '@/services/chatService';
import { cn } from '@/lib/utils';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';
import { useAppStore } from '@/stores/useAppStore';
import type { ModelProvider } from '@/types';
import { ProviderIcon } from '@/components/composed/provider-icon';

type ModelConfig = {
  id: string;
  name: string;
  provider: string;
};

const quickPrompts = [
  { icon: 'streamline-color:lightbulb', text: '总结所有知识库的核心主题' },
  { icon: 'streamline-color:graph-arrow-increase', text: '输出 3 条可执行行动建议' },
  { icon: 'streamline-color:chat-bubble-text-square', text: '生成客户支持的标准回复' },
  { icon: 'streamline-color:module-puzzle-3', text: '发现跨行业的关联机会' },
  { icon: 'streamline-color:pen-draw', text: '整理一份 5 分钟简报' },
  { icon: 'streamline-color:ai-redo-spark', text: '优化当前方案的表达方式' },
];

export default function AIAssistantPage() {
  const [question, setQuestion] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const siteName = useSiteSettingsStore((s) => s.siteName);
  const brandName = siteName?.trim() ? siteName : 'MutiExpert';
  const currentModel = useAppStore((s) => s.currentModel);
  const normalizedCurrent = currentModel === 'codex' ? 'openai' : currentModel;
  const setCurrentModel = useAppStore((s) => s.setCurrentModel);

  const { data: knowledgeBases = [] } = useQuery({
    queryKey: ['knowledge-bases', 'all'],
    queryFn: () => knowledgeBaseService.list(),
  });

  const { data: modelConfigs = [], isLoading: loadingModels } = useQuery({
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  });

  const updateConversation = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; title?: string | null; is_pinned?: boolean }) =>
      chatService.updateConversation(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
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

  const handleStartRename = (id: string, title: string | null) => { setRenamingId(id); setRenameDraft(title || ''); };
  const handleRenameCancel = () => { setRenamingId(null); setRenameDraft(''); };
  const handleRenameSave = () => { if (renamingId) { updateConversation.mutate({ id: renamingId, title: renameDraft.trim() || null }); } handleRenameCancel(); };
  const handleTogglePin = (id: string, pin: boolean) => updateConversation.mutate({ id, is_pinned: pin });

  const handlePrompt = (text: string) => {
    setQuestion(text);
  };

  const handleSend = () => {
    const text = question.trim();
    if (!text) return;
    setQuestion('');
    navigate('/assistant/chat', { state: { initialPrompt: text } });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const currentModelName =
    modelConfigs.find((m) => m.id === normalizedCurrent)?.name
    || (loadingModels ? '加载模型中...' : '请选择模型');

  return (
    <div className="flex h-[calc(100svh-var(--topbar-height))]">
      {/* ── Main content ── */}
      <div className="relative flex-1 overflow-y-auto pb-6 pt-6">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-white via-amber-50/50 to-orange-50/30 dark:from-slate-950/70 dark:via-slate-900/40 dark:to-slate-950/80" />
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-50 [background:radial-gradient(circle_at_15%_12%,rgba(251,191,36,0.18),transparent_58%),radial-gradient(circle_at_82%_18%,rgba(255,237,213,0.25),transparent_58%),radial-gradient(circle_at_78%_60%,rgba(252,211,77,0.12),transparent_60%),radial-gradient(circle_at_52%_85%,rgba(254,243,199,0.20),transparent_60%)] dark:opacity-40" />

        {/* Background scrolling text */}
        <div className="bg-scroll-text" aria-hidden="true">
          <div className="bg-scroll-track">
            <div className="bg-scroll-row">
              <span>KNOWLEDGE</span><span>EXPERT</span><span>INSIGHT</span><span>WISDOM</span><span>INTELLIGENCE</span>
              <span>KNOWLEDGE</span><span>EXPERT</span><span>INSIGHT</span><span>WISDOM</span><span>INTELLIGENCE</span>
            </div>
            <div className="bg-scroll-row">
              <span>AI</span><span>MULTI</span><span>DISCOVER</span><span>ANALYZE</span><span>CREATE</span><span>INNOVATE</span>
              <span>AI</span><span>MULTI</span><span>DISCOVER</span><span>ANALYZE</span><span>CREATE</span><span>INNOVATE</span>
            </div>
            <div className="bg-scroll-row">
              <span>STRATEGY</span><span>GROWTH</span><span>VISION</span><span>FUTURE</span><span>CONNECT</span>
              <span>STRATEGY</span><span>GROWTH</span><span>VISION</span><span>FUTURE</span><span>CONNECT</span>
            </div>
          </div>
        </div>

        {/* Sidebar toggle in top-right */}
        {!sidebarOpen && (
          <div className="absolute right-4 top-4 z-10">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" onClick={() => setSidebarOpen(true)} className="rounded-full">
                    <Icon icon="lucide:panel-right-open" width={16} height={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">展开侧栏</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

      <div className="px-6 sm:px-8">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
           
          </div>

          <section className="relative mx-auto flex min-h-[320px] max-w-4xl flex-col items-center justify-center text-center">
            <div className="hero-title-loader mb-2" style={{ fontSize: '0.875rem', height: 'auto', fontWeight: 500 }}>
              {'全量知识库检索'.split('').map((ch, i) => (
                <span key={i} className="hero-letter">{ch}</span>
              ))}
              <div className="hero-glow" />
            </div>
            <div className="hero-brand-title mt-4" aria-label={brandName}>
              {brandName}
            </div>

            <div id="poda" className="ai-input-shell mt-6 w-full max-w-3xl">
              <div className="glow" aria-hidden="true" />
              <div className="darkBorderBg" aria-hidden="true" />
              <div className="white" aria-hidden="true" />
              <div className="border" aria-hidden="true" />
              <div id="main" className="ai-input-surface relative">
                <div className="ai-input-content space-y-4 pb-6">
                  <div>
                    <Textarea
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="输入问题，例如：请综合所有知识库，给我一份 2024 年行业趋势总结..."
                      className="ai-input-textarea min-h-[84px] resize-none border-none bg-transparent p-0 text-sm leading-relaxed shadow-none focus-visible:ring-0"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="ai-input-chip gap-1.5 rounded-full text-[11px] font-medium">
                            <ProviderIcon provider={normalizedCurrent} size={14} />
                            {currentModelName}
                            <Icon icon="lucide:chevron-down" width={10} height={10} className="opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                          <DropdownMenuLabel>选择模型</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {modelConfigs.length === 0 ? (
                            <DropdownMenuItem disabled className="text-muted-foreground">
                              {loadingModels ? '加载模型中...' : '暂无模型配置'}
                            </DropdownMenuItem>
                          ) : (
                            modelConfigs.map((model) => {
                              const isActive = model.id === normalizedCurrent;
                              return (
                                <DropdownMenuItem
                                  key={model.id}
                                  className="gap-2"
                                  onClick={() => setCurrentModel(model.id as ModelProvider)}
                                >
                                  <ProviderIcon provider={model.id} size={16} />
                                  <span className="flex-1">{model.name}</span>
                                  {isActive && <Icon icon="lucide:check" width={14} height={14} className="text-primary" />}
                                </DropdownMenuItem>
                              );
                            })
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Badge variant="secondary" className="ai-input-chip gap-1 rounded-full text-[10px]">
                        <Icon icon="streamline-color:open-book" width={10} height={10} />
                        {knowledgeBases.length} 个知识库
                      </Badge>
                    </div>
                    <div className="ai-input-muted ml-auto flex items-center gap-2 text-xs">
                      <span>Enter 发送 · Shift+Enter 换行</span>
                      <div className="filterBorder">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="ai-input-send rounded-xl"
                          disabled={!question.trim()}
                          onClick={handleSend}
                        >
                          <Icon icon="lucide:arrow-up" width={16} height={16} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {quickPrompts.map((prompt) => (
                <Button
                  key={prompt.text}
                  variant="outline"
                  size="sm"
                  className="rounded-full bg-white/70 text-xs text-foreground shadow-sm hover:bg-white dark:bg-slate-900/60 dark:hover:bg-slate-900"
                  onClick={() => handlePrompt(prompt.text)}
                >
                  <Icon icon={prompt.icon} width={14} height={14} />
                  {prompt.text}
                </Button>
              ))}
            </div>
          </section>
        </div>
      </div>
      </div>

      {/* ── Right sidebar: conversation history ── */}
      <div className={cn(
        'ai-sidebar-weather relative h-full shrink-0 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.15,0.83,0.66,1)]',
        sidebarOpen ? 'w-[300px] opacity-100' : 'w-0 opacity-0',
      )}>
        <div className={cn(
          'relative z-10 flex h-full w-[300px] flex-col p-4 transition-transform duration-500 ease-[cubic-bezier(0.15,0.83,0.66,1)]',
          sidebarOpen ? 'translate-x-0' : 'translate-x-full',
        )}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className={cn(
                'flex size-8 items-center justify-center rounded-lg',
                filteredConversations.length > 0 ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground',
              )}>
                <Icon icon="lucide:message-square" width={16} height={16} />
              </div>
              <div>
                <div className="sidebar-title text-sm font-semibold">会话历史</div>
                <div className="sidebar-subtitle text-[11px]">管理最近对话</div>
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

          <div className="mt-3">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索会话..."
              className="h-8 rounded-full text-xs"
            />
          </div>
          {searchingConversations && trimmedSearch && <div className="mt-2 text-[11px] text-muted-foreground">搜索中...</div>}

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
                  className="group flex items-start gap-2 rounded-lg border border-transparent px-3 py-2 transition-colors hover:bg-muted/50"
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
                      <button className="min-w-0 text-left" onClick={() => navigate(`/assistant/chat/${conv.id}`)}>
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
