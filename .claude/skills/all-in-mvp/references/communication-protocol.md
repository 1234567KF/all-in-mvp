# Agent Communication Protocol — 完整沟通协议参考

> 本文档定义 all-in-mvp Pipeline 中 Agent 与用户、Agent 与 Agent 之间的沟通协议。
> 借鉴 manual-driving 项目的 IoC/MQAP/CEP/RRR/决策日志 体系。

---

## 一、反转控制（IoC）核心原则

> **Agent 不替用户做决策。Agent 负责分析、整理、建议——用户负责决策。**

```
自动驾驶（旧）：Agent 收到需求 → Agent 自行判断 → Agent 产出
手动驾驶（新）：Agent 收到需求 → Agent 分析 → Agent 列出所有不清楚的点 → 用户逐一回答 → Agent 产出
```

| 维度 | 传统模式 | 强化模式 |
|------|---------|---------|
| 问题数量 | 限制 1-3 个关键问题 | **不限数量**，有多少不清楚的就问多少 |
| 决策权 | Agent 自行选择方案 | Agent 列出方案+利弊，**用户选择** |
| 假设处理 | Agent 自行假设并记录 | **禁止自行假设**，必须向用户确认 |
| 认知同步 | 无显式同步节点 | **每个环节结束前强制同步** |
| 产出物 | Agent 直接产出最终版 | Agent 产出草案 → 用户确认 → 锁定 |

---

## 二、强制问答协议（MQAP）

每一个 Pipeline 环节必须执行此协议：

```
Step 1: Agent 阅读输入（PRD/spec/需求变更）
Step 2: Agent 列出「理解确认清单」
        ├── 我理解的需求是：<用自己的话复述>
        ├── 我认为的边界是：<范围、不做清单>
        └── 我发现以下不清楚的点：<逐项列出>
Step 3: 用户审阅 → ✅同意继续 / ⚠️驳回调整
Step 4: Agent 输出「卡片式执行计划」(CEP)
        ├── 🔭 全面性：覆盖了什么、没覆盖什么
        ├── ⚠️ 难点：关键难点+风险评估+替代预案
        └── 🧭 主线计划：执行步骤+依赖关系+里程碑
Step 5: 用户审阅卡片 → ✅同意继续 / ⚠️驳回调整
Step 6: Agent 记录 Q&A + 卡片到环节决策日志
Step 7: Agent 基于确认后的理解和计划执行
Step 8: Agent 输出草案
Step 9: Agent 列出「产出物确认清单」
        ├── 我产出了什么
        ├── 关键决策+理由
        ├── 对照卡片：实际产出 vs 计划的差异
        └── 需要重点审阅的风险点
Step 10: 用户审阅产出物 → ✅锁定 / ⚠️驳回重做(RRR)
```

> **关键约束**：Step 2 中「不清楚的点」不允许留空。沉默的假设是最危险的。

---

## 三、提问格式规范

Agent 向用户提问时，遵循以下格式：

```markdown
## 需要你确认/澄清的事项

### 关于 <主题>
**我的理解**：<Agent 对这部分的理解>
**我不确定的点**：
1. <具体问题> — 为什么问这个：<上下文说明>
**我的建议**（如有）：<推荐方案 + 理由>
```

### 提问原则

- 不限制数量 / 不问"要不要" / 提供上下文 / 暴露假设
- 每个问题附带影响范围（哪些模块/接口/表会受影响）
- 优先级标识：🔴高/🟡中/🟢低

---

## 四、回答的记录规范

用户的每一个回答都必须**完整记录**到决策日志：

| 不可接受 | 必须做到 |
|---------|--------|
| "用户说要支持登录" | 记录完整信息：角色、权限、登录方式、不需要的功能等 |
| "用户选择了方案A" | 记录：方案A（JWT Token）+ 拒绝方案B（Session）+ 理由 |
| 口头确认不记录 | 即使用户口头说"可以"，也必须记录：`用户确认：✅通过` |

---

## 五、卡片式执行计划（CEP）

每个环节在理解确认后、动手执行前，Agent 必须输出一张执行计划卡片：

