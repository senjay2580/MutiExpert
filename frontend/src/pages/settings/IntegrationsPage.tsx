import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@iconify/react';
import api from '@/services/api';
import { PageHeader } from '@/components/composed/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { SaveButton, SolidButton } from '@/components/composed/solid-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FeishuConfig {
  app_id: string;
  app_secret_encrypted: string;
  webhook_url: string;
  verification_token: string;
  encrypt_key: string;
  default_chat_id: string;
  bot_enabled: boolean;
  default_provider: string;
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
          default_provider: 'claude',
        }} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="第三方集成" description="连接外部服务，扩展平台能力" />
      <FeishuCard key={`${config.app_id}:${config.webhook_url}`} initialConfig={config} />
      <TavilyCard />
      <SupabaseCard />
    </div>
  );
}

function FeishuCard({ initialConfig }: { initialConfig: FeishuConfig }) {
  const queryClient = useQueryClient();
  const [appId, setAppId] = useState(initialConfig.app_id || '');
  const [appSecret, setAppSecret] = useState(initialConfig.app_secret_encrypted || '');
  const [webhookUrl, setWebhookUrl] = useState(initialConfig.webhook_url || '');
  const [verificationToken, setVerificationToken] = useState(initialConfig.verification_token || '');
  const [encryptKey, setEncryptKey] = useState(initialConfig.encrypt_key || '');
  const [defaultChatId, setDefaultChatId] = useState(initialConfig.default_chat_id || '');
  const [botEnabled, setBotEnabled] = useState(initialConfig.bot_enabled ?? false);
  const [defaultProvider, setDefaultProvider] = useState(initialConfig.default_provider || 'claude');
  const [saved, setSaved] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
        default_provider: defaultProvider,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feishu-config'] });
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Icon icon="streamline-color:electric-cord-1" width={18} height={18} className="text-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">飞书</div>
              <div className="text-xs text-muted-foreground">在飞书中直接与 AI 对话</div>
            </div>
          </div>
          {connected ? (
            <Badge className="bg-green-500/10 text-green-600 border-transparent">已连接</Badge>
          ) : (
            <Badge variant="outline">未连接</Badge>
          )}
        </div>

        {/* Core fields */}
        <div className="space-y-3">
          <Field label="App ID" value={appId} onChange={setAppId} placeholder="输入飞书应用 App ID" />
          <Field label="App Secret" value={appSecret} onChange={setAppSecret} placeholder="输入飞书应用 App Secret" type="password" />
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2">
            <div>
              <div className="text-xs font-medium text-foreground">启用飞书机器人</div>
              <div className="text-[11px] text-muted-foreground">开启后可在飞书中与 AI 对话</div>
            </div>
            <Switch checked={botEnabled} onCheckedChange={setBotEnabled} />
          </div>
        </div>

        {/* Advanced toggle */}
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon icon={showAdvanced ? 'lucide:chevron-down' : 'lucide:chevron-right'} className="size-3.5" />
          高级配置
        </button>

        {/* Advanced fields */}
        {showAdvanced && (
          <div className="space-y-3 border-t pt-3">
            <Field label="Webhook URL" value={webhookUrl} onChange={setWebhookUrl} placeholder="群机器人 Webhook 地址（用于主动推送）" />
            <Field label="Verification Token" value={verificationToken} onChange={setVerificationToken} placeholder="事件回调校验 Token" />
            <Field label="Encrypt Key" value={encryptKey} onChange={setEncryptKey} placeholder="事件加密密钥" type="password" />
            <Field label="默认 Chat ID" value={defaultChatId} onChange={setDefaultChatId} placeholder="消息推送的目标会话 ID" />
            <p className="text-[11px] text-muted-foreground">也可在飞书对话中发送&quot;绑定&quot;自动记录会话 ID</p>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">机器人默认模型</label>
              <Select value={defaultProvider} onValueChange={setDefaultProvider}>
                <SelectTrigger className="w-full"><SelectValue placeholder="选择模型" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude">Claude</SelectItem>
                  <SelectItem value="deepseek">DeepSeek</SelectItem>
                  <SelectItem value="qwen">通义千问</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">也可在飞书对话中发送"切换到 deepseek"动态切换</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <SaveButton onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
            {saved ? '已保存' : '保存配置'}
          </SaveButton>
          <SolidButton color="secondary" icon="streamline-color:test-tube" onClick={() => testMutation.mutate()} loading={testMutation.isPending} loadingText="测试中...">
            测试连接
          </SolidButton>
          <SolidButton color="secondary" icon="streamline-color:chat-bubble-text-square" onClick={() => testMessageMutation.mutate()} loading={testMessageMutation.isPending} loadingText="发送中...">
            测试消息
          </SolidButton>
        </div>

        {/* Status */}
        {testMutation.isSuccess && <p className="text-xs text-green-600">连接成功</p>}
        {testMutation.isError && <p className="text-xs text-destructive">连接失败，请检查配置</p>}
        {testMessageMutation.isSuccess && <p className="text-xs text-emerald-600">测试消息已发送</p>}
        {testMessageMutation.isError && <p className="text-xs text-destructive">测试消息发送失败</p>}
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
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <Input
          type={isPassword && !visible ? 'password' : 'text'}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={isPassword ? 'pr-9' : ''}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon icon={visible ? 'lucide:eye-off' : 'lucide:eye'} className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function TavilyCard() {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  const { data: tavilyConfig } = useQuery({
    queryKey: ['tavily-config'],
    queryFn: () => api.get<{ api_key_set: boolean; api_key_masked: string }>('/config/tavily').then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: () => api.put('/config/tavily', { api_key: apiKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tavily-config'] });
      setSaved(true);
      setApiKey('');
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return (
    <Card className="gap-4 py-5">
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
              <Icon icon="lucide:search" width={18} height={18} className="text-blue-500" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Tavily 网络搜索</div>
              <div className="text-xs text-muted-foreground">为 AI 提供实时网络搜索能力</div>
            </div>
          </div>
          {tavilyConfig?.api_key_set ? (
            <Badge className="bg-green-500/10 text-green-600 border-transparent">已配置</Badge>
          ) : (
            <Badge variant="outline">未配置</Badge>
          )}
        </div>
        <div className="space-y-3">
          {tavilyConfig?.api_key_set && (
            <p className="text-[11px] text-muted-foreground">
              当前 Key: {tavilyConfig.api_key_masked}（输入新 Key 可覆盖）
            </p>
          )}
          <Field
            label="API Key"
            value={apiKey}
            onChange={setApiKey}
            placeholder="tvly-xxxxxxxxxxxxxxxx"
            type="password"
          />
          <p className="text-[11px] text-muted-foreground">
            在聊天页开启「搜索」模式后，AI 会自动调用 Tavily 搜索实时信息。
            前往 <a href="https://tavily.com" target="_blank" rel="noreferrer" className="underline">tavily.com</a> 获取 API Key。
          </p>
        </div>
        <SaveButton
          onClick={() => saveMutation.mutate()}
          loading={saveMutation.isPending}
          disabled={!apiKey.trim()}
        >
          {saved ? '已保存' : '保存'}
        </SaveButton>
      </CardContent>
    </Card>
  );
}

interface SupabaseConfig {
  supabase_url: string;
  supabase_service_key_masked: string;
  supabase_service_key_set: boolean;
  supabase_bucket: string;
}

function SupabaseCard() {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [serviceKey, setServiceKey] = useState('');
  const [bucket, setBucket] = useState('');
  const [saved, setSaved] = useState(false);

  const { data: config } = useQuery({
    queryKey: ['supabase-config'],
    queryFn: () => api.get<SupabaseConfig>('/config/supabase').then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put('/config/supabase', {
        supabase_url: url || undefined,
        supabase_service_key: serviceKey || undefined,
        supabase_bucket: bucket || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-config'] });
      setSaved(true);
      setServiceKey('');
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const testMutation = useMutation({
    mutationFn: () => api.get<{ success: boolean; error: string }>('/sandbox/storage/test').then((r) => r.data),
  });

  const configured = config?.supabase_service_key_set;

  return (
    <Card className="gap-4 py-5">
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
              <Icon icon="lucide:hard-drive" width={18} height={18} className="text-emerald-500" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Supabase Storage</div>
              <div className="text-xs text-muted-foreground">文件/图片公开托管，聊天附件自动上传</div>
            </div>
          </div>
          {configured ? (
            <Badge className="bg-green-500/10 text-green-600 border-transparent">已配置</Badge>
          ) : (
            <Badge variant="outline">未配置</Badge>
          )}
        </div>

        <div className="space-y-3">
          {config?.supabase_url && (
            <p className="text-[11px] text-muted-foreground">当前 URL: {config.supabase_url}</p>
          )}
          <Field label="Supabase URL" value={url} onChange={setUrl} placeholder="https://xxxxx.supabase.co" />
          {config?.supabase_service_key_set && (
            <p className="text-[11px] text-muted-foreground">
              当前 Key: {config.supabase_service_key_masked}（输入新 Key 可覆盖）
            </p>
          )}
          <Field label="Service Role Key" value={serviceKey} onChange={setServiceKey} placeholder="eyJhbGciOi..." type="password" />
          <Field label="Bucket 名称" value={bucket} onChange={setBucket} placeholder={config?.supabase_bucket || 'public-files'} />
          <p className="text-[11px] text-muted-foreground">
            聊天中上传的文件会自动推送到 Supabase Storage，生成公开下载链接。
          </p>
        </div>

        <div className="flex gap-2">
          <SaveButton onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
            {saved ? '已保存' : '保存配置'}
          </SaveButton>
          <SolidButton
            color="secondary"
            icon="lucide:wifi"
            onClick={() => testMutation.mutate()}
            loading={testMutation.isPending}
            loadingText="测试中..."
          >
            测试连接
          </SolidButton>
        </div>

        {testMutation.isSuccess && testMutation.data?.success && (
          <p className="text-xs text-green-600">连接成功</p>
        )}
        {testMutation.isSuccess && !testMutation.data?.success && (
          <p className="text-xs text-destructive">连接失败: {testMutation.data?.error}</p>
        )}
        {testMutation.isError && <p className="text-xs text-destructive">测试请求失败</p>}
      </CardContent>
    </Card>
  );
}
