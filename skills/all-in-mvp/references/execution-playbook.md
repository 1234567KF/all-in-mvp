# 执行编排手册 — 端到端执行协议

> 本文件定义 manual-driving Pipeline 如何实际运行。解决"框架定义了每个 Agent 做什么，但没说怎么串起来"的问题。

---

## 一、两种运行模式

### 协作模式（默认）：子 Agent 编排

Qoder 和 Claude Code 均支持子 Agent 协作编排。主 Agent 负责调度，通过平台的子 Agent 机制派发任务：

```
主 Agent（编排者）
  ├── 派发子 Agent: Stage1-PRD（加载 agents/pm-agent.md）
  ├── 派发子 Agent: Stage2-Planning（加载 agents/architect.md, domain-expert.md 等）
  ├── 派发子 Agent: Stage3-Dev（fan-out 最多 3 并行）
  └── 派发子 Agent: Stage4-Integration（加载 agents/stage4-coordinator.md）
```

**特点**：
- 主 Agent 负责编排 + 审查结果，子 Agent 负责执行
- 子 Agent 通过 API/MCP（Qoder）或 Workflow（Claude Code）调度
- 上下文天然隔离（每个子 Agent 独立执行）
- 支持 fan-out 并行（最多 3 个后端/前端模块同时进行）

### 降级模式（兜底）：单 Agent 角色扮演

当子 Agent 机制不可用时，主 Agent 逐个读取 `agents/*.md` 切换角色：

```
主 Agent = 编排者 + 所有角色的扮演者
  按 Stage 顺序串行执行，每个 Stage 切换“角色帽子”
  用户在同一对话中完成全部交互
```

**特点**：
- 一个 Agent 扮演所有角色（PM → 架构师 → 业务专家 → ...）
- 通过读取 `agents/*.md` 切换角色 prompt
- 无法真并行，Stage3 的模块逐个串行执行
- 上下文会膨胀，靠「上下文隔离策略」和决策日志控制

---

## 二、执行入口协议（技能加载后第一步做什么）

### Step 0: 环境检测与模式选择

```
技能加载完成
  ↓
1. 检测子 Agent 编排能力
   ├── 支持子 Agent 机制（Qoder API/MCP / Claude Code Workflow）→ 协作模式
   └── 不支持子 Agent 编排 → 降级模式（单 Agent 角色扮演，串行执行）
  ↓
2. 初始化项目目录
   ├── 创建 decisions/ 目录（如不存在）
   ├── 创建 pipeline-state.json（如不存在）
   └── 输出「Pipeline 启动卡片」
  ↓
3. 向用户输出启动确认
```

### 启动卡片模板

```markdown
📋 手动驾驶 Pipeline 启动确认

🔭 运行模式
├── 平台：协作模式（Qoder API/MCP 或 Claude Code Workflow）/ 降级模式（单 Agent 串行）
├── 技术栈：<默认推荐 / 用户指定>
└── 预计流程：Stage1 → Stage2 → Stage3 → Stage4 → Stage5

⚠️ 前置检查
├── decisions/ 目录：✅已创建 / ❌需创建
├── pipeline-state.json：✅已初始化 / ❌需初始化
└── 上游产物：<无（新项目）/ 已有 PRD.md（增量模式）>

🧭 下一步
├── 请描述你的需求（新项目）
└── 请说明变更范围（增量模式）
```

---

## 三、Agent 调用方式

### 协作模式：子 Agent 派发

主 Agent 通过平台的子 Agent 机制派发任务，每个子 Agent 加载对应的 `agents/*.md` 作为 prompt：

```
Stage1 开始：
  主 Agent 派发子 Agent，加载 agents/pm-agent.md
  → 子 Agent 以 PM 身份与用户交互
  → 产出 PRD.md + decisions/stage1-prd-decisions.md
  → 用户确认 PRD 锁定
  → 子 Agent 完成，结果返回主 Agent

Stage2-① 开始：
  主 Agent 派发子 Agent，加载 agents/architect.md
  → 子 Agent 以架构师身份与用户交互
  → 产出 spec.md + schema.sql + api-contract.yaml
  → 用户确认锁定
```

**角色调度规则**：
- 主 Agent 可并行派发多个子 Agent（最多 3 个）
- 每个子 Agent 只读自己的 Input 列表中的文件
- 每个子 Agent 只产出自己的 Output 列表中的文件
- 子 Agent 之间通过文件传递信息，不通过“记忆”
- 主 Agent 审查子 Agent 产出，决定是否需要 RRR 修正

### 降级模式：角色扮演法

主 Agent 逐个读取 `agents/*.md` 切换角色，串行执行：

