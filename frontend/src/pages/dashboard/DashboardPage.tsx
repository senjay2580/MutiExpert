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
import { Badge } from '@/components/ui/badge';

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
    badge: '+12.5%',
    trend: 'up' as const,
    trendText: '本月新增 6 个知识库',
    footerText: '近 6 个月累计数据',
  },
  {
    key: 'total_documents' as const,
    label: '文档总量',
    icon: 'streamline-color:new-file',
    glow: 'card-glow-blue',
    badge: '+8.3%',
    trend: 'up' as const,
    trendText: '文档录入稳步增长',
    footerText: '本月新增 156 篇',
  },
  {
    key: 'total_conversations' as const,
    label: 'AI 对话数',
    icon: 'streamline-color:chat-bubble-text-square',
    glow: 'card-glow-emerald',
    badge: '+23.7%',
    trend: 'up' as const,
    trendText: '用户活跃度提升',
    footerText: '本月互动超出预期',
  },
  {
    key: 'total_insights' as const,
    label: '跨域洞察',
    icon: 'streamline-color:lightbulb',
    glow: 'card-glow-amber',
    badge: '+4.5%',
    trend: 'up' as const,
    trendText: '覆盖范围稳步扩大',
    footerText: '目标 85% 行业覆盖',
  },
];

// ======================== Mock Chart Data ========================

const barChartData = [
  { month: '1月', manual: 86, api: 45 },
  { month: '2月', manual: 125, api: 78 },
  { month: '3月', manual: 97, api: 62 },
  { month: '4月', manual: 143, api: 95 },
  { month: '5月', manual: 109, api: 88 },
  { month: '6月', manual: 156, api: 112 },
];

const barChartConfig = {
  manual: { label: '手动上传', color: 'var(--color-chart-1)' },
  api: { label: 'API 导入', color: 'var(--color-chart-2)' },
} as const;

const areaChartData = [
  { month: '1月', claude: 320, openai: 180 },
  { month: '2月', claude: 480, openai: 260 },
  { month: '3月', claude: 410, openai: 220 },
  { month: '4月', claude: 560, openai: 340 },
  { month: '5月', claude: 620, openai: 390 },
  { month: '6月', claude: 780, openai: 450 },
];

const pieChartData = [
  { name: '医疗健康', value: 12, fill: 'var(--color-chart-1)' },
  { name: '金融投资', value: 9, fill: 'var(--color-chart-2)' },
  { name: '法律合规', value: 8, fill: 'var(--color-chart-3)' },
  { name: '科技研发', value: 11, fill: 'var(--color-chart-4)' },
  { name: '教育培训', value: 8, fill: 'var(--color-chart-5)' },
];

