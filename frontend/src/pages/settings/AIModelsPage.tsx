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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

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
};

type ModelForm = {
  base_url: string;
  model: string;
  reasoning_effort: string;
  disable_response_storage: boolean;
  preferred_auth_method: string;
};

export default function AIModelsPage() {
  const currentModel = useAppStore((s) => s.currentModel);
  const normalizedCurrent = currentModel === 'codex' ? 'openai' : currentModel;
  const setCurrentModel = useAppStore((s) => s.setCurrentModel);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [forms, setForms] = useState<Record<string, ModelForm>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const { data: rawModels = [], isLoading, refetch } = useQuery({
    queryKey: ['ai-models'],
    queryFn: () =>
      api
        .get<ModelConfig[]>('/config/models')
        .then((r) => r.data),
  });
  const models = rawModels;

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
      if (keys[model.id]) {
        payload.api_key = keys[model.id];
      }
      await api.put(`/config/models/${model.id}`, payload);
      setKeys((prev) => ({ ...prev, [model.id]: '' }));
      await refetch();
    } finally {
      setSaving((prev) => ({ ...prev, [model.id]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="AI 模型配置" description="选择默认模型，配置 API Key" />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="AI 模型配置" description="选择默认模型，配置 API Key" />

      {models.map((model) => {
        const isSelected = normalizedCurrent === model.id;
        const form = forms[model.id];

        return (
          <Card
            key={model.id}
            className={cn(
              'gap-4 py-5',
              isSelected && 'border-2 border-primary'
            )}
          >
            <CardHeader className="py-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm">{model.name}</CardTitle>
                  <CardDescription className="text-xs">{model.provider}</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant={isSelected ? 'default' : 'outline'}
                  onClick={() => setCurrentModel(model.id as 'claude' | 'openai' | 'codex')}
                >
                  {isSelected ? '当前使用' : '切换'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {model.id === 'openai' && (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Base URL（如：https://ls.xingchentech.asia/openai）"
                      value={form?.base_url || ''}
                      onChange={(e) =>
                        setForms((prev) => ({
                          ...prev,
                          [model.id]: { ...(prev[model.id] || {}), base_url: e.target.value },
                        }))
                      }
                      className="flex-1 text-xs"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="模型名称（如：gpt-5.3-codex / claude-sonnet-4-20250514）"
                    value={form?.model || ''}
                    onChange={(e) =>
                      setForms((prev) => ({
                        ...prev,
                        [model.id]: { ...(prev[model.id] || {}), model: e.target.value },
                      }))
                    }
                    className="flex-1 text-xs"
                  />
                </div>
                {model.id === 'openai' && (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Reasoning Effort（如：xhigh）"
                      value={form?.reasoning_effort || ''}
                      onChange={(e) =>
                        setForms((prev) => ({
                          ...prev,
                          [model.id]: { ...(prev[model.id] || {}), reasoning_effort: e.target.value },
                        }))
                      }
                      className="flex-1 text-xs"
                    />
                    <Input
                      placeholder="Auth Method（apikey 或 bearer）"
                      value={form?.preferred_auth_method || ''}
                      onChange={(e) =>
                        setForms((prev) => ({
                          ...prev,
                          [model.id]: { ...(prev[model.id] || {}), preferred_auth_method: e.target.value },
                        }))
                      }
                      className="flex-1 text-xs"
                    />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>禁用存储</span>
                      <Switch
                        checked={Boolean(form?.disable_response_storage)}
                        onCheckedChange={(checked) =>
                          setForms((prev) => ({
                            ...prev,
                            [model.id]: { ...(prev[model.id] || {}), disable_response_storage: checked },
                          }))
                        }
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    type={showKeys[model.id] ? 'text' : 'password'}
                    placeholder={model.api_key_set ? 'API Key（已配置，可留空不改）' : 'API Key（必填）'}
                    value={keys[model.id] || ''}
                    onChange={(e) =>
                      setKeys((prev) => ({ ...prev, [model.id]: e.target.value }))
                    }
                    className="flex-1 font-mono text-xs"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setShowKeys((prev) => ({
                        ...prev,
                        [model.id]: !prev[model.id],
                      }))
                    }
                  >
                    {showKeys[model.id] ? <Icon icon="streamline-color:invisible-1" width={14} height={14} /> : <Icon icon="streamline-color:visible" width={14} height={14} />}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => saveConfig(model)}
                    disabled={saving[model.id]}
                  >
                    {saving[model.id] ? '保存中...' : '保存'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

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
