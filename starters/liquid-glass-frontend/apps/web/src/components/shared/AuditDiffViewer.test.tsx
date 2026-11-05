/**
 * AuditDiffViewer 单测
 *
 * 覆盖三态渲染（标量 / 标签数组 / 键值对象）、audited-crud 的 JSON 字符串反解析、
 * snapshot 形（新增/删除）展开，以及空态兜底。
 * 纯数据归一化逻辑的测试见 lib/audit-diff.test.ts。
 */
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { AuditDiffViewer } from "@/components/shared/AuditDiffViewer"

describe("AuditDiffViewer", () => {
  it("标量对比：渲染变更前 / 变更后", () => {
    render(
      <AuditDiffViewer changes={{ 姓名: { before: "旧", after: "新" } }} />
    )
    expect(screen.getByText("姓名")).toBeInTheDocument()
    expect(screen.getByText("变更前")).toBeInTheDocument()
    expect(screen.getByText("变更后")).toBeInTheDocument()
    expect(screen.getByText("旧")).toBeInTheDocument()
    expect(screen.getByText("新")).toBeInTheDocument()
  })

  it("空值展示占位符 —", () => {
    render(
      <AuditDiffViewer changes={{ 备注: { before: null, after: "有值" } }} />
    )
    expect(screen.getByText("—")).toBeInTheDocument()
  })

  it("标签数组：新增 / 删除 / 未变化标签同时渲染", () => {
    render(
      <AuditDiffViewer
        changes={{
          角色: { before: ["admin", "old"], after: ["admin", "viewer"] },
        }}
      />
    )
    expect(screen.getByText("old")).toBeInTheDocument()
    expect(screen.getByText("+ viewer")).toBeInTheDocument()
    expect(screen.getByText("admin")).toBeInTheDocument()
  })

  it("audited-crud 的 JSON 字符串数组 → 自动反解析为标签模式", () => {
    render(
      <AuditDiffViewer
        changes={{
          角色: { before: '["admin"]', after: '["admin","viewer"]' },
        }}
      />
    )
    expect(screen.getByText("+ viewer")).toBeInTheDocument()
  })

  it("键值对象：逐 key 展示变更（JSON 字符串自动反解析）", () => {
    render(
      <AuditDiffViewer
        changes={{
          配置: {
            before: '{"theme":"green","density":"cozy"}',
            after: '{"theme":"blue","density":"cozy"}',
          },
        }}
      />
    )
    expect(screen.getByText("theme")).toBeInTheDocument()
    expect(screen.getByText("green")).toBeInTheDocument()
    expect(screen.getByText("blue")).toBeInTheDocument()
    // 未变化的 key 也展示（中性样式）
    expect(screen.getByText("density")).toBeInTheDocument()
    expect(screen.getByText("cozy")).toBeInTheDocument()
  })

  it("snapshot 新增 → 展开字段并展示新值", () => {
    render(
      <AuditDiffViewer
        changes={{
          snapshot: { before: null, after: { name: "新行", role: "user" } },
        }}
      />
    )
    expect(screen.getByText("name")).toBeInTheDocument()
    expect(screen.getByText("新行")).toBeInTheDocument()
    expect(screen.getByText("role")).toBeInTheDocument()
  })

  it("单侧缺失的标签数组仍按标签模式渲染（新增场景）", () => {
    render(
      <AuditDiffViewer
        changes={{ 角色: { before: null, after: ["viewer"] } }}
      />
    )
    expect(screen.getByText("+ viewer")).toBeInTheDocument()
  })

  it("snapshot 中的 JSON 字符串字段反解析后进入标签 / 对象模式", () => {
    render(
      <AuditDiffViewer
        changes={{
          snapshot: {
            before: null,
            after: { roles: '["admin"]', config: '{"theme":"blue"}' },
          },
        }}
      />
    )
    expect(screen.getByText("+ admin")).toBeInTheDocument()
    expect(screen.getByText("theme")).toBeInTheDocument()
    expect(screen.getByText("blue")).toBeInTheDocument()
  })

  it("无变更 → 空态文案（支持自定义）", () => {
    const { rerender } = render(<AuditDiffViewer changes={null} />)
    expect(screen.getByText("本次操作没有字段变更")).toBeInTheDocument()

    rerender(<AuditDiffViewer changes={{}} emptyText="无字段变更" />)
    expect(screen.getByText("无字段变更")).toBeInTheDocument()
  })
})
