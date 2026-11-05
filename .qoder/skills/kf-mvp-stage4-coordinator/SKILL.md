---
name: kf-mvp-stage4-coordinator
description: >-
  Load when Stage3 is complete and Stage4 integration needs coordination.
  Triggers: Stage4, 集成协调, 联调编排, 后端合并, 前后端联调, integration
  coordinator, 集成验收. Also load when integration tests fail and need
  bug dispatch, or when rollback is triggered.
metadata:
  pattern: pipeline
  domain: mvp-stage4
recommended_model: minimax-m2.7
graph:
  dependencies:
    - target: kf-pipeline-coordinator
      type: sequential
    - target: kf-mvp-test-e2e
      type: sequential
    - target: all-in-mvp
      type: semantic
---

**Default Tech Stack Context**: 
- Backend: Node.js + Hono + Drizzle ORM + SQLite
- Frontend: React 19 + Vite 8 + Zustand + React Router 7 + Axios
- Testing: Vitest + Playwright
- Third-party: ALL Mock

Load `.qoder/skills/references/mvp-tech-stack-default.md` for full specification.


# Stage4 Coordinator — 集成协调者技能

> **Core Belief**: Stage4 is where independent modules become a system. The Coordinator ensures the merge is clean, the integration is orderly, and bugs are tracked to resolution.

**Division of Labor**: This Skill focuses on **Stage4 orchestration**. It sequences sub-stages, dispatches integration issues, tracks bugs, and enforces final quality gates. Can reuse the Stage3 Pipeline Coordinator instance (already has global context) or operate as an independent lightweight Agent.

---

# Core Philosophy

Derived from MVP Whitepaper Section 4.0 — Stage4 Coordinator:

1. **Serial with order** — Stage4 is serial, but each sub-stage has a defined executor
2. **Issue triage** — Every integration problem gets classified (contract / implementation / misunderstanding) and routed
3. **Bug lifecycle** — From discovery to regression test, every bug has an owner and a state
4. **Gate enforcement** — Final delivery only when ALL gates pass

---

# Four Orchestration Responsibilities

## Responsibility 1: 子阶段执行顺序编排

Stage4的4个子阶段严格串行：

```
4.1 后端模块合并（四步流程）→ 必须全部PASS
    ↓
4.2 前后端联调（按模块切换）→ 所有模块联调通过
    ↓
4.3 集成测试执行 → Happy Path 100% + Exception ≥ 80%
    ↓
4.4 Bug修复循环 → 0 P0/P1 Bug
    ↓
4.5 产物归档 → 交付
```

**Coordinator 在每个子阶段完成后检查门禁，未通过则禁止进入下一子阶段。**

---

## Responsibility 2: 联调问题分类与分发

当联调发现问题时，Coordinator进行分类和路由：

| 问题类型 | 判定依据 | 分发目标 | 动作 |
|---------|---------|---------|------|
| 契约问题 | 实现与 `packages/shared` schema 不一致（`api-contract.yaml` 只是派生视图） | 后端 Agent（修正实现）或 架构专家（修正契约） | 记录到 integration-issues.md |
| 实现问题 | 代码逻辑错误、缺失边界处理 | 对应模块的 Backend Agent | Fix → 单元测试 → 重新联调 |
| 理解偏差 | PRD解读不一致导致的行为差异 | 产品经理 + 对应 Agent | 澄清 → 修正PRD或实现 |
| 造数缺失（v2.26 取代 Mock漂移） | 某条异常分支在真实后端无法复现 | 该模块原开发 Agent（补 demo-seed / dev-only 造数端点） | BLOCKED(造数缺失) → 补数 → 重跑走查 |

**问题分发流程**：
```
联调发现问题
    ↓
Coordinator 读取问题描述 → 分类
    ↓
├── 契约问题 → 写 change-request.md → 人类审查（<3接口可自动批准）
├── 实现问题 → 分配 Debug Agent → 修复 → 验证
├── 理解偏差 → 上浮人类 → 更新PRD或实现
└── 造数缺失 → 路由回原开发 Agent 补 demo-seed / 造数端点（禁止用假接口顶替）
    ↓
修复完成 → 重新联调验证
```

---

## Responsibility 3: Bug跟踪修复管理

