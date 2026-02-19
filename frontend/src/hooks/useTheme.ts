import { useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';

export function useTheme() {
  const { theme, resolvedTheme, setTheme, setResolvedTheme } = useAppStore();

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = () => {
      const effective = theme === 'system'
        ? (mediaQuery.matches ? 'dark' : 'light')
        : theme;
      root.classList.toggle('dark', effective === 'dark');
      setResolvedTheme(effective);
    };

    apply();

    if (theme === 'system') {
      mediaQuery.addEventListener('change', apply);
      return () => mediaQuery.removeEventListener('change', apply);
    }
  }, [theme, setResolvedTheme]);

  return { theme, resolvedTheme, setTheme };
}
