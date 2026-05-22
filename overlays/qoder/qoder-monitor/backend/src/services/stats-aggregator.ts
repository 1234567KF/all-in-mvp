import { getDb, schema } from '../db'
import { eq, sql } from 'drizzle-orm'

export interface TurnStats {
  total_calls: number
  total_input_tokens: number
  total_input_uncached: number
  total_input_cached: number
  cache_hit_rate: number
  total_output_tokens: number
  model_switch_count: number
  model_count: number
}

export function getTurnStats(sessionId?: string): TurnStats {
  const db = getDb()
  const conditions = sessionId ? sql`${schema.turns.sessionId} = ${sessionId}` : sql`1=1`

  const stats = db.select({
    total_calls: sql<number>`count(*)`,
    total_input_tokens: sql<number>`coalesce(sum(input_uncached + input_cached), 0)`,
    total_input_uncached: sql<number>`coalesce(sum(input_uncached), 0)`,
    total_input_cached: sql<number>`coalesce(sum(input_cached), 0)`,
    total_output_tokens: sql<number>`coalesce(sum(output_tokens), 0)`,
    model_count: sql<number>`count(distinct model_used)`,
  }).from(schema.turns).where(conditions).all()[0]

  const totalInput = stats.total_input_tokens

  // BR-014: If total input = 0, cache rate = 0.0%
  const cacheHitRate = totalInput > 0
    ? Math.round((stats.total_input_cached / totalInput) * 10000) / 100
    : 0

  // Count model switches from optimizations
  const switchCount = db.select({ count: sql<number>`count(*)` })
    .from(schema.optimizations)
    .where(sql`model_switched = 1`)
    .all()[0].count

  return {
    total_calls: stats.total_calls,
    total_input_tokens: stats.total_input_tokens,
    total_input_uncached: stats.total_input_uncached,
    total_input_cached: stats.total_input_cached,
    cache_hit_rate: cacheHitRate,
    total_output_tokens: stats.total_output_tokens,
    model_switch_count: switchCount,
    model_count: stats.model_count,
  }
}

export interface CostItem {
  model: string
  call_count: number
  input_uncached: number
  input_cached: number
  output_tokens: number
  input_cost: number
  output_cost: number
  total_cost: number
  currency: string
  has_pricing: boolean
}

export interface CostResult {
  items: CostItem[]
  total_cost: number
  currency: string
}

export function getTurnCost(sessionId?: string): CostResult {
  const db = getDb()
  const conditions = sessionId ? sql`${schema.turns.sessionId} = ${sessionId}` : sql`1=1`

  const modelGroups = db.select({
    model: schema.turns.modelUsed,
    callCount: sql<number>`count(*)`,
    inputUncached: sql<number>`coalesce(sum(input_uncached), 0)`,
    inputCached: sql<number>`coalesce(sum(input_cached), 0)`,
    outputTokens: sql<number>`coalesce(sum(output_tokens), 0)`,
  })
    .from(schema.turns)
    .where(conditions)
    .groupBy(schema.turns.modelUsed)
    .all()

  const allPricing = db.select().from(schema.pricing).all()

  let totalCost = 0
  const items: CostItem[] = modelGroups.map(g => {
    const pricing = allPricing.find(p => p.modelId === g.model)
    const hasPricing = !!pricing
    const inputPrice = pricing?.inputPerMtok ?? 0
    const outputPrice = pricing?.outputPerMtok ?? 0
    // BR-018: If cache_read_per_mtok not defined, use input_per_mtok
    const cachePrice = pricing?.cacheReadPerMtok ?? inputPrice
    const currency = pricing?.currency ?? '¥'  // BR-017

    const inputCost = (g.inputUncached / 1000000 * inputPrice) + (g.inputCached / 1000000 * cachePrice)
    const outputCost = (g.outputTokens / 1000000 * outputPrice)
    const total = Math.round((inputCost + outputCost) * 10000) / 10000
    totalCost += total

    return {
      model: g.model,
      call_count: g.callCount,
      input_uncached: g.inputUncached,
      input_cached: g.inputCached,
      output_tokens: g.outputTokens,
      input_cost: Math.round(inputCost * 10000) / 10000,
      output_cost: Math.round(outputCost * 10000) / 10000,
      total_cost: total,
      currency,
      has_pricing: hasPricing,
    }
  })

  return {
    items,
    total_cost: Math.round(totalCost * 10000) / 10000,
    currency: '¥',
  }
}

export interface SavingsResult {
  mechanisms: Record<string, number>
  total_savings: number
  model_switch_savings: number
  percentages: Record<string, number>
  model_switch_count: number
}

export function getTurnSavings(sessionId?: string): SavingsResult {
  const db = getDb()
  const conditions = sessionId
    ? sql`${schema.optimizations.sessionId} = ${sessionId} AND ${schema.optimizations.modelSwitched} = 0`
    : sql`${schema.optimizations.modelSwitched} = 0`

  // Get non-switch optimizations
  const nonSwitchOpts = db.select()
    .from(schema.optimizations)
    .where(conditions)
    .all()

  // Aggregate mechanism savings
  const mechanisms: Record<string, number> = {
    lean_ctx: 0,
    l1_cache: 0,
    l2_warmup: 0,
    l3_skill_stub: 0,
    ccp_skip: 0,
    lambda_lang: 0,
  }

  nonSwitchOpts.forEach(opt => {
    const mechs = JSON.parse(opt.mechanisms || '{}')
    for (const [key, val] of Object.entries(mechs)) {
      if (key in mechanisms && typeof val === 'number') {
        mechanisms[key] += val
      }
    }
  })

  const totalSavings = Object.values(mechanisms).reduce((s, v) => s + v, 0)

  // Calculate percentages
  const percentages: Record<string, number> = {}
  for (const [key, val] of Object.entries(mechanisms)) {
    percentages[key] = totalSavings > 0 ? Math.round(val / totalSavings * 10000) / 100 : 0
  }

  // BR-008: model_switch savings counted separately
  const switchOpts = db.select()
    .from(schema.optimizations)
    .where(sql`${schema.optimizations.modelSwitched} = 1`)
    .all()

  const modelSwitchSavings = switchOpts.reduce((s, opt) => {
    const mechs = JSON.parse(opt.mechanisms || '{}')
    return s + (mechs.model_switch || 0)
  }, 0)

  return {
    mechanisms,
    total_savings: totalSavings,
    model_switch_savings: modelSwitchSavings,
    percentages,
    model_switch_count: switchOpts.length,
  }
}

export interface ModelDistributionItem {
  model: string
  call_count: number
  percentage: number
}

export function getModelDistribution(sessionId?: string): ModelDistributionItem[] {
  const db = getDb()
  const conditions = sessionId ? sql`${schema.turns.sessionId} = ${sessionId}` : sql`1=1`

  const groups = db.select({
    model: schema.turns.modelUsed,
    count: sql<number>`count(*)`,
  })
    .from(schema.turns)
    .where(conditions)
    .groupBy(schema.turns.modelUsed)
    .all()

  const total = groups.reduce((s, g) => s + g.count, 0)

  return groups.map(g => ({
    model: g.model,
    call_count: g.count,
    percentage: total > 0 ? Math.round(g.count / total * 10000) / 100 : 0,
  }))
}
