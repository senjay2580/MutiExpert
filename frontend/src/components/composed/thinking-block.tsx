import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
}

export function ThinkingBlock({ content, isStreaming }: ThinkingBlockProps) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!isStreaming && content) {
      const timer = setTimeout(() => setOpen(false), 600);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, content]);

  if (!content) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-2">
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
        <Icon
          icon="lucide:brain"
          width={13}
          height={13}
          className={cn('text-violet-500/70', isStreaming && 'animate-pulse')}
        />
        <span className="font-medium">
          {isStreaming ? '思考中...' : '思考过程'}
        </span>
        {!isStreaming && (
          <span className="text-[10px] text-muted-foreground/50">
            {content.length} 字
          </span>
        )}
        <Icon
          icon={open ? 'lucide:chevron-up' : 'lucide:chevron-down'}
          width={11}
          height={11}
          className="ml-auto"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className={cn(
          'mt-1.5 mb-3 max-h-[300px] overflow-y-auto rounded-lg border-l-2 border-violet-500/30',
          'bg-violet-500/5 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground',
          'font-mono whitespace-pre-wrap',
        )}>
          {content}
          {isStreaming && (
            <span className="ml-0.5 inline-flex items-center gap-0.5">
              <span className="inline-block size-1 animate-bounce rounded-full bg-violet-500/60 [animation-delay:0ms]" />
              <span className="inline-block size-1 animate-bounce rounded-full bg-violet-500/60 [animation-delay:150ms]" />
              <span className="inline-block size-1 animate-bounce rounded-full bg-violet-500/60 [animation-delay:300ms]" />
            </span>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
