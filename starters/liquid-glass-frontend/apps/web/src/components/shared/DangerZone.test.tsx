/**
 * DangerZone 危险操作区域单元测试
 *
 * 覆盖：
 * - 分组卡渲染（标题 / 描述 / 子项 / 状态标签 / 自定义确认文案）；
 * - 二次确认弹窗开合、取消不触发、确认回调与关闭；
 * - 密码验证模式（未输入禁用确认、输入后可确认、Enter 快捷确认）；
 * - 禁用态与异步执行中的 loading 锁（执行期间不可关闭）。
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  DangerZone,
  DangerZoneGroup,
  type DangerZoneItemProps,
} from "@/components/shared/DangerZone"

function makeItem(
  overrides: Partial<DangerZoneItemProps> = {}
): DangerZoneItemProps {
  return {
    title: "审计日志清理",
    description: "当前策略：保留 180 天，可清理 0 条过期日志",
    badgeText: "可清理 0 条",
    buttonText: "执行清理",
    onConfirm: vi.fn(),
    ...overrides,
  }
}

/** 打开指定按钮对应的二次确认弹窗 */
function openConfirm(buttonText = "执行清理") {
  fireEvent.click(screen.getByRole("button", { name: buttonText }))
  return screen.getByRole("alertdialog")
}

afterEach(() => cleanup())

describe("DangerZoneGroup", () => {
  it("渲染危险区标题、说明与全部子项（含状态标签）", () => {
    render(
      <DangerZoneGroup
        items={[
          makeItem(),
          makeItem({
            id: "orphan",
            title: "孤立附件清理",
            description: "清理无业务引用的附件",
            badgeText: "可清理 0 个",
            buttonText: "清理附件",
          }),
        ]}
      />
    )

    expect(screen.getByText("危险操作")).toBeInTheDocument()
    expect(
      screen.getByText("以下包含高风险敏感指令及数据清理操作，请谨慎执行")
    ).toBeInTheDocument()
    expect(screen.getByText("审计日志清理")).toBeInTheDocument()
    expect(screen.getByText("孤立附件清理")).toBeInTheDocument()
    expect(screen.getByText("可清理 0 条")).toBeInTheDocument()
    expect(screen.getByText("可清理 0 个")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "执行清理" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "清理附件" })).toBeInTheDocument()
  })

  it("支持自定义分组标题与说明", () => {
    render(
      <DangerZoneGroup
        title="数据维护"
        description="低峰期执行"
        items={[makeItem()]}
      />
    )
    expect(screen.getByText("数据维护")).toBeInTheDocument()
    expect(screen.getByText("低峰期执行")).toBeInTheDocument()
  })

  it("单项 DangerZone 兼容模式渲染分组卡", () => {
    render(<DangerZone {...makeItem()} />)
    expect(screen.getByText("危险操作")).toBeInTheDocument()
    expect(screen.getByText("审计日志清理")).toBeInTheDocument()
  })
})

