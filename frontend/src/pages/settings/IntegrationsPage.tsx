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
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FeishuConfig {
  app_id: string;
  app_secret_set: boolean;
  webhook_url: string;
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
          app_secret_set: false,
          webhook_url: '',
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
  const [appSecret, setAppSecret] = useState('');
  const [webhookUrl, setWebhookUrl] = useState(initialConfig.webhook_url || '');
  const [defaultChatId, setDefaultChatId] = useState(initialConfig.default_chat_id || '');
  const [botEnabled, setBotEnabled] = useState(initialConfig.bot_enabled ?? false);
  const [defaultProvider, setDefaultProvider] = useState(initialConfig.default_provider || 'claude');
  const [saved, setSaved] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put('/feishu/config', {
        app_id: appId,
        app_secret: appSecret,
        webhook_url: webhookUrl,
        default_chat_id: defaultChatId,
        bot_enabled: botEnabled,
        default_provider: defaultProvider,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feishu-config'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success('配置已保存');
    },
    onError: () => toast.error('保存失败，请重试'),
  });

  const testMutation = useMutation({
    mutationFn: () => api.post('/feishu/test-connection'),
    onSuccess: () => toast.success('连接测试成功'),
    onError: () => toast.error('连接测试失败'),
  });

  const testMessageMutation = useMutation({
    mutationFn: () =>
      api.post('/feishu/send-message', {
        text: 'MutiExpert 测试消息：飞书集成已连接。',
      }),
    onSuccess: () => toast.success('测试消息已发送'),
    onError: () => toast.error('发送失败'),
  });

  const chatsMutation = useMutation({
    mutationFn: () => api.get<{ chats: { chat_id: string; name: string; chat_mode: string }[] }>('/feishu/chats').then((r) => r.data),
    onError: () => toast.error('获取群组失败'),
  });

  const connected = Boolean(appId);

  return (
    <Card className="gap-4 py-5">
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#3370ff]/10">
              <div
                className="h-6 w-6"
                style={{
                  backgroundImage: 'url(https://lf-package-cn.feishucdn.com/obj/feishu-static/developer/console/frontend/images/899fa60e60151c73aaea2e25871102dc.svg)',
                  backgroundPosition: '0 0',
                  backgroundSize: 'auto 24px',
                  backgroundRepeat: 'no-repeat',
                }}
              />
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

        <div className="space-y-3">
          <Field label="App ID" value={appId} onChange={setAppId} placeholder="输入飞书应用 App ID" />
          <Field label="App Secret" value={appSecret} onChange={setAppSecret} placeholder={initialConfig.app_secret_set ? '已配置（输入新值可覆盖）' : '输入飞书应用 App Secret'} type="password" />

          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-muted-foreground">方式一：Open API 模式</div>
              <button
                type="button"
                onClick={() => chatsMutation.mutate()}
                className="text-[11px] text-primary hover:underline"
                disabled={chatsMutation.isPending}
              >
                {chatsMutation.isPending ? '查询中...' : '获取会话列表'}
              </button>
            </div>
            <Field label="Chat ID" value={defaultChatId} onChange={setDefaultChatId} placeholder="oc_xxxxxxxx（私聊或群聊均可，给机器人发「绑定」自动获取）" />
            {chatsMutation.isSuccess && chatsMutation.data?.chats?.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] text-muted-foreground">点击选择：</div>
                {chatsMutation.data.chats.map((c) => (
                  <button
                    key={c.chat_id}
                    type="button"
                    onClick={() => setDefaultChatId(c.chat_id)}
                    className={`w-full text-left text-xs px-2 py-1.5 rounded-md border transition-colors ${defaultChatId === c.chat_id ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/50'}`}
                  >
                    <span className="font-medium">{c.name || '未命名'}</span>
                    <span className="text-muted-foreground ml-2">({c.chat_mode === 'p2p' ? '私聊' : '群聊'} {c.chat_id})</span>
                  </button>
                ))}
              </div>
            )}
            {chatsMutation.isSuccess && chatsMutation.data?.chats?.length === 0 && (
              <p className="text-[11px] text-muted-foreground">未找到会话，请先在飞书中给机器人发一条消息</p>
            )}
            {chatsMutation.isError && (
              <p className="text-[11px] text-destructive">获取失败：{(chatsMutation.error as any)?.response?.data?.detail || '请检查配置'}</p>
            )}
          </div>

          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3 space-y-3">
            <div className="text-xs font-medium text-muted-foreground">方式二：Webhook 模式（无需加群）</div>
            <Field label="Webhook URL" value={webhookUrl} onChange={setWebhookUrl} placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxx" />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2">
            <div>
              <div className="text-xs font-medium text-foreground">启用飞书机器人</div>
              <div className="text-[11px] text-muted-foreground">开启后可在飞书中与 AI 对话</div>
            </div>
            <Switch checked={botEnabled} onCheckedChange={setBotEnabled} />
          </div>
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
          </div>
        </div>

        <div className="flex gap-2">
          <SaveButton onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
            {saved ? '已保存' : '保存配置'}
          </SaveButton>
          <SolidButton color="secondary" icon="lucide:wifi" onClick={() => testMutation.mutate()} loading={testMutation.isPending} loadingText="测试中...">
            测试连接
          </SolidButton>
          <SolidButton color="secondary" icon="lucide:message-circle" onClick={() => testMessageMutation.mutate()} loading={testMessageMutation.isPending} loadingText="发送中...">
            测试消息
          </SolidButton>
        </div>

        {testMutation.isSuccess && <p className="text-xs text-green-600">连接成功</p>}
        {testMutation.isError && <p className="text-xs text-destructive">连接失败：{(testMutation.error as any)?.response?.data?.detail || '请检查配置'}</p>}
        {testMessageMutation.isSuccess && <p className="text-xs text-emerald-600">测试消息已发送</p>}
        {testMessageMutation.isError && <p className="text-xs text-destructive">测试消息发送失败：{(testMessageMutation.error as any)?.response?.data?.detail || '未知错误'}</p>}
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
      toast.success('配置已保存');
    },
    onError: () => toast.error('保存失败，请重试'),
  });

  return (
    <Card className="gap-4 py-5">
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
              <div
                className="h-6 w-6"
                style={{
                  backgroundImage: 'url(https://app.tavily.com/img/logo/logo.svg)',
                  backgroundPosition: '0 center',
                  backgroundSize: 'auto 100%',
                  backgroundRepeat: 'no-repeat',
                }}
              />
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
  supabase_access_token_masked: string;
  supabase_access_token_set: boolean;
}

