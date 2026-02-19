import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, MessageSquare, Search, Trash2, Loader2, Bot, BookOpen } from 'lucide-react';
import { chatService } from '../../services/chatService';
import { knowledgeBaseService } from '../../services/knowledgeBaseService';
import type { Conversation } from '../../types';

export default function ChatListPage() {
  const [search, setSearch] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [selectedKbs, setSelectedKbs] = useState<string[]>([]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: chatService.listConversations,
  });

  const { data: knowledgeBases = [] } = useQuery({
    queryKey: ['knowledge-bases'],
    queryFn: () => knowledgeBaseService.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: chatService.deleteConversation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  });

  const createMutation = useMutation({
    mutationFn: () => chatService.createConversation({
      title: '',
      knowledge_base_ids: selectedKbs,
      model_provider: 'claude',
    }),
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setShowNewDialog(false);
      setSelectedKbs([]);
      navigate(`/chat/${conv.id}`);
    },
  });

  const toggleKb = (id: string) => {
    setSelectedKbs((prev) => prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]);
  };

  const filtered = conversations.filter((c) =>
    !search || c.title?.toLowerCase().includes(search.toLowerCase())
  );

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin} 分钟前`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} 小时前`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD} 天前`;
    return d.toLocaleDateString('zh-CN');
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
        <div
          className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border-default)' }}
        >
          <Search size={15} strokeWidth={1.8} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="搜索对话..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[13px]"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
        <button
          onClick={() => setShowNewDialog(true)}
          disabled={createMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-colors shrink-0 disabled:opacity-60"
          style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
        >
          {createMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} strokeWidth={2} />}
          <span className="hidden sm:inline">新建对话</span>
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasSearch={!!search} onCreate={() => createMutation.mutate()} />
      ) : (
        <div
          className="flex-1 rounded-xl overflow-y-auto divide-y"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderColor: 'var(--border-default)' }}
        >
          {filtered.map((conv) => (
            <ConversationRow
              key={conv.id}
              conv={conv}
              formatTime={formatTime}
              onOpen={() => navigate(`/chat/${conv.id}`)}
              onDelete={() => { if (confirm('确定删除这个对话？')) deleteMutation.mutate(conv.id); }}
            />
          ))}
        </div>
      )}

      {/* New conversation dialog */}
      {showNewDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowNewDialog(false)}>
          <div className="w-full max-w-md rounded-xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>新建对话</h3>
            <p className="text-[13px] mb-3" style={{ color: 'var(--text-secondary)' }}>选择要关联的知识库（可多选，也可跳过）</p>
            <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
              {knowledgeBases.map((kb) => (
                <label key={kb.id} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                  style={{ background: selectedKbs.includes(kb.id) ? 'var(--accent-subtle)' : 'var(--bg-sunken)', border: '1px solid var(--border-default)' }}>
                  <input type="checkbox" checked={selectedKbs.includes(kb.id)} onChange={() => toggleKb(kb.id)} className="accent-[var(--accent)]" />
                  <BookOpen size={14} style={{ color: 'var(--accent)' }} />
                  <span className="text-[13px]" style={{ color: 'var(--text-primary)' }}>{kb.name}</span>
                </label>
              ))}
              {knowledgeBases.length === 0 && (
                <p className="text-[12px] py-4 text-center" style={{ color: 'var(--text-muted)' }}>暂无知识库，可直接创建对话</p>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowNewDialog(false)}
                className="flex-1 py-2 rounded-lg text-[13px] font-medium cursor-pointer"
                style={{ background: 'var(--bg-sunken)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                取消
              </button>
              <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}
                className="flex-1 py-2 rounded-lg text-[13px] font-medium cursor-pointer disabled:opacity-50"
                style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}>
                {createMutation.isPending ? '创建中...' : '开始对话'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ hasSearch, onCreate }: { hasSearch: boolean; onCreate: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
      >
        <Bot size={24} strokeWidth={1.5} />
      </div>
      <p className="text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>
        {hasSearch ? '没有匹配的对话' : '还没有对话'}
      </p>
      {!hasSearch && (
        <button
          onClick={onCreate}
          className="text-[13px] px-4 py-2 rounded-lg cursor-pointer transition-colors"
          style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
        >
          开始第一次对话
        </button>
      )}
    </div>
  );
}

function ConversationRow({
  conv, formatTime, onOpen, onDelete,
}: {
  conv: Conversation; formatTime: (s: string) => string; onOpen: () => void; onDelete: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 sm:gap-4 px-4 py-3 sm:px-5 sm:py-4 cursor-pointer transition-colors group"
      style={{ transitionDuration: 'var(--duration-fast)' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      onClick={onOpen}
    >
      <div
        className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
      >
        <MessageSquare size={16} strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {conv.title || '未命名对话'}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {conv.model_provider}
          </span>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {formatTime(conv.updated_at)}
          </span>
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        style={{ color: 'var(--text-muted)', transitionDuration: 'var(--duration-fast)' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--error)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
      >
        <Trash2 size={14} strokeWidth={1.8} />
      </button>
    </div>
  );
}
