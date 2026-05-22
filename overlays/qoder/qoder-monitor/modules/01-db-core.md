# M01: db-core — 数据库核心

## 模块职责

- **做什么**: Drizzle ORM Schema 定义（6 张表）、数据库连接初始化与生命周期管理、SQLite WAL 模式配置、JSONL 双写降级策略、基础 CRUD 封装
- **不做什么**: 不包含业务逻辑，不处理 API 路由，不涉及数据聚合

## 依赖

| 模块ID | 依赖关系 | 说明 |
|--------|---------|------|
| 无 | — | Foundation 模块，无依赖 |

## 领域标注

- **领域**: 工具与配置
- **类型**: 后端 (Foundation)

## 核心文件

| 文件路径 | 职责 |
|---------|------|
| `backend/src/db/schema.ts` | Drizzle ORM Schema 定义（6 张表） |
| `backend/src/db/index.ts` | 数据库连接初始化、WAL 模式、导出 db 实例 |
| `backend/src/db/seed.ts` | 种子数据（mechanisms + pricing） |

## 数据库表

### sessions 表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | UUID 自动生成 |
| created | TEXT | NOT NULL | ISO 8601 创建时间 |
| last_activity | TEXT | NOT NULL | ISO 8601 最后活跃时间 |
| turn_count | INTEGER | DEFAULT 0 | 人机对话轮次数 |
| a2a_count | INTEGER | DEFAULT 0 | A2A 消息数 |
| total_input_uncached | INTEGER | DEFAULT 0 | 总未命中输入 Token |
| total_input_cached | INTEGER | DEFAULT 0 | 总缓存输入 Token |
| total_output | INTEGER | DEFAULT 0 | 总输出 Token |
| estimated_cost | REAL | DEFAULT 0 | 估算总成本 |

### turns 表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | UUID 自动生成 |
| session_id | TEXT | FK→sessions.id | 会话 ID |
| type | TEXT | CHECK(turn,a2a) | 记录类型 |
| parent_turn_id | TEXT | 可空 | 父轮次 ID |
| phase | TEXT | 可空 | 阶段标识 |
| timestamp | TEXT | NOT NULL | ISO 8601 时间戳 |
| role | TEXT | CHECK(human,ai) | 角色 |
| from_agent | TEXT | 可空 | 来源 Agent |
| to_agent | TEXT | 可空 | 目标 Agent |
| skill | TEXT | 可空 | 使用的 Skill |
| model_used | TEXT | 可空 | 使用的模型 |
| protocol | TEXT | CHECK(三种协议) | A2A 通信协议 |
| input_uncached | INTEGER | DEFAULT 0 | 未命中缓存输入 Token |
| input_cached | INTEGER | DEFAULT 0 | 缓存输入 Token |
| output_tokens | INTEGER | DEFAULT 0 | 输出 Token |
| latency_ms | INTEGER | DEFAULT 0 | 延迟（毫秒） |
| message_size_bytes | INTEGER | DEFAULT 0 | 消息大小（字节） |
| opt_id | TEXT | 可空，FK | 关联优化记录 |
| note | TEXT | 可空 | 备注 |
| data_source | TEXT | CHECK(5种来源) | 数据来源 |

### optimizations 表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| opt_id | TEXT | PK | 优化记录 ID |
| session_id | TEXT | FK→sessions.id | 会话 ID |
| timestamp | TEXT | NOT NULL | ISO 8601 时间戳 |
| model_switched | INTEGER | 0/1 | 是否模型切换 |
| mechanisms | TEXT | JSON 字符串 | 各机制节省明细 |
| saved_total | INTEGER | DEFAULT 0 | 总节省 Token |

### pricing 表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| model_id | TEXT | PK | 模型 ID |
| short | TEXT | 可空 | 模型简称 |
| name | TEXT | 可空 | 模型全名 |
| input_per_mtok | REAL | NOT NULL | 输入价格 |
| output_per_mtok | REAL | NOT NULL | 输出价格 |
| cache_read_per_mtok | REAL | NOT NULL | 缓存价格 |
| note | TEXT | 可空 | 备注 |
| currency | TEXT | DEFAULT '¥' | 货币符号 |

### mechanisms 表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | 机制 ID |
| name | TEXT | NOT NULL | 机制名称 |
| description | TEXT | NOT NULL | 机制描述 |
| measurable | INTEGER | 0/1 | 是否可量化 |
| measurement | TEXT | 可空 | 测量方式 |
| exclude_from_savings | INTEGER | DEFAULT 0 | 是否不计入节省 |

### timers 表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| tool_call_id | TEXT | PK | 工具调用 ID |
| tool_name | TEXT | NOT NULL | 工具名称 |
| start_time | INTEGER | NOT NULL | 开始时间戳 |
| session_id | TEXT | FK→sessions.id | 会话 ID |
| latency_ms | INTEGER | NOT NULL | 耗时（毫秒） |

## 验收标准

### Happy Path
- SQLite 数据库文件被成功创建，6 张表均存在
- WAL 模式生效，并发读写不阻塞
- 种子数据（mechanisms 7条、pricing 7条）正确插入
- JSONL 双写文件正确生成

### Exception Path
- 数据库文件不可用时，自动降级到 JSONL 读取
- 数据库文件损坏时，可重新初始化并从 JSONL 恢复
- better-sqlite3 编译失败时，可降级到 sql.js

---

**【锁定版】** 已通过 Grill 审查
