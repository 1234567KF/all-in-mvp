# MVP白皮书 三维度诊断 + 3轮Flash优化建议

> **定位**：本文件是对 `MVP白皮书.md` 的理论覆盖度、执行准确性、稳定性的深度审视报告，附带3轮迭代优化建议。
> **原则**：保持白皮书现有结构不变，每轮建议独立可执行，可由对应Agent按建议自行调整实现。

---

## 一、三维度诊断总览

| 维度 | 评分 | 核心问题数 | 致命级 | 高优先级 | 中优先级 |
|------|------|-----------|--------|---------|---------|
| 理论覆盖度 | 7.5/10 | 7 | 1 | 3 | 3 |
| 执行准确性 | 6.5/10 | 9 | 2 | 4 | 3 |
| 稳定性 | 5.5/10 | 11 | 3 | 5 | 3 |

### 1.1 理论覆盖度 — 已覆盖 vs 缺口

**已覆盖良好的**：
- Stage1→Stage4 全流程链路完整
- 并行/串行决策原则清晰（6.1/6.2 节）
- TDD 循环 + Code Review 触发条件明确（6.3 节）
- Agent 角色映射完整（五、角色与Agent映射表）
- 文件驱动通信协议的设计理念（九、Agent间通信协议）
- 风险清单覆盖常见场景（十、风险与应对）

**理论缺口**：
| # | 缺口 | 影响 | 严重度 |
|---|------|------|--------|
| GAP-01 | **缺少 Stage0 需求探索阶段**：白皮书从"原始需求"直接跳到 PRD 创作，缺少用户角色定义、价值流映射、竞品分析的预处理步骤。PRD 的质量取决于输入质量 | 低质量的原始需求直接产生不完整的 PRD，导致后续全链返工 | 致命 |
| GAP-02 | **缺少 Stage5 交付复盘阶段**：没有定义执行数据采集、流程效率评估、白皮书自我进化的闭环 | 白皮书无法根据执行数据自我优化，每次MVP执行的经验无法系统沉淀 | 高 |
| GAP-03 | **缺少质量门禁(Gate)的量化标准**：门禁概念散落在各处（"PRD 锁定"、"↺循环通过"、"测试通过率100%"），但没有统一的门禁检查清单和否决权归属 | 门禁的执行力度依赖Agent的自觉性，无强制性检查清单 | 高 |
| GAP-04 | **缺少非功能需求的演化路径**：白皮书说"忽略非功能需求"但没有定义"何时回补"。性能/安全/可扩展性被无限推迟 | 产品越迭代，非功能债务越重，最终架构难以演进 | 高 |
| GAP-05 | **缺少数据一致性理论**：多Agent并行修改共享Schema时，没有定义冲突检测和合并策略 | 并行开发中可能出现Schema引用歧义或字段冲突 | 中 |
| GAP-06 | **缺少部分交付理论**：系统没有定义"交付部分模块"的机制。一个模块阻塞则全Pipeline阻塞 | 高延迟模块阻塞整体交付，无法做增量发布 | 中 |
| GAP-07 | **缺少上下文管理理论**：Agent从Stage2连续工作到Stage3的上下文膨胀问题未被定义 | Token消耗膨胀，Agent回答质量下降 | 中 |

### 1.2 执行准确性 — 已覆盖 vs 模糊带

**描述清晰的**：
- ↺ 拷问审查的四维检查表 + 循环机制（2.3 节）
- ③b-1 与 ③b-2 的边界仲裁规则（含实例）
- 依赖图驱动的调度策略（3.0 策略一）
- 专家领域匹配的分配规则（3.0 策略二）
- 文件状态约定（DONE/BLOCKED 机制）

