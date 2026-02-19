import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plug, TestTube, Check, Loader2 } from 'lucide-react';
import api from '../../services/api';

interface FeishuConfig {
  app_id: string;
  app_secret_encrypted: string;
  webhook_url: string;
  bot_enabled: boolean;
}

export default function IntegrationsPage() {
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [saved, setSaved] = useState(false);

  const { data: config } = useQuery({
    queryKey: ['feishu-config'],
    queryFn: () => api.get<FeishuConfig>('/feishu/config').then(r => r.data),
  });

  useEffect(() => {
    if (config) {
      setAppId(config.app_id || '');
      setAppSecret(config.app_secret_encrypted || '');
      setWebhookUrl(config.webhook_url || '');
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: () => api.put('/feishu/config', {
      app_id: appId, app_secret: appSecret, webhook_url: webhookUrl,
    }),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000); },
  });

  const testMutation = useMutation({
    mutationFn: () => api.post('/feishu/test-connection'),
  });

  const connected = !!(config?.app_id && config?.webhook_url);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[16px] font-semibold" style={{ color: 'var(--text-primary)' }}>第三方集成</h3>
        <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>连接外部服务，扩展平台能力</p>
      </div>

      <div
        className="rounded-xl p-5 space-y-4"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
              <Plug size={18} strokeWidth={1.8} />
            </div>
            <div>
              <div className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>飞书</div>
              <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>将知识洞察推送到飞书群</div>
            </div>
          </div>
          <span
            className="text-[11px] font-medium px-2 py-1 rounded"
            style={{ background: connected ? 'var(--success-subtle)' : 'var(--bg-sunken)', color: connected ? 'var(--success)' : 'var(--text-muted)' }}
          >
            {connected ? '已连接' : '未连接'}
          </span>
        </div>

        <div className="space-y-3">
          <Field label="App ID" value={appId} onChange={setAppId} placeholder="输入 App ID..." />
          <Field label="App Secret" value={appSecret} onChange={setAppSecret} placeholder="输入 App Secret..." type="password" />
          <Field label="Webhook URL" value={webhookUrl} onChange={setWebhookUrl} placeholder="输入 Webhook URL..." />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-colors disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
          >
            {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
            {saved ? '已保存' : '保存配置'}
          </button>
          <button
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-colors"
            style={{ background: 'transparent', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
          >
            {testMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <TestTube size={14} />}
            测试连接
          </button>
        </div>
        {testMutation.isSuccess && <p className="text-[12px]" style={{ color: 'var(--success)' }}>连接成功</p>}
        {testMutation.isError && <p className="text-[12px]" style={{ color: 'var(--error)' }}>连接失败，请检查配置</p>}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string;
}) {
  return (
    <div>
      <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-[13px] bg-transparent outline-none"
        style={{ border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
      />
    </div>
  );
}
