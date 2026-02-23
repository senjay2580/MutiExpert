import { Icon } from "@iconify/react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useTheme } from "@/hooks/useTheme"
import { cn } from "@/lib/utils"

type ToastKind = "success" | "info" | "warning" | "error" | "loading"

function ToastGlyph({ kind }: { kind: ToastKind }) {
  const config: Record<ToastKind, { icon: string; ring: string; bg: string }> =
    {
      success: {
        icon: "lucide:check-circle-2",
        bg: "bg-gradient-to-br from-emerald-500/90 to-cyan-500/90",
        ring: "shadow-[0_10px_30px_rgba(16,185,129,0.25)]",
      },
      info: {
        icon: "lucide:info",
        bg: "bg-gradient-to-br from-blue-500/90 to-indigo-500/90",
        ring: "shadow-[0_10px_30px_rgba(59,130,246,0.25)]",
      },
      warning: {
        icon: "lucide:triangle-alert",
        bg: "bg-gradient-to-br from-amber-500/95 to-orange-500/90",
        ring: "shadow-[0_10px_30px_rgba(245,158,11,0.25)]",
      },
      error: {
        icon: "lucide:x-circle",
        bg: "bg-gradient-to-br from-rose-500/90 to-red-500/90",
        ring: "shadow-[0_10px_30px_rgba(244,63,94,0.25)]",
      },
      loading: {
        icon: "lucide:loader-2",
        bg: "bg-gradient-to-br from-zinc-500/70 to-slate-500/70",
        ring: "shadow-[0_10px_30px_rgba(0,0,0,0.15)]",
      },
    }

  const { icon, bg, ring } = config[kind]

  return (
    <span
      className={cn(
        "flex size-8 items-center justify-center rounded-2xl text-white",
        bg,
        ring
      )}
    >
      <Icon
        icon={icon}
        className={cn("size-4", kind === "loading" && "animate-spin")}
      />
    </span>
  )
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <Sonner
      theme={resolvedTheme as ToasterProps["theme"]}
      position="top-right"
      closeButton
      className="toaster group"
      icons={{
        success: <ToastGlyph kind="success" />,
        info: <ToastGlyph kind="info" />,
        warning: <ToastGlyph kind="warning" />,
        error: <ToastGlyph kind="error" />,
        loading: <ToastGlyph kind="loading" />,
        close: <Icon icon="lucide:x" className="size-4" />,
      }}
      style={
        {
          zIndex: 99999,
          "--normal-bg": isDark
            ? "oklch(0.18 0.005 265 / 0.72)"
            : "oklch(0.99 0 0 / 0.72)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "transparent",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        duration: 3200,
        style: {
          border: "0",
          backdropFilter: "blur(18px) saturate(1.6)",
          WebkitBackdropFilter: "blur(18px) saturate(1.6)",
          backgroundImage: isDark
            ? "linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 45%, transparent 100%)"
            : "linear-gradient(145deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.06) 45%, transparent 100%)",
          boxShadow: isDark
            ? "0 18px 60px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)"
            : "0 18px 60px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.35)",
        },
        classNames: {
          toast:
            "gap-3 rounded-2xl px-4 py-3 [&_[data-title]]:leading-snug [&_[data-description]]:leading-snug",
          icon: "!h-8 !w-8 !m-0 !items-center !justify-center",
          title: "text-sm font-medium",
          description: "text-xs opacity-85",
          closeButton:
            "text-muted-foreground/70 hover:text-foreground hover:bg-white/5 transition-colors",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
