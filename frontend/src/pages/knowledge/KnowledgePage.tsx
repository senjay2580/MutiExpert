import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Heart,
  Banknote,
  Scale,
  Cpu,
  GraduationCap,
  HardHat,
  Megaphone,
  FolderOpen,
  ChevronRight,
  FileText,
  Link as LinkIcon,
  StickyNote,
  BookOpen,
} from 'lucide-react';
import clsx from 'clsx';

interface Industry {
  id: string;
  name: string;
  icon: typeof Heart;
  color: string;
  knowledgeCount: number;
  description: string;
}

const industries: Industry[] = [
  { id: 'medical', name: '医疗健康', icon: Heart, color: 'var(--industry-medical)', knowledgeCount: 42, description: '医疗AI、健康管理、药物研发' },
  { id: 'finance', name: '金融投资', icon: Banknote, color: 'var(--industry-finance)', knowledgeCount: 38, description: '风控模型、量化交易、区块链' },
  { id: 'legal', name: '法律法规', icon: Scale, color: 'var(--industry-legal)', knowledgeCount: 25, description: '合规审查、合同分析、法律条文' },
  { id: 'tech', name: '科技互联', icon: Cpu, color: 'var(--industry-tech)', knowledgeCount: 56, description: 'AI技术、云计算、软件工程' },
  { id: 'education', name: '教育学术', icon: GraduationCap, color: 'var(--industry-education)', knowledgeCount: 31, description: '在线教育、学术研究、教学方法' },
  { id: 'engineering', name: '建筑工程', icon: HardHat, color: 'var(--industry-engineering)', knowledgeCount: 18, description: '建筑设计、工程管理、BIM技术' },
  { id: 'marketing', name: '市场营销', icon: Megaphone, color: 'var(--industry-marketing)', knowledgeCount: 29, description: '品牌策略、数字营销、用户增长' },
  { id: 'general', name: '通用知识', icon: FolderOpen, color: 'var(--industry-general)', knowledgeCount: 15, description: '跨行业通用方法论与工具' },
];

const knowledgeItems = [
  { id: '1', title: '金融风控模型深度解析', type: 'article', industry: 'finance', time: '2 小时前' },
  { id: '2', title: '医疗AI诊断系统白皮书.pdf', type: 'document', industry: 'medical', time: '昨天' },
  { id: '3', title: 'https://arxiv.org/abs/2024.xxxxx', type: 'link', industry: 'tech', time: '3 天前' },
  { id: '4', title: '合同审查要点笔记', type: 'note', industry: 'legal', time: '上周' },
  { id: '5', title: '数字营销ROI计算方法', type: 'article', industry: 'marketing', time: '上周' },
  { id: '6', title: '在线教育平台架构设计.docx', type: 'document', industry: 'education', time: '2 周前' },
];

const typeIcons: Record<string, typeof FileText> = {
  article: BookOpen,
  document: FileText,
  link: LinkIcon,
  note: StickyNote,
};

const typeLabels: Record<string, string> = {
  article: '文章',
  document: '文档',
  link: '链接',
  note: '笔记',
};

export default function KnowledgePage() {
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const filtered = selectedIndustry
    ? knowledgeItems.filter((k) => k.industry === selectedIndustry)
    : knowledgeItems;

  return (
    <div className="flex gap-6 h-[calc(100vh-var(--topbar-height)-var(--content-padding)*2)]">
      {/* Left: Industry Tree */}
      <div
        className="w-56 shrink-0 rounded-lg overflow-y-auto"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
      >
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-default)' }}>
          <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            行业分类
          </span>
        </div>
        <div className="py-1">
          <button
            onClick={() => setSelectedIndustry(null)}
            className={clsx(
              'w-full flex items-center gap-2.5 px-4 py-2 text-[13px] font-medium cursor-pointer transition-colors',
              !selectedIndustry ? 'text-[var(--accent-text)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
            style={{
              background: !selectedIndustry ? 'var(--accent-subtle)' : 'transparent',
              transitionDuration: 'var(--duration-fast)',
            }}
          >
            <FolderOpen size={16} strokeWidth={1.8} />
            <span>全部行业</span>
            <span className="ml-auto text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {knowledgeItems.length}
            </span>
          </button>
          {industries.map((ind) => (
            <button
              key={ind.id}
              onClick={() => setSelectedIndustry(ind.id)}
              className={clsx(
                'w-full flex items-center gap-2.5 px-4 py-2 text-[13px] font-medium cursor-pointer transition-colors',
                selectedIndustry === ind.id
                  ? 'text-[var(--accent-text)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
              style={{
                background: selectedIndustry === ind.id ? 'var(--accent-subtle)' : 'transparent',
                transitionDuration: 'var(--duration-fast)',
              }}
            >
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: ind.color }} />
              <span>{ind.name}</span>
              <span className="ml-auto text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {ind.knowledgeCount}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Knowledge Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border-default)' }}
          >
            <Search size={16} strokeWidth={1.8} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="搜索知识..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-[13px]"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-colors"
            style={{
              background: 'var(--accent)',
              color: 'var(--text-inverse)',
              transitionDuration: 'var(--duration-fast)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
          >
            <Plus size={16} strokeWidth={2} />
            添加知识
          </button>
        </div>

        {/* Knowledge List */}
        <div
          className="flex-1 rounded-lg overflow-y-auto"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
        >
          {filtered.map((item, i) => {
            const TypeIcon = typeIcons[item.type] ?? FileText;
            return (
              <div
                key={item.id}
                className="flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors"
                style={{
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--border-default)' : 'none',
                  transitionDuration: 'var(--duration-fast)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                onClick={() => navigate(`/knowledge/${item.industry}`)}
              >
                <TypeIcon size={18} strokeWidth={1.8} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {item.title}
                  </div>
                </div>
                <span
                  className="text-[11px] font-medium px-2 py-0.5 rounded shrink-0"
                  style={{ background: 'var(--bg-sunken)', color: 'var(--text-muted)' }}
                >
                  {typeLabels[item.type]}
                </span>
                <span className="text-[12px] shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {item.time}
                </span>
                <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

