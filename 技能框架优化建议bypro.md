# MVP白皮书三视角审视与3轮迭代优化建议

> **审视日期**：2026-05-21
> **审视对象**：`MVP白皮书.md` v1.0 + `all-in-mvp/SKILL.md` + `grill-with-docs/SKILL.md` + 36个配套技能
> **审视维度**：理论覆盖度、执行准确性、稳定性
> **方法论**：每轮先诊断，再开方，下一轮在上轮基础上递进优化。

---

## 一、三视角诊断总览

### 1.1 理论覆盖度诊断

| # | 缺失/薄弱项 | 严重级别 | 影响范围 |
|---|-----------|---------|---------|
| T1 | **增量迭代模型缺失**：白皮书是"一次性瀑布"，MVP本质是迭代的，未定义Stage1-4如何与迭代周期耦合 | 🔴 CRITICAL | 全局 |
| T2 | **回退/回滚机制空白**：Stage3发现Stage2缺陷时，没有降级回退到Stage2的流程 | 🔴 CRITICAL | Stage3→Stage2 |
| T3 | **非功能需求演进路径缺失**：说"后续迭代"处理，但无时间线和触发条件 | 🟡 HIGH | Stage2架构决策 |
| T4 | **Agent失败恢复模型空白**：Agent崩溃/死循环/产出不合格后如何恢复 | 🔴 CRITICAL | Stage3 |
| T5 | **人类决策框架不完整**：只有↺循环上限降级，缺少Stage3单模块阻塞、联调大问题等决策点 | 🟡 HIGH | Stage3/Stage4 |
| T6 | **跨Agent知识共享协议缺失**：Agent间应共享什么上下文、system prompt应包含什么 | 🟡 HIGH | Stage2/Stage3 |
| T7 | **可观测性设计为零**：Pipeline运行中怎么知道进度、性能、瓶颈 | 🟠 MEDIUM | 全部Stage |
| T8 | **PRD质量门禁标准缺失**：说"MECE评审"但无评审人、评审标准、通过条件 | 🟡 HIGH | Stage1 |
| T9 | **前端测试方法论空白**：后端有TDD，前端只有"基于Mock开发"，无前端测试层级定义 | 🟡 HIGH | Stage3前端 |
| T10 | **并行度上限的数学依据缺失**：后端3/前端3/测试2，这些数字从哪里来？ | 🟠 MEDIUM | Stage2/Stage3 |

### 1.2 执行准确性诊断

| # | 缺失/薄弱项 | 严重级别 | 影响范围 |
|---|-----------|---------|---------|
| E1 | **"拷问审查"是Skill还是Agent？**白皮书说"grill-with-docs Skill"又说"grill Agent"，概念模糊 | 🟡 HIGH | Stage2↺ |
| E2 | **Stage2测试产出物无验证环节**：③b-1/③b-2只写不执行，写错了怎么发现？ | 🔴 CRITICAL | Stage2 |
| E3 | **Mock一致性验证后置**：Mock-后端7维一致性在Stage4才检查，太晚了 | 🟡 HIGH | Stage3↔Stage4 |
| E4 | **依赖图构建依赖人工且无校验**：隐式依赖遗漏导致死锁 | 🟡 HIGH | Stage2→Stage3 |
| E5 | **前端页面拆分策略缺失**：只说了3个Agent但没说按什么拆 | 🟠 MEDIUM | Stage3前端 |
| E6 | **Code Review时机不明确**：每个TDD循环都Review还是在Green/Refactor阶段？ | 🟠 MEDIUM | Stage3后端 |
| E7 | **Stage3测试补充的触发条件模糊**："根据实际开发进展补充"，什么时候触发补充？ | 🟠 MEDIUM | Stage3测试 |
| E8 | **Coordinator的模块分配是push还是pull？**描述为push但Coordinator需要知道Agent是否空闲 | 🟠 MEDIUM | Stage3 |
| E9 | **Schema锁定粒度问题**：整个schema.sql全局锁定 vs 按模块锁定，全局锁定阻塞无依赖模块 | 🟡 HIGH | Stage2→Stage3 |
| E10 | **联调问题记录模板**在SKILL.md有但白皮书没有，信息分散 | 🟠 MEDIUM | Stage4 |

### 1.3 稳定性诊断

