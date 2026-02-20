import { useState, useCallback } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';

const PRIORITIES: Record<string, { label: string; color: string; dot: string }> = {
  high:   { label: '高', color: 'text-rose-600 dark:text-rose-400', dot: 'bg-rose-500' },
  medium: { label: '中', color: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  low:    { label: '低', color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
};

export type TaskNodeData = {
  title?: string;
  completed?: boolean;
  priority?: 'high' | 'medium' | 'low';
  onDataChange?: (id: string, data: Partial<TaskNodeData>) => void;
};

type TaskNodeType = Node<TaskNodeData, 'task'>;

export function TaskNode({ id, data, selected }: NodeProps<TaskNodeType>) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(data.title ?? '');
  const pri = PRIORITIES[data.priority ?? 'medium'];

  const commitTitle = useCallback(() => {
    setEditing(false);
    data.onDataChange?.(id, { title });
  }, [id, title, data]);

  const toggleComplete = useCallback(() => {
    data.onDataChange?.(id, { completed: !data.completed });
  }, [id, data]);

  const cyclePriority = useCallback(() => {
    const order: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high'];
    const cur = data.priority ?? 'medium';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    data.onDataChange?.(id, { priority: next });
  }, [id, data]);

  return (
    <div
      className={cn(
        'w-[220px] rounded-lg border bg-card shadow-sm transition-shadow',
        selected && 'ring-2 ring-primary/40 shadow-md',
      )}
    >
      <Handle type="target" position={Position.Top} className="!size-2 !border-0 !bg-primary/60" />

      <div className="flex items-start gap-2.5 px-3 py-3">
        {/* Checkbox */}
        <button
          onClick={toggleComplete}
          className={cn(
            'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
            data.completed
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-muted-foreground/30 hover:border-primary/50',
          )}
        >
          {data.completed && <Icon icon="lucide:check" className="size-3" />}
        </button>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') commitTitle();
              }}
              className="w-full bg-transparent text-[13px] font-medium text-foreground outline-none"
            />
          ) : (
            <div
              className={cn(
                'cursor-text text-[13px] font-medium leading-snug',
                data.completed ? 'text-muted-foreground line-through' : 'text-foreground',
                !title && 'text-muted-foreground/50 italic',
              )}
              onDoubleClick={() => setEditing(true)}
            >
              {title || '双击编辑任务...'}
            </div>
          )}

          {/* Priority */}
          <button
            onClick={cyclePriority}
            className="mt-1.5 flex items-center gap-1 text-[11px]"
            title="点击切换优先级"
          >
            <span className={cn('size-1.5 rounded-full', pri.dot)} />
            <span className={pri.color}>{pri.label}优先级</span>
          </button>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!size-2 !border-0 !bg-primary/60" />
    </div>
  );
}
