import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Icon } from '@iconify/react';
import api from '@/services/api';
import { PageHeader } from '@/components/composed/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { SaveButton, SolidButton } from '@/components/composed/solid-button';

interface FeishuConfig {
  app_id: string;
  app_secret_encrypted: string;
  webhook_url: string;
  verification_token: string;
  encrypt_key: string;
  default_chat_id: string;
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
        <FeishuCard initialConfig={{
          app_id: '',
          app_secret_encrypted: '',
          webhook_url: '',
          verification_token: '',
          encrypt_key: '',
          default_chat_id: '',
          bot_enabled: false,
        }} />
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
  const [verificationToken, setVerificationToken] = useState(initialConfig.verification_token || '');
  const [encryptKey, setEncryptKey] = useState(initialConfig.encrypt_key || '');
  const [defaultChatId, setDefaultChatId] = useState(initialConfig.default_chat_id || '');
  const [botEnabled, setBotEnabled] = useState(initialConfig.bot_enabled ?? false);
  const [saved, setSaved] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put('/feishu/config', {
        app_id: appId,
        app_secret: appSecret,
        webhook_url: webhookUrl,
        verification_token: verificationToken,
        encrypt_key: encryptKey,
        default_chat_id: defaultChatId,
        bot_enabled: botEnabled,
      }),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const testMutation = useMutation({
    mutationFn: () => api.post('/feishu/test-connection'),
  });

  const testMessageMutation = useMutation({
    mutationFn: () =>
      api.post('/feishu/send-message', {
        text: 'MutiExpert 测试消息：飞书集成已连接。',
        use_webhook: !defaultChatId,
        chat_id: defaultChatId || undefined,
      }),
  });

  const connected = Boolean(webhookUrl || defaultChatId || appId);

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
            label="Verification Token（可选）"
            value={verificationToken}
            onChange={setVerificationToken}
            placeholder="用于校验飞书事件回调"
          />
          <Field
            label="Encrypt Key（可选）"
            value={encryptKey}
            onChange={setEncryptKey}
            placeholder="事件加密密钥（如启用加密）"
            type="password"
          />
          <Field
            label="Webhook URL"
            value={webhookUrl}
            onChange={setWebhookUrl}
            placeholder="输入 Webhook URL..."
          />
          <Field
            label="默认 Chat ID（可选）"
            value={defaultChatId}
            onChange={setDefaultChatId}
            placeholder="用于消息推送的会话 ID"
          />
          <p className="text-[11px] text-muted-foreground">
            你也可以在飞书对话中发送“绑定”，系统会自动记录该会话为默认推送目标。
          </p>
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2">
            <div>
              <div className="text-xs font-medium text-foreground">启用飞书机器人</div>
              <div className="text-[11px] text-muted-foreground">开启后可接收飞书消息并回复</div>
            </div>
            <Switch checked={botEnabled} onCheckedChange={setBotEnabled} />
          </div>
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
          <SolidButton
            color="secondary"
            icon="streamline-color:chat-bubble-text-square"
            onClick={() => testMessageMutation.mutate()}
            loading={testMessageMutation.isPending}
            loadingText="发送中..."
          >
            测试消息
          </SolidButton>
        </div>

        {/* Status messages */}
        {testMutation.isSuccess && (
          <p className="text-xs text-green-600">连接成功</p>
        )}
        {testMutation.isError && (
          <p className="text-xs text-destructive">连接失败，请检查配置</p>
        )}
        {testMessageMutation.isSuccess && (
          <p className="text-xs text-emerald-600">测试消息已发送</p>
        )}
        {testMessageMutation.isError && (
          <p className="text-xs text-destructive">测试消息发送失败</p>
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