| # | 缺失/薄弱项 | 严重级别 | 影响范围 |
|---|-----------|---------|---------|
| S1 | **Pipeline Coordinator单点故障**：Coordinator崩溃→Stage3全停 | 🔴 CRITICAL | Stage3 |
| S2 | **产出物无版本控制**：↺循环多轮修改无版本号，无法回滚 | 🟡 HIGH | Stage2↺ |
| S3 | **Agent上下文窗口溢出无策略**：11种Agent如果复用实例，上下文累积膨胀 | 🟡 HIGH | 全局 |
| S4 | **人类不在线阻塞全流程**：↺上限降级、PRD变更评审都需人类 | 🟡 HIGH | Stage1/Stage2 |
| S5 | **Mock与实现同步漂移**：契约锁定后发现不合理→改契约→Mock未同步 | 🟡 HIGH | Stage2→Stage3 |
| S6 | **模块间隐藏数据竞争**：两个Agent操作同一表的不同字段，DONE信号竞态 | 🟠 MEDIUM | Stage3 |
| S7 | **产出物完整性校验缺失**：文件损坏/格式错误/空文件无检测 | 🟠 MEDIUM | Stage间传递 |
| S8 | **Stage4多Agent协作缺乏协调**：后端合并、联调、集成测试、Bug修复需要依次串行但无明确协调者 | 🟠 MEDIUM | Stage4 |
| S9 | **风险应对表过于简化**：6项风险应对，但实际运行时风险远多于6种 | 🟡 HIGH | 全局 |
| S10 | **BLOCKED标记处理不闭环**：Agent标记BLOCKED后谁来解决？时限？超时怎么办？ | 🟡 HIGH | Stage3 |

---

## 二、Round 1：补全理论框架（痛点T1-T10）

### 2.1 新增：第零章「迭代模型与生命周期」

> **位置**：插入在现有第一章之前
> **内容**：定义MVP白皮书的两种运行模式

```markdown
## 零、迭代模型与生命周期

### 0.1 两种运行模式

| 模式 | 适用场景 | Stage1-4执行方式 |
|------|---------|-----------------|
| **全量模式** | 全新项目、第一次交付 | 完整执行Stage1-4，全部模块一次到位 |
| **增量模式** | 迭代项目、追加功能 | 每次迭代只跑涉及的Stage，已锁定模块跳过 |

### 0.2 增量模式的阶段裁剪规则

| 迭代场景 | Stage1 | Stage2 | Stage3 | Stage4 |
|---------|--------|--------|--------|--------|
| 新增独立模块 | 更新PRD | 仅新模块走①→②→↺→③ | 仅新模块 | 集成新模块 |
| 修改现有模块 | 更新PRD变更记录 | 重走①→②→↺（仅受影响部分）| 重新开发变更模块 | 重新集成 |
| Bug修复 | 跳过 | 跳过 | 跳过 | 仅Stage4 |

### 0.3 回退协议

当Stage3执行中发现Stage2产物缺陷时：

```
发现缺陷
  ↓
判定缺陷类型：
  ├── 接口契约缺陷 → 回退到Stage2①，修正api-contract.yaml
  ├── Schema缺陷 → 回退到Stage2①，修正schema.sql
  ├── 模块边界缺陷 → 回退到Stage2②，修正<module>.md
  └── PRD理解偏差 → 回退到Stage1，修正PRD
  ↓
受影响模块回滚到「未分配」状态
  ↓
Coordinator重新调度受影响模块
```
```

### 2.2 新增：非功能需求演进时间线

> **位置**：插入在Stage2架构专家职责之后，作为独立小节

每个迭代周期的非功能需求补充时机：

```
MVP v1（全量交付）：零非功能需求 → 功能优先
MVP v1.1（首个增量）：补充认证安全（R1: 密码强度、JWT过期、令牌刷新）
MVP v1.2：补充性能基线（R2: p99<500ms、SQL查询无N+1）
MVP v2.0：补充安全加固（R3: XSS/CSRF/限流/防重放）
MVP v2.1+：补充可观测性（R4: 日志、错误追踪、慢查询）
```

### 2.3 新增：Agent失败恢复模型

> **位置**：插入在新的「第十一章」

```markdown
## 十一、Agent失败恢复协议

### 11.1 失败分类与恢复策略

| 失败类型 | 判定依据 | 恢复动作 | Coordinator行为 |
|---------|---------|---------|----------------|
| 超时未响应 | Agent spawn后N分钟无产出 | 重试（最多2次） | 标记模块为「待重试」，释放Slot |
| 产出不合格 | Code Review发现≥3个P0问题 | 打回→Agent修正→重新Review | 模块保持「已分配」，不释放Slot |
| 产出严重偏离 | 产出与模块定义完全不符 | 重新spawn新Agent实例 | 废弃旧产出，模块回「未分配」 |
| Agent崩溃 | spawn进程异常退出 | 重启Agent，从checkpoint恢复 | 模块保持「已分配」，等待重启 |
| 死循环 | 重复产出同类错误≥3次 | 终止Agent→升级给人类 | 模块标记BLOCKED(human_decision) |

### 11.2 Coordinator自身恢复

Coordinator维护 `pipeline-state.json`（详见§11.3），崩溃后重启读取该文件恢复状态：
- 无需重新扫描所有模块
- 恢复最近一轮的分配日志
- 恢复各Agent的slot占用状态

### 11.3 状态持久化

Coordinator的运行时状态文件：

```json
{
  "pipeline_id": "uuid",
  "stage": "Stage3",
  "current_round": 2,
  "agent_slots": {
    "backend": [{"agent": "Backend-1", "module": "user", "status": "DONE"}],
    "frontend": [{"agent": "Frontend-1", "module": null, "status": "IDLE"}]
  },
  "module_states": {
    "user": "DONE",
    "product": "ASSIGNED",
    "trace": "PENDING"
  },
  "last_checkpoint": "2026-05-21T10:30:00Z"
}
```
```