const recentActivities = [
  { title: '上传了 3 份研究报告', kb: '医疗健康', time: '2 分钟前', initials: '医' },
  { title: '新建对话「投资策略分析」', kb: '金融投资', time: '15 分钟前', initials: '金' },
  { title: '导入合同模板 12 份', kb: '法律合规', time: '1 小时前', initials: '法' },
  { title: 'API 同步技术文档 8 篇', kb: '科技研发', time: '3 小时前', initials: '科' },
  { title: '创建知识库「K12 教材解析」', kb: '教育培训', time: '5 小时前', initials: '教' },
];

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
  const [activeChart, setActiveChart] = useState<'manual' | 'api'>('manual');
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

  const barTotals = useMemo(
    () => ({
      manual: barChartData.reduce((acc, d) => acc + d.manual, 0),
      api: barChartData.reduce((acc, d) => acc + d.api, 0),
    }),
    [],
  );

  const pieTotal = useMemo(
    () => pieChartData.reduce((acc, d) => acc + d.value, 0),
    [],
  );

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
          {statCards.map((stat) => {
            const trendIcon = stat.trend === 'up'
              ? 'streamline-color:graph-arrow-increase'
              : 'streamline-color:graph-arrow-decrease';
            return (
              <Card key={stat.key} className={cn('gap-0 py-0', stat.glow)}>
                <CardHeader className="px-6 pt-6 pb-2">
                  <CardDescription>{stat.label}</CardDescription>
                  <CardAction>
                    <div className="flex size-10 items-center justify-center rounded-xl border bg-muted/30 shadow-sm">
                      <Icon icon={stat.icon} className="size-5" aria-hidden="true" />
                    </div>
                  </CardAction>
                  <CardTitle className="flex items-baseline gap-2 text-2xl tabular-nums">
                    {loadingOverview ? (
                      <Skeleton className="h-7 w-16 rounded-md" />
                    ) : (
                      overview?.[stat.key]?.toLocaleString() ?? '--'
                    )}
                    <Badge
                      variant="outline"
                      className={cn(
                        'gap-1 rounded-lg text-xs font-medium',
                        stat.trend === 'up'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                          : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400',
                      )}
                    >
                      <Icon icon={trendIcon} className="size-3" />
                      {stat.badge}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-0" />
                <CardFooter className="flex-col items-start gap-1.5 px-6 pt-2 pb-6">
                  <div className="flex items-center gap-1 text-sm font-medium leading-none">
                    {stat.trendText}
                    <Icon icon={trendIcon} className="size-4" />
                  </div>
                  <p className="text-xs leading-none text-muted-foreground">{stat.footerText}</p>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ---- Row 2: Bar Chart + Recent Activity ---- */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        {/* Interactive Bar Chart */}
        <Card className="gap-0 py-0 card-glow-blue">
          <CardHeader className="flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
            <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
              <CardTitle className="text-base">文档上传趋势</CardTitle>
              <CardDescription>2024 年 1 月 - 6 月</CardDescription>
            </div>
            <div className="flex">
              {(['manual', 'api'] as const).map((key) => (
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
                <BarChart data={barChartData}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} stroke="var(--color-muted-foreground)" />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-muted)', opacity: 0.3 }} />
                  <Bar dataKey={activeChart} fill={barChartConfig[activeChart].color} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
          <CardFooter className="flex-col items-start gap-2 px-6 pb-6 text-sm">
            <div className="flex gap-2 font-medium leading-none">
              本月上传量环比增长 18.6%
              <Icon icon="streamline-color:graph-arrow-increase" className="size-4" />
            </div>
            <div className="leading-none text-muted-foreground">近 6 个月文档上传总量</div>
          </CardFooter>
        </Card>

        {/* Recent Activity */}
        <Card className="gap-0 py-0 card-glow-emerald">
          <CardHeader className="px-6 py-5 sm:py-6">
            <CardTitle className="text-base">最近动态</CardTitle>
            <CardDescription>今日共 12 条操作记录</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="space-y-6">
              {recentActivities.map((item) => (
                <div key={item.title} className="flex items-center gap-4">
                  <Avatar className="size-9">
                    <AvatarFallback className="text-xs">{item.initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-sm font-medium leading-none">{item.title}</p>
                    <p className="truncate text-sm text-muted-foreground">{item.kb}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{item.time}</span>
                </div>
              ))}
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
                <AreaChart data={areaChartData}>
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
            <div className="flex gap-2 font-medium leading-none">
              本月 AI 调用量增长 23.7%
              <Icon icon="streamline-color:graph-arrow-increase" className="size-4" />
            </div>
            <div className="leading-none text-muted-foreground">Claude 占比 63%，为主力模型</div>
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
                  <Pie data={pieChartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} strokeWidth={5} stroke="var(--color-card)">
                    {pieChartData.map((entry, i) => (
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
            <div className="flex items-center gap-2 font-medium leading-none">
              本月新增 3 个行业知识库
              <Icon icon="streamline-color:graph-arrow-increase" className="size-4" />
            </div>
            <div className="leading-none text-muted-foreground">覆盖 5 大行业，目标 8 个</div>
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
