import * as React from 'react';
import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Color presets                                                      */
/* ------------------------------------------------------------------ */

const colorPresets = {
  primary: {
    bg: 'bg-primary',
    text: 'text-primary-foreground',
    shadow: 'shadow-primary/40',
    shadowDark: 'dark:shadow-primary/30',
    hoverBg: 'hover:brightness-110',
    border: 'border-primary/20',
  },
  destructive: {
    bg: 'bg-destructive',
    text: 'text-white',
    shadow: 'shadow-destructive/40',
    shadowDark: 'dark:shadow-destructive/30',
    hoverBg: 'hover:brightness-110',
    border: 'border-destructive/20',
  },
  secondary: {
    bg: 'bg-secondary',
    text: 'text-secondary-foreground',
    shadow: 'shadow-secondary/30',
    shadowDark: 'dark:shadow-black/20',
    hoverBg: 'hover:brightness-95 dark:hover:brightness-125',
    border: 'border-secondary/30',
  },
  success: {
    bg: 'bg-emerald-600 dark:bg-emerald-500',
    text: 'text-white',
    shadow: 'shadow-emerald-600/40',
    shadowDark: 'dark:shadow-emerald-500/30',
    hoverBg: 'hover:brightness-110',
    border: 'border-emerald-700/20',
  },
  warning: {
    bg: 'bg-amber-500 dark:bg-amber-500',
    text: 'text-white',
    shadow: 'shadow-amber-500/40',
    shadowDark: 'dark:shadow-amber-500/30',
    hoverBg: 'hover:brightness-110',
    border: 'border-amber-600/20',
  },
  indigo: {
    bg: 'bg-indigo-600 dark:bg-indigo-500',
    text: 'text-white',
    shadow: 'shadow-indigo-600/40',
    shadowDark: 'dark:shadow-indigo-500/30',
    hoverBg: 'hover:brightness-110',
    border: 'border-indigo-700/20',
  },
  violet: {
    bg: 'bg-violet-600 dark:bg-violet-500',
    text: 'text-white',
    shadow: 'shadow-violet-600/40',
    shadowDark: 'dark:shadow-violet-500/30',
    hoverBg: 'hover:brightness-110',
    border: 'border-violet-700/20',
  },
  cyan: {
    bg: 'bg-cyan-600 dark:bg-cyan-500',
    text: 'text-white',
    shadow: 'shadow-cyan-600/40',
    shadowDark: 'dark:shadow-cyan-500/30',
    hoverBg: 'hover:brightness-110',
    border: 'border-cyan-700/20',
  },
  rose: {
    bg: 'bg-rose-600 dark:bg-rose-500',
    text: 'text-white',
    shadow: 'shadow-rose-600/40',
    shadowDark: 'dark:shadow-rose-500/30',
    hoverBg: 'hover:brightness-110',
    border: 'border-rose-700/20',
  },
  /** 新建按钮专用：渐变立体 3D */
  create: {
    bg: 'bg-gradient-to-b from-zinc-100 to-zinc-250 dark:from-zinc-700 dark:to-zinc-800',
    text: 'text-zinc-700 dark:text-zinc-200',
    shadow: 'shadow-zinc-400/60',
    shadowDark: 'dark:shadow-black/80',
    hoverBg: 'hover:from-zinc-150 hover:to-zinc-300 dark:hover:from-zinc-600 dark:hover:to-zinc-750',
    border: 'border-zinc-300 dark:border-zinc-600',
  },
} as const;

type ColorPreset = keyof typeof colorPresets;

/* ------------------------------------------------------------------ */
/*  Size presets                                                       */
/* ------------------------------------------------------------------ */

const sizePresets = {
  xs: 'h-7 px-2.5 text-xs gap-1.5 rounded-lg',
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  default: 'h-9 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-10 px-5 text-sm gap-2 rounded-xl',
  icon: 'size-9 rounded-xl',
  'icon-xs': 'size-7 rounded-lg',
  'icon-sm': 'size-8 rounded-lg',
} as const;

/** Icon pixel sizes matching each button size */
const iconSizes: Record<SizePreset, number> = {
  xs: 12,
  sm: 14,
  default: 16,
  lg: 16,
  icon: 16,
  'icon-xs': 14,
  'icon-sm': 14,
};

type SizePreset = keyof typeof sizePresets;