**执行模糊点**：
| # | 问题 | 精确描述 | 严重度 |
|---|------|---------|--------|
| ACC-01 | **Pipeline Coordinator 实操与描述不符** | 白皮书说"轻量Agent不做开发只调度"，但Coordinator需要spawn子Agent——在当前Agent范式下这是重操作，Agent 间无法直接 spawn。Coordinator 的角色本质上是人 + 工具的协作决策者，而非自动调度器 | 致命 |
| ACC-02 | **Stage4.1 模块合并过于简化** | "合并各模块路由到统一入口"一句话带过。实际多Agent并行开发后的合并涉及：路由前缀冲突、中间件链顺序、Schema引用解析、全局类型一致性检查 | 高 |
| ACC-03 | **Code Review 仅被动触发** | 只在TDD失败时才触发Review，缺少"模块完成后强制Final Review"门禁。质量问题可能直到Stage4合并时才暴露 | 高 |
| ACC-04 | **测试写的时机 vs 执行的时机分离** | Stage2 写大量测试用例但 Stage4 才执行。Stage3 的 TDD 循环中跑的是单元测试还是集成测试？定义不清 | 高 |
| ACC-05 | **↺循环3轮上限缺少判定锚点** | "3轮未通过→人类决策"，但没有明确定义哪些问题应内部消化、哪些必须上浮。导致同一场景不同Agent可能有不同判断 | 中 |
| ACC-06 | **Mock 服务与前端开发的对接流程模糊** | Mock 搭建后前端如何连接？Mock API 地址如何注入前端环境？Mock 数据更新后前端如何感知？ | 中 |
| ACC-07 | **Debug Fixer 的输入输出格式未定义** | Bug 报告的格式、优先级定义、回归测试的命名规范均未标准化 | 中 |
| ACC-08 | **Agent 间产物的引用路径未标准化** | 各Agent提到"读取spec.md"但未定义从哪里读、相对路径还是绝对路径、文件命名是否统一 | 低 |
| ACC-09 | **Stage3 前后端并行时版本漂移** | 后端API实现与Mock服务在Stage3期间可能产生差异，前端基于Mock开发的代码在联调时才发现不匹配 | 高 |

### 1.3 稳定性 — 已覆盖 vs 脆弱点

**已有防护的**：
- ↺ 循环的高质量契约锁定机制
- 依赖图的无环校验
- TDD 的 Red-Green-Refactor 内建质量循环
- 防错机制表（遗漏/重复/死锁/领域不匹配）

**稳定性脆弱点**：
| # | 问题 | 风险描述 | 严重度 |
|---|------|---------|--------|
| STB-01 | **Pipeline Coordinator 单点故障** | Coordinator 是唯一调度中枢。如果它中断执行，恢复时无持久化检查点，需要从 Stage3 起点重新扫描文件系统 | 致命 |
| STB-02 | **无 Agent 超时/心跳机制** | 没有定义 Agent 的最大执行时长。一个 Agent 卡住（如某 TDD 循环陷入无限失败→修复循环）时，整个 Pipeline 无法感知 | 致命 |
| STB-03 | **无部分交付能力** | Stage3 中一个高复杂模块阻塞，所有依赖它的下游模块和整个 Stage4 都被阻塞。无法做增量交付 | 高 |
| STB-04 | **文件系统竞态** | DONE/BLOCKED 标记基于文件系统。Agent 写入 DONE 时进程被中断 → 部分写入 → Coordinator 读到不完整内容 | 高 |
| STB-05 | **无 Pipeline 级回滚协议** | Stage4 集成发现 P0 缺陷时，回滚到哪个状态？回滚范围是多模块还是所有模块？未定义 | 高 |
| STB-06 | **上下文窗口无管控** | Agent 从 Stage2↺循环持续工作到 Stage3，Token 使用量持续膨胀，无精简/重置策略 | 高 |
| STB-07 | **回归测试无增长机制** | "每个Bug修复要补充回归测试"但未定义回归测试套件的管理方式（去重、增长、执行时机） | 中 |
| STB-08 | **Monitor Agent 无自动修复能力** | Monitor 能检测异常（BLOCKED/STUCK）但只能报告，不能触发自动恢复动作 | 中 |
| STB-09 | **Agent 失败后的重试策略未定义** | Agent spawn 失败后是重试还是跳过？重试次数上限是几次？ | 中 |
| STB-10 | **无冷启动/预热流程** | 第一次运行 Pipeline 时，Agent 的 System Prompt 首次加载 vs 后续运行的上下文差异未定义 | 低 |
| STB-11 | **PRD 变更后的影响范围未量化** | "PRD 变更需走评审"但未定义影响范围分析和变更影响模块的自动标记 | 高 |

---

## 二、第1轮 Flash：理论覆盖度优化建议