### 2.4 新增：人类决策框架完整化

> **扩充现有↺循环降级策略，增加多个决策点**

在原文"无法达成一致时的降级策略"之后追加：

```markdown
### 完整人类决策点清单

| 决策点 | 触发条件 | 决策内容 | 决策时限 |
|--------|---------|---------|---------|
| PRD评审 | Stage1完成 | PRD是否通过评审 | 无时限，需人类确认 |
| ↺循环未决 | 3轮未通过 | 采纳推荐方案 或 自定义决策 | 建议24h内 |
| 单模块反复失败 | 同一模块重试3次仍失败 | 跳过该模块/降低验收标准/等待 | 建议4h内 |
| 联调发现架构问题 | Stage4联调发现接口不匹配>5个 | 修正契约/修正实现/调整模块边界 | 建议1h内 |
| Schema变更 | 锁定后需要变更 | 批准/驳回变更申请 | 建议4h内 |
| 无法解决的BLOCKED | 标记BLOCKED后1h无人处理 | 降级/跳过/等待 | 建议1h内 |

### 人类离线时的自动策略

当所有决策点触发但人类不在线时，系统执行**保守自动策略**：
- ↺循环未决 → 采纳grill推荐方案，记录为「自动裁决」
- 单模块反复失败 → 标记为BLOCKED，跳过该模块，继续其他模块
- 联调架构问题 → 记录问题清单，继续联调其他模块
- Schema变更 → 自动拒绝（锁定后不可自动变更）
- 无法解决的BLOCKED → 等待人类，不自动降级
```

### 2.5 新增：跨Agent知识共享协议

```markdown
## 十一.A、Agent知识共享协议

### 共享上下文（每个Agent的system prompt必须包含）

| 类别 | 内容 | 来源 |
|------|------|------|
| 项目目标 | PRD「项目背景」章节摘要（≤200字） | PRD.md |
| 技术栈约束 | 完整技术栈清单 | mvp-tech-stack-default.md |
| 当前阶段 | 所在Stage、角色、门禁条件 | 白皮书对应章节 |
| 契约文件路径 | api-contract.yaml、schema.sql的绝对路径 | Coordinator分配时提供 |
| 前置产出物 | 当前模块依赖的其他模块的接口摘要 | <module>.md依赖清单 |
| 文件约定 | 产出物目录结构、命名规范 | 白皮书第八/九章 |

### 禁止共享的内容
- 其他Agent的实现代码（只通过API契约交互）
- 其他Agent的测试数据
- 未锁定的产出物
- 人类对话历史（执行Agent不与人类直接对话）
```

### 2.6 新增：PRD质量门禁

> 在Stage1章节末尾增加：

```markdown
### PRD质量门禁（MUST PASS before Stage2）

| 门禁项 | 检查方式 | 通过条件 |
|--------|---------|---------|
| 章节完整性 | 人工/Agent检查 | 9个强制章节全部存在且非空 |
| 功能需求可测试性 | Agent解析 | 每条功能需求可转化为至少1条集成测试 |
| ER关系一致性 | Agent交叉校验 | 实体引用的表名/字段在所有章节中一致 |
| 术语自洽 | Agent检查 | PRD内部同一概念只用同一术语 |
| 验收标准覆盖 | Agent检查 | 每条业务主流程有≥1条Happy Path + ≥1条Exception Path验收标准 |
| 范围边界清晰 | 人工确认 | 「不做」清单明确 |

> PRD质量门禁不通过 → 拒绝进入Stage2 → 产品经理Agent修正后重新提交。
```

### 2.7 新增：前端测试方法论

> 在Stage3.2章节补充：

```markdown
### 前端测试层级

前端采用与后端对称的三层测试（前端TDD-Lite）：

| 层级 | 测试对象 | 工具 | 触发时机 |
|------|---------|------|---------|
| **FT1 组件单元测试** | Composable函数、工具函数、Pinia Store | Vitest | 每个组件开发时同步编写 |
| **FT2 页面集成测试** | 完整页面渲染、表单交互、路由跳转 | Vitest + @vue/test-utils | 页面完成后 |
| **FT3 E2E场景测试** | 真实浏览器用户旅程 | Playwright | Stage4集成测试阶段执行 |

与后端TDD的区别：前端可以先写页面再补测试（Mock已就绪，视觉优先），但**组件和Store必须测试先行**（纯逻辑层）。
```

### 2.8 新增：并行度上限的理论依据

