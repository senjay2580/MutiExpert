import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@iconify/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { KnowledgeGraphView } from '@/components/dashboard/KnowledgeGraphView';
import { cn } from '@/lib/utils';
import { dashboardService } from '@/services/dashboardService';
import { networkService } from '@/services/networkService';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';
import {
  BarChart,
  Bar,
  XAxis,
  CartesianGrid,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Label,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ======================== Stat Card Config ========================

const statCards = [
  {
    key: 'total_knowledge_bases' as const,
    label: '知识库总数',
    icon: 'streamline-color:open-book',
    glow: 'card-glow-indigo',
  },
  {
    key: 'total_documents' as const,
    label: '文档总量',
    icon: 'streamline-color:new-file',
    glow: 'card-glow-blue',
  },
  {
    key: 'total_conversations' as const,
    label: 'AI 对话数',
    icon: 'streamline-color:chat-bubble-text-square',
    glow: 'card-glow-emerald',
  },
  {
    key: 'total_insights' as const,
    label: '跨域洞察',
    icon: 'streamline-color:lightbulb',
    glow: 'card-glow-amber',
  },
];

const barChartConfig = {
  local_ai: { label: '本地 AI', color: 'var(--color-chart-1)' },
  feishu: { label: '飞书交互', color: 'var(--color-chart-2)' },
} as const;

const CHART_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
];

