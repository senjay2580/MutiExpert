import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MessageSquare, Trash2, Search } from 'lucide-react';
import clsx from 'clsx';

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  time: string;
  industries: string[];
}

const mockConversations: Conversation[] = [
  { id: '1', title: '医疗AI发展趋势分析', lastMessage: '根据最新的医疗行业数据...', time: '10 分钟前', industries: ['医疗健康'] },
  { id: '2', title: '金融风控与法律合规', lastMessage: '从金融和法律两个角度来看...', time: '2 小时前', industries: ['金融投资', '法律法规'] },
  { id: '3', title: '跨行业数字化转型', lastMessage: '数字化转型在不同行业的应用...', time: '昨天', industries: ['科技互联', '教育学术'] },
  { id: '4', title: '营销策略与用户增长', lastMessage: '结合市场营销的最佳实践...', time: '3 天前', industries: ['市场营销'] },
];

export default function ChatListPage() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  return (
    <div className="flex gap-6 h-[calc(100vh-var(--topbar-height)-var(--content-padding)*2)]">
      {/* Conversation List */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border-default)' }}
          >
            <Search size={16} strokeWidth={1.8} style={{ color: 'var(--text-muted)' }} />
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
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-colors"
            style={{ background: 'var(--accent)', color: 'var(--text-inverse)', transitionDuration: 'var(--duration-fast)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
          >
            <Plus size={16} strokeWidth={2} />
            新建对话
          </button>
        </div>

        <div
          className="flex-1 rounded-lg overflow-y-auto"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
        >
          {mockConversations.map((conv, i) => (
            <div
              key={conv.id}
              className="flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors"
              style={{
                borderBottom: i < mockConversations.length - 1 ? '1px solid var(--border-default)' : 'none',
                transitionDuration: 'var(--duration-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              onClick={() => navigate(`/chat/${conv.id}`)}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
              >
                <MessageSquare size={18} strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {conv.title}
                </div>
                <div className="text-[12px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {conv.lastMessage}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{conv.time}</span>
                <div className="flex gap-1">
                  {conv.industries.map((ind) => (
                    <span
                      key={ind}
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--bg-sunken)', color: 'var(--text-muted)' }}
                    >
                      {ind}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
