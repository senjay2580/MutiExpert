import { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';
import { cn } from '@/lib/utils';

// ======================== FAQ Data ========================

const faqCategories = [
  {
    category: '快速上手',
    icon: 'streamline-color:rocket-1',
    items: [
      {
        q: '如何创建第一个知识库？',
        a: '进入「知识库」页面，点击右上角「新建知识库」按钮，填写名称和行业分类即可创建。创建后可以上传文档来充实知识库内容。',
      },
      {
        q: '支持哪些文档格式？',
        a: '目前支持 PDF、Word（.docx）、Markdown（.md）、纯文本（.txt）以及网页链接。上传后系统会自动解析并建立索引。',
      },
      {
        q: '如何开始 AI 对话？',
        a: '进入任意知识库详情页，点击「开始对话」即可基于该知识库的内容与 AI 进行问答交互。',
      },
    ],
  },
  {
    category: '功能说明',
    icon: 'streamline-color:module-puzzle-3',
    items: [
      {
        q: '仪表盘展示了哪些数据？',
        a: '仪表盘汇总了知识库数量、文档总量、AI 对话数、跨域洞察等核心指标，以及文档上传趋势、AI 调用趋势、行业分布图表和知识图谱。',
      },
      {
        q: '定时任务可以做什么？',
        a: '定时任务支持配置 Cron 表达式，让 AI 按计划自动执行数据同步、报告生成、知识更新等工作，减少重复操作。',
      },
      {
        q: '知识图谱是什么？',
        a: '知识图谱以可视化网络的形式展示知识库之间的关联关系，帮助你发现跨行业的知识连接和洞察。',
      },
    ],
  },
  {
    category: '系统配置',
    icon: 'streamline-color:cog',
    items: [
      {
        q: '如何配置 AI 模型？',
        a: '进入「系统管理 > AI 模型配置」，添加模型供应商的 API Key，选择默认模型并调整参数（如温度、最大 Token 数）。',
      },
      {
        q: '如何连接飞书等第三方服务？',
        a: '进入「系统管理 > 第三方集成」，配置对应平台的 Webhook 地址即可实现消息推送和双向交互。',
      },
      {
        q: '数据保存在哪里？',
        a: '站点基础设置（名称、Logo 等）保存在浏览器本地。知识库数据、文档和对话记录保存在后端 PostgreSQL 数据库中。',
      },
    ],
  },
];

const allFaqItems = faqCategories.flatMap((cat) =>
  cat.items.map((item) => ({ ...item, category: cat.category })),
);

// ======================== FAQ Item ========================

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center gap-3 rounded-lg px-4 py-3.5 text-left transition-colors hover:bg-accent cursor-pointer group">
          <Icon
            icon="lucide:chevron-right"
            className={cn(
              'size-4 shrink-0 text-muted-foreground/50 transition-transform duration-200',
              open && 'rotate-90',
            )}
          />
          <span className="text-sm font-medium text-foreground">{q}</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-11 pb-3 text-sm leading-relaxed text-muted-foreground">
          {a}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ======================== Main Component ========================

export default function HelpCenterPage() {
  const siteName = useSiteSettingsStore((s) => s.siteName);
  const logoUrl = useSiteSettingsStore((s) => s.logoUrl);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return null;
    const kw = search.toLowerCase();
    return allFaqItems.filter(
      (item) => item.q.toLowerCase().includes(kw) || item.a.toLowerCase().includes(kw),
    );
  }, [search]);
  return (
    <div className="space-y-8">
      {/* ---- Hero Section ---- */}
      <section className="dashboard-hero -mx-6 px-6 pt-14 pb-10">
        <div className="grid-bg" />
        <div className="relative z-10 flex flex-col items-center text-center">
          <img src={logoUrl} alt={`${siteName} Logo`} className="h-14 w-14 mb-4 drop-shadow-lg" />
          <div className="hero-title-loader">
            {'帮助中心'.split('').map((ch, i) => (
              <span key={i} className="hero-letter">{ch}</span>
            ))}
            <div className="hero-glow" />
          </div>
          <p className="mt-3 text-base text-muted-foreground max-w-md leading-relaxed">
            快速了解 {siteName} 的功能和使用方法
          </p>

          {/* Search */}
          <div className="relative mt-8 w-full max-w-lg">
            <Icon
              icon="streamline-color:magnifying-glass"
              className="absolute left-4 top-1/2 -translate-y-1/2 size-5"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索常见问题..."
              className="pl-12 h-12 text-base rounded-2xl bg-background/90 backdrop-blur-sm border-border/60 shadow-lg"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <Icon icon="lucide:x" className="size-5" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ---- Search Results ---- */}
      {filtered !== null ? (
        <section>
          <p className="mb-3 text-sm text-muted-foreground">
            找到 {filtered.length} 条结果
          </p>
          {filtered.length > 0 ? (
            <Card className="py-0 divide-y">
              <CardContent className="p-0">
                {filtered.map((item) => (
                  <FaqItem key={item.q} q={item.q} a={item.a} />
                ))}
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Icon icon="lucide:search-x" className="size-10 mb-3 opacity-30" />
              <p className="text-sm">没有找到相关问题，试试其他关键词</p>
            </div>
          )}
        </section>
      ) : (
        /* ---- FAQ Categories ---- */
        <section className="grid gap-6">
          {faqCategories.map((cat) => (
            <div key={cat.category}>
              <div className="flex items-center gap-2 mb-3 px-1">
                <Icon icon={cat.icon} className="size-5" />
                <h2 className="text-sm font-semibold text-foreground">{cat.category}</h2>
              </div>
              <Card className="py-0 divide-y">
                <CardContent className="p-0">
                  {cat.items.map((item) => (
                    <FaqItem key={item.q} q={item.q} a={item.a} />
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}
        </section>
      )}

      {/* ---- Attachments ---- */}
      <section>
        <div className="flex items-center gap-2 mb-3 px-1">
          <Icon icon="streamline-color:attachment-1" className="size-5" />
          <h2 className="text-sm font-semibold text-foreground">相关附件</h2>
        </div>
        <Card className="py-0">
          <CardContent className="p-0 divide-y">
            {[
              { name: 'MutiExpert 使用手册.pdf', size: '2.4 MB', icon: 'streamline-color:pdf-1' },
              { name: 'API 接口文档 v1.0.pdf', size: '1.1 MB', icon: 'streamline-color:pdf-1' },
              { name: '快速上手指南.docx', size: '856 KB', icon: 'streamline-color:word' },
              { name: '数据导入模板.xlsx', size: '124 KB', icon: 'streamline-color:excel' },
            ].map((file) => (
              <div
                key={file.name}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50 cursor-pointer"
              >
                <Icon icon={file.icon} className="size-5 shrink-0" />
                <span className="text-sm font-medium text-foreground flex-1 truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{file.size}</span>
                <Icon icon="lucide:download" className="size-4 text-muted-foreground/50" />
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
