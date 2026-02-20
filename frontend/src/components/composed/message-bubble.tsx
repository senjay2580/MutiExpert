import { useState } from 'react';
import { Icon } from '@iconify/react';
import ReactMarkdown from 'react-markdown';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface MessageSource {
  document_name: string;
  content_preview: string;
  relevance_score: number;
  document_id: string;
}

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  sources?: MessageSource[];
  isStreaming?: boolean;
  timestamp?: string;
  className?: string;
}

export function MessageBubble({
  role,
  content,
  sources,
  isStreaming,
  timestamp,
  className,
}: MessageBubbleProps) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const isAssistant = role === 'assistant';

  return (
    <div
      className={cn(
        'flex gap-3',
        !isAssistant && 'flex-row-reverse',
        className
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          isAssistant
            ? 'bg-primary/10 text-primary'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {isAssistant ? (
          <Icon icon="streamline-color:artificial-intelligence-spark" width={16} height={16} />
        ) : (
          <Icon icon="streamline-color:user-circle-single" width={16} height={16} />
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          'min-w-0 max-w-[80%] rounded-xl px-4 py-3',
          isAssistant
            ? 'bg-card text-card-foreground border'
            : 'bg-primary text-primary-foreground'
        )}
      >
        <div
          className={cn(
            'text-sm leading-relaxed',
            isAssistant && 'prose prose-sm max-w-none'
          )}
        >
          {isAssistant ? (
            <>
              <ReactMarkdown>{content}</ReactMarkdown>
              {isStreaming && (
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-primary" />
              )}
            </>
          ) : (
            <p className="m-0 whitespace-pre-wrap">{content}</p>
          )}
        </div>

        {/* Sources */}
        {sources && sources.length > 0 && (
          <Collapsible open={sourcesOpen} onOpenChange={setSourcesOpen}>
            <CollapsibleTrigger
              className={cn(
                'mt-3 flex items-center gap-1 text-xs font-medium transition-colors',
                isAssistant
                  ? 'text-muted-foreground hover:text-foreground'
                  : 'text-primary-foreground/80 hover:text-primary-foreground'
              )}
            >
              <Icon icon="streamline-color:new-file" width={12} height={12} />
              <span>
                {sources.length} 个参考来源
              </span>
              <Icon
                icon="streamline-color:arrow-down-2"
                width={12}
                height={12}
                className={cn(
                  'transition-transform',
                  sourcesOpen && 'rotate-180'
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-2">
                {sources.map((src, i) => (
                  <div
                    key={`${src.document_id}-${i}`}
                    className={cn(
                      'rounded-md border p-2',
                      isAssistant
                        ? 'border-border bg-muted/50'
                        : 'border-primary-foreground/20 bg-primary-foreground/10'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium">
                        {src.document_name}
                      </span>
                      <span className="shrink-0 text-[10px] opacity-70">
                        {Math.round(src.relevance_score * 100)}%
                      </span>
                    </div>
                    {src.content_preview && (
                      <p className="mt-1 line-clamp-2 text-[11px] opacity-70">
                        {src.content_preview}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Timestamp */}
        {timestamp && (
          <p
            className={cn(
              'mt-2 text-[11px]',
              isAssistant
                ? 'text-muted-foreground'
                : 'text-primary-foreground/70'
            )}
          >
            {timestamp}
          </p>
        )}
      </div>
    </div>
  );
}
