import { Plug, TestTube } from 'lucide-react';

const integrations = [
  {
    id: 'feishu',
    name: '飞书',
    description: '将知识洞察推送到飞书群，支持 Webhook 和 Open API',
    connected: false,
    fields: ['App ID', 'App Secret', 'Webhook URL'],
  },
];

export default function IntegrationsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[16px] font-semibold" style={{ color: 'var(--text-primary)' }}>第三方集成</h3>
        <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>连接外部服务，扩展平台能力</p>
      </div>

      {integrations.map((item) => (
        <div
          key={item.id}
          className="rounded-lg p-5 space-y-4"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
              >
                <Plug size={18} strokeWidth={1.8} />
              </div>
              <div>
                <div className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>{item.name}</div>
                <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{item.description}</div>
              </div>
            </div>
            <span
              className="text-[11px] font-medium px-2 py-1 rounded"
              style={{
                background: item.connected ? 'var(--success-subtle)' : 'var(--bg-sunken)',
                color: item.connected ? 'var(--success)' : 'var(--text-muted)',
              }}
            >
              {item.connected ? '已连接' : '未连接'}
            </span>
          </div>

          <div className="space-y-3">
            {item.fields.map((field) => (
              <div key={field}>
                <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                  {field}
                </label>
                <input
                  type="text"
                  placeholder={`输入 ${field}...`}
                  className="w-full px-3 py-2 rounded-md text-[13px] bg-transparent outline-none"
                  style={{ border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-[13px] font-medium cursor-pointer transition-colors"
              style={{ background: 'var(--accent)', color: 'var(--text-inverse)', transitionDuration: 'var(--duration-fast)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
            >
              保存配置
            </button>
            <button
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-[13px] font-medium cursor-pointer transition-colors"
              style={{ background: 'transparent', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', transitionDuration: 'var(--duration-fast)' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
            >
              <TestTube size={14} /> 测试连接
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