```
┌─────────────────────────────────────────────┐
│  📋 <环节名称> 执行计划卡片                    │
│                                              │
│  🔭 全面性 — 覆盖了什么？                      │
│  ├── 覆盖范围：<本环节要产出的所有内容>          │
│  ├── 不覆盖：<明确不做的内容+理由>              │
│  └── 与上/下游的关系：<输入来自哪，输出给谁>      │
│                                              │
│  ⚠️ 难点 — 哪里最可能出问题？                   │
│  ├── 技术难点：<1-3个关键技术挑战>              │
│  ├── 业务难点：<1-3个业务逻辑复杂点>            │
│  ├── 风险等级：🟢低 / 🟡中 / 🔴高              │
│  └── 每难点的替代预案：<如果卡住了怎么做>        │
│                                              │
│  🧭 主线计划 — 按什么顺序推进？                 │
│  ├── 执行步骤：<第一步→第二步→...→完成>         │
│  ├── 依赖项：<需要等待谁/什么先完成>            │
│  ├── 里程碑：<什么时候产出什么中间产物>          │
│  └── 预计耗时：<整个环节需要多久>               │
│                                              │
│  ❓ 待确认事项：<仍需用户回答的问题>             │
└─────────────────────────────────────────────┘
```

**三条铁律**：
1. **不超过一张屏**：用户在 30 秒内能读完
2. **先说"不做什么"**：边界不清是认知漂移的第一来源
3. **每个难点必须有预案**：不允许只说"这里难"

---

## 六、驳回-修正-重审循环（RRR）

```
1. 用户驳回，给出驳回意见（必须指明：驳回什么、为什么、期望方向）
2. Agent 读取驳回意见，逐条理解
3. Agent 输出「驳回响应」：修正后的理解 + 调整后的方案 + 连带影响
4. Agent 修正产出物/计划
5. Agent 重新摆出（回到 MQAP 对应 Step）
6. 用户重新审阅 → ✅通过 / ⚠️再次驳回
```

| 驳回次数 | 状态 | 处理方式 |
|---------|------|---------|
| 第 1 次 | 正常 | Agent 按驳回意见调整后重交 |
| 第 2 次 | 关注 | 附"与前次驳回的差异对照" |
| 第 3 次 | 警告 | 输出「未对齐清单」，分析根因 |
| 第 3 次后仍未通过 | 升级 | 标记 `BLOCKED(human-review)`，上浮人类全量审查 |

**驳回类型**：理解驳回 / 覆盖驳回 / 方案驳回 / 产出驳回 / 部分驳回

---

## 七、认知同步检查点（不可跳过）

| 检查点 | 位置 | 同步内容 | 通过条件 |
|--------|------|---------|---------|
| CP-1 | Stage1 完成后 | PRD 理解一致性 | 用户同意 PRD 准确反映需求 |
| CP-2 | Stage2 ①完成后 | 架构理解一致性 | 用户同意 spec/schema/api-contract |
| CP-3 | Stage2 ②完成后 | 模块划分一致性 | 用户同意模块拆分合理 |
| CP-4 | ↺循环通过后 | 交叉校验结果 | 审查问题已全部修正 |
| CP-5 | Stage2 ③完成后 | Mock/测试覆盖 | Mock数据和测试场景完整 |
| CP-6 | 每个后端模块 DONE | 模块实现一致性 | 用户同意模块实现符合预期 |
| CP-7 | 每个前端页面完成 | 页面实现一致性 | 用户同意页面交互符合预期 |
| CP-8 | Stage4 集成完成 | 整体交付一致性 | 用户同意交付满足验收标准 |

---

## 八、决策日志系统

### 目录结构

```
decisions/
  ├── stage1-prd-decisions.md
  ├── stage2-arch-decisions.md
  ├── stage2-biz-decisions.md
  ├── stage2-grill-decisions.md
  ├── stage2-mock-decisions.md
  ├── stage2-test-decisions.md
  ├── stage3-backend-<module>-decisions.md
  ├── stage3-frontend-<page>-decisions.md
  ├── stage4-integration-decisions.md
  └── stage5-retro-decisions.md
```

### 日志包含内容

- 理解确认阶段（Agent 复述 + 用户确认）
- 执行计划卡片（全面性 + 难点 + 主线）
- 决策记录（候选方案 + 选择 + 理由 + 用户确认）
- 产出物确认（产出物 + 风险 + 差异 + 用户确认）
- 驳回与修正记录（RRR 轮次 + 驳回意见 + 响应 + 连带影响）
- 环节门禁 checklist

### 决策复议（下游 Agent 质疑上游决策）

下游 Agent 如果对上游决策有疑问，**不直接修改**，而是：

```
1. 在决策日志中新增一条「决策复议」记录
2. 说明为什么现有决策可能有问题
3. 列出替代方案
4. 等待用户裁决
```

> 决策可追溯性链：问题 → 用户回答 → Agent 决策 → 决策记录 → 下游引用决策编号

> 详细模板见 `references/decision-log-template.md`

---

## 九、上下文隔离策略

