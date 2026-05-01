import { useState } from 'react';
import { Icon } from '@iconify/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({ children }) => (
                    <div className="my-2 overflow-x-auto rounded-lg border border-border">
                      <table className="w-full !m-0 border-collapse text-sm">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
                  th: ({ children }) => <th className="px-3 py-2 text-left text-xs font-semibold text-foreground border-b border-border [&:not(:last-child)]:border-r [&:not(:last-child)]:border-border/30">{children}</th>,
                  td: ({ children }) => <td className="px-3 py-2 border-b border-border/40 [&:not(:last-child)]:border-r [&:not(:last-child)]:border-border/20">{children}</td>,
                  tr: ({ children }) => <tr className="hover:bg-primary/5 even:bg-muted/15">{children}</tr>,
                  // 拦截 ```log 代码块渲染成可折叠的"执行日志"块（类似 thinking）
                  code: (props: any) => {
                    const { className, children } = props;
                    const inline = !className;
                    if (!inline && className === 'language-log') {
                      const text = String(children).replace(/\n$/, '');
                      const lineCount = text.split('\n').length;
                      return (
                        <Collapsible className="my-2">
                          <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/60 transition-colors [&[data-state=open]>svg:first-child]:rotate-90">
                            <Icon icon="lucide:chevron-right" className="h-3.5 w-3.5 transition-transform" />
                            <Icon icon="lucide:terminal" className="h-3.5 w-3.5" />
                            <span>执行日志（{lineCount} 行）</span>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <pre className="mt-1 overflow-x-auto rounded-md bg-zinc-950 px-3 py-2 text-[11px] leading-relaxed text-zinc-200">
                              <code className="font-mono">{text}</code>
                            </pre>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    }
                    return inline
                      ? <code className={className}>{children}</code>
                      : <pre className="my-2 overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs"><code className={className}>{children}</code></pre>;
                  },
                }}
              >
                {content}
              </ReactMarkdown>
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