```markdown
### 并行度上限推导

| 维度 | 上限值 | 推导依据 |
|------|--------|---------|
| 后端Agent | 3 | 典型MVP模块数6-12个，3个Agent分2-4轮完成；>3时Coordinator上下文窗口压力指数增长 |
| 前端Agent | 3 | 共享组件路由/Pinia Store冲突风险随Agent数平方增长；3个Agent可覆盖表单/展示/流程三种页面类型 |
| 测试Agent(③b-1) | 2 | 模块间测试完全独立但共享api-contract；>2时测试fixture命名冲突概率>30% |
| 总并行Agent上限 | 8 | 后端3+前端3+测试2；Coordinator需为每个Agent维护slot状态，8个slot接近LLM上下文管理极限 |
```

---

## 三、Round 2：强化执行准确性（痛点E1-E10，基于R1已补理论）

### 3.1 明确「拷问审查」定位

> 修改白皮书2.3章节标题和措辞：

原文：`### 2.3 ↺ 拷问审查循环（① ↔ ② 交叉校验，grill-with-docs 驱动）`

修订为：

```markdown
### 2.3 ↺ 拷问审查循环（① ↔ ② 交叉校验）

**执行方式**：加载 `grill-with-docs` Skill 创建审查Agent，Skill提供四维审查方法论和标准化报告格式。
**Agent角色**：独立于①和②的第三方审查Agent，仅持有PRD作为唯一基准。

**Skill vs Agent边界**：
- `grill-with-docs` Skill：定义审查维度(D1-D4)、报告格式、循环机制 — **方法论层**
- 审查Agent：执行Skill中定义的四维检查、读取产出物、生成报告 — **执行层**
```

### 3.2 增加Stage2测试产出物验证环节

> 在Stage2③b-1/③b-2之后，Stage2门禁之前插入：

```markdown
### 2.7 ③c 测试用例静态审查（单Agent，在③a/③b完成后串行）

**前置条件**：③b-1和③b-2全部完成
**输入**：`integration-tests/modules/` + `integration-tests/scenarios/` + `<module>.md` + PRD
**输出**：测试用例审查报告

**职责**（轻量快速审查，不执行测试）：
- 检查每个模块的测试文件是否存在且非空
- 检查每个test用例是否引用了有效的API路由（对照api-contract.yaml）
- 检查场景测试是否完整覆盖PRD「业务主流程」中的所有步骤
- 检查测试数据fixture是否与schema.sql字段类型一致
- 标记语法明显错误（import路径不存在、函数名拼写等）

**审查通过标准**：无ERROR级别问题。WARNING可记录但通过。
**产出**：审查报告 + 问题清单（如有）→ ③b-1/③b-2对应Agent修正 → 重新审查。

> 此环节是Stage2的最后一道防线。审查仅检查"用例写对了没有"，不实际执行（执行在Stage4）。
```

### 3.3 Mock一致性验证前置

> 在Stage3.2前端开发章节中增加Mock验证机制：

```markdown
### 前端开发中的Mock持续验证

每个前端Agent在开发每个页面时，自动执行「Mock三合一检查」：

| 检查项 | 方式 | 频率 |
|--------|------|------|
| 响应格式 | 对比Mock返回的JSON结构与api-contract.yaml的Response DTO | 每个API首次调用 |
| 状态码 | 验证happy path返回2xx，exception path返回4xx/5xx | 每个API首次调用 |
| 字段类型 | 验证返回字段的TypeScript类型是否与DTO一致 | 每个页面开发时 |

发现不一致 → 写入 `mock-drift-issues.md` → Coordinator在Stage4开始前统一处理（批量修正Mock或更新契约）。

> 这样将Mock一致性检查从Stage4终点前置到Stage3全流程，避免Stage4集中爆发大量Mock不一致问题。
```

### 3.4 依赖图自动校验

> 在Stage3.0 Pipeline Coordinator职责中增加：

```markdown
### 启动时依赖图自动校验

Coordinator在Stage3启动时执行一次完整的依赖图静态分析：

1. **无环检查**：拓扑排序所有模块，检测循环依赖 → 发现循环则Stage3拒绝启动
2. **隐式依赖检测**：扫描所有模块的接口定义，如果模块A的DTO中引用了模块B的表字段，但模块A的<module>.md未声明依赖B → 标记为WARNING，人工确认
3. **孤儿模块检测**：未被任何模块依赖且不依赖任何模块的模块 → 无需特殊处理，正常分配

**检查通过标准**：无循环依赖（ERROR）。隐式依赖呈报人类确认（WARNING不阻塞）。
```

### 3.5 前端页面拆分策略明确化

> 修改Stage3.2前端Agent分配逻辑：

```markdown
### 前端页面分配算法

Coordinator按以下优先级拆分页面：

1. **公共组件先行**（第0轮）：Layout、Nav、AuthGuard等跨页面组件 → 分配给Frontend-1
2. **按路由模块拆分**（第1轮起）：
   - 每个前端Agent分配一个路由模块（如 `/products` 路由组）
   - 路由模块内的所有子页面（列表/详情/编辑）归同一Agent
3. **负载均衡**：路由模块数 > 3时，按页面数大致均匀分配给3个Agent
4. **页面间无交叉**：一个路由模块的所有页面只分配给一个Agent（避免同一个页面的不同部分由不同Agent开发）

**示例**（6个路由模块分配给3个Agent）：
- Frontend-1：`/users`（4页）+ `/roles`（2页）= 6页
- Frontend-2：`/products`（3页）+ `/categories`（2页）= 5页
- Frontend-3：`/trace`（3页）+ `/templates`（2页）= 5页
```

