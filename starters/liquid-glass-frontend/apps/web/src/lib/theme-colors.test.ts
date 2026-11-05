import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import {
  DEFAULT_THEME_COLOR,
  getThemeColorOption,
  isThemeColor,
  THEME_COLOR_IDS,
  THEME_COLORS,
} from "@/lib/theme-colors"

/**
 * CSS 是主题色的事实源，这里直接读源码做契约测试。
 * 种子色必须是 6 位 hex（contrast helper 与主题 token 都按此约定）。
 * 兼容 apps/web 与仓库根两种 cwd（IDE 的 Vitest 扩展可能从根目录启动）。
 */
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

const SWATCH_PREFIX = "swatch-"
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

/** 宽松解析块内所有自定义属性，用于校验 preset 只覆盖种子 */
function parseDeclarations(block: string): Map<string, string> {
  const declarations = new Map<string, string>()
  const pattern = /(--[a-z0-9-]+)\s*:\s*([^;]+);/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(block))) {
    declarations.set(match[1], match[2].trim())
  }

  return declarations
}

/** 只抓 6 位 hex 的 --theme-* 种子（排除 --theme-swatch-* 预览色） */
function parseSeeds(block: string): Map<string, string> {
  const seeds = new Map<string, string>()
  const pattern = /--theme-([a-z-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(block))) {
    seeds.set(match[1], match[2])
  }

  return seeds
}

function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "")
  const channels = [0, 2, 4].map((index) => {
    const channel = parseInt(value.slice(index, index + 2), 16) / 255
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4)
  })

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground)
  const second = relativeLuminance(background)
  const lighter = Math.max(first, second)
  const darker = Math.min(first, second)
  return (lighter + 0.05) / (darker + 0.05)
}

function expectReadablePair(foreground: string, background: string) {
  expect(
    contrastRatio(foreground, background),
    `${foreground} on ${background}`
  ).toBeGreaterThanOrEqual(4.5)
}

const rootBlock = extractBlock(css, ":root")
const rootSeeds = parseSeeds(rootBlock)
const SEED_KEYS = [...rootSeeds.keys()]
  .filter((key) => !key.startsWith(SWATCH_PREFIX))
  .sort()
// 两个 primary-foreground 是所有预设共用的全局常量，不要求在 preset 中重复
const PRESET_SEED_KEYS = SEED_KEYS.filter(
  (key) => !key.startsWith("primary-foreground-")
)

describe("theme color metadata", () => {
  it("registers every id exactly once with a label", () => {
    const ids = THEME_COLORS.map((color) => color.id)

    expect(ids).toEqual([...THEME_COLOR_IDS])
    expect(new Set(ids).size).toBe(ids.length)

    for (const color of THEME_COLORS) {
      expect(color.label.trim().length).toBeGreaterThan(0)
    }
  })

  it("includes the default color and validates stored values", () => {
    expect(isThemeColor(DEFAULT_THEME_COLOR)).toBe(true)
    expect(getThemeColorOption(DEFAULT_THEME_COLOR).id).toBe(
      DEFAULT_THEME_COLOR
    )

    for (const id of THEME_COLOR_IDS) {
      expect(isThemeColor(id)).toBe(true)
    }

    expect(isThemeColor("magenta")).toBe(false)
    expect(isThemeColor("")).toBe(false)
    expect(isThemeColor(null)).toBe(false)
  })
})

describe("theme color CSS contract", () => {
  it("derives the seed contract from :root and declares every default seed", () => {
    expect(SEED_KEYS.length).toBeGreaterThan(0)

    for (const seed of SEED_KEYS) {
      expect(rootSeeds.get(seed), `missing default seed: ${seed}`).toMatch(
        HEX_PATTERN
      )
    }
  })

  it.each(THEME_COLOR_IDS)(
    "keeps %s swatch in sync with its preset primary-dark",
    (id) => {
      const swatch = rootSeeds.get(`${SWATCH_PREFIX}${id}`)
      expect(swatch, `missing swatch: ${id}`).toMatch(HEX_PATTERN)

      const primaryDark =
        id === DEFAULT_THEME_COLOR
          ? rootSeeds.get("primary-dark")
          : parseSeeds(
              extractBlock(css, `:root[data-theme-color="${id}"]`)
            ).get("primary-dark")

      expect(swatch).toBe(primaryDark)
    }
  )

  it.each(THEME_COLOR_IDS.filter((id) => id !== DEFAULT_THEME_COLOR))(
    "defines exactly the preset seed keys, accessible contrast, and only theme tokens for %s",
    (id) => {
      const presetBlock = extractBlock(css, `:root[data-theme-color="${id}"]`)
      const declarations = parseDeclarations(presetBlock)
      const declaredKeys = [...declarations.keys()].sort()
      const expectedKeys = PRESET_SEED_KEYS.map(
        (seed) => `--theme-${seed}`
      ).sort()

      // 预设块只能覆盖 preset 种子：多一个 --primary、少一个 seed 都算契约破坏
      expect(declaredKeys).toEqual(expectedKeys)
      for (const key of declaredKeys) {
        expect(
          key.startsWith("--theme-"),
          `${id} declares non-seed ${key}`
        ).toBe(true)
      }

      const seeds = parseSeeds(presetBlock)
      for (const seed of PRESET_SEED_KEYS) {
        expect(seeds.get(seed), `${id} missing seed: ${seed}`).toMatch(
          HEX_PATTERN
        )
      }

      // 全局常量从 :root 回退
      const get = (seed: string) =>
        seeds.get(seed) ?? rootSeeds.get(seed) ?? "#000000"

      // Dark：primary 上的文字（按钮 / shadcn primary-foreground / on-primary / container）
      expectReadablePair(get("primary-foreground-dark"), get("primary-dark"))
      expectReadablePair(get("on-primary-dark"), get("primary-dark"))
      expectReadablePair(get("on-primary-container-dark"), get("primary-dark"))

      // Light：primary 是深色底、白色文字；container 使用 bright
      expectReadablePair(get("primary-foreground-light"), get("primary-light"))
      expectReadablePair(get("on-primary-light"), get("primary-light"))
      expectReadablePair(get("on-primary-container-light"), get("bright-light"))
    }
  )

  it("declares readable success/primary text tokens in both modes", () => {
    const rootDeclarations = parseDeclarations(rootBlock)
    const lightDeclarations = parseDeclarations(extractBlock(css, ".light"))

    // 语义成功色必须固定，不能跟随主题色
    expect(rootDeclarations.get("--lg-success-text")).toBe("#4be277")
    expect(lightDeclarations.get("--lg-success-text")).toBe("#006e2f")
    expect(rootDeclarations.get("--lg-primary-text")).toBe(
      "var(--theme-bright-dark)"
    )
    expect(lightDeclarations.get("--lg-primary-text")).toBe(
      "var(--theme-primary-light)"
    )

    expectReadablePair("#4be277", "#0e0e11")
    expectReadablePair("#006e2f", "#f7f9fb")
  })

  it("keeps the default green palette readable in both modes", () => {
    const get = (seed: string) => rootSeeds.get(seed) ?? "#000000"

    expectReadablePair(get("primary-foreground-dark"), get("primary-dark"))
    expectReadablePair(get("on-primary-dark"), get("primary-dark"))
    expectReadablePair(get("on-primary-container-dark"), get("primary-dark"))
    expectReadablePair(get("primary-foreground-light"), get("primary-light"))
    expectReadablePair(get("on-primary-light"), get("primary-light"))
    expectReadablePair(get("on-primary-container-light"), get("bright-light"))
  })
})
