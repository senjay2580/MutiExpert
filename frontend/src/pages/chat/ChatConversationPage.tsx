import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Input, Button, Select, Tag, Collapse, Empty } from 'antd';
import { SendOutlined, SwapOutlined, LoadingOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { chatService, streamMessage } from '../../services/chatService';
import { useAppStore } from '../../stores/useAppStore';
import type { Message, SourceReference } from '../../types';

export default function ChatConversationPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { currentModel, setCurrentModel } = useAppStore();
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [streamSources, setStreamSources] = useState<SourceReference[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const { data: conv } = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => chatService.getConversation(id!),
    enabled: !!id,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', id],
    queryFn: () => chatService.listMessages(id!),
    enabled: !!id,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamText]);

  useEffect(() => {
    if (conv?.model_provider) setCurrentModel(conv.model_provider as 'claude' | 'codex');
  }, [conv?.model_provider, setCurrentModel]);

  const handleSend = useCallback(() => {
    if (!input.trim() || !id || streaming) return;
    const content = input.trim();
    setInput('');
    setStreaming(true);
    setStreamText('');
    setStreamSources([]);

    abortRef.current = streamMessage(
      id, content,
      (chunk) => setStreamText((prev) => prev + chunk),
      (sources) => setStreamSources(sources as unknown as SourceReference[]),
      () => {
        setStreaming(false);
        setStreamText('');
        setStreamSources([]);
        queryClient.invalidateQueries({ queryKey: ['messages', id] });
        queryClient.invalidateQueries({ queryKey: ['conversation', id] });
      },
      (error) => {
        setStreaming(false);
        setStreamText(`Error: ${error}`);
      },
    );
  }, [input, id, streaming, queryClient]);

  const handleModelSwitch = async (model: 'claude' | 'codex') => {
    setCurrentModel(model);
    if (id) {
      await chatService.switchModel(id, model);
      queryClient.invalidateQueries({ queryKey: ['conversation', id] });
    }
  };

  const renderMessage = (msg: Message) => {
    const isUser = msg.role === 'user';
    return (
      <div key={msg.id} className={`flex mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[75%] rounded-lg px-4 py-2 ${isUser ? 'bg-blue-500 text-white' : 'bg-white border'}`}>
          <div className="whitespace-pre-wrap">{msg.content}</div>
          {!isUser && msg.sources && msg.sources.length > 0 && (
            <Collapse ghost size="small" className="mt-2"
              items={[{
                key: '1', label: <span className="text-xs text-gray-400">来源引用 ({msg.sources.length})</span>,
                children: msg.sources.map((s: SourceReference, i: number) => (
                  <div key={i} className="text-xs text-gray-500 mb-1">
                    <Tag color="blue" className="text-xs">{s.document_title}</Tag>
                    <span className="text-gray-400">相关度: {(s.score * 100).toFixed(0)}%</span>
                    <p className="mt-1 text-gray-400 truncate">{s.snippet}</p>
                  </div>
                )),
              }]}
            />
          )}
          {!isUser && msg.model_used && (
            <div className="text-xs text-gray-400 mt-1">{msg.model_used === 'claude' ? 'Claude' : 'Codex'}</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-128px)]">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl font-semibold">{conv?.title || '新对话'}</h2>
        <Select
          value={currentModel}
          onChange={handleModelSwitch}
          options={[
            { value: 'claude', label: 'Claude (Anthropic)' },
            { value: 'codex', label: 'Codex (OpenAI)' },
          ]}
          suffixIcon={<SwapOutlined />}
          className="min-w-[180px]"
        />
      </div>
      <Card className="flex-1 overflow-y-auto mb-3" styles={{ body: { padding: 16 } }}>
        {messages.length === 0 && !streaming ? (
          <Empty description="开始提问，AI 将基于知识库回答" className="py-20" />
        ) : (
          <>
            {messages.map(renderMessage)}
            {streaming && (
              <div className="flex justify-start mb-4">
                <div className="max-w-[75%] rounded-lg px-4 py-2 bg-white border">
                  <div className="whitespace-pre-wrap">{streamText || <LoadingOutlined />}</div>
                  {streamSources.length > 0 && (
                    <div className="mt-2 text-xs text-gray-400">
                      {streamSources.map((s, i) => <Tag key={i} color="blue">{s.document_title}</Tag>)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </Card>
      <div className="flex gap-2">
        <Input.TextArea
          placeholder="输入你的问题..."
          autoSize={{ minRows: 1, maxRows: 4 }}
          className="flex-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); handleSend(); } }}
          disabled={streaming}
        />
        <Button
          type="primary"
          icon={streaming ? <LoadingOutlined /> : <SendOutlined />}
          className="self-end"
          onClick={handleSend}
          disabled={streaming || !input.trim()}
        >
          发送
        </Button>
      </div>
    </div>
  );
}
