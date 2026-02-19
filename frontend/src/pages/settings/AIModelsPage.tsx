import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import api from '../../services/api';
import { useAppStore } from '../../stores/useAppStore';

export default function AIModelsPage() {
  const { currentModel, setCurrentModel } = useAppStore();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [keys, setKeys] = useState<Record<string, string>>({});

  const { data: models = [] } = useQuery({
    queryKey: ['ai-models'],
    queryFn: () => api.get<Array<{ id: string; name: string; provider: string }>>('/config/models').then(r => r.data),
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[16px] font-semibold" style={{ color: 'var(--text-primary)' }}>AI 模型配置</h3>
        <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>选择默认模型，配置 API Key</p>
      </div>

      {models.map((model) => (
        <div
          key={model.id}
          className="rounded-xl p-5 space-y-4"
          style={{
            background: 'var(--bg-surface)',
            border: currentModel === model.id ? '2px solid var(--accent)' : '1px solid var(--border-default)',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>{model.name}</span>
              <span className="text-[12px] ml-2" style={{ color: 'var(--text-muted)' }}>{model.provider}</span>
            </div>
            <button
              onClick={() => setCurrentModel(model.id as 'claude' | 'codex')}
              className="text-[12px] px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
              style={{
                background: currentModel === model.id ? 'var(--accent)' : 'var(--bg-sunken)',
                color: currentModel === model.id ? 'var(--text-inverse)' : 'var(--text-secondary)',
              }}
            >
              {currentModel === model.id ? '当前使用' : '切换'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border-default)' }}
            >
              <input
                type={showKeys[model.id] ? 'text' : 'password'}
                placeholder="API Key（服务端已配置则无需填写）"
                value={keys[model.id] || ''}
                onChange={(e) => setKeys(prev => ({ ...prev, [model.id]: e.target.value }))}
                className="flex-1 bg-transparent border-none outline-none text-[13px] font-mono"
                style={{ color: 'var(--text-primary)' }}
              />
              <button
                onClick={() => setShowKeys(prev => ({ ...prev, [model.id]: !prev[model.id] }))}
                className="cursor-pointer p-1 rounded"
                style={{ color: 'var(--text-muted)' }}
              >
                {showKeys[model.id] ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        </div>
      ))}

      {models.length === 0 && (
        <div className="text-center py-12 text-[12px]" style={{ color: 'var(--text-muted)' }}>
          无法加载模型列表，请检查后端连接
        </div>
      )}
    </div>
  );
}
