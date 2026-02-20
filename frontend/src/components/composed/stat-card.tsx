import { Icon } from '@iconify/react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** Map hex color → accent glow utility */
const colorToGlow: Record<string, string> = {
  '#6366f1': 'card-glow-indigo',
  '#3b82f6': 'card-glow-blue',
  '#10b981': 'card-glow-emerald',
  '#f59e0b': 'card-glow-amber',
  '#8b5cf6': 'card-glow-violet',
  '#06b6d4': 'card-glow-cyan',
  '#ef4444': 'card-glow-rose',
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  iconColor?: string;
  description?: string;
  trend?: { value: string; direction: 'up' | 'down' | 'flat' };
  className?: string;
}

export function StatCard({
  label,
  value,
  icon,
  iconColor,
  description,
  trend,
  className,
}: StatCardProps) {
  const glowClass = iconColor ? colorToGlow[iconColor.toLowerCase()] ?? '' : '';

  return (
    <Card className={cn('gap-0 py-0', glowClass, className)}>
      <CardContent className="flex flex-col gap-3 px-5 py-5">
        {/* Icon — gradient fill bg */}
        <div
          className="flex size-10 items-center justify-center rounded-xl"
          style={iconColor
            ? { background: `linear-gradient(135deg, ${iconColor}20, ${iconColor}08)`, color: iconColor }
            : undefined
          }
        >
          <Icon
            icon={icon}
            width={20}
            height={20}
            className={cn(!iconColor && 'text-primary')}
          />
        </div>

        {/* Label */}
        <p className="text-xs font-medium text-muted-foreground">
          {label}
        </p>

        {/* Value + Trend */}
        <div className="flex items-end justify-between gap-2">
          <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums leading-none">
            {value}
          </p>
          {trend && (
            <span className={cn(
              'inline-flex items-center gap-0.5 text-[11px] font-medium leading-none',
              trend.direction === 'up' && 'text-emerald-600 dark:text-emerald-400',
              trend.direction === 'down' && 'text-rose-600 dark:text-rose-400',
              trend.direction === 'flat' && 'text-muted-foreground',
            )}>
              {trend.direction === 'up' && <Icon icon="streamline-color:graph-arrow-increase" width={12} height={12} />}
              {trend.direction === 'down' && <Icon icon="streamline-color:graph-arrow-decrease" width={12} height={12} />}
              {trend.direction === 'flat' && <Icon icon="streamline-color:subtract-1" width={12} height={12} />}
              {trend.value}
            </span>
          )}
        </div>

        {description && (
          <p className="truncate text-[11px] text-muted-foreground -mt-1">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
