/**
 * Layout Store — 管理页面布局宽度偏好
 */
import { create } from "zustand"
import { persist } from "zustand/middleware"

export type LayoutWidth = "standard" | "wide" | "fluid"

interface LayoutState {
  layoutWidth: LayoutWidth
  setLayoutWidth: (width: LayoutWidth) => void
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      layoutWidth: "wide", // 默认为宽屏模式 (1600px 居中)
      setLayoutWidth: (layoutWidth) => set({ layoutWidth }),
    }),
    {
      name: "app_layout", // 存入 localStorage 的 key
    }
  )
)
