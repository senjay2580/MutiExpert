import { type DragEvent } from 'react';
import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';
import type { BoardNodeType } from './nodes';

interface ToolItem {
  type: BoardNodeType;
  label: string;
  icon: string;
  color: string;
}

const TOOLS: ToolItem[] = [
  { type: 'sticky', label: '便签', icon: 'lucide:sticky-note', color: 'text-amber-500' },
  { type: 'task', label: '任务卡', icon: 'lucide:check-square', color: 'text-emerald-500' },
  { type: 'text', label: '文本', icon: 'lucide:type', color: 'text-sky-500' },
  { type: 'image', label: '图片', icon: 'lucide:image', color: 'text-violet-500' },
];

interface BoardToolbarProps {
  className?: string;
}

export function BoardToolbar({ className }: BoardToolbarProps) {
  const onDragStart = (e: DragEvent<HTMLDivElement>, nodeType: string) => {
    e.dataTransfer.setData('application/reactflow', nodeType);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className={cn(
      'absolute left-3 top-3 z-10 flex flex-col gap-1 rounded-xl border bg-background/95 p-1.5 shadow-lg backdrop-blur-sm',
      className,
    )}>
      <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        组件
      </div>
      {TOOLS.map((tool) => (
        <div
          key={tool.type}
          draggable
          onDragStart={(e) => onDragStart(e, tool.type)}
          className="flex cursor-grab items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-accent active:cursor-grabbing"
          title={`拖拽添加${tool.label}`}
        >
          <Icon icon={tool.icon} className={cn('size-4', tool.color)} />
          <span className="text-[12px] font-medium text-foreground">{tool.label}</span>
        </div>
      ))}
    </div>
  );
}