> **目标**：补齐流程理论缺口，将零散质量意识升级为可量化体系。
> **不需要修改白皮书结构**，以下建议可直接指导对应 Agent 的行为调整。

### 建议 1.1：PRD 创作前增加需求预处理步骤（指导 PM Agent）

PM Agent 收到原始需求后，在执行 PRD 创作之前，先完成：

```markdown
1. **用户角色定义**
   - 产出物：`user-persona.md`（轻量格式，每人一个 Section）
   - 内容：角色名、一句话描述、核心痛点、使用场景、预期交互方式
   - 格式示例：见下图
   
2. **价值流映射**
   - 产出物：`value-stream.md`
   - 内容：核心业务流程的价值链（从触发到交付的完整链路）
   - 格式：Mermaid sequenceDiagram
   
3. **需求精炼**
   - 检查原始需求是否存在冲突/矛盾
   - 识别模糊陈述并标记需澄清项
   - 产出：需求精炼报告（内嵌在 PRD 的开篇 "需求来源" 章节）
```

**影响范围**：
- `pm-agent.md`：System Prompt 中增加预处理步骤说明
- `architect.md`：输入中增加 `user-persona.md`、`value-stream.md` 为可选输入

### 建议 1.2：PRD 必须包含的表格增加 3 行（指导 PM Agent）

当前 PRD 表格末尾增加：

| 章节 | 内容 | 说明 |
|------|------|------|
| 不支持的场景清单 | 本版MVP明确不实现的功能边界 | 防止Stage2/3的范围蔓延，限定Scope |
| 非功能需求演化路线 | 性能/安全/可扩展性的预期迭代版本 | 如"性能优化→V2，安全加固→V3" |
| 验收标准交叉引用 | PRD验收标准与后续module.md验收标准的映射关系 | 确保测试覆盖无遗漏 |

**影响范围**：仅 PM Agent 的 PRD 模板

### 建议 1.3：交付后增加复盘步骤（指导 Monitor Agent）

Monitor Agent 在 Stage4 完成后切换到复盘模式，自动产出 `pipeline-retro.md`：

```markdown
# Pipeline Retro — [迭代名]

## 执行数据
- 总耗时：Stage1 + Stage2 + Stage3 + Stage4 = X 分钟
- Agent 调用次数：N 次
- ↺ 循环轮数：N 轮
- 发现的 Bug 数：N（P0/P1/P2）
- 测试覆盖率：X%

## 流程效率分析
- 最耗时的 Stage：StageX（耗时 Y 分钟，占比 Z%）
- 瓶颈模块：module-X（原因：复杂度过高/依赖等待/多次返工）
- ↺ 循环效率：每轮发现问题数（收敛趋势是否健康）

## 改进建议
- [建议1]
- [建议2]

## 下一轮关注的改进点
- 关注项1
- 关注项2
```

**影响范围**：
- `pipeline-monitor.md`：增加复盘模式的说明
- 《MVP白皮书.md》的引用对应（但白皮书不可修改，以补充说明的方式附着）

### 建议 1.4：Quality Gate 门禁检查清单（指导所有 Agent）

为每个 Gate 定义明确的检查清单，将当前散布的门禁条件集中为可执行的 Checkbox 列表：

**Stage0→Stage1 门禁**：
```
[ ] user-persona.md 产出
[ ] value-stream.md 产出
[ ] 需求精炼完成，无已知矛盾/模糊项
```

**Stage1→Stage2 门禁**：
```
[ ] PRD 包含全部 10+ 个强制章节（含新增的3个）
[ ] PRD 经 MECE 检查：无功能遗漏、无功能冗余
[ ] PRD 锁定（无变更 或 变更已走评审）
```

**Stage2→Stage3 门禁**：
```
[ ] spec.md + schema.sql + api-contract.yaml 锁定
[ ] task.md + 所有 module.md 锁定
[ ] ↺ 审查报告结论为 LOCKED
[ ] mocks/ 目录非空
[ ] integration-tests/modules/ 覆盖全部模块
[ ] integration-tests/scenarios/ 覆盖全部 PRD 业务主流程
```

