-- ============================================================
-- Qoder Monitor — 数据库 Schema SQL 定义
-- 数据库: SQLite (better-sqlite3)
-- 说明: 所有 6 张表全局共享，模块间不独立建库
-- 实际 Drizzle ORM Schema 将在 backend/src/db/schema.ts 中实现
-- ============================================================

-- ============================================================
-- 1. Session 表 — 会话聚合信息
-- 功能: 存储会话级汇总数据，每次写入 turn/a2a 时自动更新
-- 关联: 1:N → Turn, 1:N → Optimization, 1:N → Timer
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
    id              TEXT PRIMARY KEY,          -- PK, UUID 自动生成
    created         TEXT NOT NULL,              -- ISO 8601 创建时间
    last_activity   TEXT NOT NULL,              -- ISO 8601 最后活跃时间
    turn_count      INTEGER NOT NULL DEFAULT 0, -- 人机对话轮次数
    a2a_count       INTEGER NOT NULL DEFAULT 0, -- A2A 消息数
    total_input_uncached INTEGER NOT NULL DEFAULT 0, -- 总未命中输入 Token
    total_input_cached   INTEGER NOT NULL DEFAULT 0, -- 总缓存输入 Token
    total_output    INTEGER NOT NULL DEFAULT 0, -- 总输出 Token
    estimated_cost  REAL NOT NULL DEFAULT 0     -- 估算总成本
);