| 规则 | 说明 |
|------|------|
| Agent 间不直接通信 | 通过文件读取，不直接对话 |
| 禁止共享未锁定产出物 | 非 `.locked.md` 不得被其他 Agent 读取 |
| 禁止共享对话历史 | Agent B 只读取决策日志中的**结论** |
| 禁止共享内部推理 | 只写结论+理由，不暴露中间推理 |
| 决策日志是唯一跨环节载体 | 下游通过 `decisions/*.md` 了解人类决策 |

### 上下文传递规范

```
Agent A 产出 → Agent B 接收：
  ├── 锁定版产出物（spec.md / module.md 等）
  ├── 决策日志（只读结论，不读中间推理）
  └── 上下文摘要（≤500 字）
```

---

## 十、文件锁定机制

产出物经用户确认后，在文件头部添加锁定标记：

```yaml
---
status: LOCKED
locked_at: <ISO 8601>
decision_ref: decisions/<对应决策日志>
---
```

- `LOCKED` → 下游 Agent 可读取
- `DRAFT` / 无标记 → 禁止被下游 Agent 读取
- 解锁需记录原因到决策日志，重新走 MQAP 确认

---

## 十一、Agent 间通信协议

### 文件状态约定

| State | Marker | Meaning |
|-------|--------|---------|
| Ready | Module dir doesn't exist | Available for next allocation round |
| Assigned | Module dir exists, no DONE marker | Agent is working, don't reassign |
| Completed | DONE marker file in module dir | Dependency requirements satisfied |
| Blocked | BLOCKED marker with reason file | Agent encountered blocker, needs intervention |

### WIP 标记机制

Agent 操作文件前：
1. 检查目标目录是否存在 `WIP-<agent-id>` 标记
2. 超过 30 分钟 → 判断是否崩溃 → 清理
3. 创建 `WIP-<agent-id>`：`{ agent_id, module, started_at, platform }`
4. 完成后删除 WIP → 创建 DONE 或 BLOCKED

### 输出结构

```
project/
├── PRD.md                           # Stage 1
├── spec.md                          # Stage 2.1 (Architecture)
├── schema.sql                       # Stage 2.1 (Database Schema)
├── api-contract.yaml                # Stage 2.1 (API Contract)
├── task.md                          # Stage 2.2 (Task breakdown)
├── modules/
│   ├── user.md                      # Stage 2.2 (Module definitions)
│   ├── product.md
│   └── ...
├── mocks/
│   └── <module>/                    # Stage 2.4 (Mock services)
├── integration-tests/
│   ├── modules/<module>.test.ts     # Stage 2.5 (Module tests)
│   └── scenarios/<scenario>.test.ts # Stage 2.6 (E2E scenarios)
├── src/
│   ├── modules/<module>/            # Stage 3 (Backend implementation)
│   ├── views/                       # Stage 3 (Frontend pages)
│   └── components/                  # Stage 3 (Shared components)
├── decisions/                       # 决策日志目录
├── tests/                           # 测试产物
├── scripts/                         # 可复跑脚本
├── delivery/                        # Stage4 交付归档
└── <DONE|BLOCKED>                   # Status markers
```

### Coordinator 扫描规则

- Coordinator 扫描目录 after each agent completion event
- 扫描: new DONE markers, BLOCKED markers, unallocated module dirs
- 输出 allocation log after each round

---

## 十二、沟通质量指标

| 指标 | 计算方式 | 目标值 |
|------|---------|--------|
| 认知同步覆盖率 | 通过用户确认的检查点数 / 强制检查点总数 | = 100% |
| 提问充分度 | Agent 实际提问数 / 后续环节发现的理解偏差数 | ≥ 3 |
| 决策记录完整率 | 有决策日志的环节数 / 总环节数 | = 100% |
| 用户决策参与率 | 用户直接参与的决策数 / 总决策数 | ≥ 80% |
| 首次同意率 | 一次确认即 ✅ 的检查点数 / 总检查点数 | ≥ 50% |
| 平均驳回轮次 | 各检查点 RRR 轮次之和 / 被驳回的检查点数 | ≤ 1.5 |
| 驳回升级率 | 达到3轮驳回升级的检查点数 / 总检查点数 | ≤ 10% |
| MSVP 首次通过率 | 首次 MSVP 即 A1-A8 全零的检查点数 / MSVP 检查点总数 | ≥ 70% |

---

## 参考文件

- `references/decision-log-template.md` — 决策日志模板
- `references/msvp-protocol.md` — MSVP 强制冒烟验证协议
- `references/execution-playbook.md` — 执行编排手册
- `agents/msvp-verifier.md` — MSVP 独立验证 Agent