**Stage3→Stage4 门禁**：
```
[ ] 所有模块标记为 DONE（非 DEFER/BLOCKED）
[ ] 所有模块通过 Final Review
[ ] 依赖链闭环验证通过，无环
[ ] 单元测试通过率 100%
[ ] 增量集成测试通过率 100%
```

**Stage4→交付门禁**：
```
[ ] 路由一致性验证通过
[ ] 前后端联调完成，接口匹配率 100%
[ ] 全量集成测试通过率 100%
[ ] 无 P0/P1 Bug 遗留
[ ] 回归测试套件已更新
```

### 建议 1.5：Agent 配置修改对照表

| Agent 文件 | 修改点 |
|-----------|--------|
| `agents/pm-agent.md` | 输入增加 user-persona.md + value-stream.md 可选输入；PRD 表格增加3行 |
| `agents/architect.md` | 输入增加 user-persona.md 为参考输入（影响实体设计） |
| `agents/domain-expert.md` | 输入增加 user-persona.md 为参考输入（影响模块边界划分） |
| `agents/pipeline-monitor.md` | 增加复盘模式（Stage4→pipeline-retro.md） |

---

## 三、第2轮 Flash：执行准确性优化建议

> **目标**：解决白皮书描述与实操之间的落差，特别是 Coordinator、Code Review、模块合并等环节。

### 建议 2.1：Pipeline Coordinator 的角色精确化

**问题**：白皮书说 Coordinator 是"轻量Agent只调度不写代码"，但 Agent 无法自动 spawn 其他 Agent。Coordinator 的本质是"人机协作的调度决策者"。

**修正建议**：
```markdown
Coordinator 的实际工作模式（非自动调度，而是半自动辅助决策）：

1. 依赖图分析（自动，Coordinator Agent）
   - 读取 task.md + module.md → 输出依赖图
   - 标记当前可分配的候选模块清单
   - 按专家匹配给出推荐分配方案

2. 调度决策（人机协作）
   - Coordinator 产出《调度方案建议书》
   - 格式："第N轮可分配：[模块A→Backend-1(推荐)] [模块B→Backend-2(推荐)]"
   - 人类或调用方确认后执行 spawn

3. 状态跟踪（自动，Coordinator Agent）
   - 记录已分配/已完成/已阻塞的持久化检查点
   - 中断恢复时读取检查点重建状态
   - 检查点文件：`.pipeline/checkpoint.json`
```

**检查点格式**（`.pipeline/checkpoint.json`）：
```json
{
  "stage": "Stage3",
  "round": 2,
  "allocated": {
    "user": {"agent": "Backend-1", "status": "DONE", "completed_at": "..."},
    "product": {"agent": "Backend-2", "status": "DONE", "completed_at": "..."},
    "template": {"agent": "Backend-3", "status": "ALLOCATED", "allocated_at": "..."}
  },
  "agent_pool": {
    "Backend-1": "IDLE",
    "Backend-2": "IDLE",
    "Backend-3": "BUSY"
  },
  "pending_modules": ["trace", "report"],
  "blocked_modules": [],
  "defers": []
}
```

### 建议 2.2：Stage3 增加强制性 Final Review 门禁

**问题**：Code Review 只在 TDD 失败时触发，但"测试全过"不等于"质量过关"。缺少模块完成后的强制终审。

**修正建议**（指导 Backend Agent + Code Review Agent的行为）：
```markdown
Final Review 触发条件（与 TDD 循环中的被动 Review 不同）：

- 触发时机：每个模块的 TDD 循环全部通过后，标记 DONE 之前
- 执行者：Code Review Agent（独立 Review，非开发 Agent 自审）
- 检查清单：
  [ ] 接口实现与 api-contract.yaml 完全一致（路由、方法、参数、响应格式）
  [ ] 测试覆盖率 ≥ 80%（按 Vitest --coverage 报告）
  [ ] 异常路径覆盖 ≥ 3 种：参数校验失败、资源不存在、权限不足
  [ ] 无硬编码（token/secret/URL）
  [ ] 跨模块调用通过 API 而非直接操作数据库
  [ ] Schema 引用正确（引用了全局定义而非自己重写）

- 通过标记：模块目录中创建 READY_FOR_MERGE 标记（而非直接 DONE）
- 不通过：打回 Backend Agent，修改后重新提交 Final Review
```

