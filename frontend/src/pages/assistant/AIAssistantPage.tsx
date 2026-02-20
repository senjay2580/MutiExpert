import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const queryClient = useQueryClient();
  const siteName = useSiteSettingsStore((s) => s.siteName);
  const brandName = siteName?.trim() ? siteName : 'MutiExpert';
  const currentModel = useAppStore((s) => s.currentModel);
  const normalizedCurrent = currentModel === 'codex' ? 'openai' : currentModel;
  const setCurrentModel = useAppStore((s) => s.setCurrentModel);

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

  const deleteConversation = useMutation({
    mutationFn: chatService.deleteConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (activeConvId && activeConvId === deleteConversation.variables) {
        setActiveConvId(null);
      }
    },
  });

  const conversations = useMemo(
    () =>
      [...rawConversations].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      ),
    [rawConversations],
  );

  const handlePrompt = (text: string) => {
    setQuestion(text);
  };

  const handleSend = () => {
    if (!question.trim()) return;
    setQuestion('');
  };

  const currentModelName =
    modelConfigs.find((m) => m.id === normalizedCurrent)?.name
    || (normalizedCurrent === 'openai' ? 'OpenAI' : 'Claude');

  return (
    <div className="relative min-h-[calc(100svh-var(--topbar-height))] pb-6 pt-6">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-amber-50/80 via-rose-50/70 to-amber-100/70 dark:from-slate-950/70 dark:via-slate-900/40 dark:to-slate-950/80" />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-70 [background:radial-gradient(circle_at_20%_10%,rgba(251,191,36,0.22),transparent_55%),radial-gradient(circle_at_80%_15%,rgba(244,114,182,0.18),transparent_55%),radial-gradient(circle_at_78%_72%,rgba(59,130,246,0.18),transparent_60%),radial-gradient(circle_at_50%_80%,rgba(56,189,248,0.12),transparent_60%)] dark:opacity-40" />

      <div className="px-6 sm:px-8">
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold text-foreground">全域知识问答</h1>
              </div>
            </div>

            <section className="relative mx-auto flex min-h-[320px] max-w-4xl flex-col items-center justify-center text-center">
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] font-medium">
                全量知识库检索
              </Badge>
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
                        placeholder="输入问题，例如：请综合所有知识库，给我一份 2024 年行业趋势总结..."
                        className="ai-input-textarea min-h-[84px] resize-none border-none bg-transparent p-0 text-sm leading-relaxed shadow-none focus-visible:ring-0"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="ai-input-chip gap-1 rounded-full text-[10px]">
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

      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed right-0 top-[calc(var(--topbar-height)+24px)] z-40 flex h-12 w-10 items-center justify-center rounded-l-xl border border-white/60 bg-white/70 text-muted-foreground shadow-lg backdrop-blur-xl transition-colors hover:text-foreground dark:border-white/10 dark:bg-slate-900/70"
        >
          <Icon icon="lucide:panel-right-open" width={16} height={16} />
        </button>
      )}

      <div
        className={cn(
          'fixed right-0 top-[var(--topbar-height)] z-40 h-[calc(100svh-var(--topbar-height))] w-[320px] transform transition-transform duration-300 ease-out',
          sidebarOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="h-full rounded-l-2xl border border-white/60 bg-white/70 p-4 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/70">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-slate-900/5 text-slate-600 dark:bg-white/10 dark:text-white/70">
                <Icon icon="lucide:message-square" width={16} height={16} />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">会话历史</div>
                <div className="text-xs text-muted-foreground">管理最近对话</div>
              </div>
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
                className="text-muted-foreground"
              >
                <Icon icon="lucide:x" width={14} height={14} />
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 rounded-full">
                  {knowledgeBases.length} 个知识库
                  <Icon icon="lucide:chevron-down" width={14} height={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>知识库列表</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {loadingKnowledge ? (
                  <DropdownMenuItem disabled>加载中...</DropdownMenuItem>
                ) : knowledgeBases.length === 0 ? (
                  <DropdownMenuItem disabled>尚未创建知识库</DropdownMenuItem>
                ) : (
                  knowledgeBases.map((kb) => (
                    <DropdownMenuItem key={kb.id} className="justify-between">
                      <span className="truncate">{kb.name}</span>
                      <span className="text-xs text-muted-foreground">{kb.document_count} 篇</span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="sm" className="gap-1.5 rounded-full">
              <Icon icon="lucide:plus" width={14} height={14} />
              新建会话
            </Button>
          </div>

          <div className="mt-4 space-y-2 overflow-y-auto pr-1" style={{ maxHeight: 'calc(100% - 132px)' }}>
            {loadingConversations ? (
              <div className="text-xs text-muted-foreground">加载会话中...</div>
            ) : conversations.length === 0 ? (
              <div className="text-xs text-muted-foreground">暂无会话记录</div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    'group flex items-start gap-2 rounded-lg border border-white/40 bg-white/70 px-3 py-2 transition-colors hover:border-primary/30 hover:bg-white dark:border-white/10 dark:bg-slate-900/50',
                    activeConvId === conv.id && 'border-primary/50 bg-white dark:bg-slate-900',
                  )}
                >
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setActiveConvId(conv.id)}
                  >
                    <div className="truncate text-xs font-medium text-foreground">
                      {conv.title || '未命名会话'}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      更新于 {formatRelativeTime(conv.updated_at)}
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground/70 hover:text-destructive"
                    onClick={() => deleteConversation.mutate(conv.id)}
                    disabled={deleteConversation.isPending}
                  >
                    <Icon icon="lucide:trash-2" width={12} height={12} />
                  </Button>
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
  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth} 个月前`;
}
