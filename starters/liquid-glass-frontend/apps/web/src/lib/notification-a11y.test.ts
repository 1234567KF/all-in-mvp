import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import {
  ENTITY_CHIP_PALETTES,
  NOTIFICATION_TONE_STYLES,
} from "@/components/shared/notification-config"
import {
  DEFAULT_THEME_COLOR,
  THEME_COLOR_IDS,
  type ThemeColorId,
} from "@/lib/theme-colors"

/**
 * 消息通知可访问性契约测试（对比度）。
 *
 * 直接读 theme-tokens.css 源码，按「模式（dark/light）× 主题色（6 套）」解析
 * `--lg-*` token（支持 var() 链、color-mix(dim, transparent) 与 rgba 透明度），
 * 把半透明前景/背景先合成为实际渲染色，再按 WCAG 相对亮度公式校验：
 * - 小字号文字（warning 语气文字、实体 chip 11px、时间/空态文字）≥ 4.5:1；
 * - 非文本焦点环（实色 --lg-primary-text）≥ 3:1。
 *
 * 背景模型与 NotificationPanel 实际 DOM 一致：
 * popover 底(--lg-surface-elevated) 叠在表面(--lg-surface)上 → 未读行/悬停行
 * 再叠 --lg-surface-high 40% / 70% / 30%。取最不利背景，避免只测最亮的表面。
 */

// ─── CSS 源码解析（与 theme-colors.test.ts 相同的契约读取方式）────────────────

function loadTokensCss(): string {
  const candidates = [
    new URL("../theme-tokens.css", import.meta.url),
    resolve(process.cwd(), "src/theme-tokens.css"),
    resolve(process.cwd(), "apps/web/src/theme-tokens.css"),
  ]

  for (const candidate of candidates) {
    try {
      return readFileSync(candidate, "utf8")
    } catch {
      // try next candidate
    }
  }

  throw new Error("theme-tokens.css not found from any known cwd")
}

const css = loadTokensCss()

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function extractBlock(source: string, selector: string): string {
  const match = new RegExp(`(?:^|\\n)${escapeRegExp(selector)}\\s*\\{`).exec(
    source
  )
  expect(match, `missing CSS block: ${selector}`).not.toBeNull()

  const open = source.indexOf("{", match!.index)
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1
    if (source[i] === "}") {
      depth -= 1
      if (depth === 0) return source.slice(open + 1, i)
    }
  }

  throw new Error(`unclosed CSS block: ${selector}`)
}

function parseDeclarations(block: string): Map<string, string> {
  const declarations = new Map<string, string>()
  const pattern = /(--[a-z0-9-]+)\s*:\s*([^;]+);/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(block))) {
    declarations.set(match[1], match[2].replace(/\s+/g, " ").trim())
  }

  return declarations
}

// ─── token 解析（var 链 / rgba / color-mix(dim, transparent)）────────────────

interface Rgba {
  r: number
  g: number
  b: number
  /** 0–1；合成后的渲染色 alpha 恒为 1 */
  a: number
}

function parseHex(value: string): Rgba | null {
  if (!HEX_PATTERN.test(value)) return null
  const raw = value.slice(1)
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
    a: 1,
  }
}

function parseRgba(value: string): Rgba | null {
  const match =
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/.exec(
      value
    )
  if (!match) return null

  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] === undefined ? 1 : Number(match[4]),
  }
}

