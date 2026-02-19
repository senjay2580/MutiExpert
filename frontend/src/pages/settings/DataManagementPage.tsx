import { Download, Upload, Database, RefreshCw } from 'lucide-react';

export default function DataManagementPage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[16px] font-semibold" style={{ color: 'var(--text-primary)' }}>数据管理</h3>
        <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>管理知识库数据的导入导出和备份恢复</p>
      </div>

      {/* Database Status */}
      <div
        className="rounded-lg p-5"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <Database size={18} strokeWidth={1.8} style={{ color: 'var(--accent)' }} />
          <span className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>数据库状态</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: '知识库', value: '8 个行业' },
            { label: '文档总数', value: '248 篇' },
            { label: '向量索引', value: '12,480 条' },
          ].map((item) => (
            <div key={item.label} className="p-3 rounded-md" style={{ background: 'var(--bg-sunken)' }}>
              <div className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>{item.label}</div>
              <div className="text-[16px] font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Download, label: '导出数据', desc: '导出所有知识库数据为 JSON', color: 'var(--info)' },
          { icon: Upload, label: '导入数据', desc: '从 JSON 文件导入知识库', color: 'var(--success)' },
          { icon: RefreshCw, label: '重建索引', desc: '重新生成向量索引', color: 'var(--warning)' },
        ].map((action) => (
          <button
            key={action.label}
            className="flex flex-col items-center gap-3 p-6 rounded-lg cursor-pointer transition-colors text-center"
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
