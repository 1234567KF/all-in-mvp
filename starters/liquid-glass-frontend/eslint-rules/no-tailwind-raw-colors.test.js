import { describe, it } from "bun:test"
import { RuleTester } from "eslint"
import { parser as tsParser } from "typescript-eslint"

import rule from "./no-tailwind-raw-colors.js"

RuleTester.describe = (text, method) => describe(text, method)
RuleTester.it = (text, method) => it(text, method)
RuleTester.itOnly = (text, method) => it.only(text, method)

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    // 规则同时覆盖 className 与 JSX inline style，测试代码需要能解析 JSX。
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
})

ruleTester.run("no-tailwind-raw-colors", rule, {
  valid: [
    {
      name: "className 使用语义化 token 类",
      code: '<div className="text-destructive border-border bg-background/40" />',
    },
    {
      name: "className 模板字符串使用合法 token",
      code: "<div className={`font-h2 ${sizeClass}`} />",
    },
    {
      name: "inline style 使用设计 token 变量",
      code: '<div style={{ color: "var(--lg-danger)" }} />',
    },
    {
      name: "inline style 使用 color-mix 与 token 组合",
      code: '<div style={{ background: "color-mix(in oklab, var(--lg-primary) 20%, transparent)" }} />',
    },
    {
      name: "非颜色 inline style 值不报",
      code: '<div style={{ fontSize: 14, lineHeight: "1.5", borderRadius: "var(--radius-glass-lg)" }} />',
    },
    {
      name: "inline style 中使用 calc 尺寸不报",
      code: '<div style={{ minHeight: "calc(100vh - var(--topbar-height) - 64px)" }} />',
    },
    {
      name: "inline style 变量引用静态不可判，不报",
      code: "<div style={{ color: tone.textColor, background: tone.bg }} />",
    },
    {
      name: "inline style 整体变量引用静态不可判，不报",
      code: 'const tone = { color: "#fff" }; <div style={tone} />',
    },
    {
      name: "SVG url(#id) 是引用不是颜色字面量",
      code: '<svg><rect style={{ filter: "url(#abc123)" }} /></svg>',
    },
    {
      name: "inline style 的 TS 类型断言只含非颜色值",
      code: '<div style={{ "--gap": spacing } as React.CSSProperties} />',
    },
    {
      name: "纯 token 渐变不报",
      code: '<div style={{ background: "linear-gradient(135deg, var(--lg-primary), transparent)" }} />',
    },
    {
      name: "rgba(var(--*), α) 颜色分量来自 token，不报",
      code: '<div style={{ color: "rgba(var(--lg-primary-rgb), 0.5)" }} />',
    },
    {
      name: "带引号的 url(#id) 仍是引用，不报",
      code: "<div style={{ filter: 'url(\"#abc123\")' }} />",
    },
    {
      name: "url 路径里的 #hex 不是颜色字面量，不报",
      code: "<div style={{ backgroundImage: \"url('/img/#fff')\" }} />",
    },
  ],
  invalid: [
    {
      name: "inline style 三位 hex 颜色",
      code: '<div style={{ color: "#fff" }} />',
      errors: [{ messageId: "rawInlineColor" }],
    },
    {
      name: "inline style 六位 hex 颜色",
      code: '<div style={{ background: "#ff0000" }} />',
      errors: [{ messageId: "rawInlineColor" }],
    },
    {
      name: "inline style 带透明度八位 hex 颜色",
      code: '<div style={{ borderColor: "#22c55e80" }} />',
      errors: [{ messageId: "rawInlineColor" }],
    },
    {
      name: "inline style rgba() 颜色",
      code: '<div style={{ boxShadow: "0 0 20px rgba(0,0,0,0.5)" }} />',
      errors: [{ messageId: "rawInlineColor" }],
    },
    {
      name: "inline style hsl() 颜色",
      code: '<div style={{ color: "hsl(0 0% 0%)" }} />',
      errors: [{ messageId: "rawInlineColor" }],
    },
    {
      name: "inline style 模板字符串中的 hex 颜色",
      code: "<div style={{ color: `#00ff00` }} />",
      errors: [{ messageId: "rawInlineColor" }],
    },
    {
      name: "inline style 条件表达式分支中的 hex 颜色",
      code: '<div style={{ color: active ? "#fff" : "var(--lg-text-primary)" }} />',
      errors: [{ messageId: "rawInlineColor" }],
    },
    {
      name: "inline style 逻辑表达式回退值中的颜色",
      code: '<div style={{ color: tone.color || "#000" }} />',
      errors: [{ messageId: "rawInlineColor" }],
    },
    {
      name: "inline style 调用参数对象中的颜色",
      code: '<div style={buildStyle({ color: "#fff" })} />',
      errors: [{ messageId: "rawInlineColor" }],
    },
    {
      name: "inline style 展开对象中的颜色",
      code: '<div style={{ ...base, borderColor: "#ef4444" }} />',
      errors: [{ messageId: "rawInlineColor" }],
    },
    {
      name: "inline style 条件表达式两个分支都是硬编码颜色",
      code: '<div style={{ color: isOn ? "#22c55e" : "#ef4444" }} />',
      errors: [
        { messageId: "rawInlineColor" },
        { messageId: "rawInlineColor" },
      ],
    },
    {
      name: "字符串形式的 style 属性中的 hex 颜色",
      code: '<div style="color:#fff" />',
      errors: [{ messageId: "rawInlineColor" }],
    },
    {
      name: "inline style 的 TS 类型断言内的 hex 颜色",
      code: '<div style={{ color: "#fff" } as React.CSSProperties} />',
      errors: [{ messageId: "rawInlineColor" }],
    },
    {
      name: "className 原生色类仍报 rawColor",
      code: '<div className="text-red-500" />',
      errors: [{ messageId: "rawColor" }],
    },
    {
      name: "className 带透明度的原生色类仍报 rawColor",
      code: '<div className="bg-green-600/10" />',
      errors: [{ messageId: "rawColor" }],
    },
    {
      name: "className 条件表达式中的原生色类仍报 rawColor",
      code: '<div className={cn("p-4", isActive && "text-red-500")} />',
      errors: [{ messageId: "rawColor" }],
    },
    {
      name: "token 混入硬编码渐变停留色仍报错",
      code: '<div style={{ background: "linear-gradient(var(--lg-primary), #ff0000)" }} />',
      errors: [{ messageId: "rawInlineColor" }],
    },
    {
      name: "color-mix 内的硬编码颜色仍报错",
      code: '<div style={{ background: "color-mix(in srgb, #ff0000, #000)" }} />',
      errors: [{ messageId: "rawInlineColor" }],
    },
    {
      name: "token 之外剩余的颜色函数仍报错",
      code: '<div style={{ color: "rgb(1, 2, 3) var(--unused)" }} />',
      errors: [{ messageId: "rawInlineColor" }],
    },
    {
      name: "大写 RGB() 颜色函数同样报错（CSS 函数名大小写不敏感）",
      code: '<div style={{ color: "RGB(1, 2, 3)" }} />',
      errors: [{ messageId: "rawInlineColor" }],
    },
    {
      name: "大写 Rgba() 颜色函数同样报错",
      code: '<div style={{ color: "Rgba(1, 2, 3, 0.5)" }} />',
      errors: [{ messageId: "rawInlineColor" }],
    },
    {
      name: "大写 HSL() 颜色函数同样报错",
      code: '<div style={{ color: "HSL(0 0% 0%)" }} />',
      errors: [{ messageId: "rawInlineColor" }],
    },
    {
      // 我们补的回归用例（勿删）：同一条 className 里两个原色类必须各报一条。
      // 上游曾用单次 RAW_COLOR_RE.exec(value) 实现 → 一行只报第一条，第二条要等第一条
      // 被修掉后才暴露，属于静默漏报；规则改为 matchAll 后由本用例钉住行为。
      name: "同一 className 内多个原色类必须全部上报（matchAll 回归）",
      code: 'const C = () => <div className="divide-y-blue-200 ring-offset-blue-500">x</div>',
      errors: [
        { messageId: "rawColor" },
        { messageId: "rawColor" },
      ],
    },
  ],
})
