import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Bot, User } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: { title: string; industry: string }[];
}

const mockMessages: Message[] = [
  { id: '1', role: 'user', content: '请分析一下医疗AI在诊断领域的最新发展趋势' },
  {
    id: '2', role: 'assistant',
    content: '根据医疗健康知识库的资料，医疗AI诊断领域近期有以下关键趋势：\n\n1. **多模态融合诊断** — 结合影像、病历文本、基因组数据的综合分析能力显著提升\n2. **可解释性增强** — 监管要求推动AI诊断结果必须提供可解释的推理路径\n3. **边缘部署** — 轻量化模型使得AI诊断可以在基层医疗机构本地运行\n\n从金融投资角度看，医疗AI赛道2024年融资额同比增长47%，头部企业估值持续走高。',
    sources: [
      { title: '医疗AI诊断系统白皮书', industry: '医疗健康' },
      { title: '2024医疗科技投资报告', industry: '金融投资' },
    ],
  },
];

export default function ChatConversationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [messages] = useState<Message[]>(mockMessages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-[calc(100vh-var(--topbar-height)-var(--content-padding)*2)]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
        <button
          onClick={() => navigate('/chat')}
          className="p-1.5 rounded-md cursor-pointer transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <ArrowLeft size={18} strokeWidth={1.8} />
        </button>
        <span className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          医疗AI发展趋势分析
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-6 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className="flex gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
              style={{
                background: msg.role === 'assistant' ? 'var(--accent-subtle)' : 'var(--bg-sunken)',
                color: msg.role === 'assistant' ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              {msg.role === 'assistant' ? <Bot size={16} strokeWidth={1.8} /> : <User size={16} strokeWidth={1.8} />}
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="text-[13px] leading-relaxed whitespace-pre-wrap"
                style={{ color: 'var(--text-primary)' }}
              >
                {msg.content}
              </div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {msg.sources.map((src, i) => (
                    <span
                      key={i}
                      className="text-[11px] font-medium px-2 py-1 rounded-md cursor-pointer transition-colors"
                      style={{
                        background: 'var(--bg-sunken)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-secondary)',
                        transitionDuration: 'var(--duration-fast)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                    >
                      {src.industry} · {src.title}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="flex items-center gap-3 pt-4"
        style={{ borderTop: '1px solid var(--border-default)' }}
      >
        <div
          className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-lg"
          style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border-default)' }}
        >
          <input
            type="text"
            placeholder="输入你的问题... 支持 @ 选择行业专家"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[13px]"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
        <button
          className="p-2.5 rounded-lg cursor-pointer transition-colors"
          style={{
            background: input.trim() ? 'var(--accent)' : 'var(--bg-sunken)',
            color: input.trim() ? 'var(--text-inverse)' : 'var(--text-muted)',
            transitionDuration: 'var(--duration-fast)',
          }}
        >
          <Send size={18} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}