/** 把 token 的原始声明值解析成可合成的颜色；不支持的值直接抛错，避免静默跳过 */
function resolveColor(
  value: string,
  tokens: Map<string, string>,
  chain: readonly string[] = []
): Rgba {
  const normalized = value.replace(/\s+/g, " ").trim()

  const hex = parseHex(normalized)
  if (hex) return hex
  const rgba = parseRgba(normalized)
  if (rgba) return rgba

  const varMatch = /^var\(\s*(--[a-z0-9-]+)\s*\)$/.exec(normalized)
  if (varMatch) return resolveToken(varMatch[1], tokens, chain)

  // dim token：color-mix(in srgb, <seed> N%, transparent) → 同色 N% alpha
  const mixMatch =
    /^color-mix\(\s*in srgb,\s*(.+?)\s+([\d.]+)%\s*,\s*transparent\s*\)$/.exec(
      normalized
    )
  if (mixMatch) {
    const source = resolveColor(mixMatch[1], tokens, chain)
    return { ...source, a: source.a * (Number(mixMatch[2]) / 100) }
  }

  // 双色 color-mix（不透明）：color-mix(in srgb, <color> N%, <color>)
  const mixOpaqueMatch =
    /^color-mix\(\s*in srgb,\s*([^,]+?)\s+([\d.]+)%\s*,\s*(.+?)\s*\)$/.exec(
      normalized
    )
  if (mixOpaqueMatch) {
    const first = resolveColor(mixOpaqueMatch[1], tokens, chain)
    const second = resolveColor(mixOpaqueMatch[3], tokens, chain)
    const weight = Number(mixOpaqueMatch[2]) / 100
    const rest = 1 - weight
    return {
      r: first.r * weight + second.r * rest,
      g: first.g * weight + second.g * rest,
      b: first.b * weight + second.b * rest,
      a: 1,
    }
  }

  throw new Error(`unsupported CSS color for a11y test: ${value}`)
}

function resolveToken(
  name: string,
  tokens: Map<string, string>,
  chain: readonly string[] = []
): Rgba {
  if (chain.includes(name)) {
    throw new Error(`circular token reference: ${[...chain, name].join(" → ")}`)
  }
  const raw = tokens.get(name)
  if (raw === undefined) throw new Error(`missing token: ${name}`)
  return resolveColor(raw, tokens, [...chain, name])
}

// ─── 颜色合成 / 对比度 ────────────────────────────────────────────────────────

function composite(foreground: Rgba, background: Rgba): Rgba {
  const alpha = foreground.a
  return {
    r: foreground.r * alpha + background.r * (1 - alpha),
    g: foreground.g * alpha + background.g * (1 - alpha),
    b: foreground.b * alpha + background.b * (1 - alpha),
    a: 1,
  }
}

function linearize(channel: number): number {
  const value = channel / 255
  return value <= 0.03928
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4)
}

function relativeLuminance(color: Rgba): number {
  return (
    0.2126 * linearize(color.r) +
    0.7152 * linearize(color.g) +
    0.0722 * linearize(color.b)
  )
}

