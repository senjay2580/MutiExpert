import { Sun, Moon, Monitor } from 'lucide-react';
import clsx from 'clsx';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../stores/useAppStore';

const themeOptions: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: 'light', icon: Sun, label: '浅色' },
  { value: 'dark', icon: Moon, label: '深色' },
  { value: 'system', icon: Monitor, label: '跟随系统' },
];

export function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const { theme, setTheme } = useTheme();

  if (collapsed) {
    const current = themeOptions.find((o) => o.value === theme) ?? themeOptions[0];
    const nextIndex = (themeOptions.findIndex((o) => o.value === theme) + 1) % themeOptions.length;
    const next = themeOptions[nextIndex];
    return (
      <button
        onClick={() => setTheme(next.value)}
        title={`当前: ${current.label}，点击切换到${next.label}`}
        className={clsx(
          'w-full flex items-center justify-center py-2.5 rounded-lg cursor-pointer',
          'text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors'
        )}
        style={{ transitionDuration: 'var(--duration-fast)' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <current.icon size={18} strokeWidth={1.8} />
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-1 p-1 rounded-lg"
      style={{ background: 'var(--bg-sunken)' }}
    >
      {themeOptions.map((option) => {
        const Icon = option.icon;
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            onClick={() => setTheme(option.value)}
            title={option.label}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-medium cursor-pointer transition-all',
              active
                ? 'text-[var(--text-primary)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            )}
            style={{
              background: active ? 'var(--bg-surface)' : 'transparent',
              boxShadow: active ? 'var(--shadow-xs)' : 'none',
              transitionDuration: 'var(--duration-normal)',
            }}
          >
            <Icon size={14} strokeWidth={1.8} />
          </button>
        );
      })}
    </div>
  );
}