### 3.6 Code Review时机明确化

> 修改Stage3.1 TDD循环中的Code Review触发条件：

原文的Code Review触发表修订为：

```markdown
### TDD循环中的Code Review时机

| TDD阶段 | 触发Review? | Review内容 | 执行方式 |
|---------|------------|-----------|---------|
| Red阶段（测试失败） | ❌ 不触发 | — | — |
| Green阶段（实现刚完成） | ✅ 自动触发 | 实现逻辑、API契约一致性 | 独立Review Agent自动审查 |
| Refactor阶段（重构中） | ❌ 不触发 | — | 由开发Agent自审 |
| Refactor完成后测试失败 | ✅ 自动触发 | 重构是否破坏行为、是否违反契约 | 独立Review Agent |
| 模块标记DONE前 | ✅ 强制触发 | **全量终审**：5层测试通过 + 代码规范 + 边界覆盖 | 这是最终门禁 |

### Review通过标准

| 级别 | 含义 | 动作 |
|------|------|------|
| P0（阻塞） | 接口契约不一致、安全漏洞、数据丢失风险 | 必须修复，修复后重新全量Review |
| P1（重要） | 异常路径未覆盖、潜在性能问题 | 建议修复，开发Agent决定是否立即修 |
| P2（建议） | 代码风格、命名建议 | 记录，Stage4前统一清理 |

> DONE前终审：P0必须清零，P1≤2个。
```

### 3.7 Stage3测试补充触发条件

> 修改Stage3.3章节：

```markdown
### 3.3 测试团队：事件驱动的边界用例补充

**触发机制**（不再模糊的"根据开发进展"，改为事件驱动）：

| 触发事件 | 补充动作 | 时效要求 |
|---------|---------|---------|
| 新模块标记DONE | 追加该模块的并发场景测试、大数据量测试 | DONE后30min内 |
| Code Review发现异常路径遗漏 | 补充被遗漏的异常路径测试 | Review后15min内 |
| 一个领域的所有模块DONE | 追加该领域的跨模块数据一致性测试 | 完成后30min内 |
| 后端全部DONE | 追加全局并发压力测试、全量数据迁移测试 | 完成前（Stage4开始前） |

**测试团队的工作节奏**：被动响应（事件驱动），不主动轮询。
```

### 3.8 Coordinator推送/Pull模式澄清

> 在Stage3.0 Pipeline Coordinator职责中明确：

```markdown
### 通信模式：Coordinator推送（非Pull）

Coordinator主动分配模块，不等待Agent请求：

1. Coordinator扫描当前状态 → 确定候选模块
2. Coordinator spawn新Agent（或复用空闲Agent），将模块定义作为prompt传入
3. Agent完成后写入DONE标记 → Coordinator在下一轮扫描时发现
4. Coordinator立即分配新模块给刚空闲的Agent

**Agent Slot管理**：
- Coordinator维护3个后端Slot + 3个前端Slot
- Slot状态：IDLE / BUSY
- 每轮扫描：检查BUSY Slot → DONE? → 释放Slot → 分配新模块
- 分配日志记录每次slot状态变更
```

### 3.9 Schema锁定粒度优化

> 修改Stage2锁定约定：

```markdown
### Schema锁定粒度

**原方案（全局锁定）**：整个`schema.sql`在↺循环通过后一次性锁定。

**优化方案（分表锁定）**：

| 锁定时机 | 锁定范围 | 下游释放 |
|---------|---------|---------|
| ↺循环通过 | schema.sql整体锁定（不变） | — |
| 原子表组可提前锁定 | 无依赖表组（表A不引用表B字段） | 操作该表组的模块可提前进入Stage3 |

**原子表组划分规则**（由架构专家在产出的schema.sql注释中标注）：
```sql
-- @atomic_group: auth
CREATE TABLE users (...);
CREATE TABLE roles (...);
CREATE TABLE user_roles (...);

-- @atomic_group: product
CREATE TABLE categories (...);
CREATE TABLE products (...);

-- @atomic_group: trace (依赖 product)
CREATE TABLE trace_codes (..., FOREIGN KEY product_id REFERENCES products(id));
```

Coordinator读取原子表组标记：auth组锁定→user/role模块可进入Stage3，无需等product表锁定。
```

### 3.10 信息集中化

> 将SKILL.md中的联调问题记录模板、质量审计清单等搬入白皮书（或白皮书引用）确保白皮书是单一事实来源。

在白皮书Stage4.2末尾增加引用：

```markdown
> 联调问题记录模板、质量审计完整清单见 `all-in-mvp/SKILL.md` Stage4章节。
> 白皮书定义流程和门禁，SKILL.md定义具体模板和检查清单。
```

---

## 四、Round 3：加固稳定性（痛点S1-S10，基于R1+R2已补理论和执行）