function contrastRatio(foreground: Rgba, background: Rgba): number {
  const first = relativeLuminance(foreground)
  const second = relativeLuminance(background)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

function expectContrastAtLeast(
  foreground: Rgba,
  background: Rgba,
  minimum: number,
  label: string
): void {
  const ratio = contrastRatio(foreground, background)
  expect(
    ratio,
    `${label} → ${ratio.toFixed(2)}:1（要求 ≥ ${minimum}:1）`
  ).toBeGreaterThanOrEqual(minimum)
}

// ─── 模式 / 主题色 token 解析 ────────────────────────────────────────────────

function extractPresetSeeds(themeId: ThemeColorId): Map<string, string> {
  // 默认绿色不建 preset 块，直接回落到 :root 默认种子
  if (themeId === DEFAULT_THEME_COLOR) return new Map()
  return parseDeclarations(
    extractBlock(css, `:root[data-theme-color="${themeId}"]`)
  )
}

const rootDeclarations = parseDeclarations(extractBlock(css, ":root"))
const lightDeclarations = parseDeclarations(extractBlock(css, ".light"))

function buildTokens(
  mode: "dark" | "light",
  themeId: ThemeColorId
): Map<string, string> {
  const tokens = new Map(rootDeclarations)
  // 先叠模式覆盖（.light），再叠主题色种子（preset 同时覆盖 dark/light 两个家族）
  if (mode === "light") {
    for (const [name, value] of lightDeclarations) tokens.set(name, value)
  }
  for (const [name, value] of extractPresetSeeds(themeId)) {
    tokens.set(name, value)
  }
  return tokens
}

interface Backgrounds {
  /** 应用背景（浅色 #ffffff / 深色 #0e0e11） */
  background: Rgba
  /** 基础表面（popover 背后最差情况的页面表面） */
  surface: Rgba
  /** popover 面板实际底色 = --lg-surface-elevated 叠在表面上 */
  panel: Rgba
  /** 未读行：--lg-surface-high 40% */
  row: Rgba
  /** 悬停行：--lg-surface-high 70% */
  rowHover: Rgba
  /** 已读行悬停：--lg-surface-high 30% */
  rowReadHover: Rgba
}

function buildBackgrounds(tokens: Map<string, string>): Backgrounds {
  const background = resolveToken("--lg-background", tokens)
  const surface = resolveToken("--lg-surface", tokens)
  const panel = composite(
    resolveToken("--lg-surface-elevated", tokens),
    surface
  )
  const surfaceHigh = resolveToken("--lg-surface-high", tokens)

  return {
    background,
    surface,
    panel,
    row: composite({ ...surfaceHigh, a: 0.4 }, panel),
    rowHover: composite({ ...surfaceHigh, a: 0.7 }, panel),
    rowReadHover: composite({ ...surfaceHigh, a: 0.3 }, panel),
  }
}

/** 通知面板内可能出现的所有底色；断言取最不利值 */
function candidateBackgrounds(tokens: Map<string, string>): Rgba[] {
  const backgrounds = buildBackgrounds(tokens)
  return [
    backgrounds.background,
    backgrounds.surface,
    backgrounds.panel,
    backgrounds.row,
    backgrounds.rowReadHover,
    backgrounds.rowHover,
  ]
}

const MODES = ["dark", "light"] as const

// ─── 契约测试 ────────────────────────────────────────────────────────────────

describe("notification a11y token contract", () => {
  const NEW_TOKENS = [
    "--lg-warning-text",
    "--lg-primary-emphasis-text",
    "--lg-chip-yellow-text",
    "--lg-chip-tertiary-text",
  ]

  it("defines the mode-aware readable tokens in both :root and .light", () => {
    for (const token of NEW_TOKENS) {
      expect(
        rootDeclarations.get(token),
        `missing ${token} in :root`
      ).toBeDefined()
      expect(
        lightDeclarations.get(token),
        `missing ${token} in .light`
      ).toBeDefined()
      // 模式感知：两块必须给出不同值（var 链不同也算）
      expect(lightDeclarations.get(token)).not.toBe(rootDeclarations.get(token))
    }

    expect(rootDeclarations.get("--lg-warning-text")).toBe("#facc15")
    expect(lightDeclarations.get("--lg-warning-text")).toBe("#7a5c00")
    expect(rootDeclarations.get("--lg-primary-emphasis-text")).toBe(
      "var(--lg-primary-text)"
    )
    expect(lightDeclarations.get("--lg-primary-emphasis-text")).toContain(
      "color-mix"
    )
    expect(lightDeclarations.get("--lg-primary-emphasis-text")).toContain(
      "var(--theme-primary-light) 70%"
    )
    expect(rootDeclarations.get("--lg-chip-yellow-text")).toBe(
      "var(--lg-accent-yellow-light)"
    )
    expect(lightDeclarations.get("--lg-chip-yellow-text")).toBe("#7a5c00")
    expect(rootDeclarations.get("--lg-chip-tertiary-text")).toBe(
      "var(--lg-tertiary-accent)"
    )
    expect(lightDeclarations.get("--lg-chip-tertiary-text")).toBe("#005ac2")
  })

  it("only adds tokens — existing accent values stay untouched", () => {
    expect(rootDeclarations.get("--lg-warning-accent")).toBe("#facc15")
    expect(lightDeclarations.get("--lg-warning-accent")).toBe("#eab308")
    expect(rootDeclarations.get("--lg-accent-yellow-light")).toBe("#facc15")
    expect(lightDeclarations.get("--lg-accent-yellow-light")).toBe("#eab308")
    expect(rootDeclarations.get("--lg-tertiary-accent")).toBe("#8bcfff")
    expect(lightDeclarations.get("--lg-tertiary-accent")).toBe("#82abff")
    expect(rootDeclarations.get("--lg-primary-light")).toBe(
      "var(--theme-bright-dark)"
    )
    expect(lightDeclarations.get("--lg-primary-light")).toBe(
      "var(--theme-bright-light)"
    )
  })

  it("points notification tone/chip styles at the readable tokens", () => {
    expect(NOTIFICATION_TONE_STYLES.warning.textColor).toBe(
      "var(--lg-warning-text)"
    )
    expect(NOTIFICATION_TONE_STYLES.primary.textColor).toBe(
      "var(--lg-primary-emphasis-text)"
    )
    expect(ENTITY_CHIP_PALETTES[2].color).toBe(
      "var(--lg-primary-emphasis-text)"
    )
    expect(ENTITY_CHIP_PALETTES[3].color).toBe("var(--lg-chip-yellow-text)")
    expect(ENTITY_CHIP_PALETTES[4].color).toBe("var(--lg-chip-tertiary-text)")

    // info 的浅色 accent 本身是深蓝 #005ac2，已满足 AA，无需新 token
    expect(NOTIFICATION_TONE_STYLES.info.textColor).toBe(
      "var(--lg-info-accent)"
    )
  })

  it("keeps warning emphasis text ≥ 4.5:1 in both modes and all theme colors", () => {
    for (const themeId of THEME_COLOR_IDS) {
      for (const mode of MODES) {
        const tokens = buildTokens(mode, themeId)
        const foreground = resolveToken("--lg-warning-text", tokens)

        for (const background of candidateBackgrounds(tokens)) {
          expectContrastAtLeast(
            foreground,
            background,
            4.5,
            `${mode}/${themeId} warning text`
          )
        }
      }
    }
  })

  it.each(MODES)(
    "keeps every entity chip foreground ≥ 4.5:1 on its composed chip background (%s, all themes)",
    (mode) => {
      for (const themeId of THEME_COLOR_IDS) {
        const tokens = buildTokens(mode, themeId)
        const backgrounds = candidateBackgrounds(tokens)

        for (const palette of ENTITY_CHIP_PALETTES) {
          const foreground = resolveColor(palette.color, tokens)
          const chipFill = resolveColor(palette.background, tokens)

          for (const background of backgrounds) {
            const chipBackground = composite(chipFill, background)
            expectContrastAtLeast(
              foreground,
              chipBackground,
              4.5,
              `${mode}/${themeId} chip ${palette.color}`
            )
          }
        }
      }
    }
  )

  it.each(MODES)(
    "keeps every tone emphasis text ≥ 4.5:1 in all theme colors (%s)",
    (mode) => {
      for (const themeId of THEME_COLOR_IDS) {
        const tokens = buildTokens(mode, themeId)

        for (const [tone, style] of Object.entries(NOTIFICATION_TONE_STYLES)) {
          const foreground = resolveColor(style.textColor, tokens)

          for (const background of candidateBackgrounds(tokens)) {
            expectContrastAtLeast(
              foreground,
              background,
              4.5,
              `${mode}/${themeId} tone ${tone} emphasis text`
            )
          }
        }
      }
    }
  )

  it.each(MODES)(
    "keeps timestamp/empty-state secondary text ≥ 4.5:1 (%s)",
    (mode) => {
      const tokens = buildTokens(mode, DEFAULT_THEME_COLOR)
      const foreground = resolveToken("--lg-text-secondary", tokens)

      for (const background of candidateBackgrounds(tokens)) {
        expectContrastAtLeast(
          foreground,
          background,
          4.5,
          `${mode} --lg-text-secondary`
        )
      }
    }
  )

  it.each(THEME_COLOR_IDS)(
    "keeps the solid focus ring token ≥ 3:1 against every surface in both modes (%s)",
    (themeId) => {
      for (const mode of MODES) {
        const tokens = buildTokens(mode, themeId)
        // 组件用 --lg-primary-text 作焦点环实色（非半透明 accent）
        const focusRing = resolveToken("--lg-primary-text", tokens)

        for (const background of candidateBackgrounds(tokens)) {
          expectContrastAtLeast(
            focusRing,
            background,
            3,
            `${mode}/${themeId} focus ring`
          )
        }
      }
    }
  )
})
