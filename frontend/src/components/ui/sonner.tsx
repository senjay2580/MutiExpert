import { Icon } from "@iconify/react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useTheme } from "@/hooks/useTheme"

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={resolvedTheme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <Icon icon="streamline-color:check" className="size-4" />,
        info: <Icon icon="streamline-color:information-circle" className="size-4" />,
        warning: <Icon icon="streamline-color:warning-triangle" className="size-4" />,
        error: <Icon icon="streamline-color:warning-octagon" className="size-4" />,
        loading: <Icon icon="streamline-color:signal-loading" className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
