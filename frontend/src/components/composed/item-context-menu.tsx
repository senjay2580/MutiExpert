import { Icon } from '@iconify/react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Action definition                                                   */
/* ------------------------------------------------------------------ */

export interface ItemAction {
  key: string;
  label: string;
  icon?: string;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
  /** Return false to prevent menu close */
  onClick: () => void;
}

export interface ItemActionGroup {
  actions: ItemAction[];
}

/* ------------------------------------------------------------------ */
/*  ItemContextMenu — right-click context menu wrapper                  */
/* ------------------------------------------------------------------ */

interface ItemContextMenuProps {
  actions: (ItemAction | 'separator')[];
  children: React.ReactNode;
  className?: string;
  /** Also render a "..." trigger button (default false) */
  showTriggerButton?: boolean;
  triggerClassName?: string;
}

/**
 * Shared context menu for list items.
 * Wraps children with a right-click context menu AND optionally
 * shows a "..." dropdown button.
 *
 * Usage:
 * ```tsx
 * <ItemContextMenu actions={[
 *   { key: 'edit', label: '编辑', icon: 'lucide:pencil', onClick: handleEdit },
 *   'separator',
 *   { key: 'delete', label: '删除', icon: 'lucide:trash-2', variant: 'destructive', onClick: handleDelete },
 * ]}>
 *   <MyListItem />
 * </ItemContextMenu>
 * ```
 */
export function ItemContextMenu({
  actions,
  children,
  className,
  showTriggerButton = false,
  triggerClassName,
}: ItemContextMenuProps) {
  const menuItems = actions.map((action, i) =>
    action === 'separator' ? (
      <ContextMenuSeparator key={`sep-${i}`} />
    ) : (
      <ContextMenuItem
        key={action.key}
        variant={action.variant}
        disabled={action.disabled}
        onClick={action.onClick}
      >
        {action.icon && <Icon icon={action.icon} width={14} height={14} />}
        {action.label}
      </ContextMenuItem>
    ),
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild className={className}>
        <div className="relative">
          {children}
          {showTriggerButton && (
            <MoreDropdown
              actions={actions}
              className={triggerClassName}
            />
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-40">
        {menuItems}
      </ContextMenuContent>
    </ContextMenu>
  );
}

/* ------------------------------------------------------------------ */
/*  MoreDropdown — "..." button that opens a dropdown (same actions)    */
/* ------------------------------------------------------------------ */

interface MoreDropdownProps {
  actions: (ItemAction | 'separator')[];
  className?: string;
}

export function MoreDropdown({ actions, className }: MoreDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className={cn(
            'opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground z-10',
            className,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Icon icon="lucide:ellipsis-vertical" width={14} height={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {actions.map((action, i) =>
          action === 'separator' ? (
            <DropdownMenuSeparator key={`sep-${i}`} />
          ) : (
            <DropdownMenuItem
              key={action.key}
              variant={action.variant}
              disabled={action.disabled}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick();
              }}
            >
              {action.icon && <Icon icon={action.icon} width={14} height={14} />}
              {action.label}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
