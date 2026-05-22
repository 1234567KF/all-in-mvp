import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

// ============================================================
// 1. Sessions Table
// ============================================================
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  created: text('created').notNull().default('(datetime(\'now\'))'),
  lastActivity: text('last_activity').notNull().default('(datetime(\'now\'))'),
  turnCount: integer('turn_count').notNull().default(0),
  a2aCount: integer('a2a_count').notNull().default(0),
  totalInputUncached: integer('total_input_uncached').notNull().default(0),
  totalInputCached: integer('total_input_cached').notNull().default(0),
  totalOutput: integer('total_output').notNull().default(0),
  estimatedCost: real('estimated_cost').notNull().default(0),
})

// ============================================================
// 2. Turns Table
// ============================================================
export const turns = sqliteTable('turns', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['turn', 'a2a'] }).notNull().default('turn'),
  parentTurnId: text('parent_turn_id'),
  phase: text('phase'),
  timestamp: text('timestamp').notNull().default('(datetime(\'now\'))'),
  role: text('role', { enum: ['human', 'ai'] }).notNull(),
  fromAgent: text('from_agent'),
  toAgent: text('to_agent'),
  skill: text('skill'),
  modelUsed: text('model_used').notNull(),
  protocol: text('protocol', { enum: ['native', 'mcp'] }),
  inputUncached: integer('input_uncached').notNull().default(0),
  inputCached: integer('input_cached').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  latencyMs: integer('latency_ms'),
  messageSizeBytes: integer('message_size_bytes'),
  optId: text('opt_id'),
  note: text('note'),
  dataSource: text('data_source', { enum: ['hook', 'stdin', 'file'] }).notNull().default('hook'),
}, (table) => [
  index('idx_turns_session').on(table.sessionId),
  index('idx_turns_timestamp').on(table.timestamp),
  index('idx_turns_type').on(table.type),
  index('idx_turns_model').on(table.modelUsed),
])

// ============================================================
// 3. Optimizations Table
// ============================================================
export const optimizations = sqliteTable('optimizations', {
  optId: text('opt_id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  timestamp: text('timestamp').notNull().default('(datetime(\'now\'))'),
  modelSwitched: integer('model_switched', { mode: 'boolean' }).notNull().default(false),
  mechanisms: text('mechanisms').notNull(), // JSON string: { "lean_ctx": 10000, "l1_cache": 5000 }
  savedTotal: integer('saved_total').notNull().default(0),
}, (table) => [
  index('idx_optimizations_session').on(table.sessionId),
])

// ============================================================
// 4. Pricing Table
// ============================================================
export const pricing = sqliteTable('pricing', {
  modelId: text('model_id').primaryKey(),
  short: text('short').notNull(),
  name: text('name').notNull(),
  inputPerMtok: real('input_per_mtok').notNull(),
  outputPerMtok: real('output_per_mtok').notNull(),
  cacheReadPerMtok: real('cache_read_per_mtok').notNull(),
  note: text('note'),
  currency: text('currency').notNull().default('¥'),
}, (table) => [
  uniqueIndex('idx_pricing_model').on(table.modelId),
])

// ============================================================
// 5. Mechanisms Table
// ============================================================
export const mechanisms = sqliteTable('mechanisms', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  measurable: integer('measurable', { mode: 'boolean' }).notNull().default(true),
  measurement: text('measurement'),
  excludeFromSavings: integer('exclude_from_savings', { mode: 'boolean' }).notNull().default(false),
})

// ============================================================
// 6. Timers Table
// ============================================================
export const timers = sqliteTable('timers', {
  toolCallId: text('tool_call_id').primaryKey(),
  toolName: text('tool_name').notNull(),
  startTime: integer('start_time').notNull(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  latencyMs: integer('latency_ms').notNull().default(0),
}, (table) => [
  index('idx_timers_session').on(table.sessionId),
])
