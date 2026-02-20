import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Icon } from '@iconify/react';
import api from '@/services/api';
import { PageHeader } from '@/components/composed/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SaveButton, SolidButton } from '@/components/composed/solid-button';

interface FeishuConfig {
  app_id: string;
  app_secret_encrypted: string;
  webhook_url: string;
  bot_enabled: boolean;
}

export default function IntegrationsPage() {
  const { data: config } = useQuery({
    queryKey: ['feishu-config'],
    queryFn: () => api.get<FeishuConfig>('/feishu/config').then((r) => r.data),
  });

  if (!config) {
    return (
      <div className="space-y-4">
        <PageHeader title="第三方集成" description="连接外部服务，扩展平台能力" />
        <FeishuCard initialConfig={{ app_id: '', app_secret_encrypted: '', webhook_url: '', bot_enabled: false }} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="第三方集成" description="连接外部服务，扩展平台能力" />
      <FeishuCard key={`${config.app_id}:${config.webhook_url}`} initialConfig={config} />
    </div>
  );
}

function FeishuCard({ initialConfig }: { initialConfig: FeishuConfig }) {
  const [appId, setAppId] = useState(initialConfig.app_id || '');
  const [appSecret, setAppSecret] = useState(initialConfig.app_secret_encrypted || '');
  const [webhookUrl, setWebhookUrl] = useState(initialConfig.webhook_url || '');
  const [saved, setSaved] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put('/feishu/config', {
        app_id: appId,
        app_secret: appSecret,
        webhook_url: webhookUrl,
      }),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const testMutation = useMutation({
    mutationFn: () => api.post('/feishu/test-connection'),
  });

  const connected = !!(appId && webhookUrl);

  return (
    <Card className="gap-4 py-5">
      <CardContent className="space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Icon icon="streamline-color:electric-cord-1" width={18} height={18} className="text-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">飞书</div>
              <div className="text-xs text-muted-foreground">
                将知识洞察推送到飞书群
              </div>
            </div>
          </div>
          {connected ? (
            <Badge className="bg-green-500/10 text-green-600 border-transparent">
              已连接
            </Badge>
          ) : (
            <Badge variant="outline">未连接</Badge>
          )}
        </div>

        {/* Form fields */}
        <div className="space-y-3">
          <Field
            label="App ID"
            value={appId}
            onChange={setAppId}
            placeholder="输入 App ID..."
          />
          <Field
            label="App Secret"
            value={appSecret}
            onChange={setAppSecret}
            placeholder="输入 App Secret..."
            type="password"
          />
          <Field
            label="Webhook URL"
            value={webhookUrl}
            onChange={setWebhookUrl}
            placeholder="输入 Webhook URL..."
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <SaveButton
            onClick={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
          >
            {saved ? '已保存' : '保存配置'}
          </SaveButton>
          <SolidButton
            color="secondary"
            icon="streamline-color:test-tube"
            onClick={() => testMutation.mutate()}
            loading={testMutation.isPending}
            loadingText="测试中..."
          >
            测试连接
          </SolidButton>
        </div>

        {/* Status messages */}
        {testMutation.isSuccess && (
          <p className="text-xs text-green-600">连接成功</p>
        )}
        {testMutation.isError && (
          <p className="text-xs text-destructive">连接失败，请检查配置</p>
        )}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