**文件状态约定新增**：
| 状态 | 文件标记 | 含义 |
|------|---------|------|
| ReadyForMerge | `READY_FOR_MERGE` | TDD通过 + Final Review通过，等待合并 |

### 建议 2.3：Stage4.1 模块合并流程精确化

**问题**："合并各模块路由到统一入口"太简化，实际涉及路由冲突检测、中间件链验证、Schema 引用解析等。

**修正建议**（指导 Code Review Agent / 合并执行者）：
```markdown
Stage4.1 后端模块合并子流程：

Step 1: 合并前检查
   1.1 确认所有模块状态为 READY_FOR_MERGE
   1.2 验证依赖链闭环——各模块的依赖声明与最终状态一致
   1.3 Schema 冲突检测——检查不同模块是否定义了同名但不同类型的字段
   1.4 路由前缀冲突检测——无重复的 HTTP Method + Path 组合

Step 2: 路由聚合
   2.1 收集所有模块的 routes.ts 中的路由定义
   2.2 按路径前缀分组，挂载到统一 Hono app
   2.3 验证中间件链顺序（auth → body-parser → router → error-handler）
   2.4 输出：`src/index.ts`（聚合后的入口文件）

Step 3: Schema 引用解析
   3.1 检查每个模块的 schema.ts 中对全局 schema 的 import 路径
   3.2 按照全局 schema.sql 进行最终的 Drizzle Schema 编译验证
   3.3 输出：`src/db/schema.ts`（合并后的全局 Schema）

Step 4: 合并后验证
   4.1 启动应用（可用 --dry-run 或 import 级验证）
   4.2 运行全量单元测试（必须全部通过）
   4.3 运行全量 API 端到端扫描（遍历所有定义的 route，确认启动无异常）
   4.4 运行增量集成测试（integration-tests/modules/* + scenarios/*）
```

### 建议 2.4：新增测试执行窗口（Stage3.5）

**问题**：Stage2 写测试 → Stage4 才执行，中间有巨大的验证真空。

**修正建议**：
```markdown
Stage3.5：增量测试执行

定位：每轮后端模块 DONE 后的验证闭环，不是独立的 Stage，而是嵌入 Stage3 的验证步骤。

执行规则：
1. 每轮调度中，当一个模块被标记为 READY_FOR_MERGE 后：
   → 立即执行该模块的单元测试（已在 TDD 中通过，此处为回归验证）
   → 执行该模块相关的集成测试（从 integration-tests/modules/ 中挑选对应文件）
   → 输出：增量测试报告（pass/fail + 覆盖统计）
   
2. Stage3 结束时（所有模块 READY_FOR_MERGE）：
   → 执行全量单元测试（所有模块，确保全局无回归）
   → 执行全量集成测试（modules/ + scenarios/ 必须全部通过）
   → Stage3→Stage4 门禁：全量测试通过率 100%

3. 增量测试与全量测试的关系：
   - 每轮增量测试是"快速反馈"（只测受影响模块，10秒级）
   - Stage3 末全量测试是"门禁关卡"（测所有模块，分钟级）
   - 只有全量门禁通过才能进入 Stage4
```

### 建议 2.5：↺ 循环降级判定锚点精确化

**问题**："3轮上限后给人类决策"缺少判定锚点，不同Agent对"应自行解决 vs 应上浮"的判断不一致。

**修正建议**：
```markdown
↺ 循环问题分级处理矩阵：

| 类别 | 问题类型示例 | 处理方式 | 轮次上限 |
|------|-------------|---------|---------|
| 自愈级 | 字段命名风格、注释语言、缩进/格式 | ①或②自行修正，无需grill再验证 | 0（stylistic可不进循环） |
| 调试级 | 字段类型选择（TEXT vs VARCHAR）、模块边界微调 | ①/②修正后grill单轮验证 | 2轮内 |
| 协商级 | 验收标准覆盖范围、API响应字段增减 | ①与②协商后grill验证 | 3轮内 |
| 上浮级 | 实体关系冲突（1:N vs N:M）、核心业务流程分歧、技术栈选择 | 立即输出未决清单，上浮人类 | 第1轮发现即上浮 |
| 终止级 | PRD 本身存在根本性矛盾、技术方案不可行 | 立即终止循环，上浮人类重新评估 | 第1轮发现即终止 |

实例：
- 「trace_code 字段类型 TEXT vs 结构体」→ 调试级（2轮内解决）
- 「同一订单可关联多个产品 vs 一个产品」→ 上浮级（第1轮即上浮）
- 「使用SQLite vs PostgreSQL」→ 终止级（不纳入循环，上浮人类）
```