### 4.1 Coordinator高可用设计

```markdown
### Pipeline Coordinator恢复协议

**问题**：Coordinator是Stage3单点，崩溃导致全流程停摆。

**方案**：无状态Coordinator + 状态文件持久化

1. Coordinator每次状态变更写入 `pipeline-state.json`（见R1-2.3）
2. 写入采用**原子写**（先写临时文件→重命名覆盖）防止写入中途崩溃
3. Coordinator崩溃后重启：
   - 读取 `pipeline-state.json` 恢复所有slot和模块状态
   - 扫描文件系统校验状态一致性（DONE/BLOCKED标记与实际文件是否匹配）
   - 差异以文件系统为准（文件系统是ground truth）
4. 如果 `pipeline-state.json` 也损坏 → 退化到全量扫描模式（扫描所有模块目录，重建状态）

**恢复时间目标**：< 30秒（全量扫描）/ < 5秒（从状态文件恢复）
```

### 4.2 产出物版本控制

```markdown
### 产出物版本管理

**原则**：所有产出物在修改时自动增加版本号，保持历史可追溯。

**实现方式**（轻量，不引入Git之外的版本工具）：

1. 文件头部增加元数据注释块：

```yaml
# @version: 1.2
# @last_modified: 2026-05-21T14:30:00Z
# @modified_by: architect-agent
# @change: 拆分trace_code为company_code+date_part+serial_number
# @grill_round: 2
```

2. ↺循环中每次修正后自动更新版本号和变更说明
3. 旧版本通过Git历史自然保留（不手动备份）
4. 回退 = Git revert到目标版本 + 通知下游Agent
5. **锁定版**必须在Git中打tag：`stage2-locked/v1.0`
```

### 4.3 上下文窗口溢出防护

```markdown
### Agent上下文管理策略

| 策略 | 说明 |
|------|------|
| **单Agent单实例** | 每种Agent使用独立的LLM实例（不共享上下文），避免11种Agent交叉污染 |
| **最小化prompt** | Agent的system prompt压缩到≤500 tokens（只含：角色定义、技术栈、当前模块、文件路径、门禁条件） |
| **产出物只读链接** | Agent不加载完整PRD/spec/schema文本，只通过文件路径引用；仅在需要时读取相关段落 |
| **上下文窗口告警** | 单个Agent的上下文超过80%窗口时 → Coordinator记录WARNING → 考虑拆分该Agent的任务 |
| **长会话切割** | 单个Agent的TDD循环超过20轮 → 强制终止 → 新实例从checkpoint继续 |

### 模块定义摘要（减负）

Coordinator分配模块时，不传完整`<module>.md`，传给Agent的是**摘要版**：

```yaml
module: product
domain: 业务核心
depends_on: [user]
apis:
  - GET /api/products (list, filters)
  - POST /api/products (create)
  - GET /api/products/:id (detail)
tables:
  - categories (id, name, parent_id)
  - products (id, name, category_id, price)
acceptance:
  happy_path: 3
  exception_path: 4
```
```

### 4.4 人类离线自动降级策略

> 扩充R1中的人类决策框架，增加自动降级矩阵：

```markdown
### 人类离线自动降级矩阵

当 `pipeline-state.json` 检测到人类超过N小时未响应决策请求时：

| 决策类型 | 超时阈值 | 自动降级动作 | 风险等级 | 事后补救 |
|---------|---------|-------------|---------|---------|
| PRD评审 | 48h | **不自动通过**，挂起全流程 | 🟢 安全 | — |
| ↺循环未决 | 6h | 采纳grill推荐方案 + 记录「自动裁决」 | 🟡 中 | 人类审查时可推翻 |
| 单模块反复失败 | 2h | 跳过该模块 + 标记WARNING | 🟡 中 | Stage4前必须处理 |
| 联调架构问题 | 1h | 记录问题+继续联调其他模块 | 🟠 偏高 | 最终交付前必须解决 |
| Schema变更 | ∞ | **永不自动批准** | 🟢 安全 | — |
| BLOCKED超时 | 2h | 降级分配（跳过被阻塞的依赖链） | 🟠 偏高 | 人类回来后优先处理 |
```

### 4.5 Mock-实现同步协议

```markdown
### Mock-实现变更同步

**场景**：契约锁定后，Stage3开发中发现契约不合理→需要变更。

**同步流程**（而非直接改契约）：

```
开发Agent发现契约不合理
  ↓
提交变更申请（写入 change-request.md）
  ↓
Coordinator暂缓该模块（标记BLOCKED(reason=contract_change_pending)）
  ↓
人类审查变更申请（或自动策略：若为小变更<3个接口则自动批准）
  ↓
批准后：
  1. 更新 api-contract.yaml（增加版本号）
  2. Mock Agent同步更新对应的Mock端点
  3. 所有依赖该接口的前端Agent收到变更通知
  4. 前端对应页面标记为「需重新联调」
  5. 开发Agent继续
