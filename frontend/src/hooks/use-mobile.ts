import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(() => {
    if (typeof window === "undefined") return false
    return window.innerWidth < MOBILE_BREAKPOINT
  })

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches)

    setIsMobile(mql.matches)

    const mqlAny = mql as unknown as {
      addEventListener?: (type: "change", listener: typeof onChange) => void
      removeEventListener?: (type: "change", listener: typeof onChange) => void
      addListener?: (listener: typeof onChange) => void
      removeListener?: (listener: typeof onChange) => void
    }

    if (mqlAny.addEventListener && mqlAny.removeEventListener) {
      mqlAny.addEventListener("change", onChange)
      return () => mqlAny.removeEventListener?.("change", onChange)
    }

    // Safari < 14
    mqlAny.addListener?.(onChange)
    return () => mqlAny.removeListener?.(onChange)
  }, [])

  return isMobile
}