### 建议 2.6：Agent 配置修改对照表

| Agent 文件 | 修改点 |
|-----------|--------|
| `agents/pipeline-coordinator.md` | 增加检查点机制说明；增加调度方案建议书的输出格式；增加 READY_FOR_MERGE 状态 |
| `agents/code-reviewer.md` | 增加 Final Review 检查清单；增加 Final Review 的执行流程 |
| `agents/backend-tdd.md` | 模块完成后标记 READY_FOR_MERGE（而非DONE）；引用增量测试的执行流程 |
| `agents/pipeline-monitor.md` | 增加 Stage3.5 增量测试的监控指标；增加 READY_FOR_MERGE 状态的扫描 |

---

## 四、第3轮 Flash：稳定性加固建议

> **目标**：解决单点故障、无限等待、上下文膨胀、部分交付等稳定性风险。

### 建议 3.1：Agent 超时与心跳契约

```markdown
每个 Agent spawn 时定义契约（由调用方在 spawn 命令中传递）：

Agent 执行时限约定（建议值，按复杂度调整）：
- PM Agent（Stage1）：15 分钟
- 架构专家（Stage2.1）：15 分钟
- 业务专家（Stage2.2）：10 分钟
- Mock 专家（Stage2.3a）：10 分钟
- 单模块测试专家（Stage2.3b-1）：10 分钟
- 场景测试专家（Stage2.3b-2）：10 分钟
- Coordinator（Stage3）：持续运行，无固定时限
- Backend Agent（每个模块）：15 分钟
- Frontend Agent（每个页面）：15 分钟
- Code Review Agent：5 分钟
- Debug Fixer：10 分钟

超时分级处理：
| 级别 | 条件 | 动作 |
|------|------|------|
| WARNING | 执行时长 > 建议值的 80% | Monitor 记录警告，不阻断 |
| ESCALATE | 执行时长 > 建议值的 120% | Monitor 报告异常，Coordinator 标记该模块为 STUCK |
| TERMINATE | 执行时长 > 建议值的 200% | 该 Agent 输出标记为"不完整"，Coordinator 降级分配给其他 Agent 或上浮人类 |

Monitor Agent 的检测逻辑：
1. 每 2 分钟扫描一次活跃 Agent 的实际执行时长
2. 对照 Agent 类型→建议时限，判定是否超时
3. 超时按分级处理
```

### 建议 3.2：上下文窗口管理策略

```markdown
Agent 上下文管理规则：

1. Stage 边界重置
   - 每个 Stage 结束时，当前 Agent 的输出写入文件系统
   - 下一个 Stage 的 Agent 是新 spawn 实例（上下文从零开始）
   - 如果同一 Agent 跨 Stage 工作（如 PM→架构顾问），需要在 Stage 边界执行上下文精简

2. 长运行 Agent 的上下文维护
   - Coordinator 属于长运行 Agent，每轮调度前执行一次上下文精简
   - 精简规则：保留当前轮次的调度状态 + 最新的分配日志，丢弃已完成模块的详细调试信息
   - Token 使用量超过 80% 上下文窗口时弹出警告

3. 上下文重置恢复路径
   - 重置时依赖检查点文件（.pipeline/checkpoint.json）恢复状态
   - 检查点必须包含：当前 Stage、已完成的模块清单、未完成的模块清单、分配日志
   - 上下文重置后，Agent 必须确认检查点状态与文件系统状态一致
```

### 建议 3.3：部分交付机制（DEFER 状态）