```
Stage1 开始：
  主 Agent 读取 agents/pm-agent.md
  → 以 PM Agent 身份与用户交互
  → 产出 PRD.md + decisions/stage1-prd-decisions.md
  → 用户确认 PRD 锁定

Stage2-① 开始：
  主 Agent 读取 agents/architect.md
  → 以架构师身份与用户交互
  → 产出 spec.md + schema.sql + api-contract.yaml
  → 用户确认锁定

...（以此类推）
```

**角色切换规则**：
- 切换角色前，向用户说明：“接下来我将切换为 <角色名>，负责 <职责>”
- 每个角色只读自己的 Input 列表中的文件
- 每个角色只产出自己的 Output 列表中的文件
- 角色之间通过文件传递信息，不通过“记忆”

---

## 四、文件锁定机制

### 锁定操作定义

当一个产出物经用户确认后，执行以下操作：

```
1. 在产出物文件头部添加锁定标记：

   ---
   status: LOCKED
   locked_at: <ISO 8601>
   locked_by: user-confirmation
   decision_ref: decisions/<对应决策日志>
   ---

2. 可选：复制一份 <filename>.locked.md 作为物理锁定版
   （适用于需要保留修改历史的场景）
```

### 锁定状态判断

| 文件头部 status | 含义 | 下游 Agent 可读取？ |
|---------------|------|-----------------|
| `LOCKED` | 用户已确认 | ✅ 可读取 |
| `DRAFT` | 草案，未确认 | ❌ 禁止读取 |
| 无 status 字段 | 旧格式，视为 DRAFT | ❌ 禁止读取 |

### 解锁操作

已锁定的文件如需修改：

```
1. 将 status 改为 DRAFT
2. 记录解锁原因到决策日志
3. 修改完成后重新走 MQAP 确认流程
4. 用户确认后重新标记 LOCKED
```

---

## 五、Stage 门禁检查清单

每个 Stage 结束前，必须执行以下检查。**任何一项不通过 → 禁止进入下一 Stage。**

### Stage1 门禁（需求共建）

- [ ] `PRD.md` 存在且 status = LOCKED
- [ ] `decisions/stage1-prd-decisions.md` 存在且包含完整记录
- [ ] PRD 包含 10 个必需章节
- [ ] 每项功能需求有对应的验收标准
- [ ] 「不做」清单已定义
- [ ] 术语在全文档中一致
- [ ] 用户确认：✅ PRD 准确反映了我的需求（CP-1）

### Stage2 门禁（计划校验）

**① 架构完成后（CP-2）**：
- [ ] `spec.md` + `schema.sql` + `api-contract.yaml` 存在且 status = LOCKED
- [ ] `decisions/stage2-arch-decisions.md` 存在
- [ ] 每个 PRD 功能需求 → 对应的 API 端点 + 数据库表
- [ ] 用户确认：✅ spec/schema/api-contract 符合预期

**② 业务完成后（CP-3）**：
- [ ] `task.md` + `modules/<module>.md` 存在且 status = LOCKED
- [ ] `decisions/stage2-biz-decisions.md` 存在
- [ ] 模块边界无交叉，依赖关系无环
- [ ] 用户确认：✅ 模块拆分合理

**↺ 拷问审查完成后（CP-4）**：
- [ ] 审查报告中的所有问题已修正
- [ ] 产出物已升级为 LOCKED
- [ ] 用户确认：✅ 审查问题已全部修正

**③ Mock/测试完成后（CP-5）**：
- [ ] Mock 服务 + 集成测试文件存在
- [ ] 测试三位一体检查（fixtures + README 齐全）
- [ ] `decisions/stage2-mock-decisions.md` 存在
- [ ] 用户确认：✅ Mock 和测试覆盖完整

### Stage3 门禁（逐模块确认）

**每个后端模块（CP-6）**：
- [ ] `src/modules/<module>/` 存在且完整
- [ ] TDD 测试全部通过
- [ ] Code Review 无 P0 问题
- [ ] `DONE` 标记文件存在
- [ ] `decisions/stage3-backend-<module>-decisions.md` 存在
- [ ] 用户确认：✅ 该模块实现符合预期

**每个前端页面（CP-7）**：
- [ ] `src/views/<page>.vue` + 组件存在
- [ ] `DONE` 标记存在（非 VISUAL_PENDING）
- [ ] MSVP-1 通过（无 A1/A2/A7）
- [ ] `decisions/stage3-frontend-<page>-decisions.md` 存在
- [ ] 用户确认：✅ 页面交互符合预期

**Stage3 整体**：
- [ ] `pipeline-state.json` 所有模块状态 = DONE
- [ ] 无 BLOCKED 或 VISUAL_PENDING 模块

### Stage4 门禁（逐项验收）

