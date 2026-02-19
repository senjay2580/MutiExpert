import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send, Bot, User, Square, FileText, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { chatService, streamMessage } from '../../services/chatService';
import type { Message, SourceReference } from '../../types';

export default function ChatConversationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingSources, setStreamingSources] = useState<SourceReference[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: conversation } = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => chatService.getConversation(id!),
    enabled: !!id,
  });

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', id],
    queryFn: () => chatService.listMessages(id!),
    enabled: !!id,
  });

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, streamingContent, scrollToBottom]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || !id || isStreaming) return;
    setInput('');
    setIsStreaming(true);
    setStreamingContent('');
    setStreamingSources([]);

    // Optimistic: add user message
    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: id,
      role: 'user',
      content: text,
      sources: [],
      model_used: '',
      tokens_used: 0,
      created_at: new Date().toISOString(),
    };
    queryClient.setQueryData<Message[]>(['messages', id], (old = []) => [...old, userMsg]);

    let accumulated = '';
    abortRef.current = streamMessage(
      id, text,
      (chunk) => { accumulated += chunk; setStreamingContent(accumulated); },
      (sources) => { setStreamingSources(sources.map(s => ({ ...s, document_id: s.document_id ?? '' }))); },
      () => {
        setIsStreaming(false);
        setStreamingContent('');
        setStreamingSources([]);
        queryClient.invalidateQueries({ queryKey: ['messages', id] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      },
      (err) => { setIsStreaming(false); console.error('Stream error:', err); },
    );
  }, [input, id, isStreaming, queryClient]);

  const handleStop = () => { abortRef.current?.(); setIsStreaming(false); };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const allMessages = [...messages];
  // Append streaming assistant message
  if (isStreaming && streamingContent) {
    allMessages.push({
      id: 'streaming',
      conversation_id: id!,
      role: 'assistant',
      content: streamingContent,
      sources: streamingSources,
      model_used: '',
      tokens_used: 0,
      created_at: new Date().toISOString(),
    });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-var(--topbar-height))] -m-[var(--content-padding)] sm:m-0 sm:h-[calc(100vh-var(--topbar-height)-var(--content-padding)*2)]">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 sm:px-0 shrink-0"
        style={{ height: 48, borderBottom: '1px solid var(--border-default)' }}
      >
        <button
          onClick={() => navigate('/chat')}
          className="p-1.5 rounded-md cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={18} strokeWidth={1.8} />
        </button>
        <span className="text-[14px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
          {conversation?.title || '对话'}
        </span>
        {conversation?.model_provider && (
          <span
            className="text-[11px] px-2 py-0.5 rounded-full shrink-0"
            style={{ background: 'var(--accent-subtle)', color: 'var(--accent-text)' }}
          >
            {conversation.model_provider}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-0">
        <div className="max-w-3xl mx-auto py-6 space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
          ) : allMessages.length === 0 ? (
            <EmptyState />
          ) : (
            allMessages.map((msg) => <MessageBubble key={msg.id} message={msg} isStreaming={msg.id === 'streaming'} />)
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 sm:px-0 pb-4 pt-2">
        <div
          className="max-w-3xl mx-auto flex items-end gap-2 p-2 rounded-xl"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}
        >
          <textarea
            ref={inputRef}
            placeholder="输入你的问题..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="flex-1 bg-transparent border-none outline-none text-[13px] resize-none leading-relaxed px-2 py-1.5 max-h-32"
            style={{ color: 'var(--text-primary)' }}
          />
          {isStreaming ? (
            <button
              onClick={handleStop}
              className="p-2 rounded-lg cursor-pointer transition-colors shrink-0"
              style={{ background: 'var(--error-subtle)', color: 'var(--error)' }}
            >
              <Square size={16} strokeWidth={2} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="p-2 rounded-lg cursor-pointer transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: input.trim() ? 'var(--accent)' : 'var(--bg-sunken)',
                color: input.trim() ? 'var(--text-inverse)' : 'var(--text-muted)',
              }}
            >
              <Send size={16} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
      >
        <Bot size={24} strokeWidth={1.5} />
      </div>
      <p className="text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>开始新对话</p>
      <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>输入问题，AI 将基于知识库为你解答</p>
    </div>
  );
}

function MessageBubble({ message, isStreaming }: { message: Message; isStreaming?: boolean }) {
  const isAssistant = message.role === 'assistant';
  return (
    <div className="flex gap-3">
      <div
        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 mt-1"
        style={{
          background: isAssistant ? 'var(--accent-subtle)' : 'var(--bg-sunken)',
          color: isAssistant ? 'var(--accent)' : 'var(--text-secondary)',
        }}
      >
        {isAssistant ? <Bot size={15} strokeWidth={1.8} /> : <User size={15} strokeWidth={1.8} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] leading-relaxed prose prose-sm max-w-none" style={{ color: 'var(--text-primary)' }}>
          {isAssistant ? (
            <>
              <ReactMarkdown>{message.content}</ReactMarkdown>
              {isStreaming && <span className="inline-block w-1.5 h-4 ml-0.5 bg-[var(--accent)] animate-pulse rounded-sm" />}
            </>
          ) : (
            <p className="whitespace-pre-wrap m-0">{message.content}</p>
          )}
        </div>
        {message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {message.sources.map((src, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition-colors"
                style={{
                  background: 'var(--bg-sunken)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-secondary)',
                }}
              >
                <FileText size={10} strokeWidth={2} />
                {src.document_title}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
