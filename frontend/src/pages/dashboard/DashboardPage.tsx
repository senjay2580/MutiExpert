import { useQuery } from '@tanstack/react-query';
import { BookOpen, FileText, MessageSquare, Lightbulb, Loader2, Clock } from 'lucide-react';
import { dashboardService } from '../../services/dashboardService';

export default function DashboardPage() {
  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: dashboardService.getOverview,
  });

  const { data: aiUsage } = useQuery({
    queryKey: ['dashboard-ai-usage'],
    queryFn: dashboardService.getAIUsage,
  });

  const { data: timeline = [], isLoading: loadingTimeline } = useQuery({
    queryKey: ['dashboard-timeline'],
    queryFn: dashboardService.getActivityTimeline,
  });

  const { data: heatmap = [] } = useQuery({
    queryKey: ['dashboard-heatmap'],
    queryFn: dashboardService.getKnowledgeHeatmap,
  });

  const stats = [
    { label: '知识库', value: overview?.total_knowledge_bases ?? '-', icon: BookOpen, color: 'var(--accent)' },
    { label: '文档数', value: overview?.total_documents ?? '-', icon: FileText, color: 'var(--info)' },
    { label: '对话数', value: overview?.total_conversations ?? '-', icon: MessageSquare, color: 'var(--success)' },
    { label: '洞察数', value: overview?.total_insights ?? '-', icon: Lightbulb, color: 'var(--warning)' },
  ];

  if (loadingOverview) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-xl transition-colors"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
          >
            <div
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'var(--accent-subtle)', color: stat.color }}
            >
              <stat.icon size={18} strokeWidth={1.8} />
            </div>
            <div>
              <div className="text-[11px] sm:text-[12px] font-medium" style={{ color: 'var(--text-muted)' }}>
                {stat.label}
              </div>
              <div className="text-[20px] sm:text-[22px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {stat.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* AI Usage */}
        {aiUsage && (
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
          >
            <div className="text-[13px] font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>AI 使用统计</div>
            <div className="space-y-3">
              <UsageRow label="Claude 调用" value={aiUsage.claude_calls} />
              <UsageRow label="OpenAI 调用" value={aiUsage.openai_calls} />
              <UsageRow label="总 Token" value={formatNumber(aiUsage.total_tokens)} />
            </div>
          </div>
        )}

        {/* Knowledge Heatmap */}
        {heatmap.length > 0 && (
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
          >
            <div className="text-[13px] font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>知识库分布</div>
            <div className="space-y-2">
              {heatmap.map((item) => (
                <HeatmapBar key={item.id} name={item.name} count={item.count} max={Math.max(...heatmap.map(h => h.count), 1)} />
              ))}
            </div>
          </div>
        )}

        {/* Activity Timeline */}
        <div
          className="rounded-xl lg:col-span-1"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
        >
          <div className="px-5 py-3.5 text-[13px] font-semibold" style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-default)' }}>
            最近活动
          </div>
          {loadingTimeline ? (
            <div className="flex justify-center py-8">
              <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
          ) : timeline.length === 0 ? (
            <div className="py-8 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>暂无活动</div>
          ) : (
            <div>
              {timeline.map((item, i) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-5 py-3 transition-colors"
                  style={{ borderBottom: i < timeline.length - 1 ? '1px solid var(--border-default)' : 'none' }}
                >
                  <Clock size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span className="text-[12px] flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>{item.title}</span>
                  <span className="text-[11px] shrink-0" style={{ color: 'var(--text-muted)' }}>{item.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UsageRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function HeatmapBar({ name, count, max }: { name: string; count: number; max: number }) {
  const pct = Math.round((count / max) * 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] truncate" style={{ color: 'var(--text-secondary)' }}>{name}</span>
        <span className="text-[11px] font-medium shrink-0 ml-2" style={{ color: 'var(--text-muted)' }}>{count}</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: 'var(--bg-sunken)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
      </div>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}
