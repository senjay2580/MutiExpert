import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { useSidebarState } from '@/components/ui/sidebar';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import type { Theme } from '@/stores/useAppStore';

const themeOptions: { value: Theme; icon: string; label: string }[] = [
  { value: 'light', icon: 'streamline-color:brightness-1', label: '浅色' },
  { value: 'dark', icon: 'streamline-color:waning-cresent-moon', label: '深色' },
];

export function ThemeToggle() {
  const { theme, setThemeWithTransition } = useTheme();
  const { state } = useSidebarState();
  const collapsed = state === 'collapsed';

  if (collapsed) {
    const current =
      themeOptions.find((o) => o.value === theme) ?? themeOptions[0];
    const nextIndex =
      (themeOptions.findIndex((o) => o.value === theme) + 1) %
      themeOptions.length;
    const next = themeOptions[nextIndex];

    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip={`当前: ${current.label}，点击切换到${next.label}`}
            onClick={(e) => setThemeWithTransition(next.value, e)}
          >
            <Icon icon={current.icon} />
            <span>切换主题</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-sidebar-accent/60 p-0.5">
      {themeOptions.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            onClick={(e) => setThemeWithTransition(option.value, e)}
            title={option.label}
            className={cn(
              'flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] font-medium transition-all duration-200',
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                : 'text-sidebar-foreground/35 hover:text-sidebar-foreground/60'
            )}
          >
            <Icon icon={option.icon} className="size-3.5" />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
