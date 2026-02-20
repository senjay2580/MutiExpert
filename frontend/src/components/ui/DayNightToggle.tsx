import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';

/**
 * Animated day/night toggle — pill shape with sun/moon, clouds/stars.
 * Uses the View Transitions API circle-expand animation on click.
 */
export function DayNightToggle({ className }: { className?: string }) {
  const { resolvedTheme, setThemeWithTransition } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
      onClick={(e) => setThemeWithTransition(isDark ? 'light' : 'dark', e)}
      className={cn(
        'relative flex h-[22px] w-[42px] shrink-0 cursor-pointer items-center rounded-full p-[2px] transition-all duration-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        isDark
          ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950'
          : 'bg-gradient-to-br from-sky-300 via-blue-400 to-blue-500',
        className,
      )}
    >
      {/* ---- Night: stars ---- */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 overflow-hidden rounded-full transition-opacity duration-500',
          isDark ? 'opacity-100' : 'opacity-0',
        )}
      >
        <span className="absolute left-[6px] top-[4px] h-[2px] w-[2px] rounded-full bg-white" />
        <span className="absolute left-[13px] top-[13px] h-[1.5px] w-[1.5px] rounded-full bg-white/80" />
        <span className="absolute left-[4px] top-[14px] h-[1.5px] w-[1.5px] rounded-full bg-white/60" />
        <span className="absolute left-[16px] top-[5px] h-[1px] w-[1px] rounded-full bg-white/50" />
        <span className="absolute left-[10px] top-[7px] text-[5px] leading-none text-white/90">
          ✦
        </span>
      </div>

      {/* ---- Day: clouds ---- */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 overflow-hidden rounded-full transition-opacity duration-500',
          isDark ? 'opacity-0' : 'opacity-100',
        )}
      >
        <span className="absolute bottom-[1px] right-[3px] h-[6px] w-[10px] rounded-full bg-white/80" />
        <span className="absolute bottom-[3px] right-[9px] h-[5px] w-[7px] rounded-full bg-white/60" />
        <span className="absolute bottom-[0px] right-[7px] h-[4px] w-[8px] rounded-full bg-white/40" />
      </div>

      {/* ---- Thumb: Sun / Moon ---- */}
      <div
        className={cn(
          'relative z-10 h-[18px] w-[18px] rounded-full transition-all duration-500',
          isDark
            ? 'translate-x-[20px] bg-gradient-to-br from-gray-100 to-gray-300 shadow-[0_0_6px_rgba(255,255,255,0.25)]'
            : 'translate-x-0 bg-gradient-to-br from-yellow-200 via-yellow-300 to-amber-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]',
        )}
      >
        {/* Moon craters */}
        <div
          className={cn(
            'absolute inset-0 transition-opacity duration-500',
            isDark ? 'opacity-100' : 'opacity-0',
          )}
        >
          <span className="absolute right-[2px] top-[2px] h-[5px] w-[5px] rounded-full bg-gray-400/50" />
          <span className="absolute bottom-[3px] left-[3px] h-[3px] w-[3px] rounded-full bg-gray-400/40" />
          <span className="absolute bottom-[2px] right-[5px] h-[2px] w-[2px] rounded-full bg-gray-400/30" />
        </div>

        {/* Sun inner glow */}
        <div
          className={cn(
            'absolute inset-[2px] rounded-full bg-yellow-200/60 transition-opacity duration-500',
            isDark ? 'opacity-0' : 'opacity-100',
          )}
        />
      </div>
    </button>
  );
}
