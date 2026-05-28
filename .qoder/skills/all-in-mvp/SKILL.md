---
name: all-in-mvp
description: Qoder 特化版多Agent并行MVP开发流水线。Triggers: MVP, 原型开发, 多Agent并行开发, 全栈快速原型, multi-agent pipeline, 从需求到交付, 多Agent流水线, 并行开发, 快速验证产品, 原型系统, 并行工程. NOT for: single API endpoint, bug fixing, code refactoring, deployment, code review alone.
---

# Parallel MVP Pipeline — Qoder 特化版

> 基于《MVP 白皮书 v2.5》的多 Agent 并行工程方法论，针对 Qoder IDE 环境深度适配。增量变更强制走完整流水线（§0.2决策树）。
> 利用 Qoder Custom Subagents（具备文件读写能力）+ Experts Mode（专家团面板）+ Canvas（进度看板）。

---

## 执行概览

```
【轻量模式】简单任务 → QuickStep1-3（单Agent直通，10-30min）
【全量模式】全新项目 → Stage1→Stage2→Stage3→Stage4（6-10 Agent，4-12h）
【增量模式】迭代项目 → 裁剪Stage执行（1-4h）
```

**黄金规则**：全量/增量模式下 Stage 不可跳过。轻量模式走简化通道（3 步替代 4 Stage）。

---

## Phase 0: Pipeline Monitor 自动回溯（强制前置步骤）

> 每次执行 all-in-mvp 时，自动启动 Pipeline Monitor 并创建回溯 Pipeline。
> 记录所有 Agent 工具调用，实现全链路可追溯。

### 执行步骤

1. **运行 Session 初始化脚本**（获取端口 + 创建 Pipeline）：
   ```
   node overlays/pipeline-monitor/scripts/manage-session.cjs <workspacePath> "<taskName>" "<mode>"
   ```
   - 输出格式：JSON `{ pipelineId, sessionName, port }`
   - 脚本自动执行：启动 Daemon（如未运行）、创建 Pipeline、记录 PIPELINE_START
2. **记录后续事件**（按需手动写入）：
   - 注意：FILE_CHANGE / TOOL_CALL / ERROR 由 PostToolUse Hook **自动**写入，无需手动处理
3. **全部完成后**记录 PIPELINE_END + PATCH 状态为 DONE/FAILED

### 事件记录指引

| 时机 | 事件类型 | 记录方式 |
|------|----------|----------|
| Session 创建时 | PIPELINE_START | manage-session.cjs 自动 |
| Agent 被 spawn/完成/阻塞时 | AGENT_SPAWN / AGENT_DONE / AGENT_BLOCKED | 手动 POST /api/events |
| Write/Edit/create_file 等 | FILE_CHANGE | Hook 自动 |
| run_in_terminal/search_* 等 | TOOL_CALL | Hook 自动 |
| Stage 开始 / 完成 | STAGE_START / STAGE_END | 手动 POST /api/events |
| 门禁检查 | GATE_CHECK | 手动 POST /api/events |
| 拷问审查 | GRILL_ROUND | 手动 POST /api/events |
| Pipeline 完成 | PIPELINE_END | 手动 POST /api/events |
| 任何错误 | ERROR | Hook 自动 |

### 环境变量

设置环境变量便于后续使用：
```
export PM_PORT=<port>
export PM_PIPELINE_ID=<pipelineId>
export PM_SESSION_NAME=<sessionName>
```

### 注意事项

- Pipeline Monitor 为全局单实例（端口 :3000），多个 AI IDE 共享同一实例
- 每条 all-in-mvp 调用在 DB 中创建独立 Pipeline，通过 `sessionName` 区分（格式：`workspaceName@HHmmss`）
- Hook 脚本失败时不阻塞 Agent 执行（静默退出）
- 本阶段无门禁检查

---

## Qoder 环境适配说明

### 1. Agent 执行模式

| 模式 | 说明 | 使用场景 |
|------|------|---------|
| **主 Agent 角色切换** | 主 Agent 以不同角色身份顺序执行 | Stage 1、Stage 2 串行部分、Stage 4 |
| **Custom Subagent 并行** | spawn `.qoder/agents/mvp-*.md` 定义的子 Agent | Stage 2 并行部分、Stage 3 fallback |
| **Experts Mode 专家团** | Qoder 内置专家团模式，Team Lead 调度 | Stage 3 首选方案 |