- [ ] 后端合并完成，路由无冲突
- [ ] MSVP-2 通过（A1-A8 全零）
- [ ] 前后端联调完成
- [ ] MSVP-3 通过（核心旅程走通）
- [ ] 集成测试通过率 100%
- [ ] 无 P0/P1 Bug 遗留
- [ ] MSVP-4 通过（全功能冒烟）
- [ ] 跨平台复现性检查通过
- [ ] 用户确认：✅ 整体交付满足验收标准（CP-8）
- [ ] `decisions/stage4-integration-decisions.md` 存在

---

## 六、pipeline-state.json Schema

```json
{
  "version": "1.0.0",
  "project_name": "<项目名>",
  "mode": "full | incremental | lightweight",
  "platform": "qoder | claude-code | degraded",
  "created_at": "<ISO 8601>",
  "updated_at": "<ISO 8601>",
  "current_stage": 1,
  "stages": {
    "stage1": {
      "status": "pending | in_progress | done | blocked",
      "started_at": null,
      "completed_at": null,
      "artifacts": {
        "prd": { "file": "PRD.md", "status": "draft | locked" },
        "decisions": { "file": "decisions/stage1-prd-decisions.md", "status": "draft | final" }
      },
      "gate_passed": false
    },
    "stage2": {
      "status": "pending",
      "sub_stages": {
        "architect": { "status": "pending", "artifacts": ["spec.md", "schema.sql", "api-contract.yaml"] },
        "domain": { "status": "pending", "artifacts": ["task.md", "modules/*.md"] },
        "grill": { "status": "pending", "rounds": 0, "max_rounds": 3 },
        "mock_test": { "status": "pending", "artifacts": ["mocks/", "tests/"] }
      },
      "gate_passed": false
    },
    "stage3": {
      "status": "pending",
      "current_round": 0,
      "modules": {
        "<module_name>": {
          "status": "unallocated | allocated | in_progress | done | blocked | defer",
          "assigned_agent": null,
          "domain": "auth | core | util",
          "dependencies": [],
          "artifacts": [],
          "started_at": null,
          "completed_at": null,
          "gate_passed": false
        }
      },
      "gate_passed": false
    },
    "stage4": {
      "status": "pending",
      "sub_stages": {
        "backend_merge": { "status": "pending" },
        "msvp_2": { "status": "pending", "a_bugs": 0 },
        "frontend_integration": { "status": "pending" },
        "msvp_3": { "status": "pending", "a_bugs": 0 },
        "integration_tests": { "status": "pending", "pass_rate": null },
        "msvp_4": { "status": "pending", "a_bugs": 0 },
        "reproducibility_check": { "status": "pending" }
      },
      "gate_passed": false
    },
    "stage5": {
      "status": "pending",
      "artifacts": {
        "retrospective": { "file": "retrospective.md", "status": "draft | final" }
      },
      "gate_passed": false
    }
  },
  "msvp": {
    "msvp_1": { "status": "pending", "a_bugs": 0, "last_run": null },
    "msvp_2": { "status": "pending", "a_bugs": 0, "last_run": null },
    "msvp_3": { "status": "pending", "a_bugs": 0, "last_run": null },
    "msvp_4": { "status": "pending", "a_bugs": 0, "last_run": null }
  },
  "decisions_count": 0,
  "rrr_total_rounds": 0,
  "blocked_items": []
}
```

---

## 七、降级模式策略

当子 Agent 机制不可用时（降级模式），白皮书中的并行度假设需要降级：

| 白皮书假设 | 降级方案 |
|----------|---------------|
| Stage3 后端最多 3 并行 | **串行执行**：按依赖图拓扑排序，逐个模块执行 |
| Stage3 前端最多 3 并行 | **串行执行**：按页面优先级排序，逐个页面执行 |
| Stage2 ③a/③b 并行 | **串行执行**：先 Mock → 再测试 |
| Coordinator 分配模块给多 Agent | **主 Agent 自行按序执行**，跳过分配汇报 |

### 串行执行的优先级排序

```
1. 无依赖的模块优先
2. 被依赖最多的模块优先（减少后续阻塞）
3. 同优先级按字母序排序（保证确定性）
```

### 降级模式下的批量确认优化

串行模式更需要批量确认——否则用户会被频繁打断：

```
每完成 2-3 个模块 → Coordinator 汇总为「本轮交付确认汇总」
  → 用户一次性审阅
  → 逐个通过/修正
```

> **协作模式下**：上述降级策略不适用。子 Agent 并行执行，并行度与白皮书假设一致。

---

## 八、完整执行流程图

