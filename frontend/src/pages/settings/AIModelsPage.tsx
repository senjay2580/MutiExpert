import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@iconify/react';

import api from '@/services/api';
import { useAppStore } from '@/stores/useAppStore';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/composed/page-header';
import { EmptyState } from '@/components/composed/empty-state';
import { illustrationPresets } from '@/lib/illustrations';
import { CardSkeleton } from '@/components/composed/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ProviderIconWithBg } from '@/components/composed/provider-icon';
import type { ModelProvider } from '@/types';

type AvailableModel = { id: string; name: string };

type ModelConfig = {
  id: string;
  name: string;
  provider: string;
  base_url?: string | null;
  model?: string | null;
  api_key_set: boolean;
  reasoning_effort?: string | null;
  disable_response_storage?: boolean | null;
  preferred_auth_method?: string | null;
  wire_api?: string | null;
  requires_openai_auth?: boolean | null;
  available_models?: AvailableModel[];
};

type ModelForm = {
  base_url: string;
  model: string;
  reasoning_effort: string;
  disable_response_storage: boolean;
  preferred_auth_method: string;
};

type TestResult = { ok: boolean; message: string };

export default function AIModelsPage() {
  const currentModel = useAppStore((s) => s.currentModel);
  const setCurrentModel = useAppStore((s) => s.setCurrentModel);
  const normalizedCurrent = currentModel === 'codex' ? 'openai' : currentModel;

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [forms, setForms] = useState<Record<string, ModelForm>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>();
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  const { data: models = [], isLoading, refetch } = useQuery({
    queryKey: ['ai-models'],
    queryFn: () => api.get<ModelConfig[]>('/config/models').then((r) => r.data),
  });

  useEffect(() => {
    setForms((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const model of models) {
        if (!next[model.id]) {
          next[model.id] = {
            base_url: model.base_url || '',
            model: model.model || '',
            reasoning_effort: model.reasoning_effort || '',
            disable_response_storage: Boolean(model.disable_response_storage),
            preferred_auth_method: model.preferred_auth_method || '',
          };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [models]);

  const saveConfig = async (model: ModelConfig) => {
    const form = forms[model.id];
    if (!form) return;
    setSaving((prev) => ({ ...prev, [model.id]: true }));
    try {
      const payload: Record<string, unknown> = {
        base_url: form.base_url,
        model: form.model,
        reasoning_effort: form.reasoning_effort || null,
        disable_response_storage: form.disable_response_storage,
        preferred_auth_method: form.preferred_auth_method || null,
      };
      if (keys[model.id]) payload.api_key = keys[model.id];
      await api.put(`/config/models/${model.id}`, payload);
      setKeys((prev) => ({ ...prev, [model.id]: '' }));
      await refetch();
    } finally {
      setSaving((prev) => ({ ...prev, [model.id]: false }));
    }
  };

  const testConnection = async (model: ModelConfig) => {
    setTesting((prev) => ({ ...prev, [model.id]: true }));
    setTestResults((prev) => ({ ...prev, [model.id]: { ok: false, message: '测试中...' } }));
    try {
      const response = await api.post<{ ok: boolean; message: string }>(`/config/models/${model.id}/test`);
      setTestResults((prev) => ({ ...prev, [model.id]: response.data }));
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : '连接失败';
      setTestResults((prev) => ({ ...prev, [model.id]: { ok: false, message: message || '连接失败' } }));
    } finally {
      setTesting((prev) => ({ ...prev, [model.id]: false }));
    }
  };

  const isRelay = (id: string) => id === 'openai' || id === 'claude';

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="AI 模型配置" description="配置模型参数与 API Key" />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="AI 模型配置" description="配置模型参数与 API Key" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {models.map((model) => {
          const isExpanded = expandedId === model.id;
          const isSelected = normalizedCurrent === model.id;
          const form = forms[model.id];
          const hasModels = (model.available_models?.length ?? 0) > 0;

          return (
            <div
              key={model.id}
              className={cn(
                'rounded-xl border bg-card shadow-sm overflow-hidden transition-all',
                isExpanded && 'lg:col-span-2 border-primary/30',
                !isExpanded && isSelected && 'border-primary/40',
                !isExpanded && !isSelected && 'border-border',
              )}
            >
              {/* Header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : model.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <ProviderIconWithBg provider={model.id} size="md" />
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{model.name}</span>
                      {model.api_key_set && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 rounded">
                          已配置
                        </span>
                      )}
                      {isSelected && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded">
                          当前使用
                        </span>
                      )}
                      {isRelay(model.id) && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded">
                          中转
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {hasModels
                        ? model.available_models!.slice(0, 3).map((m) => m.name).join(', ') +
                          (model.available_models!.length > 3 ? '...' : '')
                        : model.model || model.provider}
                    </p>
                  </div>
                </div>
                <Icon icon="lucide:chevron-down" width={16} height={16} className={cn('text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
              </button>

              {/* Expanded config form */}
              {isExpanded && form && (
                <div className="px-4 pb-4 pt-2 bg-muted/20 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* API Key */}
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">API Key</label>
                      <div className="relative">
                        <Input
                          type={showKeys[model.id] ? 'text' : 'password'}
                          placeholder={model.api_key_set ? '已配置，留空不改' : 'sk-...'}
                          value={keys[model.id] || ''}
                          onChange={(e) => setKeys((prev) => ({ ...prev, [model.id]: e.target.value }))}
                          className="pr-10 font-mono text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKeys((prev) => ({ ...prev, [model.id]: !prev[model.id] }))}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                        >
                          <Icon icon={showKeys[model.id] ? 'lucide:eye-off' : 'lucide:eye'} width={14} height={14} />
                        </button>
                      </div>
                    </div>

                    {/* Model selector */}
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                        {hasModels ? '默认模型' : '模型名称'}
                      </label>
                      {hasModels ? (
                        <select
                          value={form.model}
                          onChange={(e) =>
                            setForms((prev) => ({ ...prev, [model.id]: { ...prev[model.id], model: e.target.value } }))
                          }
                          className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs focus:ring-2 ring-primary/20 outline-none"
                        >
                          {model.available_models!.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          placeholder="模型名称"
                          value={form.model}
                          onChange={(e) =>
                            setForms((prev) => ({ ...prev, [model.id]: { ...prev[model.id], model: e.target.value } }))
                          }
                          className="text-xs"
                        />
                      )}
                    </div>

                    {/* Base URL - full width */}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                        Base URL {isRelay(model.id) ? '（中转地址）' : '（可选）'}
                      </label>
                      <Input
                        placeholder={model.base_url || 'https://api.example.com/v1'}
                        value={form.base_url}
                        onChange={(e) =>
                          setForms((prev) => ({ ...prev, [model.id]: { ...prev[model.id], base_url: e.target.value } }))
                        }
                        className="text-xs"
                      />
                    </div>

                    {/* OpenAI-specific fields */}
                    {model.id === 'openai' && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Reasoning Effort</label>
                          <Input
                            placeholder="xhigh"
                            value={form.reasoning_effort}
                            onChange={(e) =>
                              setForms((prev) => ({ ...prev, [model.id]: { ...prev[model.id], reasoning_effort: e.target.value } }))
                            }
                            className="text-xs"
                          />
                        </div>
                        <div className="flex items-end gap-4">
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Auth Method</label>
                            <Input
                              placeholder="apikey 或 bearer"
                              value={form.preferred_auth_method}
                              onChange={(e) =>
                                setForms((prev) => ({
                                  ...prev,
                                  [model.id]: { ...prev[model.id], preferred_auth_method: e.target.value },
                                }))
                              }
                              className="text-xs"
                            />
                          </div>
                          <div className="flex items-center gap-2 pb-1">
                            <span className="text-xs text-muted-foreground">禁用存储</span>
                            <Switch
                              checked={form.disable_response_storage}
                              onCheckedChange={(checked) =>
                                setForms((prev) => ({
                                  ...prev,
                                  [model.id]: { ...prev[model.id], disable_response_storage: checked },
                                }))
                              }
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    <Button size="sm" onClick={() => saveConfig(model)} disabled={saving?.[model.id]}>
                      {saving?.[model.id] ? '保存中...' : '保存'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => testConnection(model)} disabled={testing[model.id]}>
                      {testing[model.id] ? '测试中...' : '测试连接'}
                    </Button>
                    {!isSelected && model.api_key_set && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setCurrentModel(model.id as ModelProvider)}
                      >
                        设为当前
                      </Button>
                    )}
                    {testResults[model.id] && (
                      <span className={cn('text-xs ml-2', testResults[model.id].ok ? 'text-emerald-500' : 'text-destructive')}>
                        {testResults[model.id].message}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {models.length === 0 && (
        <EmptyState
          icon="streamline-color:artificial-intelligence-spark"
          illustration={illustrationPresets.emptyAIModels}
          title="无法加载模型列表"
          description="请检查后端连接"
        />
      )}
    </div>
  );
}