### 2. Custom Subagent 注册

本流水线依赖以下预注册的 Custom Subagent（位于 `.qoder/agents/` 目录）：

| Agent 名称 | 角色 | Stage | 工具权限 |
|------------|------|-------|---------|
| `mvp-backend-tdd` | 后端 TDD 开发专家 | Stage 3 | Read, Write, Edit, Bash, Grep, Glob |
| `mvp-frontend-dev` | 前端开发专家 | Stage 3 | Read, Write, Edit, Bash, Grep, Glob |
| `mvp-mock-service` | Mock 服务搭建专家 | Stage 2 | Read, Write, Edit, Bash, Grep, Glob |
| `mvp-test-writer` | 测试用例编写专家 | Stage 2 | Read, Write, Edit, Bash, Grep, Glob |
| `mvp-debug-fixer` | Bug 修复专家 | Stage 4 | Read, Write, Edit, Bash, Grep, Glob |

**Spawn 方式**：使用 Qoder 的 `Agent` 工具，指定 subagent_type 为对应 agent 名称。

### 3. Experts Mode 集成（Stage 3 首选）

当模块数量 ≥ 3 时，优先使用 Qoder Experts Mode：
- 主 Agent 扮演 **Team Lead / Pipeline Coordinator** 角色
- 通过 Experts Mode 调度多个专家并行开发
- 自动生成 **Expert Team Canvas** 实时展示进度
- Fallback：如果 Experts Mode 不可用，退回 Custom Subagent 手动 spawn

### 4. Canvas 看板

Stage 2 完成后，生成 Pipeline Dashboard Canvas（`.canvas.tsx`），展示：
- 模块分配状态
- 后端/前端/测试进度
- 整体完成百分比和 ETA

---

## 快速通道：简单任务判定

> 在执行完整流水线之前，先判定任务复杂度。简单任务走轻量通道。

### 判定流程

```
用户需求进入
    ↓
评估以下 7 个维度：
  1. API/接口数量 ≤2？
  2. 无数据库 或 单表 CRUD？
  3. 单用户角色（无登录/单一类型）？
  4. 无状态流转（单状态）？
  5. 单页面 或 2 个简单页面？
  6. 无外部服务调用？
  7. 仅 1 个全栈模块？
    ↓
满足 ≥3 项 → 轻量模式（3 步直通车）
不满足     → 全量/增量模式（完整流水线）
```

### 轻量模式 QuickStep 1-3

```
QuickStep1: 需求摘要
    ├── 输出：需求卡片 + 技术摘要（单个 .md，YAML front matter）
    ├── 不产生：PRD.md / spec.md / schema.sql / api-contract.yaml / task.md
    └── 耗时：2-5min
    ↓
QuickStep2: 直接开发
    ├── 单 Agent 全栈开发（后端+前端一起写）
    ├── 无 Coordinator、无 Mock、无模块拆分
    ├── 可选 L1 单元测试（按需）
    └── 耗时：5-20min
    ↓
QuickStep3: 轻量验收
    ├── 运行 + 冒烟测试
    ├── 用户确认可用
    └── 耗时：2-5min
```

### 需求卡片模板

```yaml
# @task: <一句话任务描述>
# @type: simple
# @tech: <html+css+js | hono+sqlite | vue+vite | ...>
# @apis: <API端点列表，无则写 none>
# @db: <数据表，无则写 none>
# @pages: <页面列表>
# @acceptance: <1-2条验收标准>
```

**典型简单任务**：个人博客、落地页、留言板、JSON API 代理、单表 CRUD、Markdown 预览器。

### 轻量→全量升级

开发中发现以下情况应升级为全量模式：
- 需要 ≥3 个 API 端点
- 需要多表关联/事务
- 用户追加需求导致模块 ≥2
- 需要多角色权限

> 升级时保留已产出代码，补充执行全量 Stage1→Stage2。

---

## 专家卡片格式（Qoder 对话流嵌入）

### Stage 开始卡片

每个 Stage 启动时，输出以下格式的卡片：

