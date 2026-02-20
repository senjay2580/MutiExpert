import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useBoardEditorStore } from '@/stores/useBoardEditorStore';
import { cn } from '@/lib/utils';

interface BoardTopBarProps {
  name: string;
  onBack: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onImport: () => void;
  onTemplate: () => void;
}

export function BoardTopBar({
  name,
  onBack,
  onSave,
  onUndo,
  onRedo,
  onExport,
  onImport,
  onTemplate,
}: BoardTopBarProps) {
  const { isDirty, isSaving, canUndo, canRedo, showMiniMap, toggleMiniMap, showToolbar, toggleToolbar } =
    useBoardEditorStore();

  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b bg-background/95 px-3 backdrop-blur-sm">
      {/* Left */}
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" onClick={onBack}>
                <Icon icon="lucide:arrow-left" className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">返回列表</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Separator orientation="vertical" className="h-5" />

        <div className="flex items-center gap-1.5">
          <Icon icon="streamline-color:artboard-tool" className="size-4" />
          <span className="text-sm font-medium text-foreground truncate max-w-[200px]">{name}</span>
          {isDirty && (
            <span className="size-1.5 rounded-full bg-amber-500" title="未保存的更改" />
          )}
        </div>
      </div>

      {/* Center - Actions */}
      <div className="flex items-center gap-0.5">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" onClick={onUndo} disabled={!canUndo()}>
                <Icon icon="lucide:undo-2" className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">撤销 (Ctrl+Z)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" onClick={onRedo} disabled={!canRedo()}>
                <Icon icon="lucide:redo-2" className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">重做 (Ctrl+Shift+Z)</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="mx-1 h-5" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn('size-8', showToolbar && 'bg-accent')}
                onClick={toggleToolbar}
              >
                <Icon icon="lucide:panel-left" className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">工具栏</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn('size-8', showMiniMap && 'bg-accent')}
                onClick={toggleMiniMap}
              >
                <Icon icon="lucide:map" className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">小地图</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="mx-1 h-5" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" onClick={onTemplate}>
                <Icon icon="lucide:layout-template" className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">模板</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" onClick={onImport}>
                <Icon icon="lucide:upload" className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">导入 JSON</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" onClick={onExport}>
                <Icon icon="lucide:download" className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">导出 JSON</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Right - Save */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">
          {isSaving ? '保存中...' : isDirty ? '有未保存更改' : '已保存'}
        </span>
        <Button
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={onSave}
          disabled={isSaving || !isDirty}
        >
          <Icon icon="lucide:save" className="size-3.5" />
          保存
        </Button>
      </div>
    </div>
  );
}
