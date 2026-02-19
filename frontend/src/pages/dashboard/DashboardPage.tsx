import { BookOpen, FileText, TrendingUp, MessageSquare } from 'lucide-react';

const stats = [
  { label: '知识库总数', value: '12', icon: BookOpen, color: 'var(--accent)' },
  { label: '文档数量', value: '248', icon: FileText, color: 'var(--info)' },
  { label: '本月问答', value: '86', icon: MessageSquare, color: 'var(--success)' },
  { label: '知识增长', value: '+23%', icon: TrendingUp, color: 'var(--warning)' },
];

const recentActivities = [
  { text: '上传了《金融风控模型分析》', time: '10 分钟前', type: '文档上传' },
  { text: '与 AI 讨论了医疗行业趋势', time: '1 小时前', type: 'AI 对话' },
  { text: '新增了科技行业知识笔记', time: '3 小时前', type: '手动笔记' },
  { text: '收藏了法律法规解读链接', time: '昨天', type: '链接收藏' },
  { text: '上传了《教育行业白皮书》', time: '昨天', type: '文档上传' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-4 p-5 rounded-lg transition-colors"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'var(--accent-subtle)', color: stat.color }}
            >
              <stat.icon size={20} strokeWidth={1.8} />
            </div>
            <div>
              <div className="text-[12px] font-medium" style={{ color: 'var(--text-muted)' }}>
                {stat.label}
              </div>
              <div className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {stat.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div
        className="rounded-lg"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
      >
        <div
          className="px-5 py-3.5 text-[13px] font-semibold"
          style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-default)' }}
        >
          最近活动
        </div>
        <div>
          {recentActivities.map((activity, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-5 py-3 transition-colors"
              style={{
                borderBottom: i < recentActivities.length - 1 ? '1px solid var(--border-default)' : 'none',
                transitionDuration: 'var(--duration-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="text-[11px] font-medium px-2 py-0.5 rounded"
                  style={{ background: 'var(--accent-subtle)', color: 'var(--accent-text)' }}
                >
                  {activity.type}
                </span>
                <span className="text-[13px]" style={{ color: 'var(--text-primary)' }}>
                  {activity.text}
                </span>
              </div>
              <span className="text-[12px] shrink-0" style={{ color: 'var(--text-muted)' }}>
                {activity.time}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