```markdown
> **[Stage N] 角色名称 — 阶段目标**
> | 字段 | 值 |
> |------|-----|
> | 状态 | IN_PROGRESS |
> | 输入 | 上游产出物列表 |
> | 产出 | 本阶段交付物列表 |
> | 门禁 | 通过条件 |
> | 预估 | 耗时范围 |
```

### Stage 完成卡片

```markdown
> **[Stage N Complete] 阶段名称**
> | 产出物 | 状态 | 摘要 |
> |--------|------|------|
> | PRD.md | LOCKED | 5 个功能模块、12 条验收标准 |
> | ... | ... | ... |
```

### Subagent 执行卡片

spawn subagent 时输出：

```markdown
> **[Subagent] mvp-backend-tdd**
> | 字段 | 值 |
> |------|-----|
> | 模块 | auth（认证与授权） |
> | 依赖 | 无（首批执行） |
> | 任务 | Red→Green→Refactor 完成 auth 模块 |
> | 工具 | Read, Write, Edit, Bash, Grep, Glob |
```

---

## 门禁系统（硬约束）

```
     Stage1 完成 → PRD.md 已锁定
         ↓
     Stage2 完成 → schema.sql / api-contract / module docs 全部锁定
         ↓
     Stage3 完成 → 后端全模块 DONE + 前端全页面 DONE + 单元测试全通过
         ↓
     Stage4 完成 → 集成测试通过率 100%
```

任何阶段的产出物变更必须走变更评审——下游 Agent 不自行修改上游锁定产出物。

---

## Stage 1: 需求对齐（主 Agent 角色切换：产品经理）

**前置条件**：用户需求已收集（如果模糊则先执行 Inversion 采集）。
**产出物**：`PRD.md`
**执行模式**：主 Agent 角色切换（无需 spawn subagent）

### 执行步骤

1. 主 Agent 切换为「产品经理」角色，遵循以下原则：
   - MECE（Mutually Exclusive, Collectively Exhaustive）
   - 每项功能需求必须有明确的验收标准
   - 术语定义必须在全文档中保持一致
   - 不涉及技术实现细节
2. 输入：用户原始需求 + 业务背景
3. 产出 PRD.md，必须包含：
   - 项目背景与目标
   - 术语定义
   - 风险与约束
   - 业务主流程（用户旅程）
   - ER 关系 / 核心领域模型
   - 功能需求（含验收标准）
   - 核心实体状态图
4. **输出 Stage 1 完成卡片**
5. **门禁**：PRD 评审通过后锁定为 `PRD.md`

---

## Stage 2: 规划阶段（①→②→↺→③a∥③b-1∥③b-2）

**前置条件**：`PRD.md` 已存在并锁定。

### 2.1 ① 架构专家（主 Agent 角色切换）

1. 主 Agent 切换为「架构专家」角色
2. 输入：`PRD.md`
3. 产出：`spec.md`（架构设计）+ `schema.sql`（数据库 Schema）+ `api-contract.yaml`（接口契约）
4. **技术栈绑定**：询问用户偏好的技术栈或使用默认（Hono + Drizzle + SQLite + Vue 3 + Vite）
5. 产出物标记为【初版】

### 2.2 ② 业务领域专家（主 Agent 角色切换）

1. 主 Agent 切换为「业务领域专家」角色
2. 输入：`PRD.md` + `spec.md` + `schema.sql` + `api-contract.yaml`（均为【初版】）
3. 产出：
   - `task.md` — 任务全景图（所有模块清单 + 依赖关系）
   - `modules/<module>.md` — 每个模块的详细定义（边界、接口、表、验收标准）
4. 产出物标记为【初版】

### 2.3 ↺ 拷问审查循环（grill review）

1. 主 Agent 切换为「审查员」角色，或调用 `grill-with-docs` skill
2. 对照 `PRD.md`（基准），检查：
   - 需求覆盖完整性
   - 模块边界合理性
   - 术语一致性
   - 验收标准对齐
3. 发现不一致 → 写审查报告 → 修正 → 重新审查
4. **循环上限 3 轮**，仍不一致 → 输出「未决问题清单」→ 由人类决策
5. 全部通过 → 所有产出物升级为【锁定版】

### 2.4 ③a Mock 服务（spawn Custom Subagent，与 ③b 并行）

1. **Spawn `mvp-mock-service` subagent**
2. 输入：`api-contract.yaml`【锁定版】+ `task.md`【锁定版】
3. 产出：`mocks/` 目录下的完整 Mock 服务
4. **输出 Subagent 执行卡片**

