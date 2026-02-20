import { useMemo, useState, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';
import { useAppStore } from '@/stores/useAppStore';
import { illustrationPresets } from '@/lib/illustrations';

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
  const navigate = useNavigate();
  const siteName = useSiteSettingsStore((s) => s.siteName);
  const brandName = siteName?.trim() ? siteName : 'MutiExpert';
  const currentModel = useAppStore((s) => s.currentModel);
  const normalizedCurrent = currentModel === 'codex' ? 'openai' : currentModel;
  const setCurrentModel = useAppStore((s) => s.setCurrentModel);

  const { data: knowledgeBases = [], isLoading: loadingKnowledge } = useQuery({
    queryKey: ['knowledge-bases', 'all'],
    queryFn: () => knowledgeBaseService.list(),
  });

  const { data: modelConfigs = [], isLoading: loadingModels } = useQuery({
    queryKey: ['ai-models'],
    queryFn: () => api.get<ModelConfig[]>('/config/models').then((r) => r.data),
  });

  const randomKnowledgeBases = useMemo(() => {
    const names = knowledgeBases
      .map((kb) => kb.name)
      .filter((name): name is string => Boolean(name?.trim()));
    if (names.length === 0) return [];
    const shuffled = [...names];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 5);
  }, [knowledgeBases]);

  const knowledgeTickerItems = useMemo(
    () => (randomKnowledgeBases.length ? [...randomKnowledgeBases, ...randomKnowledgeBases] : []),
    [randomKnowledgeBases],
  );

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
    <div className="relative min-h-[calc(100svh-var(--topbar-height))] pb-6 pt-6">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-orange-50/80 via-amber-50/80 to-yellow-100/80 dark:from-slate-950/70 dark:via-slate-900/40 dark:to-slate-950/80" />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-70 [background:radial-gradient(circle_at_15%_12%,rgba(251,191,36,0.28),transparent_58%),radial-gradient(circle_at_82%_18%,rgba(251,146,60,0.20),transparent_58%),radial-gradient(circle_at_78%_60%,rgba(248,113,113,0.18),transparent_60%),radial-gradient(circle_at_52%_85%,rgba(250,204,21,0.16),transparent_60%)] dark:opacity-40" />

      <div className="px-6 sm:px-8">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
           
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
                      onKeyDown={handleKeyDown}
                      placeholder="输入问题，例如：请综合所有知识库，给我一份 2024 年行业趋势总结..."
                      className="ai-input-textarea min-h-[84px] resize-none border-none bg-transparent p-0 text-sm leading-relaxed shadow-none focus-visible:ring-0"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        模型
                      </span>
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
                                  className="justify-between"
                                  onClick={() => setCurrentModel(model.id as 'claude' | 'openai' | 'codex')}
                                >
                                  <span>{model.name}</span>
                                  {isActive && <Icon icon="lucide:check" width={14} height={14} />}
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

            <div className="mt-6 w-full max-w-4xl">
              <div className={`ai-knowledge-ticker${knowledgeTickerItems.length === 0 ? ' ai-knowledge-empty-mode' : ''}`}>
                {loadingKnowledge ? (
                  <div className="ai-knowledge-empty">加载知识库中...</div>
                ) : knowledgeTickerItems.length === 0 ? (
                  <div className="ai-knowledge-empty">
                    <div className="ai-knowledge-empty-icon">
                      <img
                        src={illustrationPresets.emptyKnowledge}
                        alt="暂无知识库"
                        className="ai-knowledge-empty-illustration"
                      />
                    </div>
                    <span className="ai-knowledge-empty-text">暂无知识库可展示</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 gap-1.5 rounded-full text-xs"
                      onClick={() => navigate('/knowledge')}
                    >
                      <Icon icon="lucide:plus" width={14} height={14} />
                      新建知识库
                    </Button>
                  </div>
                ) : (
                  <div className="ai-knowledge-track" aria-label="随机知识库滚动展示">
                    {knowledgeTickerItems.map((name, index) => (
                      <span
                        key={`${name}-${index}`}
                        className="ai-knowledge-chip"
                        title={name}
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
