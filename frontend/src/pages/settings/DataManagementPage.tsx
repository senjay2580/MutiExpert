import { useQuery } from '@tanstack/react-query';
import { Download, Upload, Database, RefreshCw, Loader2 } from 'lucide-react';
import { dashboardService } from '../../services/dashboardService';

export default function DataManagementPage() {
  const { data: overview, isLoading } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: dashboardService.getOverview,
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[16px] font-semibold" style={{ color: 'var(--text-primary)' }}>数据管理</h3>
        <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>管理知识库数据的导入导出和备份恢复</p>
      </div>

      {/* Database Status */}
      <div
        className="rounded-xl p-5"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <Database size={18} strokeWidth={1.8} style={{ color: 'var(--accent)' }} />
          <span className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>数据库状态</span>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="知识库" value={overview?.total_knowledge_bases ?? 0} />
            <StatCard label="文档总数" value={overview?.total_documents ?? 0} />
            <StatCard label="对话数" value={overview?.total_conversations ?? 0} />
            <StatCard label="洞察数" value={overview?.total_insights ?? 0} />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: Download, label: '导出数据', desc: '导出所有知识库数据为 JSON', color: 'var(--info)' },
          { icon: Upload, label: '导入数据', desc: '从 JSON 文件导入知识库', color: 'var(--success)' },
          { icon: RefreshCw, label: '重建索引', desc: '重新生成向量索引', color: 'var(--warning)' },
        ].map((action) => (
          <button
            key={action.label}
            className="flex flex-col items-center gap-3 p-6 rounded-xl cursor-pointer transition-colors text-center"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', transitionDuration: 'var(--duration-fast)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
          >
            <action.icon size={24} strokeWidth={1.5} style={{ color: action.color }} />
            <div>
              <div className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{action.label}</div>
              <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{action.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-3 rounded-lg" style={{ background: 'var(--bg-sunken)' }}>
      <div className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-[18px] font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}
