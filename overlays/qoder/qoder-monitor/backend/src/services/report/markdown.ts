import { getDb, schema } from '../../db'
import { eq, desc, sql } from 'drizzle-orm'
import { getTurnStats, getTurnCost, getTurnSavings, getModelDistribution } from '../stats-aggregator'

export interface ReportOptions {
  sessionId?: string
  outputDir?: string
}

/**
 * Generate a Markdown report (F-010)
 */
export function generateMarkdownReport(options: ReportOptions = {}): string {
  const { sessionId } = options
  const stats = getTurnStats(sessionId)
  const cost = getTurnCost(sessionId)
  const savings = getTurnSavings(sessionId)
  const distribution = getModelDistribution(sessionId)
  const db = getDb()

  const conditions = sessionId ? eq(schema.turns.sessionId, sessionId) : sql`1=1`
  const recentTurns = db.select()
    .from(schema.turns)
    .where(conditions)
    .orderBy(desc(schema.turns.timestamp))
    .limit(50)
    .all()

  const dateStr = new Date().toISOString().split('T')[0]
  const sessionLabel = sessionId ? `-${sessionId}` : ''

  const lines: string[] = []

  // ============================================================
  // Chapter 1: Overview
  // ============================================================
  lines.push(`# Qoder Monitor — AI 执行报告${sessionLabel}`)
  lines.push('')
  lines.push(`> 生成时间: ${new Date().toISOString()}`)
  lines.push('')
  lines.push('## 1. Overview — 概览统计')
  lines.push('')
  lines.push('| 指标 | 值 |')
  lines.push('|------|-----|')
  lines.push(`| 总调用次数 | ${stats.total_calls} |`)
  lines.push(`| 输入 Token (未缓存) | ${stats.total_input_uncached.toLocaleString()} |`)
  lines.push(`| 输入 Token (缓存) | ${stats.total_input_cached.toLocaleString()} |`)
  lines.push(`| 缓存命中率 | ${stats.cache_hit_rate}% |`)
  lines.push(`| 输出 Token | ${stats.total_output_tokens.toLocaleString()} |`)
  lines.push(`| 模型切换次数 | ${stats.model_switch_count} |`)
  lines.push(`| 使用模型数 | ${stats.model_count} |`)
  lines.push(`| 预估成本 | ¥${cost.total_cost.toFixed(4)} |`)
  lines.push(`| 总节省 | ${savings.total_savings.toLocaleString()} Token |`)
  lines.push('')

  // ============================================================
  // Chapter 2: Per-Turn Breakdown
  // ============================================================
  lines.push('## 2. Per-Turn Breakdown — 轮次明细')
  lines.push('')
  if (recentTurns.length === 0) {
    lines.push('> 暂无数据')
    lines.push('')
  } else {
    lines.push('| ID | 类型 | 角色 | 模型 | 输入(未缓存) | 输入(缓存) | 输出 | 耗时(ms) |')
    lines.push('|----|------|------|------|-------------|------------|------|---------|')
    for (const turn of recentTurns) {
      lines.push(`| ${turn.id} | ${turn.type} | ${turn.role} | ${turn.modelUsed} | ${turn.inputUncached} | ${turn.inputCached} | ${turn.outputTokens} | ${turn.latencyMs ?? '-'} |`)
    }
    lines.push('')
  }

  // ============================================================
  // Chapter 3: Token Savings
  // ============================================================
  lines.push('## 3. Token Savings — 优化节省明细')
  lines.push('')
  if (savings.total_savings === 0) {
    lines.push('> 暂无节省数据')
    lines.push('')
  } else {
    lines.push('| 机制 | 节省 Token | 占比 |')
    lines.push('|------|-----------|------|')
    for (const [key, val] of Object.entries(savings.mechanisms)) {
      const pct = savings.percentages[key] ?? 0
      lines.push(`| ${key} | ${val.toLocaleString()} | ${pct}% |`)
    }
    lines.push(`| **总计** | **${savings.total_savings.toLocaleString()}** | **100%** |`)
    lines.push('')
    if (savings.model_switch_savings > 0) {
      lines.push(`> 模型切换节省 (单独统计): ${savings.model_switch_savings.toLocaleString()} Token`)
      lines.push('')
    }
  }

  // ============================================================
  // Chapter 4: Cost Estimate
  // ============================================================
  lines.push('## 4. Cost Estimate — 成本估算详情')
  lines.push('')
  if (cost.items.length === 0) {
    lines.push('> 暂无成本数据')
    lines.push('')
  } else {
    lines.push('| 模型 | 调用次数 | 输入成本 | 输出成本 | 总成本 |')
    lines.push('|------|---------|---------|---------|-------|')
    for (const item of cost.items) {
      const pricingLabel = item.has_pricing ? '' : ' (无定价)'
      lines.push(`| ${item.model}${pricingLabel} | ${item.call_count} | ¥${item.input_cost.toFixed(4)} | ¥${item.output_cost.toFixed(4)} | ¥${item.total_cost.toFixed(4)} |`)
    }
    lines.push('')
    lines.push(`| **总计** | | | | **¥${cost.total_cost.toFixed(4)}** |`)
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push(`*由 Qoder Monitor 自动生成 | ${dateStr}*`)

  return lines.join('\n')
}
