import { useState, useCallback } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';

export type ImageNodeData = {
  src?: string;
  alt?: string;
  onDataChange?: (id: string, data: Partial<ImageNodeData>) => void;
};

type ImageNodeType = Node<ImageNodeData, 'image'>;

export function ImageNode({ id, data, selected }: NodeProps<ImageNodeType>) {
  const [editUrl, setEditUrl] = useState(false);
  const [urlInput, setUrlInput] = useState(data.src ?? '');

  const commitUrl = useCallback(() => {
    setEditUrl(false);
    if (urlInput.trim() !== (data.src ?? '')) {
      data.onDataChange?.(id, { src: urlInput.trim() });
    }
  }, [id, urlInput, data]);

  return (
    <div
      className={cn(
        'w-[200px] overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow',
        selected && 'ring-2 ring-primary/40 shadow-md',
      )}
    >
      <Handle type="target" position={Position.Top} className="!size-2 !border-0 !bg-violet-400" />

      {data.src ? (
        <img
          src={data.src}
          alt={data.alt ?? '图片'}
          className="h-auto max-h-[300px] w-full object-contain"
          draggable={false}
        />
      ) : (
        <div className="flex h-[120px] flex-col items-center justify-center gap-2 bg-muted/30 text-muted-foreground">
          <Icon icon="lucide:image" className="size-8 opacity-40" />
          <span className="text-[11px]">粘贴图片或输入 URL</span>
        </div>
      )}

      {/* URL input on bottom */}
      {editUrl ? (
        <div className="border-t px-2 py-1.5">
          <input
            autoFocus
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onBlur={commitUrl}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') commitUrl(); }}
            placeholder="输入图片 URL..."
            className="w-full bg-transparent text-[11px] text-foreground outline-none"
          />
        </div>
      ) : (
        <button
          className="flex w-full items-center justify-center gap-1 border-t px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-accent transition-colors"
          onClick={() => {
            setUrlInput(data.src ?? '');
            setEditUrl(true);
          }}
        >
          <Icon icon="lucide:link" className="size-3" />
          {data.src ? '修改 URL' : '输入 URL'}
        </button>
      )}

      <Handle type="source" position={Position.Bottom} className="!size-2 !border-0 !bg-violet-400" />
    </div>
  );
}