```markdown
DEFER 机制（新增模块状态）：

触发条件：
- 一个模块经过 2 轮重新分配仍未完成（复杂度超出预期）
- 或者该模块依赖的外部服务无法就绪
- 或者该模块的需求存在争议，需长周期讨论

DEFER 流程：
1. Coordinator 识别阻塞模块，评估影响范围
2. 标记该模块为 DEFER（在 checkpoint.json 中 + 模块目录中的 DEFER 标记文件）
3. 将依赖该模块的下游模块也标记为 DEFER（级联）
4. 剩余模块继续执行，不受影响
5. DEFER 模块进入下一轮迭代的 Backlog

产出物标记：
- 核心交付物（非 DEFER 模块）正常产出
- 被 DEFER 的模块在产物清单中标注"本版未覆盖，计划下一轮"
- 集成测试中跳过被 DEFER 模块的场景

文件状态约定新增：
| 状态 | 文件标记 | 含义 |
|------|---------|------|
| DEFER | `DEFER` + `reason.md`（原因说明） | 本模块推迟到下一轮，依赖它的模块一同推迟 |
```

### 建议 3.4：Pipeline 级回滚协议

```markdown
回滚触发条件（任一满足即触发）：
1. Stage4 集成测试发现 P0 缺陷 > 3 个
2. Bug 修复引入了新的 P0 缺陷
3. 回滚由人类确认后执行（非自动触发）

回滚路径：
1. 回滚目标：Stage3 最后一个全量测试通过的检查点
2. 回滚范围：保留所有模块代码，但将状态回退到检查点的 ALLOCATED/DONE 状态
3. 回滚例外：不回滚已合并的 Bug 修复（保留修复代码，清除新增 Bug 的代码）

回滚执行步骤：
1. 读取 checkpoint.json 找到上一个绿色检查点
2. 将当前代码与检查点快照进行区别对比
3. 移除检查点之后的变更（保留 Bug 修复）
4. 重置模块状态为检查点时的状态
5. 重新执行 Stage4 门禁检查

风险控制：
- 回滚是手动触发操作（需人类确认），不会自动执行
- 回滚前需要备份当前代码（git commit 或 stash）
- 回滚后如果仍然无法通过，标记为"本轮不可交付"，进入迭代复盘
```

### 建议 3.5：回归测试自动增长机制

```markdown
回归测试管理规则：

1. 目录结构
   integration-tests/
     modules/        ← Stage2 ③b-1 产出
     scenarios/      ← Stage2 ③b-2 产出
     regression/     ← 新增：Bug 修复的回归测试（单调增长）

2. 回归测试的创建规则
   - 每个 Bug 修复必须创建一个回归测试用例文件
   - 文件命名：`regression/bug-<编号>-<简要描述>.test.ts`
   - 回归测试必须是独立的（不依赖其他测试的执行状态）
   - 回归测试必须包含：Bug 复现步骤 + 断言 + 验证修复后的正确行为

3. 回归测试的执行
   - 每次全量集成测试执行时，regression/ 目录下的所有测试必须一起执行
   - 回归测试失败 = Bug 重现（即修复被破坏了）→ 阻塞交付
   - 回归测试套件单调增长（只增不减），确保历史 Bug 不会重现

4. 回归测试的生命周期
   - 理论上是永久的（历史 Bug 的历史保护）
   - 如果某个回归测试超过 5 轮迭代没有失败过，可以标记为"低价值"，但不删除
```

### 建议 3.6：文件系统竞态防护

```markdown
标记文件写入规范：

DONE 标记写入步骤：
1. 创建临时文件：`<module>/.done.tmp`
2. 写入完整内容（含 TDD 元数据）
3. 调用文件系统原子重命名：`.done.tmp` → `DONE`
   - Windows: MoveFileEx with MOVEFILE_REPLACE_EXISTING
   - Unix: rename()（原子操作）
4. 验证：读取 `DONE` 确认内容完整

Coordinator 读取规范：
1. 检查 `DONE` 是否存在且非空 → 确认模块完成
2. 检查 `.done.tmp` 是否存在 → 如果存在且 `DONE` 不存在，说明写入中断，标记为 UNSTABLE
3. 同时检查 `BLOCKED` 和 `.blocked.tmp`
4. 长时间无写入（超过 10 分钟）且无生效标记 → 标记为 STUCK

BLOCKED 标记写入（同上规范）：
- 必须附带 `reason.md`（阻塞原因）
- reason.md 必须包含：阻塞模块名、依赖的模块/服务、期望的解决方式

STUCK 检测（Monitor Agent 新增逻辑）：
- 上次扫描 vs 本次扫描：DONE 数无变化 + 无活跃 Agent 写入活动 → STUCK
- STUCK ≠ BLOCKED（BLOCKED 是 Agent 主动报告，STUCK 是 Monitor 被动检测）
- STUCK 处理：上报人类，询问是继续等待还是标记为 DEFER
```

