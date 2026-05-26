---
name: kf-mvp-retrospective
description: >-
  Load when a project iteration is complete and the team needs to review the
  multi-agent pipeline execution itself. Triggers: 复盘, retrospective, 流程复盘,
  经验沉淀, 迭代回顾, pipeline review, Stage5. Also load when quality metrics
  indicate systemic issues or when the white paper needs revision proposals.
metadata:
  pattern: reviewer + pipeline
  domain: mvp-stage5
recommended_model: pro
graph:
  dependencies:
    - target: kf-mvp-stage4-coordinator
      type: sequential
    - target: all-in-mvp
      type: semantic
---

**Default Tech Stack Context**: 
- Backend: Node.js + Hono + Drizzle ORM + SQLite
- Frontend: Vue 3 + Vite + Pinia + Vue Router + Axios
- Testing: Vitest + Playwright
- Third-party: ALL Mock

Load `references/mvp-tech-stack-default.md` for full specification.


# Stage5 Retrospective Agent — 流程复盘与经验沉淀技能

> **Core Belief**: The pipeline itself is a product. Every iteration should make it better. Review not WHAT was built, but HOW it was built.

**Division of Labor**: This Skill focuses on **pipeline process review**, NOT product review. It analyzes multi-agent execution effectiveness, extracts reusable patterns and anti-patterns, and proposes white paper revisions. Complements §12.3 L1 auto-retrospective: L1 generates quantitative data, Stage5 performs deep qualitative analysis.

---

# Core Philosophy

Derived from MVP Whitepaper Section 13 — Stage5 流程复盘:

1. **Process, not product** — Review the pipeline execution, not the delivered features
2. **Data-driven** — Base analysis on collected metrics, not intuition
3. **Pattern extraction** — Every iteration teaches something; capture it
4. **Continuous improvement** — Anti-patterns found → process enhanced

---

# Input Artifacts

| 文件 | 提供者 | 内容 |
|------|--------|------|
| `pipeline-execution-log.md` | Coordinator | 完整执行记录（分配、完成、阻塞、异常） |
| `pipeline-metrics.json` | Coordinator (Stage4自动采集) | 质量指标（Grill通过率、CR通过率、P0密度、Bug逃逸率等） |
| 各阶段实际耗时 vs 预期耗时 | Coordinator | 时间偏差数据 |
| 审查报告历史 | grill-with-docs | 各轮次输出 |
| Bug 清单 | Debug Agent + Coordinator | 含根因分类的Bug列表 |
| `retro-<project>.md` | Coordinator (L1自动回溯) | 定量数据报告 |

---

# Six Required Outputs

## Output 1: 流程健康度评分

**计算方式**: 各 Stage 实际耗时 / 预期耗时 的比值

```markdown
## 流程健康度评分

| Stage | 预期耗时 | 实际耗时 | 健康度 | 评级 |
|-------|---------|---------|--------|------|
| Stage1 | 1-2h | 1.5h | 0.75 | 🟢 健康 |
| Stage2 | 2-4h | 5.2h | 1.30 | 🟡 偏慢 |
| Stage3 | 4-8h | 3.8h | 0.48 | 🟢 高效 |
| Stage4 | 1-2h | 2.1h | 1.05 | 🟢 健康 |
| 总计 | 8-16h | 12.6h | - | 🟢 整体健康 |

**整体评分**: [健康/偏慢/瓶颈]
**瓶颈阶段**: [Stage2 — Grill循环耗时超预期]
```

**评级标准**：
- 🟢 健康: ≤ 1.0 (实际耗时 ≤ 预期)
- 🟡 偏慢: 1.0 - 1.5
- 🔴 瓶颈: > 1.5

---

## Output 2: Agent 效率分析

