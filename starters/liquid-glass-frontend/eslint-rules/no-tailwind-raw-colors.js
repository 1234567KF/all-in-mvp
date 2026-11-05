/**
 * Custom ESLint Rule: no-tailwind-raw-colors
 *
 * Disallows hard-coded colors in UI code, on two surfaces:
 *
 *   1. className — raw Tailwind palette utilities (e.g. text-red-500,
 *      bg-green-600/10, border-l-blue-400).
 *   2. JSX inline `style` — raw color literals: `#rgb` / `#rgba` / `#rrggbb` /
 *      `#rrggbbaa`, `rgb()` / `rgba()`, `hsl()` / `hsla()`, including string
 *      literals nested in template literals, conditional/logical expressions,
 *      object property values, arrays and call arguments.
 *
 * Rationale: the design system defines semantic tokens (--lg-danger,
 * --lg-warning, tag-red/tag-yellow/tag-blue classes, destructive variant).
 * Hard-coded palette colors bypass theming (dark mode, brand adjustments) and
 * drift from the design language. Colors live in CSS: `--theme-*` seeds and
 * `[data-theme-color]` presets cannot reach a literal hex, so both surfaces must
 * go through tokens.
 *
 * Correct alternatives:
 *   - text-red-500              → text-destructive / var(--lg-danger)
 *   - bg-red-500                → bg-destructive
 *   - priority/status tag       → tag-red / tag-yellow / tag-blue classes
 *   - warning hint boxes        → color-mix(...) with var(--lg-warning)
 *   - style={{ color: "#fff" }} → style={{ color: "var(--lg-text-primary)" }}
 *   - rgba(0,0,0,.4) glow       → color-mix(in oklab, var(--lg-primary) 20%, transparent)
 *
 * Token handling: `var(...)` references are masked out and the remaining string is
 * still scanned, so a token mixed with a hard-coded stop — e.g.
 * `linear-gradient(var(--a), #fff)` or `color-mix(in srgb, #fff, #000)` — IS
 * reported. A color function whose first argument is a var() reference —
 * `rgba(var(--primary-rgb), 0.5)` — is treated as token-derived and passes.
 * Non-color style values ("14px", "none", "calc(...)", variable references) carry
 * no color literal and are never reported. Blind spot: a literal used as a var()
 * fallback (`var(--x, #fff)`) sits inside the masked group and is not reported.
 *
 * `url(...)` values are resource references (SVG paint servers, background
 * images), never colors: the whole function — with any quoting and path/hash
 * content, e.g. `url(#abc123)` or `url("/img/#fff")` — is masked before matching,
 * so hex-shaped ids/paths are not false-positived. Hex matching is bounded to
 * 3/4/6/8 digits with a lookbehind that rejects `#` glued to a word or entity
 * character, so `#` inside longer tokens (e.g. `foo#abcdef0`) is not misread as a
 * color. Caveat: `#123` is a valid three-digit hex color in CSS grammar, so an
 * inline style string that merely contains text like "issue #123" would be
 * reported — style values are CSS, not prose.
 *
 * Known blind spots (green lint does NOT prove these dimensions are clean —
 * they are review's job, not lint's):
 *   - `style={someVar}`, spread/derived style objects, and color values computed
 *     in modules or fetched at runtime: static analysis cannot see through
 *     variables, so they pass silently.
 *   - className strings concatenated at runtime and colors defined in CSS files
 *     (theme-tokens.css / design-utils.css / index.css) are out of scope.
 *   - Inline style only matches hex/rgb()/hsl(); named colors ("red"),
 *     oklch()/lab()/lch() and keywords ("transparent") are not reported.
 *   - A literal color used as a var() fallback (`var(--x, #fff)`) is masked
 *     together with the token group and is not reported.
 *   - The className part keeps the original palette-shape regex: arbitrary
 *     values such as `bg-[#fff]` are not matched (pre-existing behavior, kept
 *     unchanged to avoid regressing baseline findings).
 */

// text-red-500, bg-green-600/10, border-l-red-500, ring-offset-blue-500, divide-y-blue-200 …
const RAW_COLOR_RE =
  /\b(?:text|bg|border|ring|fill|stroke|outline|decoration|divide|shadow|accent|caret|from|via|to)(?:-[trblsexy])?(?:-offset)?(?:-\d+)?-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}(?:\/\d{1,3})?\b/

// matchAll 需要 g 旗标；matchAll 内部会克隆正则，共享实例不会污染 lastIndex。
const RAW_COLOR_RE_G = new RegExp(RAW_COLOR_RE.source, RAW_COLOR_RE.flags + "g")

// #rgb / #rgba / #rrggbb / #rrggbbaa. The lookbehind rejects `#` glued to a
// word char (`foo#fff`) or an HTML entity (`&#123;`); the trailing \b rejects
// longer hex-ish runs (`#abcdef0`).
const HEX_COLOR_RE =
  /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/