```

**变更影响范围自动分析**：
Coordinator读取变更的接口 → 扫描所有前端页面引用的API → 输出受影响页面清单。
```

### 4.6 模块间数据竞争检测

```markdown
### 数据竞争自动检测

Coordinator在每个领域的所有模块DONE后，执行一次数据竞争扫描：

1. 提取该领域所有模块的schema定义
2. 检测是否存在：两个模块操作同一张表（即使是不同字段）
3. 检测是否存在：两个模块操作有外键关联的不同表，且操作时序不正确
4. 发现潜在竞争 → 写入 `race-condition-warnings.md` → Stage4联调时重点验证

**示例**：
- 模块A：`UPDATE products SET stock = stock - 1`（下单扣库存）
- 模块B：`UPDATE products SET price = 9.9`（后台改价）
→ 两个模块操作同一表 `products` → 标记为潜在竞争 → 需要并发测试覆盖
```

### 4.7 产出物完整性自动校验

> 在Stage N到Stage N+1的门禁中增加：

```markdown
### 产出物完整性自动校验

每个阶段门禁中增加自动校验脚本（Agent执行）：

| 阶段门禁 | 校验项 | 校验方式 |
|---------|--------|---------|
| Stage1→Stage2 | PRD文件存在且>1KB；9个章节标记全部存在 | 文件系统检查 + 正则匹配 |
| Stage2→Stage3 | 所有产出物存在且MD5与↺锁定时刻一致；YAML/JSON文件可解析 | 文件hash + 格式验证 |
| Stage3→Stage4 | 所有模块目录存在DONE标记；schema.sql无语法错误 | 标记文件检查 + SQLite dry-run |
| Stage4→交付 | 集成测试报告非空；0个P0/P1 Bug | 文件内容解析 |

任何校验失败 → 门禁拒绝通过 → 输出具体缺失/损坏项清单。
```

### 4.8 Stage4协调者角色

> 在Stage4开头新增协调者：

```markdown
### 4.0 Stage4 Coordinator（集成协调者）

Stage4虽然串行，但涉及多个角色（后端合并、前端联调、集成测试、Bug修复），需要明确的协调者。

**职责**：
1. 编排4个子阶段的执行顺序（合并不完不开联调，联调不完不开集成测试）
2. 接收联调问题 → 分类（契约问题/实现问题/理解偏差）→ 分发（后端/前端/Mock）
3. 接收集成测试报告 → 提取Bug → 分配给Debug Agent → 跟踪修复状态
4. 最终门禁检查

**可复用Stage3的Pipeline Coordinator实例**（上下文已有全局视图），或使用独立轻量Agent。
```

### 4.9 风险矩阵扩充

> 原文第十章只有6项风险，扩充为完整风险矩阵：

```markdown
## 十、风险与应对（完整矩阵）

### 10.1 流程风险

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| PRD不完整或模糊 | 中 | 后续全返工 | Stage1 MECE评审 + 质量门禁（见R2-2.6）|
| Schema中途变更 | 中 | 受影响模块返工 | 分表锁定（见R2-3.9）+ 变更评审 |
| ↺循环超3轮 | 低 | 进入人类降级 | 自动裁决作为兜底（见R3-4.4）|
| 模块间接口不匹配 | 高 | 集成失败 | Code Review强制检查 + Mock前置验证（见R2-3.3）|
| Mock与真实API不一致 | 中 | 前端联调返工 | Mock持续验证（R2-3.3）+ Mock同步协议（R3-4.5）|

### 10.2 技术风险

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| 隐式依赖遗漏 → 死锁 | 低 | 调度阻塞 | 依赖图自动校验（R2-3.4）|
| 模块间数据竞争 | 低-中 | 数据不一致 | 数据竞争检测（R3-4.6）|
| 上下文窗口溢出 | 中 | Agent质量下降 | 上下文管理策略（R3-4.3）|
| 产出物文件损坏 | 低 | 下游读取出错 | 完整性自动校验（R3-4.7）|

### 10.3 运维风险

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| Coordinator崩溃 | 低 | Stage3全停 | 状态持久化+恢复协议（R3-4.1）|
| Agent崩溃 | 低 | 单模块阻塞 | 失败恢复模型（R1-2.3）|
| 人类不在线阻塞决策 | 中 | 流程挂起 | 自动降级矩阵（R3-4.4）|
| Bug修复引入新问题 | 中 | 回归失败 | 每次修复补充回归测试 |

### 10.4 质量风险

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| 测试用例写错但通过审查 | 中 | 假通过 | Stage4实际执行才能暴露（无法前置避免）|
| 前端等待后端（Mock中断） | 低 | 前端并行度下降 | Mock独立服务，不依赖后端 |
| BLOCKED长期不解决 | 中 | 依赖链阻塞 | 超时降级分配（R3-4.4）|
```

### 4.10 BLOCKED处理闭环

```markdown
### BLOCKED标记生命周期

```
Agent标记 BLOCKED
  ↓
Coordinator下一轮扫描发现BLOCKED
  ↓
