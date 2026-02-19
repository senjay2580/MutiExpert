import { useState } from 'react';
import { Eye, EyeOff, Check } from 'lucide-react';

interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  apiKey: string;
  enabled: boolean;
}

const defaultModels: ModelConfig[] = [
  { id: 'claude', name: 'Claude', provider: 'Anthropic', apiKey: '', enabled: true },
  { id: 'codex', name: 'GPT-4', provider: 'OpenAI', apiKey: '', enabled: false },
];

export default function AIModelsPage() {
  const [models, setModels] = useState(defaultModels);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const toggleShow = (id: string) => setShowKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  const updateKey = (id: string, key: string) =>
    setModels((prev) => prev.map((m) => (m.id === id ? { ...m, apiKey: key } : m)));
  const toggleEnabled = (id: string) =>
    setModels((prev) => prev.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[16px] font-semibold" style={{ color: 'var(--text-primary)' }}>AI 模型配置</h3>
        <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>配置 AI 模型的 API Key，用于知识问答和洞察生成</p>
      </div>

      {models.map((model) => (
        <div
          key={model.id}
          className="rounded-lg p-5 space-y-4"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>{model.name}</span>
              <span className="text-[12px] ml-2" style={{ color: 'var(--text-muted)' }}>{model.provider}</span>
            </div>
            <button
              onClick={() => toggleEnabled(model.id)}
              className="w-10 h-5 rounded-full cursor-pointer transition-colors relative"
              style={{
                background: model.enabled ? 'var(--accent)' : 'var(--border-strong)',
                transitionDuration: 'var(--duration-normal)',
              }}
            >
              <div
                className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                style={{
                  background: 'white',
                  left: model.enabled ? '22px' : '2px',
                  transitionDuration: 'var(--duration-normal)',
                }}
              />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md"
              style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border-default)' }}
            >
              <input
                type={showKeys[model.id] ? 'text' : 'password'}
                placeholder="输入 API Key..."
                value={model.apiKey}
                onChange={(e) => updateKey(model.id, e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-[13px] font-mono"
                style={{ color: 'var(--text-primary)' }}
              />
              <button
                onClick={() => toggleShow(model.id)}
                className="cursor-pointer p-1 rounded"
                style={{ color: 'var(--text-muted)' }}
              >
                {showKeys[model.id] ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-[13px] font-medium cursor-pointer transition-colors"
              style={{ background: 'var(--accent)', color: 'var(--text-inverse)', transitionDuration: 'var(--duration-fast)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
            >
              <Check size={14} /> 保存
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
