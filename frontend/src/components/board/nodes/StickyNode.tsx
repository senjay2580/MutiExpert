import { useState, useCallback, useEffect } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { cn } from '@/lib/utils';

const COLORS: Record<string, { bg: string; border: string; handle: string }> = {
  yellow: { bg: 'bg-amber-100 dark:bg-amber-900/40', border: 'border-amber-300 dark:border-amber-700', handle: 'bg-amber-400' },
  green:  { bg: 'bg-emerald-100 dark:bg-emerald-900/40', border: 'border-emerald-300 dark:border-emerald-700', handle: 'bg-emerald-400' },
  blue:   { bg: 'bg-sky-100 dark:bg-sky-900/40', border: 'border-sky-300 dark:border-sky-700', handle: 'bg-sky-400' },
  pink:   { bg: 'bg-pink-100 dark:bg-pink-900/40', border: 'border-pink-300 dark:border-pink-700', handle: 'bg-pink-400' },
  violet: { bg: 'bg-violet-100 dark:bg-violet-900/40', border: 'border-violet-300 dark:border-violet-700', handle: 'bg-violet-400' },
};

export type StickyNodeData = {
  text?: string;
  color?: string;
  __editTrigger?: number;
  onDataChange?: (id: string, data: Partial<StickyNodeData>) => void;
};

type StickyNodeType = Node<StickyNodeData, 'sticky'>;

export function StickyNode({ id, data, selected }: NodeProps<StickyNodeType>) {
  const color = COLORS[data.color ?? 'yellow'] ?? COLORS.yellow;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(data.text ?? '');

  useEffect(() => {
    if (!data.__editTrigger) return;
    setText(data.text ?? '');
    setEditing(true);
  }, [data.__editTrigger, data.text]);

  const commitText = useCallback(() => {
    setEditing(false);
    data.onDataChange?.(id, { text });
  }, [id, text, data]);

  return (
    <div
      className={cn(
        'relative min-h-[100px] w-[180px] rounded-sm border p-3 shadow-sm transition-shadow',
        color.bg,
        color.border,
        selected && 'ring-2 ring-primary/40 shadow-md',
      )}
    >
      <Handle type="target" position={Position.Top} className={cn('!size-2 !border-0', color.handle)} />

      {editing ? (
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => { if (e.key === 'Escape') commitText(); }}
          className="w-full resize-none bg-transparent text-[13px] leading-relaxed text-foreground outline-none"
          rows={4}
        />
      ) : (
        <div
          className={cn(
            'min-h-[60px] cursor-text whitespace-pre-wrap text-[13px] leading-relaxed text-foreground',
            !text && 'text-muted-foreground/50 italic',
          )}
          onDoubleClick={() => setEditing(true)}
        >
          {text || '双击编辑...'}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className={cn('!size-2 !border-0', color.handle)} />
    </div>
  );
}