/* ------------------------------------------------------------------ */
/*  SolidButton - base 3D button                                       */
/* ------------------------------------------------------------------ */

interface SolidButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  color?: ColorPreset;
  /** Override with any tailwind bg/text/shadow classes */
  customColor?: {
    bg: string;
    text: string;
    shadow: string;
  };
  size?: SizePreset;
  icon?: string;
  loading?: boolean;
  loadingText?: string;
}

const SolidButton = React.forwardRef<HTMLButtonElement, SolidButtonProps>(
  (
    {
      color = 'primary',
      customColor,
      size = 'default',
      icon: iconName,
      loading = false,
      loadingText,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;
    const iSize = iconSizes[size];

    const c = customColor
      ? {
          bg: customColor.bg,
          text: customColor.text,
          shadow: customColor.shadow,
          shadowDark: '',
          hoverBg: 'hover:brightness-110',
          border: '',
        }
      : colorPresets[color];

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          // layout
          'relative inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium',
          'select-none outline-none overflow-hidden btn-shine',
          // 3D depth
          c.bg,
          c.text,
          `shadow-[0_3px_0_0] ${c.shadow} ${c.shadowDark}`,
          c.border && `border-b ${c.border}`,
          // hover: lift slightly
          !isDisabled && [
            c.hoverBg,
            'hover:-translate-y-[1px] hover:shadow-[0_4px_0_0]',
          ],
          // active: press down
          !isDisabled && 'active:translate-y-[1px] active:shadow-[0_1px_0_0]',
          // transition
          'transition-all duration-100',
          // disabled
          isDisabled && 'pointer-events-none opacity-55',
          // focus
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          // size
          sizePresets[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <>
            <Icon icon="streamline-color:signal-loading" width={iSize} height={iSize} className="shrink-0 animate-spin" />
            {loadingText ?? children}
          </>
        ) : (
          <>
            {iconName && <Icon icon={iconName} width={iSize} height={iSize} className="shrink-0" />}
            {children}
          </>
        )}
      </button>
    );
  },
);
SolidButton.displayName = 'SolidButton';

/* ------------------------------------------------------------------ */
/*  Preset shared buttons                                              */
/* ------------------------------------------------------------------ */

type SharedProps = Omit<SolidButtonProps, 'icon' | 'color'> & {
  color?: ColorPreset;
};

/** 新建 / Create */
function CreateButton({ children = '新建', color = 'create', className, ...props }: SharedProps) {
  return (
    <SolidButton icon="lucide:plus" color={color} className={className} {...props}>
      <span className="hidden sm:inline">{children}</span>
    </SolidButton>
  );
}

/** 保存 / Save */
function SaveButton({
  children = '保存',
  loadingText = '保存中...',
  color = 'primary',
  ...props
}: SharedProps) {
  return (
    <SolidButton icon="streamline-color:floppy-disk" color={color} loadingText={loadingText} {...props}>
      {children}
    </SolidButton>
  );
}

/** 删除 / Delete */
function DeleteButton({
  children,
  loadingText = '删除中...',
  color = 'destructive',
  size = 'icon-xs',
  ...props
}: SharedProps) {
  return (
    <SolidButton icon="streamline-color:recycle-bin-2" color={color} size={size} loadingText={loadingText} {...props}>
      {children}
    </SolidButton>
  );
}

/** 编辑 / Edit */
function EditButton({ children = '编辑', color = 'secondary', size = 'xs', ...props }: SharedProps) {
  return (
    <SolidButton icon="streamline-color:pencil" color={color} size={size} {...props}>
      {children}
    </SolidButton>
  );
}

/** 执行 / Run */
function RunButton({ children = '执行', color = 'success', size = 'xs', ...props }: SharedProps) {
  return (
    <SolidButton icon="streamline-color:button-play" color={color} size={size} {...props}>
      {children}
    </SolidButton>
  );
}

/** 取消 / Cancel */
function CancelButton({ children = '取消', color = 'secondary', ...props }: SharedProps) {
  return (
    <SolidButton icon="streamline-color:delete-1" color={color} {...props}>
      {children}
    </SolidButton>
  );
}

export {
  SolidButton,
  CreateButton,
  SaveButton,
  DeleteButton,
  EditButton,
  RunButton,
  CancelButton,
  colorPresets,
  type ColorPreset,
  type SizePreset,
  type SolidButtonProps,
};
