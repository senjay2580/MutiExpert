import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface IndustryBadgeProps {
  industry: string;
  size?: 'sm' | 'md';
  className?: string;
}

const INDUSTRY_COLOR_MAP: Record<string, string> = {
  technology: '--industry-technology',
  finance: '--industry-finance',
  healthcare: '--industry-healthcare',
  education: '--industry-education',
  manufacturing: '--industry-manufacturing',
  retail: '--industry-retail',
  energy: '--industry-energy',
  media: '--industry-media',
  '科技': '--industry-technology',
  '金融': '--industry-finance',
  '医疗': '--industry-healthcare',
  '教育': '--industry-education',
  '制造': '--industry-manufacturing',
  '零售': '--industry-retail',
  '能源': '--industry-energy',
  '媒体': '--industry-media',
};

function getIndustryCssVar(industry: string): string | undefined {
  const key = industry.toLowerCase();
  return INDUSTRY_COLOR_MAP[key];
}

export function IndustryBadge({
  industry,
  size = 'md',
  className,
}: IndustryBadgeProps) {
  const cssVar = getIndustryCssVar(industry);

  return (
    <Badge
      variant="secondary"
      className={cn(
        size === 'sm' && 'px-1.5 py-0 text-[10px]',
        size === 'md' && 'px-2 py-0.5 text-xs',
        className
      )}
      style={
        cssVar
          ? {
              backgroundColor: `var(${cssVar}, hsl(var(--secondary)))`,
              color: `var(${cssVar}-foreground, hsl(var(--secondary-foreground)))`,
            }
          : undefined
      }
    >
      {industry}
    </Badge>
  );
}
