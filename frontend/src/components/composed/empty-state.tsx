import { Icon } from '@iconify/react';
import { SolidButton, type ColorPreset } from '@/components/composed/solid-button';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Color-tinted icon backgrounds                                      */
/* ------------------------------------------------------------------ */

const iconTints: Record<string, { bg: string; ring: string; text: string }> = {
  primary: {
    bg: 'bg-primary/10 dark:bg-primary/15',
    ring: 'ring-primary/20',
    text: 'text-primary',
  },
  success: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    ring: 'ring-emerald-500/20',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  indigo: {
    bg: 'bg-indigo-500/10 dark:bg-indigo-500/15',
    ring: 'ring-indigo-500/20',
    text: 'text-indigo-600 dark:text-indigo-400',
  },
  violet: {
    bg: 'bg-violet-500/10 dark:bg-violet-500/15',
    ring: 'ring-violet-500/20',
    text: 'text-violet-600 dark:text-violet-400',
  },
  cyan: {
    bg: 'bg-cyan-500/10 dark:bg-cyan-500/15',
    ring: 'ring-cyan-500/20',
    text: 'text-cyan-600 dark:text-cyan-400',
  },
  rose: {
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    ring: 'ring-rose-500/20',
    text: 'text-rose-600 dark:text-rose-400',
  },
  destructive: {
    bg: 'bg-destructive/10 dark:bg-destructive/15',
    ring: 'ring-destructive/20',
    text: 'text-destructive',
  },
  warning: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    ring: 'ring-amber-500/20',
    text: 'text-amber-600 dark:text-amber-400',
  },
  create: {
    bg: 'bg-zinc-100 dark:bg-zinc-700/40',
    ring: 'ring-zinc-200 dark:ring-zinc-600',
    text: 'text-zinc-600 dark:text-zinc-300',
  },
};

const neutralTint = {
  bg: 'bg-muted',
  ring: 'ring-border',
  text: 'text-muted-foreground',
};

/* ------------------------------------------------------------------ */
/*  EmptyState                                                         */
/* ------------------------------------------------------------------ */

interface EmptyStateProps {
  icon: string;
  /** 用 SVG 矢量插图替代图标（优先于 icon） */
  illustration?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void; color?: ColorPreset };
  className?: string;
}

export function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const tint = action?.color ? (iconTints[action.color] ?? neutralTint) : neutralTint;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-6 py-20',
        className
      )}
    >
      {illustration ? (
        <img
          src={illustration}
          alt={title}
          className="h-48 w-48 object-contain opacity-90"
          draggable={false}
        />
      ) : (
        <div
          className={cn(
            'flex h-18 w-18 items-center justify-center rounded-2xl ring-1',
            tint.bg,
            tint.ring,
          )}
        >
          <Icon icon={icon} width={36} height={36} className={tint.text} />
        </div>
      )}

      {/* Text */}
      <div className="text-center">
        <p className="text-base font-semibold text-foreground">{title}</p>
        {description && (
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {/* CTA Button */}
      {action && (
        <SolidButton
          size="default"
          color={action.color}
          icon="lucide:plus"
          onClick={action.onClick}
        >
          {action.label}
        </SolidButton>
      )}
    </div>
  );
}
