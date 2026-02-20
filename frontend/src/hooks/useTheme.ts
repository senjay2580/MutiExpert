import { useCallback, useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import type { Theme } from '../stores/useAppStore';

function applyThemeToDOM(theme: Theme): 'light' | 'dark' {
  const root = document.documentElement;
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const effective =
    theme === 'system' ? (mediaQuery.matches ? 'dark' : 'light') : theme;
  root.classList.toggle('dark', effective === 'dark');
  return effective;
}

export function useTheme() {
  const theme = useAppStore((s) => s.theme);
  const resolvedTheme = useAppStore((s) => s.resolvedTheme);
  const setTheme = useAppStore((s) => s.setTheme);
  const setResolvedTheme = useAppStore((s) => s.setResolvedTheme);

  useEffect(() => {
    const effective = applyThemeToDOM(theme);
    setResolvedTheme(effective);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => {
        const eff = applyThemeToDOM(theme);
        setResolvedTheme(eff);
      };
      mediaQuery.addEventListener('change', onChange);
      return () => mediaQuery.removeEventListener('change', onChange);
    }
  }, [theme, setResolvedTheme]);

  /**
   * Toggle theme with a circle-expand view transition.
   * Pass the React.MouseEvent from the toggle button so the
   * circle originates at the click position.
   */
  const setThemeWithTransition = useCallback(
    (newTheme: Theme, e?: React.MouseEvent) => {
      // Fallback: no event or browser doesn't support View Transitions
      if (!e || !document.startViewTransition) {
        const effective = applyThemeToDOM(newTheme);
        setResolvedTheme(effective);
        setTheme(newTheme);
        return;
      }

      const x = e.clientX;
      const y = e.clientY;
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );

      const transition = document.startViewTransition(() => {
        const effective = applyThemeToDOM(newTheme);
        setResolvedTheme(effective);
        setTheme(newTheme);
      });

      transition.ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 500,
            easing: 'ease-out',
            pseudoElement: '::view-transition-new(root)',
          },
        );
      });
    },
    [setTheme, setResolvedTheme],
  );

  return { theme, resolvedTheme, setTheme, setThemeWithTransition };
}