function SupabaseCard() {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [serviceKey, setServiceKey] = useState('');
  const [bucket, setBucket] = useState('');
  const [accessToken, setAccessToken] = useState('');
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
        supabase_access_token: accessToken || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-config'] });
      setSaved(true);
      setServiceKey('');
      setAccessToken('');
      setTimeout(() => setSaved(false), 2000);
      toast.success('配置已保存');
    },
    onError: () => toast.error('保存失败，请重试'),
  });

  const testMutation = useMutation({
    mutationFn: () => api.get<{ success: boolean; error: string }>('/sandbox/storage/test').then((r) => r.data),
    onSuccess: () => toast.success('连接测试成功'),
    onError: () => toast.error('连接测试失败'),
  });

  const configured = config?.supabase_service_key_set;

  return (
    <Card className="gap-4 py-5">
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
              <div
                className="h-6 w-6"
                style={{
                  backgroundImage: 'url(https://raw.githubusercontent.com/supabase/supabase/master/packages/common/assets/images/supabase-logo-icon.svg)',
                  backgroundPosition: 'center',
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat',
                }}
              />
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
          {config?.supabase_access_token_set && (
            <p className="text-[11px] text-muted-foreground">
              当前 Access Token: {config.supabase_access_token_masked}（输入新值可覆盖）
            </p>
          )}
          <Field label="Access Token" value={accessToken} onChange={setAccessToken} placeholder="sbp_xxxxxxxxxxxxxxxx" type="password" />
          <p className="text-[11px] text-muted-foreground">
            聊天中上传的文件会自动推送到 Supabase Storage。配置 Access Token 后 AI 可直接执行 SQL 操作数据库。
            前往 <a href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noreferrer" className="underline">Account → Access Tokens</a> 生成。
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
