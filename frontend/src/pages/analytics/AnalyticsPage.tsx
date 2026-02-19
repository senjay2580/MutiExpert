import { useQuery, useMutation } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Lightbulb, Loader2, Send } from 'lucide-react';
import { dashboardService } from '../../services/dashboardService';
import { networkService } from '../../services/networkService';

const tooltipStyle = {
  contentStyle: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-default)',
    borderRadius: 8,
    fontSize: 12,
    boxShadow: 'var(--shadow-md)',
  },
};

export default function AnalyticsPage() {
  const { data: heatmap = [], isLoading: loadingHeatmap } = useQuery({
    queryKey: ['dashboard-heatmap'],
    queryFn: dashboardService.getKnowledgeHeatmap,
  });

  const { data: insights = [], isLoading: loadingInsights } = useQuery({
    queryKey: ['insights'],
    queryFn: networkService.listInsights,
  });

  const scanMutation = useMutation({
    mutationFn: networkService.scan,
  });

  const pushMutation = useMutation({
    mutationFn: networkService.pushToFeishu,
  });

  return (
    <div className="space-y-6">
      {/* Chart */}
      <div
        className="rounded-xl p-5"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
      >
        <div className="text-[13px] font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          各知识库文档分布
        </div>
        {loadingHeatmap ? (
          <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
        ) : heatmap.length === 0 ? (
          <div className="text-center py-12 text-[12px]" style={{ color: 'var(--text-muted)' }}>暂无数据</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={heatmap} barSize={32}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} name="文档数" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Insights */}
      <div
        className="rounded-xl"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: '1px solid var(--border-default)' }}
        >
          <div className="flex items-center gap-2">
            <Lightbulb size={16} strokeWidth={1.8} style={{ color: 'var(--warning)' }} />
            <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>跨行业知识洞察</span>
          </div>
          <button
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            className="text-[12px] px-3 py-1.5 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
          >
            {scanMutation.isPending ? '扫描中...' : '扫描洞察'}
          </button>
        </div>
        {loadingInsights ? (
          <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
        ) : insights.length === 0 ? (
          <div className="py-8 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>暂无洞察，点击扫描生成</div>
        ) : (
          <div>
            {insights.map((insight, i) => (
              <div
                key={insight.id}
                className="flex items-center gap-4 px-5 py-4 transition-colors group"
                style={{ borderBottom: i < insights.length - 1 ? '1px solid var(--border-default)' : 'none' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{insight.title}</div>
                  <div className="text-[12px] mt-1 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{insight.content}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full"
                    style={{ background: insight.status === 'pushed_to_feishu' ? 'var(--success-subtle)' : 'var(--bg-sunken)', color: insight.status === 'pushed_to_feishu' ? 'var(--success)' : 'var(--text-muted)' }}
                  >
                    {insight.status === 'pushed_to_feishu' ? '已推送' : '新'}
                  </span>
                  {insight.status !== 'pushed_to_feishu' && (
                    <button
                      onClick={() => pushMutation.mutate(insight.id)}
                      className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      style={{ color: 'var(--text-muted)' }}
                      title="推送到飞书"
                    >
                      <Send size={13} strokeWidth={1.8} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
