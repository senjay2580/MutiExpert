import { useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Upload, Link as LinkIcon, StickyNote } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const industryNames: Record<string, string> = {
  medical: '医疗健康', finance: '金融投资', legal: '法律法规', tech: '科技互联',
  education: '教育学术', engineering: '建筑工程', marketing: '市场营销', general: '通用知识',
};

export default function KnowledgeDetailPage() {
  const { industryId } = useParams();
  const navigate = useNavigate();
  const name = industryNames[industryId ?? ''] ?? '未知行业';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/knowledge')}
          className="p-1.5 rounded-md cursor-pointer transition-colors"
          style={{ color: 'var(--text-muted)', transitionDuration: 'var(--duration-fast)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <ArrowLeft size={18} strokeWidth={1.8} />
        </button>
        <h2 className="text-[16px] font-semibold" style={{ color: 'var(--text-primary)' }}>{name}</h2>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon: Upload, label: '上传文档', desc: 'PDF / Word / Markdown' },
          { icon: LinkIcon, label: '收藏链接', desc: '网页链接自动摘要' },
          { icon: StickyNote, label: '写笔记', desc: '手动记录知识' },
          { icon: FileText, label: '写文章', desc: 'AI 辅助撰写' },
        ].map((action) => (
          <button
            key={action.label}
            className="flex flex-col items-center gap-2 p-5 rounded-lg cursor-pointer transition-colors text-center"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', transitionDuration: 'var(--duration-fast)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
          >
            <action.icon size={22} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
            <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{action.label}</span>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{action.desc}</span>
          </button>
        ))}
      </div>

      {/* Empty state */}
      <div
        className="flex flex-col items-center justify-center py-16 rounded-lg"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
      >
        <FileText size={40} strokeWidth={1} style={{ color: 'var(--text-muted)' }} />
        <p className="mt-3 text-[13px]" style={{ color: 'var(--text-muted)' }}>
          暂无知识内容，点击上方按钮添加
        </p>
      </div>
    </div>
  );
}
