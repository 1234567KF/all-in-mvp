/**
 * NotificationContent — 消息正文渲染
 *
 * 默认只做两件事，保持业务无关：
 * 1. 「…」/『…』包裹的实体名 → 低饱和色 chip（DJB2 哈希取色）；
 * 2. `emphasis` 配置的词组 → 按 tone 着色。
 *
 * 业务专属文案（如“提交了 / 被驳回”）通过 emphasis 或 renderContent 注入，
 * 组件本身不硬编码任何业务动作词。
 *
 * 展示契约：本组件只产出展示性 span。可点击的通知行会用覆盖层按钮承接整行
 * 点击/键盘激活，并把内容区 `aria-hidden` + `pointer-events-none`；因此正文里
 * **不得**放 button / a / input 等交互元素，需要行内交互时由业务在行外实现
 * （详见 `NotificationItem` / `renderContent` 的 JSDoc）。
 */
import {
  ENTITY_CHIP_PALETTES,
  NOTIFICATION_TONE_STYLES,
  type NotificationEmphasis,
  type NotificationTone,
} from "./notification-config"

export interface NotificationContentProps {
  /** 正文纯文本；只做展示，不承载交互（见文件头展示契约） */
  content: string
  emphasis?: readonly NotificationEmphasis[]
}

// 同时识别中文直角引号与双直角引号包裹的实体名
const ENTITY_PATTERN = /(「[^」]+」|『[^』]+』)/g

function hashEntity(name: string): number {
  let hash = 5381
  for (let index = 0; index < name.length; index++) {
    hash = (hash << 5) + hash + name.charCodeAt(index)
  }
  return Math.abs(hash)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

interface EmphasisMatcher {
  regex: RegExp
  tones: Map<string, NotificationTone>
}

function buildEmphasisMatcher(
  emphasis: readonly NotificationEmphasis[] | undefined
): EmphasisMatcher | null {
  if (!emphasis?.length) return null

  const tones = new Map<string, NotificationTone>()
  for (const group of emphasis) {
    for (const word of group.words) {
      const trimmed = word.trim()
      if (!trimmed) continue
      tones.set(trimmed, group.tone ?? "primary")
    }
  }
  if (tones.size === 0) return null

  // 长词优先，避免「驳回」抢先匹配掉「被驳回」
  const sources = Array.from(tones.keys())
    .sort((first, second) => second.length - first.length)
    .map(escapeRegExp)

  return {
    regex: new RegExp(`(${sources.join("|")})`, "g"),
    tones,
  }
}

function EmphasizedText({
  text,
  emphasis,
}: {
  text: string
  emphasis?: readonly NotificationEmphasis[]
}) {
  const matcher = buildEmphasisMatcher(emphasis)
  if (!matcher) {
    return <span style={{ color: "var(--lg-text-secondary)" }}>{text}</span>
  }

  const chunks = text.split(matcher.regex)
  return (
    <>
      {chunks.map((chunk, index) => {
        if (!chunk) return null
        // 仅一个捕获组时，split 结果奇数位为匹配词组
        if (index % 2 === 1) {
          const tone = matcher.tones.get(chunk) ?? "primary"
          return (
            <span
              key={index}
              className="font-medium"
              style={{ color: NOTIFICATION_TONE_STYLES[tone].textColor }}
            >
              {chunk}
            </span>
          )
        }
        return (
          <span key={index} style={{ color: "var(--lg-text-secondary)" }}>
            {chunk}
          </span>
        )
      })}
    </>
  )
}

export function NotificationContent({
  content,
  emphasis,
}: NotificationContentProps) {
  if (!content) return null

  const parts = content.split(ENTITY_PATTERN)

  return (
    <span className="leading-relaxed">
      {parts.map((part, index) => {
        if (!part) return null

        const isEntity =
          (part.startsWith("「") && part.endsWith("」")) ||
          (part.startsWith("『") && part.endsWith("』"))

        if (isEntity) {
          const entityName = part.slice(1, -1)
          const palette =
            ENTITY_CHIP_PALETTES[
              hashEntity(entityName) % ENTITY_CHIP_PALETTES.length
            ]
          return (
            <span
              key={index}
              className="mr-0.5 ml-1 inline-flex items-center rounded px-1.5 py-0.5 align-baseline text-[11px] font-medium transition-all"
              style={{
                backgroundColor: palette.background,
                color: palette.color,
                border: `1px solid ${palette.border}`,
              }}
            >
              {entityName}
            </span>
          )
        }

        return <EmphasizedText key={index} text={part} emphasis={emphasis} />
      })}
    </span>
  )
}
