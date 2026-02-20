import type { ModelProvider } from '@/types';

const OpenAIIcon = ({ size = 20 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24">
    <path fill="currentColor" d="M22.418 9.822a5.903 5.903 0 0 0-.52-4.91 6.1 6.1 0 0 0-2.822-2.513 6.204 6.204 0 0 0-3.78-.389A6.06 6.06 0 0 0 13.232.501 6.2 6.2 0 0 0 10.726 0a6.16 6.16 0 0 0-3.939 1.267 6.01 6.01 0 0 0-2.17 3.503 6.1 6.1 0 0 0-2.345 1.02 5.96 5.96 0 0 0-1.71 1.879 5.93 5.93 0 0 0 .753 7.092 5.9 5.9 0 0 0 .52 4.911 6.1 6.1 0 0 0 2.821 2.513 6.2 6.2 0 0 0 3.78.389 6.06 6.06 0 0 0 2.065 1.508 6.2 6.2 0 0 0 2.505.501 6.16 6.16 0 0 0 3.94-1.267 6.01 6.01 0 0 0 2.17-3.503 6.1 6.1 0 0 0 2.344-1.02 5.96 5.96 0 0 0 1.71-1.879 5.93 5.93 0 0 0-.752-7.092m-9.218 13.14a4.6 4.6 0 0 1-2.918-1.04l.145-.081 4.846-2.757a.77.77 0 0 0 .397-.682v-6.737l2.05 1.168q.03.017.038.052v5.583c-.003 2.479-2.041 4.49-4.558 4.494m-9.795-4.125a4.42 4.42 0 0 1-.54-3.015l.144.086 4.847 2.757a.8.8 0 0 0 .79 0l5.922-3.37v2.333a.07.07 0 0 1-.03.062l-4.903 2.79c-2.18 1.24-4.967.502-6.23-1.643m-1.275-10.41A4.5 4.5 0 0 1 4.604 6.37v5.673a.76.76 0 0 0 .392.676l5.895 3.35-2.048 1.168a.07.07 0 0 1-.072 0l-4.899-2.787a4.42 4.42 0 0 1-1.668-6.14zm16.824 3.858-5.923-3.398 2.044-1.164a.07.07 0 0 1 .072 0l4.899 2.787a4.47 4.47 0 0 1 1.757 1.812 4.44 4.44 0 0 1-.405 4.796 4.58 4.58 0 0 1-2.04 1.494v-5.645a.76.76 0 0 0-.404-.682m2.04-3.022-.144-.086-4.847-2.757a.8.8 0 0 0-.79 0l-5.922 3.37V8.257a.06.06 0 0 1 .03-.061l4.9-2.782a4.61 4.61 0 0 1 4.885.208c.712.487 1.267 1.16 1.604 1.944.336.784.44 1.647.293 2.487zM8.254 12.862l-2.05-1.168a.06.06 0 0 1-.038-.056V6.072c0-.86.254-1.7.73-2.411a4.56 4.56 0 0 1 1.912-1.658 4.62 4.62 0 0 1 4.85.616l-.145.082-4.846 2.756a.77.77 0 0 0-.397.682zm1.113-2.364 2.637-1.5 2.644 1.5v3l-2.635 1.5-2.644-1.5z" />
  </svg>
);

// Provider icon URLs from lobehub CDN (same as Lumina project)
const PROVIDER_ICON_URLS: Record<string, string> = {
  claude: 'https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.78.0/dark/claude-color.png',
  deepseek: 'https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.78.0/dark/deepseek-color.png',
  qwen: 'https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.78.0/dark/qwen-color.png',
};

const PROVIDER_COLORS: Record<string, string> = {
  claude: '#D97757',
  openai: '#10A37F',
  codex: '#10A37F',
  deepseek: '#4D6BFE',
  qwen: '#615CED',
};

export function ProviderIcon({
  provider,
  size = 20,
  className,
}: {
  provider: string;
  size?: number;
  className?: string;
}) {
  const normalized = provider === 'codex' ? 'openai' : provider;

  // OpenAI uses inline SVG
  if (normalized === 'openai') {
    return (
      <span className={className} style={{ display: 'inline-flex', flexShrink: 0 }}>
        <OpenAIIcon size={size} />
      </span>
    );
  }

  // Others use CDN image
  const url = PROVIDER_ICON_URLS[normalized];
  if (url) {
    return (
      <img
        src={url}
        alt={normalized}
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain', display: 'block', flexShrink: 0 }}
      />
    );
  }

  // Fallback
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#94a3b8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
      </svg>
    </div>
  );
}

export function ProviderIconWithBg({
  provider,
  size = 'md',
  className,
}: {
  provider: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeMap = { sm: 24, md: 36, lg: 44 };
  const iconMap = { sm: 16, md: 22, lg: 28 };
  const px = sizeMap[size];
  const color = PROVIDER_COLORS[provider] || '#94a3b8';

  return (
    <div
      className={className}
      style={{
        width: px,
        height: px,
        borderRadius: 10,
        background: `${color}14`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <ProviderIcon provider={provider} size={iconMap[size]} />
    </div>
  );
}

export function getProviderColor(provider: string): string {
  return PROVIDER_COLORS[provider] || '#94a3b8';
}

export function getProviderLabel(provider: ModelProvider | string): string {
  const labels: Record<string, string> = {
    claude: 'Claude',
    openai: 'OpenAI',
    codex: 'OpenAI',
    deepseek: 'DeepSeek',
    qwen: '通义千问',
  };
  return labels[provider] || provider;
}