```
┌─ Pipeline 启动 ─────────────────────────────────────────────────────┐
│                                                                      │
│  Step 0: 环境检测 + 模式选择 + 目录初始化 + 启动卡片                    │
│     ↓ 用户确认                                                        │
│                                                                      │
│  ┌─ Stage1: 需求共建 ──────────────────────────────────────────┐     │
│  │  加载 agents/pm-agent.md → MQAP → CEP → PRD → RRR → 锁定    │     │
│  │  门禁检查 → CP-1 用户确认                                     │     │
│  └──────────────────────────────────────────────────────────────┘     │
│     ↓ 门禁通过                                                        │
│                                                                      │
│  ┌─ Stage2: 计划校验 ──────────────────────────────────────────┐     │
│  │  ① 加载 agents/architect.md → MQAP → spec/schema/api → 锁定  │     │
│  │  ② 加载 agents/domain-expert.md → MQAP → task/modules → 锁定  │     │
│  │  ↺ 加载 agents/grill-review.md → 审查 → 用户裁决 → 修正 → 锁定 │     │
│  │  ③ 加载 agents/mock-test.md → MQAP → Mock + 测试 → 锁定       │     │
│  │  门禁检查 → CP-2/3/4/5 用户确认                               │     │
│  └──────────────────────────────────────────────────────────────┘     │
│     ↓ 门禁通过                                                        │
│                                                                      │
│  ┌─ Stage3: 逐模块确认 ────────────────────────────────────────┐     │
│  │  加载 agents/pipeline-coordinator.md                          │     │
│  │  循环：                                                       │     │
│  │    调度汇报 → 用户确认 → 分配模块                              │     │
│  │    后端: 加载 agents/backend-dev.md → CEP → TDD → 加载 agents/code-reviewer.md → CR → 确认   │     │
│  │    前端: 加载 agents/frontend-dev.md → CEP → 开发 → 确认      │     │
│  │    MSVP-1 验证（前端页面全部完成后）                            │     │
│  │    → 加载 agents/msvp-verifier.md 执行 Lite 级别验证             │     │
│  │  门禁检查 → CP-6/7 用户确认                                    │     │
│  └──────────────────────────────────────────────────────────────┘     │
│     ↓ 门禁通过                                                        │
│                                                                      │
│  ┌─ Stage4: 逐项验收 ──────────────────────────────────────────┐     │
│  │  加载 agents/stage4-coordinator.md                            │     │
│  │  后端合并 → 加载 agents/msvp-verifier.md → MSVP-2                   │     │
│  │  联调 → MSVP-3 → 集成测试 → Bug修复                          │     │
│  │  交付验收清单 → 用户确认 → MSVP-4 → 复现性检查                 │     │
│  │  （MSVP-2/3/4 均由加载 agents/msvp-verifier.md 独立执行）          │     │
│  │  门禁检查 → CP-8 用户确认                                     │     │
│  └──────────────────────────────────────────────────────────────┘     │
│     ↓ 门禁通过                                                        │
│                                                                      │
│  ┌─ Stage5: 共同复盘 ──────────────────────────────────────────┐     │
│  │  加载 agents/retrospective-agent.md                           │     │
│  │  复盘草案 → 用户补充 → 合并 → 经验入库                        │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  Pipeline 完成 → 输出最终交付摘要卡片                                  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 九、断点续跑

Pipeline 可能因用户离线、上下文耗尽、或主动暂停而中断。续跑协议：

### 检测中断点

```
1. 读取 pipeline-state.json
2. 找到 current_stage 和该 stage 内的进度
3. 检查最近的 LOCKED 产物和 DONE 标记
4. 从最近的门禁通过点继续
```

### 续跑确认

```markdown
📋 Pipeline 续跑确认

检测到上次执行中断于：
- Stage: <N>
- 最近完成的环节: <环节名>
- 最近的 LOCKED 产物: <文件名>

建议从 <环节名> 继续。是否继续？
```

---

## 十、Agent prompt 加载路径规范

### 路径解析规则

| 引用位置 | 解析方式 | 示例 |
|---------|---------|------|
| `agents/*.md` | 相对于技能目录 | `.claude/skills/manual-driving/agents/pm-agent.md` |
| `references/*.md` | 相对于技能目录 | `.claude/skills/manual-driving/references/execution-playbook.md` |
| `decisions/*.md` | 相对于项目根目录 | `<project>/decisions/stage1-prd-decisions.md` |
| `PRD.md` / `spec.md` | 相对于项目根目录 | `<project>/PRD.md` |

### Agent prompt 中的引用约定

每个 agent prompt 引用 references 时，使用相对路径：

```markdown
详见 `references/decision-log-template.md`（从技能目录解析）
```

主 Agent 加载 agent prompt 时，自动将 references 路径解析为技能目录下的绝对路径。