**Bug状态流转**：
```
发现Bug → OPEN
    ↓
Coordinator分配给Debug Agent → IN_PROGRESS
    ↓
Debug Agent修复 + 回归测试 → FIXED
    ↓
重新集成验证 → VERIFIED / REOPENED
    ↓
VERIFIED → CLOSED
```

**Coordinator跟踪表**（写入 `bug-tracker.md`）：
```markdown
# Bug 跟踪表

| Bug ID | 标题 | 严重级 | 根因分类 | 状态 | 负责人 | 发现阶段 | 修复验证 |
|--------|------|--------|---------|------|--------|---------|---------|
| BUG-001 | 产品创建返回400 | P0 | CAUSE:IMPL_CONTRACT | FIXED | Debug-1 | 4.2联调 | ✅ |
| BUG-002 | 溯源码幂等性 | P1 | CAUSE:DESIGN_SCHEMA | IN_PROGRESS | Debug-2 | 4.3集成测试 | - |
```

---

## Responsibility 4: 最终门禁检查

Stage4交付前的硬性门禁（全部通过才可交付）：

### 4.A 合并门禁
- [ ] 所有模块状态为 DONE（非 BLOCKED/DEFER）
- [ ] 依赖链闭环——各模块的依赖声明与最终状态一致
- [ ] Schema冲突检测——不同模块无同名但不同类型的字段
- [ ] 路由冲突检测——无重复 HTTP Method + Path 组合
- [ ] 全量单元测试通过

### 4.B 联调门禁（v2.26：全链路 + 双分支）
- [ ] 前端直指真实后端，所有页面无报错（v2.26 起不存在「切 Mock → 切真实」这一步）
- [ ] 所有 API 调用路径与后端实际注册路由匹配（R014），返回格式与 `packages/shared` schema 一致
- [ ] **双分支可交互走查通过（R035）**：每模块异常分支清单 100% 在真实浏览器 + 真实后端复现（400/401/403/404/409/空态/超长/5xx）
- [ ] 无未解决的 integration-issues.md 记录
- [ ] 无未解决的 VISUAL_PENDING 标记（所有前端页面视觉已由人类确认）

### 4.C 集成测试门禁
- [ ] Happy Path 100% 通过
- [ ] Exception Path ≥ 80% 通过
- [ ] 全量回归测试通过（含 regression/ 目录）
- [ ] 视觉回归测试通过（V1 computed style + V2 像素对比 + V3 布局完整性）
- [ ] 无 flaky tests

### 4.D Bug门禁
- [ ] 0个 P0 Bug
- [ ] 0个 P1 Bug
- [ ] 所有已修复Bug有回归测试
- [ ] 视觉相关Bug修复后有 before/after 截图对比

### 4.E 交付门禁
- [ ] `delivery/` 归档包完整
- [ ] `retro-<project>.md`（L1自动回溯）已生成
- [ ] `pipeline-metrics.json` 已生成
- [ ] 视觉回归基线已提交到版本控制

---

# Stage4 关键流程执行

## 后端合并四步流程（Coordinator 编排）

Coordinator按以下步骤依次执行，每步通过才进入下一步：

```
Step 1: 合并前检查
  ├── 确认所有模块状态 DONE
  ├── 验证依赖链闭环
  ├── Schema冲突检测（同名字段不同类型）
  └── 路由冲突检测（重复 Method+Path）
  → 检查结果写入 merge-precheck.md

Step 2: 路由聚合
  ├── 收集所有模块 routes.ts 的路由定义
  ├── 按路径前缀分组
  ├── 挂载到统一 Hono app
  └── 验证中间件链顺序: auth → body-parser → router → error-handler

Step 3: Schema引用解析
  ├── 检查每个模块 schema.ts 的 import 路径正确性
  └── 运行 Drizzle Schema 编译验证

Step 4: 合并后验证
  ├── 启动应用（至少 import 级验证）
  ├── 运行全量单元测试（必须全部通过）
  └── 运行全量集成测试
```

## Drizzle Migration 执行时机

- Stage3 各模块开发时: 使用 `db:push`（开发模式，直接同步Schema到本地SQLite）
- Stage4 合并后: 执行 `drizzle-kit generate` + `drizzle-kit migrate`，生成正式Migration文件纳入版本控制

---

## 联调失败处置（v2.26：无 Mock 可回退）