### 2.5 ③b-1 单模块 API 集成测试（spawn Custom Subagent，最多 2 个并行）

1. 按模块平分给 2 个 `mvp-test-writer` subagent
2. 输入：对应模块的 `<module>.md`【锁定版】+ `api-contract.yaml`【锁定版】
3. 产出：`integration-tests/modules/<module>.test.ts`
4. **此阶段只写用例，不执行**
5. **输出 Subagent 执行卡片**

### 2.6 ③b-2 业务条线 E2E 测试（spawn Custom Subagent）

1. **Spawn `mvp-test-writer` subagent**（E2E 模式）
2. 输入：`PRD.md`【锁定版】+ `task.md`【锁定版】
3. 产出：`integration-tests/scenarios/<scenario>.test.ts`
4. **此阶段只写用例，不执行**

### Stage 2 门禁

**全部通过后才能进入 Stage 3：**
- [ ] `spec.md`【锁定版】已产出
- [ ] `schema.sql`【锁定版】已产出
- [ ] `api-contract.yaml`【锁定版】已产出
- [ ] `task.md`【锁定版】已产出
- [ ] 所有 `<module>.md`【锁定版】已产出
- [ ] `mocks/` 已搭建并可运行
- [ ] `integration-tests/modules/` 已产出
- [ ] `integration-tests/scenarios/` 已产出

**门禁通过后**：
- 输出 Stage 2 完成卡片
- 生成 Pipeline Dashboard Canvas（`.canvas.tsx`）

---

## Stage 3: 执行阶段（大规模并行）

**前置条件**：Stage 2 门禁全部通过。

### 3.0 Pipeline Coordinator（主 Agent 担任调度中枢）

主 Agent 作为 Pipeline Coordinator，读取 `task.md` 中的模块依赖图，按策略分批分配。

**调度算法**（每轮执行）：
```
1. 依赖图筛选 → 找出「依赖已满足 ∩ 未分配」的候选模块
2. 专家匹配 → 按领域优先分配（认证/业务核心/工具配置）
3. 兜底分配 → 剩余模块给任意空闲 Agent
4. 记录分配 → 模块标记为「已分配」，写入分配日志
```

### 3.1 并行执行策略（方案 C：Experts Mode 优先 + Subagent Fallback）

#### 方案 A：Experts Mode（首选，模块 ≥ 3 时）

当模块数量 ≥ 3，优先使用 Qoder Experts Mode：
1. 主 Agent 以 Team Lead 身份启动 Experts Mode
2. 将模块分配给以下专家角色：
   - Backend Expert（使用 `mvp-backend-tdd` agent 定义）
   - Frontend Expert（使用 `mvp-frontend-dev` agent 定义）
3. Expert Team Canvas 自动展示进度
4. 主 Agent 持续监控 Canvas，协调阻塞

#### 方案 B：Custom Subagent Fallback（Experts Mode 不可用 或 模块 < 3）

手动 spawn Custom Subagent：
1. **后端**：spawn `mvp-backend-tdd` subagent（最多 3 个并行）
2. **前端**：spawn `mvp-frontend-dev` subagent（最多 3 个并行）
3. 主 Agent 通过扫描 DONE/BLOCKED 文件监控进度

### 3.2 文件状态标记（Agent 间通信协议）

Agent 通过模块目录下的状态文件通信。Coordinator 扫描文件系统判断进度。

#### DONE 标记

文件路径：`src/modules/<module>/DONE`

```yaml
module: <module_name>
agent: <agent_name>
completed_at: "YYYY-MM-DD HH:MM:SS"
checks:
  l1_unit_test: PASS
  l2_api_test: PASS
  l3_db_test: PASS
  l4_headed_test: PASS
  l5_headless_test: PASS
  coverage: 85.2
  code_review: PASS
  flaky_test: false
issues: []
```

#### BLOCKED 标记

文件路径：`src/modules/<module>/BLOCKED`

```yaml
module: <module_name>
agent: <agent_name>
blocked_at: "YYYY-MM-DD HH:MM:SS"
blocked_by: <dependency_module_or_issue>
reason: |
  [多行描述阻塞原因]
action_required: <what_needs_to_happen>
suggested_fix: <optional_suggestion>
```

