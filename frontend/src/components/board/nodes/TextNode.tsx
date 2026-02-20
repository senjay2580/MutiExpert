import { useState, useCallback } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { cn } from '@/lib/utils';

export type TextNodeData = {
  text?: string;
  onDataChange?: (id: string, data: Partial<TextNodeData>) => void;
};

type TextNodeType = Node<TextNodeData, 'text'>;

export function TextNode({ id, data, selected }: NodeProps<TextNodeType>) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(data.text ?? '');

  const commitText = useCallback(() => {
    setEditing(false);
    data.onDataChange?.(id, { text });
  }, [id, text, data]);

  return (
    <div
      className={cn(
        'min-w-[160px] max-w-[320px] rounded-md border bg-card px-3 py-2 shadow-sm transition-shadow',
        selected && 'ring-2 ring-primary/40 shadow-md',
      )}
    >
      <Handle type="target" position={Position.Top} className="!size-2 !border-0 !bg-muted-foreground/40" />

      {editing ? (
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => { if (e.key === 'Escape') commitText(); }}
          className="w-full min-w-[140px] resize-none bg-transparent text-sm leading-relaxed text-foreground outline-none"
          rows={3}
        />
      ) : (
        <div
          className={cn(
            'min-h-[24px] cursor-text whitespace-pre-wrap text-sm leading-relaxed text-foreground',
            !text && 'text-muted-foreground/50 italic',
          )}
          onDoubleClick={() => setEditing(true)}
        >
          {text || '双击编辑文本...'}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!size-2 !border-0 !bg-muted-foreground/40" />
    </div>
  );
}
