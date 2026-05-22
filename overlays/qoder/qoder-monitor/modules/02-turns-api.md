# M02: turns-api — 数据采集 API

## 模块职责

- **做什么**: 实现 F-001（用户输入记录）、F-002（AI 回复记录）、F-003（A2A 消息记录）的 API 端点，包含数据采集的多源降级策略、去重逻辑和校验规则
- **不做什么**: 不包含统计数据聚合逻辑（归 M03），不处理看板数据整合（归 M04）

## 依赖

| 模块ID | 依赖关系 | 说明 |
|--------|---------|------|
| M01 | 必须 | db-core 提供数据库 Schema 和连接 |
| M03 | 可选 | stats-api 提供统计聚合（读操作依赖） |

## 领域标注

- **领域**: 业务核心
- **类型**: 后端 (API)

## 核心文件

| 文件路径 | 职责 |
|---------|------|
| `backend/src/api/turns/index.ts` | 路由注册（仅写入和列表查询） |
| `backend/src/api/turns/handlers.ts` | 请求处理器（createTurn, listTurns, getTurnById） |
| `backend/src/api/turns/validators.ts` | Zod 校验 schema |

## 接口清单

### POST /api/turns — 记录轮次/A2A (F-001/F-002/F-003)

| 参数 | 类型 | 必填 | 校验规则 |
|------|------|------|---------|
| session_id | string | 是 | 5-100 字符 |
| type | string | 是 | enum: turn, a2a |
| timestamp | string | 是 | ISO 8601 格式 |
| role | string | 否 | enum: human, ai |
| from_agent / to_agent | string | 否 | max 100 字符 |
| model_used | string | 否 | max 100 字符 |
| input_uncached | integer | 否 | 0-999999999 |
| input_cached | integer | 否 | 0-999999999 |
| output_tokens | integer | 否 | 0-999999999 |
| message_size_bytes | integer | 否 | 0-10485760 |
| protocol | string | 否 | enum: native, lambda-lang, json |

**响应**: `{ ok: true, data: { id, session_id } }`

### GET /api/turns — 查询轮次列表

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| session_id | string | — | 按会话筛选 |
| type | string | — | turn/a2a |
| model | string | — | 模型名称 |
| phase | string | — | 阶段标识 |
| keyword | string | — | 模糊搜索 |
| page | integer | 1 | 页码 |
| page_size | integer | 50 | 每页条数 |

**响应**: `{ ok: true, data: { items: Turn[], total, page, page_size } }`

### GET /api/turns/:id — 查询单条轮次

**响应**: `{ ok: true, data: Turn }`

## 业务规则

| 编号 | 规则 | 处理方式 |
|------|------|---------|
| BR-001 | IF 同一 session 30 秒内已有用户输入 THEN 跳过 | 静默返回，不写入 |
| BR-004 | IF 同一 session 3 秒内已有 AI 回复 THEN 跳过 | 静默返回，不写入 |
| BR-002 | IF 消息为空或仅空白 THEN 不记录 | 直接返回 |
| BR-003 | IF 模型信息不可用 THEN 使用默认值 | 'deepseek-v4-flash' |
| BR-006 | IF 模型无法识别 THEN 记录 'unknown' | 跳过成本估算 |
| EB-003 | IF Token 值为负 THEN 取 max(0, value) | 防止负值影响统计 |
| EB-004 | IF cached > total_input THEN 调整 uncached | uncached = max(0, total - cached) |

## 数据校验规则

| 字段 | 校验类型 | 规则 |
|------|---------|------|
| session_id | 存在校验 | required; 5-100 字符 |
| message_size_bytes | 范围校验 | 0-10485760 |
| model_used | 格式校验 | max_length:100 |
| input_uncached | 范围校验 | 0-999999999 |
| input_cached | 范围校验 | 0-999999999 |
| output_tokens | 范围校验 | 0-999999999 |
| timestamp | 格式校验 | ISO 8601 |
| from_agent | 存在校验 | required for a2a; max_length:100 |
| to_agent | 存在校验 | required for a2a; max_length:100 |
| protocol | 枚举校验 | native, lambda-lang, json |

## 验收标准

### Happy Path
- AC-001: POST /api/turns 创建 role=human 记录成功，包含 session_id、model_used、message_size_bytes
- AC-002: POST /api/turns 创建 role=ai 记录成功，包含真实 Token 数据
- AC-003: POST /api/turns type=a2a 记录成功，包含 from_agent、to_agent、protocol
- GET /api/turns 支持所有筛选参数，分页正确
- GET /api/turns/:id 返回完整轮次信息

### Exception Path
- 同一 session 30 秒内重复用户输入，第二次被跳过
- 消息为空字符串不记录
- Token 负值被修正为 0
- 缺少 model_used 时使用默认值

---

**【锁定版】** 已通过 Grill 审查
