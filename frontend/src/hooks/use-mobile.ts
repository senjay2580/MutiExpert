import * as React from "react"

// 1024 = lg 断点。中等屏宽（笔记本分屏 / 浏览器窗口被压缩）下也让左侧主
// 导航走 Sheet overlay 模式（覆盖而非挤压主内容），只有 ≥1024px 大屏才
// 让 sidebar inline 占位
const MOBILE_BREAKPOINT = 1024

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