v2.26 起前端在 Stage3 的模块切片里就已经打真实后端，**不存在「按模块把 baseURL 从 mock 切成 real」这一步**。
原来的逐模块切换流程与 `api.config.ts` 的 `status: 'mock'/'real'` 双态设计一并作废。

**按模块推进联调**：
```
1. 检查模块状态 → DONE（含防线4 双分支走查通过）
2. 跑该模块跨模块链路的真实请求（真实后端 + 真实库），验证全链路
3. 逐条复现异常分支清单 → 复现不了的记 A10
4. 通过 → 继续下一个模块
5. 失败 → 标记该模块 BLOCKED → 按类型处置（见下）→ 重跑
```

**处置分型**：
- 接口不匹配 → 先改 `packages/shared` schema + 后端实现，再回改派生视图 `api-contract.yaml`，最后改前端调用点；
- 异常分支无法复现 → `BLOCKED(造数缺失)`，路由回原开发 Agent 补 `demo-seed` 或 dev-only 造数端点（R035）；
- 归属不明 → 先做首次根因定位，定位后仍路由回原开发 Agent。

> **为什么不能留 mock 兜底**：`api.config.ts` 里 `status: 'mock'` 的模块等于「尚未被任何真实请求验证过」，
> 而 mock 的路径与响应形状是按前端期望写的——血案 B028 里改密功能 mock 单测 270 全绿、真实 curl 404 就是这个机制。
> 回退到 Mock 只会把缺陷推迟到交付时刻。

---

## Stage4 回滚协议

**触发条件**（任一满足且人类确认后执行）：

| 触发条件 | 回滚路径 |
|---------|---------|
| 集成测试发现 P0 缺陷 > 3 个 | 回滚到 Stage3 最后一个全量测试通过的检查点 |
| Bug修复引入了新的 P0 缺陷 | 保留所有模块代码，状态回退到检查点 |

**回滚操作流程**：
1. 读取 `pipeline-state.json` 上一个绿色检查点
2. 对比差异 → 移除检查点后变更（保留Bug修复）
3. 重置模块状态 → 重新执行 Stage4 门禁

**风险控制**：
- 回滚是手动触发（需人类确认）
- 回滚前 Git 备份当前代码
- 回滚后仍无法通过 → 标记"本轮不可交付"，进入 Stage5 复盘

---

# 联调问题记录模板

每个不匹配问题写入 `integration-issues.md`：

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

---

# 集成测试通过率阈值

| 测试类型 | 通过率要求 | 低于阈值动作 |
|---------|-----------|------------|
| Happy Path | 100% | 停止交付 → Debug Agent修复 → 重新执行全量集成测试 |
| Exception Path | ≥ 80% | 低于80%同上；80-100%记录WARNING |
| 回归测试 | 100% | 任何回归失败 → P0对待 |

**修复优先级**：阻塞问题 > 功能缺陷 > 边界偏差

---

# Constraints

**MUST DO:**
- Enforce sub-stage serial order (4.1 → 4.2 → 4.3 → 4.4 → 4.5)
- Classify every integration issue before dispatching
- Track every bug with root cause classification
- Verify ALL final gates before declaring delivery-ready

**MUST NOT DO:**
- Skip any sub-stage gate
- Dispatch bugs without root cause triage
- Allow delivery if P0 or P1 bugs remain
- Perform rollback without human confirmation

---

# Gotchas

- **Serial is strict** — Don't start frontend integration before backend merge passes. Don't run integration tests before all modules are switched.
- **Module-by-module switch** — Switching all modules at once makes it impossible to isolate failures. Switch one, verify, then next.
- **Rollback is manual** — The Coordinator can recommend rollback, but only humans can authorize it.
- **Drizzle migration timing** — Migration runs in Stage4 after merge, not in Stage3 during development. Stage3 uses db:push for rapid iteration.
- **Regression tests are non-negotiable** — Every bug fix must include a regression test. No exceptions.
- **Issue triage matters** — Sending a contract problem to a Debug Agent wastes time. Route correctly.
- **VISUAL_PENDING blocks delivery** — Before declaring Stage4 complete, Coordinator MUST verify all VISUAL_PENDING files are resolved (deleted or replaced with DONE by human). Unresolved VISUAL_PENDING = delivery BLOCKED.
- **Visual regression is part of integration test pass** — V1+V2+V3 visual tests must pass alongside functional tests. Visual regression failure is a P1 bug.
