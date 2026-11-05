/**
 * AuditLogPage 权限门控测试
 *
 * 无 audit:view 权限时不发起 /logs 请求，直接渲染权限提示
 * （菜单侧隐藏 + 页面兜底，防止直接输入 URL 时误触发 403 查询）。
 */
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/hooks/usePermission", () => ({
  usePermission: () => ({ can: () => false, canAny: () => false }),
}))

vi.mock("@/hooks/queries/useLogs", () => ({
  useLogs: vi.fn(() => ({ data: undefined, isLoading: false })),
}))

import { useLogs } from "@/hooks/queries/useLogs"
import AuditLogPage from "@/pages/audit-log/AuditLogPage"

describe("AuditLogPage 权限门控", () => {
  it("无 audit:view → 不发起请求，渲染权限提示", () => {
    render(<AuditLogPage />)

    expect(
      screen.getByRole("heading", { name: "审计日志" })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/当前账号没有查看审计日志的权限/)
    ).toBeInTheDocument()
    expect(vi.mocked(useLogs)).toHaveBeenCalledWith(expect.anything(), {
      enabled: false,
    })
  })
})
