import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Lightbulb, TrendingUp, ArrowRight } from 'lucide-react';

const industryData = [
  { name: '科技', count: 56 },
  { name: '医疗', count: 42 },
  { name: '金融', count: 38 },
  { name: '教育', count: 31 },
  { name: '营销', count: 29 },
  { name: '法律', count: 25 },
  { name: '工程', count: 18 },
  { name: '通用', count: 15 },
];

const trendData = [
  { month: '9月', docs: 18, queries: 32 },
  { month: '10月', docs: 25, queries: 45 },
  { month: '11月', docs: 31, queries: 58 },
  { month: '12月', docs: 42, queries: 72 },
  { month: '1月', docs: 48, queries: 86 },
  { month: '2月', docs: 56, queries: 94 },
];

const insights = [
  { title: '医疗AI与金融风控的交叉应用', desc: '两个行业在数据隐私保护和模型可解释性方面有高度相似的需求', strength: 0.87 },
  { title: '教育与科技的融合趋势', desc: '在线教育平台的技术架构与SaaS产品有大量可复用的设计模式', strength: 0.82 },
  { title: '法律合规对所有行业的影响', desc: '数据保护法规的变化同时影响医疗、金融、科技三个行业的知识体系', strength: 0.75 },
];

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
  return (
    <div className="space-y-6">
      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Bar Chart */}
        <div
          className="rounded-lg p-5"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
        >
          <div className="text-[13px] font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            各行业知识分布
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={industryData} barSize={28}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Line Chart */}
        <div
          className="rounded-lg p-5"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
        >
          <div className="text-[13px] font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            知识增长趋势
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trendData}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="docs" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: 'var(--accent)' }} name="文档数" />
              <Line type="monotone" dataKey="queries" stroke="var(--info)" strokeWidth={2} dot={{ r: 3, fill: 'var(--info)' }} name="问答数" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cross-industry Insights */}
      <div
        className="rounded-lg"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
      >
        <div
          className="flex items-center gap-2 px-5 py-3.5"
          style={{ borderBottom: '1px solid var(--border-default)' }}
        >
          <Lightbulb size={16} strokeWidth={1.8} style={{ color: 'var(--warning)' }} />
          <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            跨行业知识洞察
          </span>
        </div>
        {insights.map((insight, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors"
            style={{
              borderBottom: i < insights.length - 1 ? '1px solid var(--border-default)' : 'none',
              transitionDuration: 'var(--duration-fast)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                {insight.title}
              </div>
              <div className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
                {insight.desc}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <TrendingUp size={14} style={{ color: 'var(--success)' }} />
              <span className="text-[12px] font-medium" style={{ color: 'var(--success)' }}>
                {Math.round(insight.strength * 100)}%
              </span>
              <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