### 3.3 后端团队：TDD 开发

1. Coordinator 分配模块给后端 Agent（最多 3 个并行）
2. 每个后端 Agent 使用 `mvp-backend-tdd` subagent 定义
3. 遵循 Red→Green→Refactor 微循环
4. 产出：`src/modules/<module>/`（routes + service + schema + types + test）

### 3.4 前端团队：基于 Mock 开发

1. Coordinator 分配页面给前端 Agent（最多 3 个并行）
2. 每个前端 Agent 使用 `mvp-frontend-dev` subagent 定义
3. 所有 API 调用指向 Mock 服务
4. 产出：`src/views/` + `src/components/` + `src/composables/`

### 3.5 Canvas 进度看板

Stage 3 执行期间，持续更新 Pipeline Dashboard Canvas：

```
Pipeline Dashboard
+------------------+------------------+------------------+
| Backend Team     | Frontend Team    | Test Status      |
|                  |                  |                  |
| [DONE] auth      | [DONE] login     | L1: 12/12 PASS  |
| [WIP ] order     | [WIP ] dashboard | L2: 8/10 PASS   |
| [QUEUED] payment | [QUEUED] profile | L3: 5/5 PASS    |
+------------------+------------------+------------------+
Overall: 3/8 modules DONE | ETA: ~45min
```

### Stage 3 门禁 (MUST)

- [ ] 后端全部模块 DONE（模块目录下存在 DONE 标记）
- [ ] 前端全部页面 DONE
- [ ] **L1 单元测试**：所有Service函数、纯函数、工具函数测试通过
- [ ] **L2 API集成测试**：每个路由的happy+error path测试通过
- [ ] **L3 数据库集成测试**：事务、迁移、约束测试通过
- [ ] **L4 有头浏览器测试**：真实浏览器渲染、交互测试通过（本地验证）
- [ ] **L5 无头CI测试**：Playwright headless测试通过
- [ ] **覆盖率 ≥ 80%**（statements + branches + functions）
- [ ] **无 flaky tests**：同一测试运行10次全部通过
- [ ] Code Review 无 P0 问题

### Stage 3 测试执行流程

```bash
# 1. L1-L3 后端测试
npx vitest run --coverage

# 2. L4 有头浏览器测试（本地人工验证）
npx playwright test --project=chromium-headed

# 3. L5 无头CI测试
npx playwright test --project=chromium-headless

# 4. 覆盖率检查（必须 ≥ 80%）
npx vitest run --coverage --reporter=json

# 5. 稳定性检查（运行3次确保无flaky）
for i in {1..3}; do npx vitest run; done
```

---

## Stage 4: 集成与验收（串行收敛）

**前置条件**：Stage 3 门禁全部通过。
**执行模式**：主 Agent 角色切换 + spawn `mvp-debug-fixer` subagent（按需）

### 4.1 后端模块合并

- 合并各模块路由到统一入口
- 验证全局 Schema 一致性
- 运行全量单元测试

### 4.2 前后端联调

- 前端切换 Mock → 真实后端 API
- 按模块逐个联调
- 记录接口不匹配问题到 `integration-issues.md`

**联调问题记录模板**：

```markdown
## 联调问题记录

### #ISSUE-001: [问题简述]

| 字段 | 值 |
|------|-----|
| **发现时间** | YYYY-MM-DD HH:MM |
| **涉及模块** | <module_name> |
| **涉及接口** | `METHOD /api/xxx` |
| **预期行为** | [api-contract.yaml 中的定义] |
| **实际行为** | [联调中观察到的偏差] |
| **偏差类型** | 响应格式不一致 / 状态码不一致 / 字段缺失 / 字段类型不一致 / 路由不存在 |
| **影响范围** | 前端哪些页面/组件受影响 |
| **修复方式** | 修正后端 / 修正契约 / 修正前端 |
| **修复状态** | 待修复 / 已修复 / 已确认无需修复 |
| **修复人** | <agent_name> |
```

### 4.3 集成测试执行

- 运行 `integration-tests/modules/` + `integration-tests/scenarios/`
- 输出测试报告

### 4.4 Bug 修复

Spawn `mvp-debug-fixer` subagent，按需执行修复循环。

### Stage 4 门禁（终检）