describe("DangerZoneGroup 二次确认", () => {
  it("点击操作按钮先弹出确认，不直接执行", () => {
    const onConfirm = vi.fn()
    render(<DangerZoneGroup items={[makeItem({ onConfirm })]} />)

    const dialog = openConfirm()
    expect(dialog).toHaveTextContent("确认执行清理？")
    expect(dialog).toHaveTextContent("取消")
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("取消关闭弹窗且不触发回调", () => {
    const onConfirm = vi.fn()
    render(<DangerZoneGroup items={[makeItem({ onConfirm })]} />)

    openConfirm()
    fireEvent.click(screen.getByRole("button", { name: "取消" }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("确认后执行回调并关闭弹窗", async () => {
    const onConfirm = vi.fn()
    render(<DangerZoneGroup items={[makeItem({ onConfirm })]} />)

    openConfirm()
    fireEvent.click(screen.getByRole("button", { name: "确认" }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    )
  })

  it("自定义确认标题与描述覆盖默认文案", () => {
    render(
      <DangerZoneGroup
        items={[
          makeItem({
            confirmTitle: "确认清空全部日志？",
            confirmDescription: "该操作不可恢复",
          }),
        ]}
      />
    )

    const dialog = openConfirm()
    expect(dialog).toHaveTextContent("确认清空全部日志？")
    expect(dialog).toHaveTextContent("该操作不可恢复")
    expect(dialog).not.toHaveTextContent("确认执行清理？")
  })

  it("disabled 时按钮不可点击，也不会弹出确认", () => {
    const onConfirm = vi.fn()
    render(
      <DangerZoneGroup items={[makeItem({ onConfirm, disabled: true })]} />
    )

    const trigger = screen.getByRole("button", { name: "执行清理" })
    expect(trigger).toBeDisabled()
    fireEvent.click(trigger)
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

describe("DangerZoneGroup 密码验证", () => {
  it("未输入密码时确认按钮禁用", () => {
    render(<DangerZoneGroup items={[makeItem({ requirePassword: true })]} />)

    openConfirm()
    expect(screen.getByRole("button", { name: "确认" })).toBeDisabled()
    expect(
      screen.getByPlaceholderText("请输入当前用户密码以确认")
    ).toBeInTheDocument()
  })

  it("输入密码后可确认，回调收到执行", async () => {
    const onConfirm = vi.fn()
    render(
      <DangerZoneGroup
        items={[makeItem({ onConfirm, requirePassword: true })]}
      />
    )

    openConfirm()
    const passwordInput =
      screen.getByPlaceholderText("请输入当前用户密码以确认")
    fireEvent.change(passwordInput, { target: { value: "secret" } })

    const confirmButton = screen.getByRole("button", { name: "确认" })
    expect(confirmButton).toBeEnabled()
    fireEvent.click(confirmButton)

    // 密码必须透传给业务方做服务端校验（UI 非空门禁不等于鉴权）
    expect(onConfirm).toHaveBeenCalledWith("secret")
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    )
  })

  it("密码框内按 Enter 直接确认", async () => {
    const onConfirm = vi.fn()
    render(
      <DangerZoneGroup
        items={[makeItem({ onConfirm, requirePassword: true })]}
      />
    )

    openConfirm()
    const passwordInput =
      screen.getByPlaceholderText("请输入当前用户密码以确认")
    fireEvent.change(passwordInput, { target: { value: "secret" } })
    fireEvent.keyDown(passwordInput, { key: "Enter" })

    expect(onConfirm).toHaveBeenCalledWith("secret")
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    )
  })

  it("密码为空时按 Enter 不会触发确认", () => {
    const onConfirm = vi.fn()
    render(
      <DangerZoneGroup
        items={[makeItem({ onConfirm, requirePassword: true })]}
      />
    )

    openConfirm()
    fireEvent.keyDown(screen.getByPlaceholderText("请输入当前用户密码以确认"), {
      key: "Enter",
    })
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

describe("DangerZoneGroup 执行失败", () => {
  it("失败时保留弹窗可重试，不产生未捕获 rejection", async () => {
    const onConfirm = vi.fn(async () => {
      throw new Error("密码错误")
    })
    render(<DangerZoneGroup items={[makeItem({ onConfirm })]} />)

    openConfirm()
    fireEvent.click(screen.getByRole("button", { name: "确认" }))

    // loading 结束、弹窗保留（未关闭）→ 可重试
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "确认" })).toBeEnabled()
    )
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it("密码模式下失败后清空密码（确认按钮回到禁用），弹窗保留", async () => {
    const onConfirm = vi.fn(async () => {
      throw new Error("密码错误")
    })
    render(
      <DangerZoneGroup
        items={[makeItem({ onConfirm, requirePassword: true })]}
      />
    )

    openConfirm()
    const passwordInput =
      screen.getByPlaceholderText("请输入当前用户密码以确认")
    fireEvent.change(passwordInput, { target: { value: "wrong-secret" } })
    fireEvent.click(screen.getByRole("button", { name: "确认" }))

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "确认" })).toBeDisabled()
    )
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    expect(passwordInput).toHaveValue("")
  })
})

describe("DangerZoneGroup 异步执行锁", () => {
  it("执行中按钮 loading 且不可关闭，完成后自动关闭", async () => {
    let finish!: () => void
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    render(<DangerZoneGroup items={[makeItem({ onConfirm })]} />)

    openConfirm()
    fireEvent.click(screen.getByRole("button", { name: "确认" }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /确认/ })).toBeDisabled()
    })
    expect(screen.getByRole("button", { name: "取消" })).toBeDisabled()
    expect(onConfirm).toHaveBeenCalledTimes(1)

    finish()
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    )
  })
})