```markdown
## Agent 效率分析

| Agent 角色 | 实例数 | 产出质量 | 返工率 | 评级 |
|-----------|--------|---------|--------|------|
| 架构专家 | 1 | 一次性通过Grill | 0% | 🟢 |
| 业务专家 | 1 | 2轮Grill通过 | 50% | 🟡 |
| Backend-1 | 1 | 无CR打回 | 0% | 🟢 |
| Backend-2 | 1 | 1次CR打回 | 33% | 🟢 |
| Backend-3 | 1 | 3次CR打回 → 升级人类 | 100% | 🔴 |

**需强化Skill的Agent**: Backend-3 — 建议检查 kf-mvp-backend-tdd Skill 是否需要更新
```

---

## Output 3: 契约偏差分析

```markdown
## 契约偏差分析

**spec.md 与实际实现的差异点**：

| 差异点 | 契约定义 | 实际实现 | 偏差类型 | 影响 |
|--------|---------|---------|---------|------|
| trace_code字段 | 3字段拆分 | 单TEXT字段 | Schema偏差 | 订单模块无法做数值范围查询 |
| 幂等性处理 | 在PRD中要求 | 未实现 | 业务逻辑缺失 | 重复生成溯源码 |

**系统性偏差来源**: [需求层面 / 设计层面 / 实现层面]
**占比最高的偏差类型**: [具体类型 + 百分比]
```

---

## Output 4: 模式提取（已验证有效的实践）

```markdown
## 本次迭代验证的有效模式

| 模式 | 描述 | 效果 | 建议推广 |
|------|------|------|---------|
| [模式名] | [具体做法] | [量化效果] | 是/否 |
| 增量测试窗口 | 模块DONE后立即执行模块级集成测试 | P0发现时间从Stage4提前到Stage3 | 是 |
```

---

## Output 5: 反模式记录（暴露的流程缺陷）

```markdown
## 本次迭代暴露的流程缺陷

| 反模式 | 表现 | 后果 | 根因 | 规避建议 |
|--------|------|------|------|---------|
| [反模式名] | [具体表现] | [对交付的影响] | [根本原因] | [具体改进] |
| 跳过Mock验证 | 前端开发未执行Mock持续验证 | 联调时发现3个Mock漂移问题 | Mock持续验证未强制 | 前端Skill增加必检项 |
```

---

## Output 6: 白皮书修订建议

```markdown
## 白皮书修订建议

| 条款 | 修订类型 | 修订理由 | 建议内容 | 优先级 |
|------|---------|---------|---------|--------|
| §3.1 并行度上限 | 调整 | 实际执行中3 Agent未充分利用 | 提升到4 Agent | 中 |
| §2.3 Grill超时 | 新增 | 本次迭代Grill第2轮因上下文耗尽超时 | 增加上下文重置机制 | 高 |
```

---

# Anomaly Detection (异常模式识别清单)

执行以下4项检查，标记异常：

## 检查1: 模块耗时异常
- [ ] 是否有模块实际耗时 > 预期 2 倍？
  - 是 → 标记为「高风险模块类型」，记录模块名 + 耗时数据

## 检查2: Agent打回率异常
- [ ] 是否有 Agent 角色 Code Review 打回率 > 30%？
  - 是 → 标记为「需强化该角色 Skill」，检查对应Skill文件是否需要更新

## 检查3: 阶段瓶颈
- [ ] 是否有阶段实际耗时 > 预期 1.5 倍？
  - 是 → 标记为「瓶颈阶段」，分析瓶颈原因

## 检查4: 系统性缺陷来源
- [ ] Bug 分类中某类占比 > 40%？
  - 是 → 标记为「系统性缺陷来源」，在对应阶段增加专项检查

## 异常模式自动响应策略

| 异常模式 | 自动响应 |
|---------|---------|
| 某类模块总是超时 | 下轮迭代拆分更细，或分配更强 Agent |
| 某 Agent 角色打回率高 | 检查该角色 Skill 是否需要更新 |
| 瓶颈阶段 | 增加该阶段的并行度或简化流程 |
| 系统性缺陷来源 | 在对应阶段增加专项检查 |

---

# Review Workflow

## Phase Gate 0: 数据收集