// rgb(...) / rgba(...) / hsl(...) / hsla(...). CSS function names are ASCII
// case-insensitive (RGB() is valid CSS), so match case-insensitively; the leading
// boundary keeps `myrgb(` and `--my-rgba(` out.
const COLOR_FUNCTION_RE = /(?<![\w-])(?:rgba?|hsla?)\s*\(/i
// `url(...)` is a resource reference (SVG paint server / image), never a color.
// Mask the whole function: optional quotes, any path/hash content — `url(#id)`,
// `url("#id")`, `url('/img/#fff')` are all ids/paths, not color literals.
const URL_FUNCTION_RE = /url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\)/gi
// `var(` starts a token reference. Its balanced group is masked before matching
// (see findRawInlineColor) so literals OUTSIDE the token are still reported.
const VAR_FUNCTION_RE = /var\(/gi
// A color function whose first argument is a var() reference —
// `rgba(var(--primary-rgb), 0.5)` — takes its components from tokens. After the
// var() group is masked its arguments look like `rgb(   , 0.5)`; blank the function
// name so the leftover masked arguments are not misread as a raw color literal.
const TOKEN_COLOR_FUNCTION_RE = /(?<![\w-])(?:rgba?|hsla?)\(\s*,/i

const blank = (text) => " ".repeat(text.length)

/** Index of the `)` matching the `(` at `openIndex`, or -1 when unbalanced. */
function findClosingParen(value, openIndex) {
  let depth = 0
  for (let i = openIndex; i < value.length; i += 1) {
    if (value[i] === "(") depth += 1
    else if (value[i] === ")") {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * Masks every `var(...)` group (balanced, including nested groups and a fallback
 * value) with spaces. Offsets are preserved so reported matches still point at the
 * original string; any literal remaining outside token groups stays visible.
 */
function maskTokenReferences(value) {
  let masked = value
  VAR_FUNCTION_RE.lastIndex = 0
  let match = VAR_FUNCTION_RE.exec(value)
  while (match) {
    const start = match.index
    // match[0] === "var("，指针落在左括号上
    const openIndex = start + match[0].length - 1
    const close = findClosingParen(value, openIndex)
    const end = close === -1 ? value.length : close + 1
    masked =
      masked.slice(0, start) +
      blank(value.slice(start, end)) +
      masked.slice(end)
    VAR_FUNCTION_RE.lastIndex = end
    match = VAR_FUNCTION_RE.exec(value)
  }
  return masked
}

/**
 * Returns the first raw color literal found in an inline-style string value, or
 * null when the value is token-based / carries no color literal.
 */
function findRawInlineColor(value) {
  // Mask references that can never be color literals, then keep scanning: a token
  // mixed with a hard-coded literal must still be reported (see file JSDoc).
  let searchable = value.replace(URL_FUNCTION_RE, blank)
  searchable = maskTokenReferences(searchable)
  searchable = searchable.replace(TOKEN_COLOR_FUNCTION_RE, blank)
  const hex = HEX_COLOR_RE.exec(searchable)
  const fn = COLOR_FUNCTION_RE.exec(searchable)
  if (!hex && !fn) return null
  if (hex && (!fn || hex.index < fn.index)) return hex[0]
  return fn[0]
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow raw Tailwind palette colors in className and hard-coded color literals in JSX inline style — use semantic design tokens instead.",
    },
    messages: {
      rawColor:
        'Raw Tailwind palette color "{{match}}" bypasses the design system. Use semantic tokens instead (text-destructive, var(--lg-danger), tag-red/tag-yellow/tag-blue, …).',
      rawInlineColor:
        'Inline style 硬编码颜色 "{{match}}" 会绕过主题系统，请改用设计 token（var(--lg-*)）或 color-mix(...)。',
    },
    schema: [],
  },
  create(context) {
    function reportRawColor(node, value) {
      // matchAll 而非单次 exec：一条 className 里常同时出现多个原色类
      // （如 "text-red-500 border-blue-500"），只报第一条会让第二条在修第一条时被静默漏掉。
      for (const match of value.matchAll(RAW_COLOR_RE_G)) {
        context.report({
          node,
          messageId: "rawColor",
          data: { match: match[0] },
        })
      }
    }

    function reportRawInlineColor(node, value) {
      const match = findRawInlineColor(value)
      if (match) {
        context.report({
          node,
          messageId: "rawInlineColor",
          data: { match },
        })
      }
    }

    /**
     * Walk string literals / template chunks reachable from a JSX expression.
     * Covers the common composition shapes: cn(...), cond ? a : b, a && b,
     * { ...obj }, arrays, spread arguments and `as` casts (generic walk), while
     * `parent` is skipped to avoid the ESLint AST cycle.
     */
    function visitExpression(expr, check) {
      if (!expr || typeof expr !== "object") return
      if (expr.type === "Literal" && typeof expr.value === "string") {
        check(expr, expr.value)
        return
      }
      if (expr.type === "TemplateLiteral") {
        for (const quasi of expr.quasis) {
          check(quasi, quasi.value.raw)
        }
        for (const sub of expr.expressions) visitExpression(sub, check)
        return
      }
      for (const key of Object.keys(expr)) {
        if (key === "parent") continue
        const child = expr[key]
        if (Array.isArray(child)) {
          for (const c of child) {
            if (c && typeof c.type === "string") visitExpression(c, check)
          }
        } else if (child && typeof child.type === "string") {
          visitExpression(child, check)
        }
      }
    }

    return {
      JSXAttribute(node) {
        if (!node.name || node.name.type !== "JSXIdentifier") return
        const value = node.value
        if (!value) return

        // className="text-red-500"
        if (node.name.name === "className") {
          if (value.type === "Literal" && typeof value.value === "string") {
            reportRawColor(value, value.value)
            return
          }
          // className={...} — inspect string literals & template chunks inside
          if (value.type === "JSXExpressionContainer") {
            visitExpression(value.expression, reportRawColor)
          }
          return
        }

        // style="color:#fff" — React ignores string styles, but plain JSX can
        // still carry a literal; check it rather than silently letting it pass.
        if (node.name.name === "style") {
          if (value.type === "Literal" && typeof value.value === "string") {
            reportRawInlineColor(value, value.value)
            return
          }
          // style={{ color: "#fff" }} — inspect string values inside the object
          if (value.type === "JSXExpressionContainer") {
            visitExpression(value.expression, reportRawInlineColor)
          }
        }
      },
    }
  },
}