### 建议 3.7：Agent 配置修改对照表

| Agent 文件 | 修改点 |
|-----------|--------|
| `agents/pipeline-coordinator.md` | 增加 DEFER 状态处理；增加检查点恢复协议；增加超时监控的协作说明 |
| `agents/pipeline-monitor.md` | 增加超时检测；增加 STUCK 与 BLOCKED 的区分；增加上下文使用量监控；增加回归测试目录的扫描 |
| `agents/debug-fixer.md` | 增加回归测试文件的创建规范；增加回归测试的命名规则 |

---

## 五、建议优先级速查

| 轮次 | 建议 | 影响 | 紧急度 | 工作量估计 |
|------|------|------|--------|-----------|
| 第1轮 | 1.1 需求预处理 | 高理论覆盖 | 中 | 低（修改pm-agent.md） |
| 第1轮 | 1.2 PRD表格补充 | 高理论覆盖 | 中 | 低（修改pm-agent.md模板） |
| 第1轮 | 1.3 复盘步骤 | 中闭环反馈 | 低 | 低（修改monitor.md） |
| 第1轮 | 1.4 质量门禁清单 | 高执行刚性 | **高** | 低（独立文档/嵌入各Agent） |
| 第2轮 | 2.1 Coordinator精确化 | 致命实操落差 | **高** | 中（重写coordinator.md） |
| 第2轮 | 2.2 Final Review门禁 | 高质量漏洞 | **高** | 低（修改code-reviewer.md + backend-tdd.md） |
| 第2轮 | 2.3 模块合并子流程 | 高实操模糊 | **高** | 低（独立流程文档） |
| 第2轮 | 2.4 测试执行窗口 | 高验证真空 | **高** | 中（新增执行逻辑描述） |
| 第2轮 | 2.5 ↺循环判定锚点 | 中决策模糊 | 中 | 低（修改grill-review.md） |
| 第3轮 | 3.1 Agent超时契约 | 致命无防护 | **高** | 中（新增契约文档） |
| 第3轮 | 3.2 上下文管理 | 高性能风险 | 中 | 低（制度约束，非代码） |
| 第3轮 | 3.3 部分交付DEFER | 高交付阻塞 | **高** | 低（新增状态定义） |
| 第3轮 | 3.4 回滚协议 | 高容灾空白 | 中 | 低（流程文档） |
| 第3轮 | 3.5 回归增长机制 | 中质量持久 | 中 | 低（目录约定+规则） |
| 第3轮 | 3.6 文件竞态防护 | 高数据安全 | 中 | 低（写入规范约定） |

---

## 六、各 Agent 修改总表

| Agent 文件 | 第1轮 | 第2轮 | 第3轮 |
|-----------|-------|-------|-------|
| pm-agent.md | 1.1, 1.2 | — | — |
| architect.md | 1.1 | — | — |
| domain-expert.md | 1.1 | — | — |
| pipeline-coordinator.md | — | 2.1, 2.6 | 3.7 |
| code-reviewer.md | — | 2.2, 2.6 | — |
| backend-tdd.md | — | 2.2, 2.6 | — |
| pipeline-monitor.md | 1.3 | 2.6 | 3.7 |
| debug-fixer.md | — | — | 3.7 |
| grill-review.md | — | 2.5 | — |

修改频次统计（受影响的Agent数）：
- 第1轮：4 个 Agent 文件
- 第2轮：5 个 Agent 文件
- 第3轮：3 个 Agent 文件

---

*本建议报告基于对 `MVP白皮书.md` 及 `skills/all-in-mvp/agents/` 下全部 13 个 Agent 配置文件的深度分析，覆盖理论覆盖度（7项缺口）、执行准确性（9项模糊点）、稳定性（11项脆弱点）共 27 个问题，给出 3 轮渐进式优化建议。建议按轮次顺序执行，第2轮依赖第1轮的输出，第3轮依赖前两轮的稳定基线。*