- [ ] 后端合并完成，路由一致性验证通过
- [ ] 前后端联调全部模块通过
- [ ] 集成测试通过率 100%
- [ ] **5层测试全部通过**：L1-L5无失败
- [ ] **有头/无头一致性**：L4和L5结果一致
- [ ] **安全测试通过**：防刷、注入、XSS、越权全部通过
- [ ] **性能测试通过**：p99 < 500ms，错误率 < 1%
- [ ] **数据一致性验证**：无外键违反、无orphan记录
- [ ] **Mock-后端一致性**：7个维度全部匹配
- [ ] 无 P0/P1 Bug 遗留

---

## 并发模型速查

| 阶段 | 并行度 | Qoder 执行方式 |
|------|--------|---------------|
| Stage1 | 串行 | 主 Agent 角色切换（PM） |
| Stage2 ① ② | 串行 | 主 Agent 角色切换（架构师→领域专家） |
| Stage2 ↺ | 串行循环 | 主 Agent 角色切换（审查员）或 grill-with-docs skill |
| Stage2 ③a/③b | 并行 | Spawn `mvp-mock-service` + `mvp-test-writer` subagents |
| Stage3 后端 | 最多 3 | Experts Mode 或 Spawn `mvp-backend-tdd` |
| Stage3 前端 | 最多 3 | Experts Mode 或 Spawn `mvp-frontend-dev` |
| Stage4 | 串行 | 主 Agent + Spawn `mvp-debug-fixer`（按需） |

---

## Qoder Hooks 配置（推荐）

在 `.qoder/settings.json` 中配置以下 hooks，实现流水线自动化守卫：

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'File modified: ${file_path}' >> .mvp-pipeline/file-changes.log"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node .mvp-pipeline/check-gate.js"
          }
        ]
      }
    ]
  }
}
```

**Hook 用途**：
- `PostToolUse` on Write/Edit：记录所有文件修改，用于审计 trace
- `Stop`：在 Agent 每轮响应结束时检查门禁状态

---

## Gotchas

- **先判定再执行**：进入流水线前先走「快速通道：简单任务判定」。简单任务用轻量模式（10-30min），不要对简单任务上全量四阶段流水线。
- **轻量模式无门禁**：简单任务用户确认即通过，不要求 L1-L5 全层测试。
- **Stage 不可跳过（全量/增量）**：门禁是硬约束。不要在 Stage2 还没锁定时就开始 Stage3 的开发。
- **Schema 锁定后严禁修改**：如果必须变更，先通知所有依赖该表的 Agent，走变更评审后再修改。
- **模块边界不可交叉**：Backend Agent 只写自己模块的文件。跨模块调用通过 API。
- **Mock 与真实 API 必须一致**：两者基于同一 `api-contract.yaml` 生成。
- **TDD 是强制流程**：先写测试（RED）→ 再写实现（GREEN）→ 最后重构（REFACTOR）。
- **文件驱动通信**：Agent 之间通过 DONE/BLOCKED 标记通信。Coordinator 扫描文件系统判断进度。
- **Qoder Subagent 工具有 Write/Edit 能力**：与 Browser subagent 不同，Custom Subagent 可以创建和修改文件。
- **Experts Mode 优先**：Stage 3 模块 ≥ 3 时优先使用 Experts Mode，自带 Canvas 面板和 Team Lead 调度。
- **Agent 数量上限**：后端 3 个、前端 3 个、测试 2 个。超过上限的模块按批次排队。
- **确定性分配**：同输入必须产生相同的模块拆分和分配结果。`task.md` 中模块的枚举顺序作为稳定排序依据。

---

## 外部工具引用

| 工具 | 用途 | 说明 |
|------|------|------|
| **Hono** | 后端框架 | 轻量、快速、TypeScript 原生 |
| **Drizzle ORM** | 数据库 ORM | 类型安全、Schema 即代码 |
| **SQLite** | 数据库 | 零配置、原型阶段首选 |
| **Vue 3 + Vite** | 前端框架 | 组合式 API、快速 HMR |
| **Vitest** | 测试框架 | 与 Vite 共享配置、高性能 |
| **OpenAPI 3.0** | 接口契约 | 标准化的 API 描述格式 |

以上仅为默认推荐。如用户指定其他技术栈，以用户指定为准。
