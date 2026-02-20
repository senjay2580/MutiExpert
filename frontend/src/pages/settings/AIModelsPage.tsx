import { useState } from 'react';
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

const MOCK_MODELS = [
  { id: 'claude', name: 'Claude 4 Opus', provider: 'Anthropic' },
  { id: 'gpt4', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'gemini', name: 'Gemini 2.0 Pro', provider: 'Google' },
  { id: 'deepseek', name: 'DeepSeek V3', provider: 'DeepSeek' },
];

export default function AIModelsPage() {
  const currentModel = useAppStore((s) => s.currentModel);
  const setCurrentModel = useAppStore((s) => s.setCurrentModel);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [keys, setKeys] = useState<Record<string, string>>({});

  const { data: rawModels = [], isLoading } = useQuery({
    queryKey: ['ai-models'],
    queryFn: () =>
      api
        .get<Array<{ id: string; name: string; provider: string }>>('/config/models')
        .then((r) => r.data),
  });
  const models = rawModels.length > 0 ? rawModels : MOCK_MODELS;

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
        const isSelected = currentModel === model.id;

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
                  onClick={() => setCurrentModel(model.id as 'claude' | 'codex')}
                >
                  {isSelected ? '当前使用' : '切换'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Input
                  type={showKeys[model.id] ? 'text' : 'password'}
                  placeholder="API Key（服务端已配置则无需填写）"
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
