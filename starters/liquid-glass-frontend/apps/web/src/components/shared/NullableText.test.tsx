import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { NullableText } from "@/components/shared/NullableText"

describe("NullableText", () => {
  it("有值时：渲染传入的值及自定义 className", () => {
    render(
      <NullableText value="测试文本" className="font-mono text-xs">
        测试文本
      </NullableText>
    )
    const el = screen.getByText("测试文本")
    expect(el).toBeInTheDocument()
    expect(el).toHaveClass("font-mono")
  })

  it("无 children 但有 value 时：直接转为字符串渲染", () => {
    render(<NullableText value={12345} />)
    expect(screen.getByText("12345")).toBeInTheDocument()
  })

  it("value 为 null 时：渲染标准破折号 — 并剥离 font-mono", () => {
    render(
      <NullableText value={null} className="font-mono text-xs">
        123
      </NullableText>
    )
    const el = screen.getByText("—")
    expect(el).toBeInTheDocument()
    expect(el).toHaveClass("text-sm")
    expect(el).not.toHaveClass("font-mono")
  })

  it("value 为 undefined 时：渲染标准破折号 —", () => {
    render(<NullableText value={undefined} />)
    expect(screen.getByText("—")).toBeInTheDocument()
  })

  it("value 为空字符串或纯空格时：渲染标准破折号 —", () => {
    render(<NullableText value="   " />)
    expect(screen.getByText("—")).toBeInTheDocument()
  })
})
