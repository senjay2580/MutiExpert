import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Plus, FolderOpen, ChevronRight, Loader2, BookOpen, Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import { industryService } from '../../services/industryService';
import { knowledgeBaseService } from '../../services/knowledgeBaseService';
import type { KnowledgeBase } from '../../types';

export default function KnowledgePage() {
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateKB, setShowCreateKB] = useState(false);
  const [newKBName, setNewKBName] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: industries = [], isLoading: loadingInd } = useQuery({
    queryKey: ['industries'],
    queryFn: industryService.list,
  });

  const { data: knowledgeBases = [], isLoading: loadingKB } = useQuery({
    queryKey: ['knowledge-bases', selectedIndustry],
    queryFn: () => knowledgeBaseService.list(selectedIndustry ?? undefined),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; industry_id?: string }) => knowledgeBaseService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-bases'] });
      setShowCreateKB(false);
      setNewKBName('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: knowledgeBaseService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge-bases'] }),
  });

  const filtered = knowledgeBases.filter((kb) =>
    !searchQuery || kb.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 h-full">
      {/* Left: Industry Tree */}
      <div
        className="sm:w-52 shrink-0 rounded-xl overflow-y-auto"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
      >
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-default)' }}>
          <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>行业分类</span>
        </div>
        {loadingInd ? (
          <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
        ) : (
          <div className="py-1">
            <IndustryBtn label="全部" count={knowledgeBases.length} active={!selectedIndustry} onClick={() => setSelectedIndustry(null)} />
            {industries.map((ind) => (
              <IndustryBtn
                key={ind.id}
                label={ind.name}
                color={ind.color}
                active={selectedIndustry === ind.id}
                onClick={() => setSelectedIndustry(ind.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right: Knowledge Bases */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-3 mb-4 flex-wrap sm:flex-nowrap">
          <div
            className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border-default)' }}
          >
            <Search size={15} strokeWidth={1.8} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="搜索知识库..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-[13px]"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
          <button
            onClick={() => setShowCreateKB(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-colors shrink-0"
            style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
          >
            <Plus size={15} strokeWidth={2} />
            <span className="hidden sm:inline">新建知识库</span>
          </button>
        </div>

        {/* Create KB inline form */}
        {showCreateKB && (
          <div
            className="flex items-center gap-2 mb-4 p-3 rounded-xl"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--accent)' }}
          >
            <input
              autoFocus
              placeholder="知识库名称..."
              value={newKBName}
              onChange={(e) => setNewKBName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newKBName.trim()) createMutation.mutate({ name: newKBName.trim(), industry_id: selectedIndustry ?? undefined }); }}
              className="flex-1 bg-transparent border-none outline-none text-[13px]"
              style={{ color: 'var(--text-primary)' }}
            />
            <button
              onClick={() => { if (newKBName.trim()) createMutation.mutate({ name: newKBName.trim(), industry_id: selectedIndustry ?? undefined }); }}
              disabled={!newKBName.trim() || createMutation.isPending}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
            >
              {createMutation.isPending ? '创建中...' : '创建'}
            </button>
            <button
              onClick={() => { setShowCreateKB(false); setNewKBName(''); }}
              className="px-3 py-1.5 rounded-lg text-[12px] cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
            >
              取消
            </button>
          </div>
        )}

        {/* List */}
        {loadingKB ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <KBEmptyState />
        ) : (
          <div className="flex-1 rounded-xl overflow-y-auto divide-y" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderColor: 'var(--border-default)' }}>
            {filtered.map((kb) => (
              <KBRow key={kb.id} kb={kb} onOpen={() => navigate(`/knowledge/${kb.id}`)} onDelete={() => { if (confirm('确定删除？')) deleteMutation.mutate(kb.id); }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function IndustryBtn({ label, color, count, active, onClick }: { label: string; color?: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-2.5 px-4 py-2 text-[13px] font-medium cursor-pointer transition-colors',
        active ? 'text-[var(--accent-text)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
      )}
      style={{ background: active ? 'var(--accent-subtle)' : 'transparent', transitionDuration: 'var(--duration-fast)' }}
    >
      {color ? <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} /> : <FolderOpen size={15} strokeWidth={1.8} />}
      <span className="truncate">{label}</span>
      {count !== undefined && <span className="ml-auto text-[11px]" style={{ color: 'var(--text-muted)' }}>{count}</span>}
    </button>
  );
}

function KBEmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
        <BookOpen size={24} strokeWidth={1.5} />
      </div>
      <p className="text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>还没有知识库</p>
      <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>点击上方按钮创建第一个知识库</p>
    </div>
  );
}

function KBRow({ kb, onOpen, onDelete }: { kb: KnowledgeBase; onOpen: () => void; onDelete: () => void }) {
  return (
    <div
      className="flex items-center gap-3 sm:gap-4 px-4 py-3 sm:px-5 sm:py-4 cursor-pointer transition-colors group"
      style={{ transitionDuration: 'var(--duration-fast)' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      onClick={onOpen}
    >
      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
        <BookOpen size={16} strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{kb.name}</div>
        {kb.description && <div className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{kb.description}</div>}
      </div>
      <span className="text-[11px] shrink-0 px-2 py-0.5 rounded" style={{ background: 'var(--bg-sunken)', color: 'var(--text-muted)' }}>
        {kb.document_count} 篇
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--error)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
      >
        <Trash2 size={14} strokeWidth={1.8} />
      </button>
      <ChevronRight size={16} className="hidden sm:block" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    </div>
  );
}