确认所有输入文件可用：
- [ ] `pipeline-execution-log.md` 存在
- [ ] `pipeline-metrics.json` 存在
- [ ] 各阶段耗时数据可得
- [ ] Bug 清单（含根因分类）可得
- [ ] `retro-<project>.md` 存在（L1自动回溯）

---

## Phase Gate 1: 定量分析

1. 读取 `pipeline-metrics.json` → 提取质量指标
2. 对比目标值 vs 告警值
3. 识别偏离指标

---

## Phase Gate 2: 异常模式识别

1. 执行上述4项检查
2. 标记所有触发异常的情况
3. 对每个异常应用自动响应策略

---

## Phase Gate 3: 定性分析

1. 审查 grill-with-docs 各轮次输出 → 识别重复发生的问题类型
2. 审查 Bug 清单根因分布 → 识别系统性缺陷来源
3. 审查 Agent 效率数据 → 识别 Skill 质量差距

---

## Phase Gate 4: 模式提取

1. 从执行日志中提取本次迭代验证有效的实践 → 候选模式
2. 从问题清单中提取反模式 → 候选反模式
3. 对照 §14 经验知识库 → 判断是新模式还是已知模式的再现

---

## Phase Gate 5: 白皮书修订提案

1. 汇总所有发现 → 判断是否需要修订白皮书
2. 需要修订 → 生成具体条款 + 修订理由
3. 不需要修订 → 记录为观察项，等待更多迭代数据

---

## Phase Gate 6: 经验知识库更新

评估是否将新模式/反模式纳入 `MVP白皮书最终融合版.md` §14 经验知识库：
- 已验证模式 → 若第2次出现，纳入 §14.1
- 反模式 → 若第2次出现，纳入 §14.2
- 新假设 → 纳入 §14.3 待验证列表

---

# Retrospective Report Template

最终产出 `retrospective.md`：

```markdown
# 流程复盘报告 — <项目名> 迭代<N>

**复盘时间**: <timestamp>
**复盘Agent**: Stage5 Retrospective Agent
**基于白皮书版本**: v2.5.0

---

## 1. 流程健康度评分

[Output 1 内容]

---

## 2. Agent 效率分析

[Output 2 内容]

---

## 3. 契约偏差分析

[Output 3 内容]

---

## 4. 模式提取

[Output 4 内容]

---

## 5. 反模式记录

[Output 5 内容]

---

## 6. 白皮书修订建议

[Output 6 内容]

---

## 7. 经验知识库更新建议

### 建议新增已验证模式
| 模式 | 说明 | 验证次数 |
|------|------|---------|

### 建议新增反模式
| 反模式 | 后果 | 规避方法 |
|--------|------|---------|

### 建议新增待验证假设
| 假设 | 提出依据 |
|------|---------|

---

## 8. 下轮迭代改进建议

1. [改进项1]
2. [改进项2]
3. [改进项3]
```

---

# Constraints

**MUST DO:**
- Base analysis on collected data, not intuition
- Run all 4 anomaly detection checks
- Distinguish patterns (repeat > 1) from one-time events
- Propose concrete white paper revisions with rationale

**MUST NOT DO:**
- Review product features (this is pipeline review, not product review)
- Propose white paper changes without evidence
- Skip the quantitative analysis phase
- Ignore L1 auto-retrospective data (it's complementary input)

---

# Gotchas

- **Process ≠ Product** — Stage5 reviews HOW the pipeline ran, not WHAT was built. Product review is a separate activity.
- **L1 + Stage5** — L1 auto-retrospective provides quantitative data (metrics). Stage5 provides qualitative analysis (patterns, root causes). Use both.
- **Pattern threshold** — A practice must appear in ≥ 2 iterations to be considered a "verified pattern." One-time successes are observations, not patterns.
- **Skill quality matters** — If a specific Agent role consistently underperforms, the root cause may be in the Skill file, not the Agent instance.
- **White paper is living** — Revision proposals should be specific (section + clause + rationale), not vague ("improve Stage3").
- **Experience knowledge base** — §14 of the white paper is the persistent memory of the pipeline. Stage5 is the gatekeeper for what gets added.