-- ============================================================
-- 2. Turn 表 — 轮次/A2A 消息记录
-- 功能: 存储所有人机对话轮次和 Agent 间通信消息
-- 类型: type='turn' 为人机对话, type='a2a' 为 Agent 间通信
-- 关联: N:1 → Session, N:1 → Optimization (通过 opt_id)
-- ============================================================
CREATE TABLE IF NOT EXISTS turns (
    id              TEXT PRIMARY KEY,          -- PK, UUID 自动生成
    session_id      TEXT NOT NULL,              -- FK → sessions.id
    type            TEXT NOT NULL               -- 类型: turn(人机) / a2a(Agent间)
                    CHECK(type IN ('turn', 'a2a')),
    parent_turn_id  TEXT,                       -- 父轮次 ID（用于 A2A 层级追踪）
    phase           TEXT,                       -- 阶段标识，如 "Phase 1"
    timestamp       TEXT NOT NULL,              -- ISO 8601 时间戳
    role            TEXT                        -- 角色: human / ai
                    CHECK(role IS NULL OR role IN ('human', 'ai')),
    from_agent      TEXT,                       -- 来源 Agent 名称
    to_agent        TEXT,                       -- 目标 Agent 名称
    skill           TEXT,                       -- 使用的 Skill 名称
    model_used      TEXT,                       -- 使用的模型名称
    protocol        TEXT                        -- A2A 通信协议
                    CHECK(protocol IS NULL OR protocol IN ('native', 'lambda-lang', 'json')),
    input_uncached  INTEGER NOT NULL DEFAULT 0, -- 未命中缓存的输入 Token
    input_cached    INTEGER NOT NULL DEFAULT 0, -- 命中缓存的输入 Token
    output_tokens   INTEGER NOT NULL DEFAULT 0, -- 输出 Token
    latency_ms      INTEGER NOT NULL DEFAULT 0, -- 延迟（毫秒）
    message_size_bytes INTEGER NOT NULL DEFAULT 0, -- 消息大小（字节）
    opt_id          TEXT,                       -- FK → optimizations.opt_id（可空）
    note            TEXT,                       -- 备注信息
    data_source     TEXT,                       -- 数据来源
                    CHECK(data_source IS NULL OR data_source IN ('hook', 'env', 'stdin', 'file', 'no-data')),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_turns_session_id ON turns(session_id);
CREATE INDEX IF NOT EXISTS idx_turns_timestamp ON turns(timestamp);
CREATE INDEX IF NOT EXISTS idx_turns_type ON turns(type);
CREATE INDEX IF NOT EXISTS idx_turns_model_used ON turns(model_used);

-- ============================================================
-- 3. Optimization 表 — 优化节省记录
-- 功能: 记录各优化机制在特定轮次的 Token 节省明细
-- 关联: 1:N → Turn（通过 opt_id）, N:1 → Session
-- ============================================================
CREATE TABLE IF NOT EXISTS optimizations (
    opt_id          TEXT PRIMARY KEY,          -- PK, 优化记录 ID
    session_id      TEXT NOT NULL,              -- FK → sessions.id
    timestamp       TEXT NOT NULL,              -- ISO 8601 时间戳
    model_switched  INTEGER NOT NULL DEFAULT 0 -- 是否发生模型切换 (0/1)
                    CHECK(model_switched IN (0, 1)),
    mechanisms      TEXT NOT NULL,              -- JSON 字符串: 各机制节省明细
    saved_total     INTEGER NOT NULL DEFAULT 0, -- 总节省 Token（不含 model_switch）
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_optimizations_session_id ON optimizations(session_id);

-- ============================================================
-- 4. Pricing 表 — 模型定价配置
-- 功能: 存储各模型定价数据，用于成本估算
-- 关联: 独立配置表，与 Turn 通过 model_used 字段逻辑关联
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing (
    model_id            TEXT PRIMARY KEY,     -- PK, 模型 ID
    short               TEXT,                 -- 模型简称
    name                TEXT,                 -- 模型全名
    input_per_mtok      REAL NOT NULL,        -- 输入价格（¥/M Token）
    output_per_mtok     REAL NOT NULL,        -- 输出价格（¥/M Token）
    cache_read_per_mtok REAL NOT NULL,        -- 缓存读取价格（¥/M Token）
    note                TEXT,                 -- 备注
    currency            TEXT NOT NULL DEFAULT '¥' -- 货币符号
);

-- ============================================================
-- 5. Mechanism 表 — 优化机制定义
-- 功能: 定义各优化机制的元信息
-- 关联: 独立配置表，与 Optimization 通过 mechanisms JSON 字段逻辑关联
-- ============================================================
CREATE TABLE IF NOT EXISTS mechanisms (
    id                  TEXT PRIMARY KEY,     -- PK, 机制 ID
    name                TEXT NOT NULL,        -- 机制名称
    description         TEXT NOT NULL,        -- 机制描述
    measurable          INTEGER NOT NULL      -- 是否可量化测量 (0/1)
                        CHECK(measurable IN (0, 1)),
    measurement         TEXT,                 -- 测量方式说明
    exclude_from_savings INTEGER NOT NULL DEFAULT 0 -- 是否不计入总节省 (0/1)
                        CHECK(exclude_from_savings IN (0, 1))
);

-- ============================================================
-- 6. Timer 表 — 工具调用耗时记录
-- 功能: 记录 AI IDE 工具调用的耗时数据
-- 关联: N:1 → Session
-- ============================================================
CREATE TABLE IF NOT EXISTS timers (
    tool_call_id    TEXT PRIMARY KEY,         -- PK, 工具调用 ID
    tool_name       TEXT NOT NULL,            -- 工具名称
    start_time      INTEGER NOT NULL,         -- 开始时间戳（毫秒）
    session_id      TEXT NOT NULL,            -- FK → sessions.id
    latency_ms      INTEGER NOT NULL,         -- 耗时（毫秒）
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_timers_session_id ON timers(session_id);

-- ============================================================
-- 表关系摘要:
-- - sessions.id ← turns.session_id (1:N)
-- - sessions.id ← optimizations.session_id (1:N)
-- - optimizations.opt_id ← turns.opt_id (1:N)
-- - sessions.id ← timers.session_id (1:N)
-- - pricing 与 turns 通过 model_used 逻辑关联
-- - mechanisms 与 optimizations 通过 mechanisms JSON 逻辑关联
-- ============================================================

-- ============================================================
-- 种子数据: 优化机制定义 (Mechanism)
-- ============================================================
INSERT OR IGNORE INTO mechanisms (id, name, description, measurable, measurement, exclude_from_savings) VALUES
    ('lean_ctx', 'lean-ctx 上下文压缩', '原始大小 - 压缩后大小', 1, '压缩前字节 - 压缩后字节', 0),
    ('l1_cache', 'L1 共享前缀缓存', '共享前缀大小 × 调用次数', 1, '共享前缀 token × 总请求数', 0),
    ('l2_warmup', 'L2 长上下文预热', '预热文档 token × (总请求数 - 1)', 1, '预热 token × (请求数-1)', 0),
    ('l3_skill_stub', 'L3 技能按需加载', '非需技能数 × (15000 - 25)', 1, '非需技能数 × 14975', 0),
    ('ccp_skip', 'CCP Skip — 阶段跳过', '跳过阶段数 × 12000', 1, '跳过阶段数 × 12000', 0),
    ('lambda_lang', 'lambda-lang A2A 压缩', '原生大小 - 压缩后大小', 1, '原生 token - 压缩后 token', 0),
    ('model_switch', '模型切换（Pro↔Flash）', 'Flash 调用 × (Pro单价 - Flash单价)', 1, 'Flash调用 × (Pro单价 - Flash单价)', 1);

-- ============================================================
-- 种子数据: 模型定价配置 (Pricing)
-- ============================================================
INSERT OR IGNORE INTO pricing (model_id, short, name, input_per_mtok, output_per_mtok, cache_read_per_mtok, currency, note) VALUES
    ('deepseek-v4-pro', 'V4-Pro', 'DeepSeek V4-Pro', 3.13, 6.26, 0.026, '¥', 'DeepSeek 旗舰模型'),
    ('deepseek-v4-flash', 'V4-Flash', 'DeepSeek V4-Flash', 1.01, 2.02, 0.020, '¥', 'DeepSeek 快速模型'),
    ('kimi-k2.6', 'K2.6', 'Kimi K2.6', 1.00, 4.00, 1.00, '¥', 'Moonshot Kimi'),
    ('kimi-k2.5', 'K2.5', 'Kimi K2.5', 1.00, 4.00, 1.00, '¥', 'Moonshot Kimi'),
    ('minimax-m2.5', 'M2.5', 'MiniMax M2.5', 2.10, 8.40, 0.21, '¥', 'MiniMax'),
    ('claude-sonnet-4', 'Sonnet 4', 'Claude Sonnet 4', 21.60, 108.00, 2.70, '¥', 'Anthropic Claude'),
    ('claude-haiku-3.5', 'Haiku 3.5', 'Claude Haiku 3.5', 1.80, 9.00, 0.216, '¥', 'Anthropic Claude');

-- ============================================================
-- 索引汇总:
-- - turns: session_id, timestamp, type, model_used
-- - optimizations: session_id
-- - timers: session_id
-- ============================================================

**【锁定版】** 已通过 Grill 审查