Coordinator读取BLOCKED文件内容 → 判断阻塞类型：
  ├── 依赖未就绪 → 等待依赖模块DONE → 自动解除
  ├── 契约问题 → 走变更申请流程（R3-4.5）
  ├── Agent自身问题 → 重试协议（R1-2.3）
  └── 未知/其他 → 升级给人类
  ↓
BLOCKED超时（见R3-4.4自动降级矩阵）：
  ├── 可降级 → 跳过模块，标记WARNING，继续流程
  └── 不可降级 → 等待人类决策
  ↓
阻塞解除：
  1. 删除或重命名BLOCKED文件为BLOCKED.resolved
  2. 模块回「未分配」状态
  3. 下一轮调度重新分配
```

**BLOCKED文件格式**（已在SKILL.md定义，确保白皮书引用一致）：

```yaml
module: <module_name>
agent: <agent_name>
blocked_at: "YYYY-MM-DD HH:MM:SS"
blocked_by: <dependency_module_or_issue>
reason: |
  [多行描述阻塞原因]
action_required: <coordinator/architect/human>
suggested_fix: <optional>
timeout_minutes: 120  # 超时分钟数，Coordinator以此触发降级
```
```

---

## 五、三轮迭代效果对比

| 维度 | 原始白皮书 | Round 1 | Round 2 | Round 3 |
|------|----------|---------|---------|---------|
| **理论覆盖度** | 10项缺失 | 补全8项核心理论 | 补充粒度优化 | 理论框架完整 |
| 迭代模型 | ❌ 无 | ✅ 全量/增量双模式 | — | ✅ |
| 回退/回滚 | ❌ 无 | ✅ 4级回退协议 | — | ✅ |
| Agent失败恢复 | ❌ 无 | ✅ 5类失败+恢复策略 | — | ✅ |
| 人类决策框架 | ⚠️ 仅1个决策点 | ✅ 6个决策点+离线策略 | — | ✅ |
| 可观测性 | ❌ 无 | ✅ 状态持久化JSON | — | ✅ |
| **执行准确性** | 10项模糊/缺失 | — | 修复10项执行细节 | 补充2项 |
| 拷问审查Skill/Agent | ⚠️ 边界模糊 | ✅ 明确定义 | — | ✅ |
| 测试验证环节 | ❌ 无 | — | ✅ ③c静态审查 | — |
| Mock一致性 | ⚠️ 后置 | — | ✅ Stage3前置验证 | ✅ 同步协议 |
| 前端测试方法论 | ❌ 无 | ✅ 三层测试 | — | — |
| Schema锁定粒度 | ⚠️ 全局锁 | — | ✅ 分表锁定 | — |
| **稳定性** | 10项风险 | — | — | 修复10项稳定性 |
| Coordinator单点 | ❌ 无保护 | ✅ 状态持久化 | — | ✅ 恢复协议+原子写 |
| 产出物版本控制 | ❌ 无 | — | — | ✅ Git+元数据 |
| 上下文溢出防护 | ❌ 无 | — | — | ✅ 5策略 |
| 人类离线阻塞 | ⚠️ 无方案 | ✅ 自动策略 | — | ✅ 降级矩阵 |
| BLOCKED闭环 | ⚠️ 半截 | ✅ 生命周期 | — | ✅ 完整生命周期 |
| 风险矩阵 | ⚠️ 6项 | — | — | ✅ 16项（4类） |

---

## 六、实施优先级建议

| 优先级 | 实施内容 | 理由 |
|--------|---------|------|
| 🔴 P0-立即 | R1-2.3 Agent失败恢复模型 | 没有恢复机制，Stage3执行期随时可能卡死 |
| 🔴 P0-立即 | R2-3.2 测试用例静态审查 ③c | 只写不验证，错了一个月后Stage4才发现 |
| 🔴 P0-立即 | R3-4.1 Coordinator状态持久化 | 单点无恢复，Coordinator崩溃=全流程报废 |
| 🟡 P1-本周 | R1-2.1 迭代模型 | 影响后续所有迭代周期的编排 |
| 🟡 P1-本周 | R1-2.4 人类决策框架完整化 | 多次人类决策点是高频场景 |
| 🟡 P1-本周 | R2-3.9 Schema分表锁定 | 直接提升Stage3并行度 |
| 🟡 P1-本周 | R3-4.10 BLOCKED处理闭环 | 高频阻塞场景 |
| 🟠 P2-下迭代 | R1-2.7 前端测试方法论 | 与现有Mock流程兼容，可渐进引入 |
| 🟠 P2-下迭代 | R3-4.2 产出物版本控制 | 在首次↺循环多轮修改时才触发需求 |
| 🟢 P3-可选 | R2-3.8 推送/Pull模式澄清 | 描述性澄清，不影响执行 |
| 🟢 P3-可选 | R2-3.10 信息集中化 | 非功能性，渐进收敛 |

---

*本文档供白皮书迭代优化参考。三个轮次可在3个独立PR中实施，每轮通过后评估效果再进入下一轮。*
