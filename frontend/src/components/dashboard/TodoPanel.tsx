import { useState, useRef, useEffect, useMemo } from 'react';
import { Icon } from '@iconify/react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTodoStore, type TodoPriority } from '@/stores/useTodoStore';

const priorityConfig: Record<TodoPriority, { label: string; color: string; icon: string }> = {
  high: { label: '高', color: 'text-rose-500', icon: 'lucide:arrow-up' },
  medium: { label: '中', color: 'text-amber-500', icon: 'lucide:minus' },
  low: { label: '低', color: 'text-blue-500', icon: 'lucide:arrow-down' },
};

const priorityCycle: TodoPriority[] = ['medium', 'high', 'low'];

export function TodoPanel() {
  const todos = useTodoStore((s) => s.todos);
  const loading = useTodoStore((s) => s.loading);
  const panelOpen = useTodoStore((s) => s.panelOpen);
  const setPanelOpen = useTodoStore((s) => s.setPanelOpen);
  const addTodo = useTodoStore((s) => s.addTodo);
  const toggleTodo = useTodoStore((s) => s.toggleTodo);
  const removeTodo = useTodoStore((s) => s.removeTodo);
  const clearCompleted = useTodoStore((s) => s.clearCompleted);
  const [input, setInput] = useState('');
  const [priority, setPriority] = useState<TodoPriority>('medium');
  const inputRef = useRef<HTMLInputElement>(null);

  const { pending, completed } = useMemo(() => {
    const pending: typeof todos = [];
    const completed: typeof todos = [];
    for (const todo of todos) {
      (todo.completed ? completed : pending).push(todo);
    }
    return { pending, completed };
  }, [todos]);

  useEffect(() => {
    if (!panelOpen) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 300);
    return () => window.clearTimeout(id);
  }, [panelOpen]);

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    addTodo(trimmed, priority);
    setInput('');
    setPriority('medium');
  };

  const cyclePriority = () => {
    const idx = priorityCycle.indexOf(priority);
    setPriority(priorityCycle[(idx + 1) % priorityCycle.length]);
  };

  return (
    <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
      <SheetContent side="right" className="w-[380px] sm:max-w-[380px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Icon icon="lucide:list-todo" className="size-5" />
            任务看板
            {pending.length > 0 && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {pending.length} 待办
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>管理你的待办事项</SheetDescription>
        </SheetHeader>

        {/* Add todo */}
        <div className="flex items-center gap-2 px-4">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={cyclePriority}
            title={`优先级: ${priorityConfig[priority].label}`}
          >
            <Icon icon={priorityConfig[priority].icon} className={cn('size-3.5', priorityConfig[priority].color)} />
          </Button>
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="添加新任务..."
            className="flex-1 h-8 text-sm"
          />
          <Button size="icon-xs" onClick={handleAdd} disabled={!input.trim()}>
            <Icon icon="lucide:plus" className="size-3.5" />
          </Button>
        </div>

        {/* Todo list */}
        <div className="flex-1 overflow-y-auto px-4 space-y-1">
          {loading && todos.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Icon icon="lucide:loader-2" className="size-6 mb-2 animate-spin opacity-40" />
              <p className="text-sm">加载中...</p>
            </div>
          )}

          {!loading && pending.length === 0 && completed.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Icon icon="lucide:inbox" className="size-10 mb-2 opacity-40" />
              <p className="text-sm">暂无任务</p>
            </div>
          )}

          {pending.map((todo) => (
            <div
              key={todo.id}
              className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors"
            >
              <button onClick={() => toggleTodo(todo.id)} className="shrink-0">
                <Icon icon="lucide:circle" className="size-4 text-muted-foreground hover:text-primary transition-colors" />
              </button>
              <Icon icon={priorityConfig[todo.priority].icon} className={cn('size-3 shrink-0', priorityConfig[todo.priority].color)} />
              <span className="flex-1 text-sm truncate">{todo.title}</span>
              <button
                onClick={() => removeTodo(todo.id)}
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Icon icon="lucide:x" className="size-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}

          {completed.length > 0 && (
            <>
              <div className="pt-3 pb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  已完成 ({completed.length})
                </span>
                <button
                  onClick={clearCompleted}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  清除全部
                </button>
              </div>
              {completed.map((todo) => (
                <div
                  key={todo.id}
                  className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors"
                >
                  <button onClick={() => toggleTodo(todo.id)} className="shrink-0">
                    <Icon icon="lucide:check-circle-2" className="size-4 text-emerald-500" />
                  </button>
                  <span className="flex-1 text-sm truncate line-through text-muted-foreground">{todo.title}</span>
                  <button
                    onClick={() => removeTodo(todo.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Icon icon="lucide:x" className="size-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