function formatMonth(ym: string) {
  const m = parseInt(ym.split('-')[1], 10);
  return `${m}月`;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

// ======================== Chart Tooltip ========================

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-sm">
          <span className="size-2.5 rounded-full" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}</span>
          <span className="ml-auto font-medium tabular-nums text-foreground">
            {entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ======================== Main Component ========================

export default function DashboardPage() {
  const [activeChart, setActiveChart] = useState<'local_ai' | 'feishu'>('local_ai');
  const siteName = useSiteSettingsStore((s) => s.siteName);
  const siteSubtitle = useSiteSettingsStore((s) => s.siteSubtitle);
  const logoUrl = useSiteSettingsStore((s) => s.logoUrl);
  const showHero = useSiteSettingsStore((s) => s.showDashboardHero);

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: dashboardService.getOverview,
  });

  const { data: graphData, isLoading: loadingGraph } = useQuery({
    queryKey: ['knowledge-network', 'graph'],
    queryFn: () => networkService.getGraph(),
  });

  const { data: usageTrend } = useQuery({
    queryKey: ['dashboard', 'usage-trend'],
    queryFn: () => dashboardService.getUsageTrend(),
  });

  const { data: aiModelTrend } = useQuery({
    queryKey: ['dashboard', 'ai-model-trend'],
    queryFn: () => dashboardService.getAIModelTrend(),
  });

  const { data: industryDist } = useQuery({
    queryKey: ['dashboard', 'industry-distribution'],
    queryFn: dashboardService.getIndustryDistribution,
  });

  const { data: timeline } = useQuery({
    queryKey: ['dashboard', 'activity-timeline'],
    queryFn: dashboardService.getActivityTimeline,
  });

  const barData = useMemo(
    () => (usageTrend ?? []).map((d) => ({ ...d, month: formatMonth(d.month) })),
    [usageTrend],
  );

  const barTotals = useMemo(
    () => ({
      local_ai: barData.reduce((acc, d) => acc + d.local_ai, 0),
      feishu: barData.reduce((acc, d) => acc + d.feishu, 0),
    }),
    [barData],
  );

  const areaData = useMemo(
    () => (aiModelTrend ?? []).map((d) => ({ ...d, month: formatMonth(d.month) })),
    [aiModelTrend],
  );

  const pieData = useMemo(
    () =>
      (industryDist ?? []).map((d, i) => ({
        ...d,
        fill: d.color || CHART_COLORS[i % CHART_COLORS.length],
      })),
    [industryDist],
  );

  const pieTotal = useMemo(() => pieData.reduce((acc, d) => acc + d.value, 0), [pieData]);

  return (
    <div className="space-y-8">
      {/* ---- Hero Section with Grid Background ---- */}
      {showHero && (
      <section className="dashboard-hero -mx-6 px-6 pt-16 pb-12">
        <div className="grid-bg" />
        <div className="relative z-10 flex flex-col items-center text-center">
          <img src={logoUrl} alt={`${siteName} Logo`} className="h-16 w-16 mb-5 drop-shadow-lg" />
          <div className="hero-title-loader">
            {siteName.split('').map((ch, i) => (
              <span key={i} className="hero-letter">{ch}</span>
            ))}
            <div className="hero-glow" />
          </div>
          <p className="mt-4 text-lg text-muted-foreground max-w-lg leading-relaxed">
            {siteSubtitle ? `你的${siteSubtitle}` : ''}
          </p>
        </div>
      </section>
      )}

      {/* ---- KPI Stats ---- */}
      <section>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((stat) => (
              <Card key={stat.key} className={cn('gap-0 py-0', stat.glow)}>
                <CardHeader className="px-6 pt-6 pb-2">
                  <CardDescription>{stat.label}</CardDescription>
                  <CardAction>
                    <div className="flex size-10 items-center justify-center rounded-xl border bg-muted/30 shadow-sm">
                      <Icon icon={stat.icon} className="size-5" aria-hidden="true" />
                    </div>
                  </CardAction>
                  <CardTitle className="text-2xl tabular-nums">
                    {loadingOverview ? (
                      <Skeleton className="h-7 w-16 rounded-md" />
                    ) : (
                      overview?.[stat.key]?.toLocaleString() ?? '--'
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-6" />
              </Card>
          ))}
        </div>
      </section>

      {/* ---- Row 2: Bar Chart + Recent Activity ---- */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        {/* Interactive Bar Chart — Usage Trend */}
        <Card className="gap-0 py-0 card-glow-blue">
          <CardHeader className="flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
            <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
              <CardTitle className="text-base">使用趋势</CardTitle>
              <CardDescription>本地 AI 与飞书交互次数</CardDescription>
            </div>
            <div className="flex">
              {(['local_ai', 'feishu'] as const).map((key) => (
                <button
                  key={key}
                  data-active={activeChart === key}
                  className="relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l data-[active=true]:bg-muted/50 sm:border-l sm:border-t-0 sm:px-8 sm:py-6"
                  onClick={() => setActiveChart(key)}
                >
                  <span className="text-xs text-muted-foreground">{barChartConfig[key].label}</span>
                  <span className="text-lg font-bold leading-none sm:text-3xl">
                    {barTotals[key].toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="px-2 pt-4 sm:p-6 sm:pt-4">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} stroke="var(--color-muted-foreground)" />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-muted)', opacity: 0.3 }} />
                  <Bar dataKey={activeChart} fill={barChartConfig[activeChart].color} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
          <CardFooter className="flex-col items-start gap-2 px-6 pb-6 text-sm">
            <div className="leading-none text-muted-foreground">近 6 个月使用总量</div>
          </CardFooter>
        </Card>

        {/* Recent Activity */}
        <Card className="gap-0 py-0 card-glow-emerald">
          <CardHeader className="px-6 py-5 sm:py-6">
            <CardTitle className="text-base">最近动态</CardTitle>
            <CardDescription>最新操作记录</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="space-y-6">
              {(timeline ?? []).slice(0, 6).map((item) => {
                const isDoc = item.type === 'document';
                const initials = isDoc ? '文' : '话';
                return (
                  <div key={item.id} className="flex items-center gap-4">
                    <Avatar className="size-9">
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm font-medium leading-none">{item.title}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {isDoc ? '文档' : '对话'}{item.status ? ` · ${item.status}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(item.time)}</span>
                  </div>
                );
              })}
              {(!timeline || timeline.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">暂无动态</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ---- Row 3: Area Chart + Pie Chart ---- */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        {/* Area Chart — AI Call Trends */}
        <Card className="gap-0 py-0 card-glow-violet">
          <CardHeader className="px-6 py-5 sm:py-6">
            <CardTitle className="text-base">AI 调用趋势</CardTitle>
            <CardDescription>近 6 个月各模型调用量</CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:p-6 sm:pt-0">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={areaData}>
                  <defs>
                    <linearGradient id="fillClaude" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="fillOpenai" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-chart-2)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="var(--color-chart-2)" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} stroke="var(--color-muted-foreground)" />
                  <Tooltip content={<ChartTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                  <Area dataKey="openai" name="OpenAI" type="natural" fill="url(#fillOpenai)" stroke="var(--color-chart-2)" stackId="a" />
                  <Area dataKey="claude" name="Claude" type="natural" fill="url(#fillClaude)" stroke="var(--color-chart-1)" stackId="a" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
          <CardFooter className="flex-col items-start gap-2 px-6 pb-6 text-sm">
            <div className="leading-none text-muted-foreground">按月统计各模型 AI 调用次数</div>
          </CardFooter>
        </Card>

        {/* Pie Chart — Industry Distribution */}
        <Card className="flex flex-col gap-0 py-0 card-glow-amber">
          <CardHeader className="items-center px-6 py-5 pb-0 sm:py-6 sm:pb-0">
            <CardTitle className="text-base">知识库行业分布</CardTitle>
            <CardDescription>按行业统计知识库数量</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 items-center pb-0">
            <div className="mx-auto aspect-square max-h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0];
                      return (
                        <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="size-2.5 rounded-full" style={{ background: String(d.payload?.fill) }} />
                            <span className="text-muted-foreground">{d.name}</span>
                            <span className="ml-auto font-medium tabular-nums">{Number(d.value)} 个</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} strokeWidth={5} stroke="var(--color-card)">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                    <Label
                      content={({ viewBox }) => {
                        if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                          return (
                            <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                              <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-3xl font-bold">
                                {pieTotal}
                              </tspan>
                              <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-muted-foreground text-sm">
                                知识库
                              </tspan>
                            </text>
                          );
                        }
                      }}
                    />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
          <CardFooter className="flex-col items-start gap-2 px-6 pb-6 text-sm">
            <div className="leading-none text-muted-foreground">
              覆盖 {pieData.length} 个行业分类
            </div>
          </CardFooter>
        </Card>
      </section>

      {/* ---- Knowledge Graph ---- */}
      <section>
        <Card className="gap-0 py-0 card-glow-cyan">
          <CardHeader className="px-6 pt-6 pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Icon icon="streamline-color:hierarchy-2" width={20} height={20} />
              知识图谱
            </CardTitle>
            <p className="text-sm text-muted-foreground">可视化展示知识库之间的关联网络</p>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loadingGraph ? (
              <div className="flex items-center justify-center" style={{ height: 400 }}>
                <div className="flex flex-col items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-4 w-32 rounded-md" />
                </div>
              </div>
            ) : (
              <KnowledgeGraphView graphData={graphData ?? { nodes: [], edges: [] }} className="rounded-lg" />
            )}
          </CardContent>
        </Card>
      </section>

    </div>
  );
}
