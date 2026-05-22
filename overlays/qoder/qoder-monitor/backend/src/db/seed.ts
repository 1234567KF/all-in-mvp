import { getDb, getSqlite } from './index'
import * as schema from './schema'

const mechanismsSeed = [
  { id: 'lean_ctx', name: 'lean-ctx 上下文压缩', description: '原始大小 - 压缩后大小', measurable: true, measurement: '压缩前字节 - 压缩后字节', excludeFromSavings: false },
  { id: 'l1_cache', name: 'L1 Cache 缓存命中', description: '输出 Token 中缓存占比 × 输入节省', measurable: true, measurement: '缓存输入 Token × 输入单价 × (1 - 缓存折扣率)', excludeFromSavings: false },
  { id: 'l2_warmup', name: 'L2 Warmup 预热', description: '首次调用基准 - 预热后 Token', measurable: true, measurement: '首次 Prompt 长度 - 预热后平均 Prompt 长度', excludeFromSavings: false },
  { id: 'l3_skill_stub', name: 'L3 Skill Stub 技能桩', description: '技能桩加载前后对比', measurable: true, measurement: '加载前 Token - 加载后 Token', excludeFromSavings: false },
  { id: 'ccp_skip', name: 'CCP Context 跳过', description: '跳过的上下文 Token 数', measurable: true, measurement: '跳过的 Token 数量', excludeFromSavings: false },
  { id: 'lambda_lang', name: 'λ-lang 精简 DSL', description: '通用语言表达 vs λ-lang 精简表达差值', measurable: true, measurement: '原始 Token - λ-lang Token', excludeFromSavings: false },
  { id: 'model_switch', name: '模型切换（Pro↔Flash）', description: 'Flash 调用 × (Pro单价 - Flash单价)', measurable: true, measurement: 'Flash调用 × (Pro单价 - Flash单价)', excludeFromSavings: true },
]

const pricingSeed = [
  { modelId: 'deepseek-v4-pro', short: 'V4-Pro', name: 'DeepSeek V4-Pro', inputPerMtok: 3.13, outputPerMtok: 6.26, cacheReadPerMtok: 0.026, note: 'DeepSeek 旗舰模型', currency: '¥' },
  { modelId: 'deepseek-v4-flash', short: 'V4-Flash', name: 'DeepSeek V4-Flash', inputPerMtok: 1.01, outputPerMtok: 2.02, cacheReadPerMtok: 0.020, note: 'DeepSeek 快速模型', currency: '¥' },
  { modelId: 'deepseek-r1', short: 'R1', name: 'DeepSeek R1', inputPerMtok: 4.80, outputPerMtok: 19.20, cacheReadPerMtok: 0.019, note: 'DeepSeek 推理模型', currency: '¥' },
  { modelId: 'gpt-4o', short: 'GPT-4o', name: 'GPT-4o', inputPerMtok: 7.50, outputPerMtok: 37.50, cacheReadPerMtok: 1.88, note: 'OpenAI 多模态模型', currency: '¥' },
  { modelId: 'minimax-m2.5', short: 'M2.5', name: 'MiniMax M2.5', inputPerMtok: 2.10, outputPerMtok: 8.40, cacheReadPerMtok: 0.21, note: 'MiniMax', currency: '¥' },
  { modelId: 'claude-sonnet-4', short: 'Sonnet 4', name: 'Claude Sonnet 4', inputPerMtok: 21.60, outputPerMtok: 108.00, cacheReadPerMtok: 2.70, note: 'Anthropic Claude', currency: '¥' },
  { modelId: 'claude-haiku-3.5', short: 'Haiku 3.5', name: 'Claude Haiku 3.5', inputPerMtok: 1.80, outputPerMtok: 9.00, cacheReadPerMtok: 0.216, note: 'Anthropic Claude', currency: '¥' },
]

export async function seed(): Promise<void> {
  const db = getDb()
  const sqlite = getSqlite()

  // Create tables if they don't exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      created TEXT NOT NULL DEFAULT (datetime('now')),
      last_activity TEXT NOT NULL DEFAULT (datetime('now')),
      turn_count INTEGER NOT NULL DEFAULT 0,
      a2a_count INTEGER NOT NULL DEFAULT 0,
      total_input_uncached INTEGER NOT NULL DEFAULT 0,
      total_input_cached INTEGER NOT NULL DEFAULT 0,
      total_output INTEGER NOT NULL DEFAULT 0,
      estimated_cost REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS turns (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'turn' CHECK(type IN ('turn','a2a')),
      parent_turn_id TEXT,
      phase TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      role TEXT NOT NULL CHECK(role IN ('human','ai')),
      from_agent TEXT,
      to_agent TEXT,
      skill TEXT,
      model_used TEXT NOT NULL,
      protocol TEXT CHECK(protocol IN ('native','mcp')),
      input_uncached INTEGER NOT NULL DEFAULT 0,
      input_cached INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      latency_ms INTEGER,
      message_size_bytes INTEGER,
      opt_id TEXT,
      note TEXT,
      data_source TEXT NOT NULL DEFAULT 'hook' CHECK(data_source IN ('hook','stdin','file'))
    );
    CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_id);
    CREATE INDEX IF NOT EXISTS idx_turns_timestamp ON turns(timestamp);
    CREATE INDEX IF NOT EXISTS idx_turns_type ON turns(type);
    CREATE INDEX IF NOT EXISTS idx_turns_model ON turns(model_used);

    CREATE TABLE IF NOT EXISTS optimizations (
      opt_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      model_switched INTEGER NOT NULL DEFAULT 0,
      mechanisms TEXT NOT NULL,
      saved_total INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_optimizations_session ON optimizations(session_id);

    CREATE TABLE IF NOT EXISTS pricing (
      model_id TEXT PRIMARY KEY,
      short TEXT NOT NULL,
      name TEXT NOT NULL,
      input_per_mtok REAL NOT NULL,
      output_per_mtok REAL NOT NULL,
      cache_read_per_mtok REAL NOT NULL,
      note TEXT,
      currency TEXT NOT NULL DEFAULT '¥'
    );

    CREATE TABLE IF NOT EXISTS mechanisms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      measurable INTEGER NOT NULL DEFAULT 1,
      measurement TEXT,
      exclude_from_savings INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS timers (
      tool_call_id TEXT PRIMARY KEY,
      tool_name TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      latency_ms INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_timers_session ON timers(session_id);
  `)

  // Seed mechanisms
  for (const m of mechanismsSeed) {
    db.insert(schema.mechanisms).values(m).onConflictDoNothing({ target: schema.mechanisms.id }).run()
  }

  // Seed pricing
  for (const p of pricingSeed) {
    db.insert(schema.pricing).values(p).onConflictDoNothing({ target: schema.pricing.modelId }).run()
  }

  console.log('[seed] Database initialized with seed data')
  console.log(`[seed] Inserted ${mechanismsSeed.length} mechanisms and ${pricingSeed.length} pricing records`)
}

// Run directly
const isMainModule = process.argv[1] && (process.argv[1].includes('seed'))
if (isMainModule) {
  seed().then(() => {
    console.log('[seed] Done.')
    process.exit(0)
  }).catch((err) => {
    console.error('[seed] Error:', err)
    process.exit(1)
  })
}
