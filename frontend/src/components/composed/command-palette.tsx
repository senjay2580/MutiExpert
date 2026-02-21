import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAppStore } from '@/stores/useAppStore';
import { useTheme } from '@/hooks/useTheme';
import { useNavItems } from '@/hooks/useNavItems';
import type { Theme } from '@/stores/useAppStore';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';

/* ---- Command data ---- */

const themeCommands: { label: string; icon: string; theme: Theme }[] = [
  { label: '切换到浅色模式', icon: 'streamline-color:brightness-1',        theme: 'light' },
  { label: '切换到深色模式', icon: 'streamline-color:waning-cresent-moon', theme: 'dark' },
];

/* ---- Component ---- */

export function CommandPalette() {
  const open = useAppStore((s) => s.commandPaletteOpen);
  const setOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const navigate = useNavigate();
  const { setThemeWithTransition } = useTheme();
  const { overviewNav, systemSubNav } = useNavItems();

  const navCommands = useMemo(
    () => [...overviewNav, ...systemSubNav],
    [overviewNav, systemSubNav],
  );

  // Global Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden rounded-2xl p-0 sm:max-w-md" showCloseButton={false} showWindowDots={false}>
        <DialogTitle className="sr-only">命令面板</DialogTitle>
        <DialogDescription className="sr-only">搜索命令或页面</DialogDescription>
        <Command className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-3 [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-3 [&_[cmdk-item]]:rounded-xl">
          <CommandInput placeholder="输入命令或搜索..." className="px-4 py-3" />
          <CommandList>
            <CommandEmpty>没有找到匹配的命令</CommandEmpty>

            <CommandGroup heading="导航">
              {navCommands.map((item) => (
                <CommandItem
                  key={item.path}
                  value={item.label}
                  onSelect={() => run(() => navigate(item.path))}
                >
                  <Icon icon={item.icon} className="size-4" />
                  <span>{item.label}</span>
                  <CommandShortcut>{item.path}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="主题">
              {themeCommands.map((item) => (
                <CommandItem
                  key={item.theme}
                  value={item.label}
                  onSelect={() => run(() => setThemeWithTransition(item.theme))}
                >
                  <Icon icon={item.icon} className="size-4" />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
