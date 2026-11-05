import * as React from "react"

/**
 * 全局唯一移动断点（与 Tailwind `md` 对齐）。
 * 所有“窄屏结构性分叉”（表格/卡片、Dialog/Sheet 等）均以此为准；
 * CSS 侧 media query（theme-tokens.css / design-utils.css）必须与该值保持一致。
 * 触摸能力判定与宽度无关，请用 `pointer-coarse:` / `(pointer: coarse)`。
 */
const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() =>
    typeof window !== "undefined"
      ? window.innerWidth < MOBILE_BREAKPOINT
      : false
  )

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
