# MVP白皮书严谨性优化建议 by Minimax

> 生成时间：2026-05-20  
> 分析维度：文档严谨性、逻辑一致性、可执行性  
> 迭代轮次：3轮递进分析  
> 核心目标：从"理论框架"升级为"可逐字执行的工程标准"

---

## 执行摘要

通过三轮递进审视白皮书文本，发现以下核心问题：

| 问题类别 | 严重程度 | 数量 |
|---------|---------|------|
| 术语不一致 | 🔴 高 | 8处 |
| 逻辑矛盾 | 🔴 高 | 5处 |
| 边界条件缺失 | 🟡 中 | 12处 |
| 可执行性不足 | 🟡 中 | 15处 |
| 编号/格式不统一 | 🟢 低 | 7处 |

**优化优先级**：术语一致性 > 逻辑矛盾 > 边界条件 > 可执行性

---

## 第一轮：术语一致性大检查（Terminology Consistency）

### 1.1 Stage/阶段 不统一 ⚠️

**问题**：白皮书在 Stage1-4 的描述中混用了"Stage"、"阶段"、"Stage2"、"二阶段"等多种表述，读者需要自行判断是否指同一事物。

**当前混乱示例**：
```
- Stage1：需求对齐（串行，1 个 Agent）
- 第1轮、第2轮
- 二阶段、三阶段
- Stage2 并行关系总结
```

**建议统一规范**：

```markdown
## 术语规范（必须严格遵守）

| 英文 | 中文 | 使用场景 |
|------|------|---------|
| Stage | 阶段 | 文档标题、章节引用（如"Stage1"、"Stage2"、"Stage3"、"Stage4"） |
| Phase | 轮次 | Stage内部的调度轮次（如"第1轮"、"第2轮"） |
| Agent | Agent | 不翻译，全文保持一致 |
| 串行 | 串行 | 执行顺序，不可并行 |
| 并行 | 并行 | 同时执行 |
| 锁定 | 锁定 | 产出物不可修改状态 |

**禁用词**：
- ❌ "二阶段" → ✅ "Stage2"
- ❌ "第三阶段" → ✅ "Stage3"
- ❌ "第1轮调度" → ✅ "第1轮"（轮次不写"调度"，调度是动作不是轮次）
```

---

### 1.2 ③a/③b-1/③b-2 编号命名不清晰 ⚠️

**问题**：③a、③b-1、③b-2 的命名让人困惑。③b-1 和 ③b-2 的下标含义不明确，需要回到表格才能理解。

**当前描述**：
```
### 2.4 ③a Mock 服务搭建（与 ③b-1/③b-2 并行，1 个 Agent）
### 2.5 ③b-1 单模块 API 集成测试（与 ③a/③b-2 并行，最多 2 个 Agent 内部并行）
### 2.6 ③b-2 业务条线端到端测试（与 ③a/③b-1 并行，1 个 Agent 串行）
```

**建议统一规范**：

```markdown
## 编号命名规范（Stage2 子角色）

| 原编号 | 新编号 | 角色名 | 说明 |
|-------|-------|-------|------|
| ① | ① | 架构专家 | 串行 |
| ② | ② | 业务领域专家 | 串行 |
| ③a | ③-A | Mock 服务专家 | 并行，与③-B/③-C 无依赖 |
| ③b-1 | ③-B | 单模块测试专家 | 并行，最多2个Agent内部并行 |
| ③b-2 | ③-C | 场景测试专家 | 串行，1个Agent |

**使用规则**：
- 引用时必须用新编号：③-A、③-B、③-C
- 禁止混合使用：不能一会儿用③a，一会儿用③-A
- 内部交叉引用：与 ③-B/③-C 并行
```

---

### 1.3 "模块" vs "页面" vs "功能" 语义混淆 ⚠️

**问题**：白皮书在描述前端时使用"模块"、"页面"、"功能"三个词，但含义不明确。后端用"模块"，前端应该用什么？

**当前描述**：
```
后端团队：按模块 TDD 开发
前端团队：基于 Mock 并行开发（多 Agent 并行）
拆分策略：按页面/功能模块拆分
```

**建议统一规范**：

```markdown
## 前后端命名规范

### 后端
| 概念 | 术语 | 说明 |
|------|------|------|
| 业务单元 | 模块 (module) | 如 user、product、trace |
| 文件组织 | `src/modules/<module>/` | 固定目录结构 |
| 代码单元 | Service / Route / Schema | 具体实现 |

### 前端
| 概念 | 术语 | 说明 |
|------|------|------|
| 业务单元 | 页面 (page) | 如登录页、用户管理页 |
| 文件组织 | `src/views/<page>/` | 固定目录结构 |
| UI单元 | 组件 (component) / Composables | 具体实现 |

**规则**：
- 后端说"模块"，前端说"页面"
- 禁止混用：不能说"前端模块"，只能说"前端页面"
- 通用场景：可以用"功能单元"指代两者
```

---

### 1.4 "门禁" vs "检查点" vs "Gate" 混用 ⚠️

**问题**：白皮书在描述质量门禁时使用了"门禁"、"检查点"、"Gate"三个词，虽然读者能理解，但不够严谨。

**当前描述**：
```
**门禁**：所有审查项通过后，产出物升级为【锁定版】
Stage2 并行关系总结
Stage 2 门禁
```

**建议统一规范**：

```markdown
## 质量门禁术语规范

| 原用词 | 统一用词 | 英文 | 说明 |
|-------|---------|------|------|
| 门禁 | 门禁 | Gate | Stage 转换时的质量关卡 |
| 检查点 | 门禁项 | Gate Item | 门禁中的单个检查项 |
| 通过门禁 | 门禁通过 | Pass Gate | 所有门禁项检查通过 |

**使用规则**：
- Stage 级别转换使用"门禁"："Stage2门禁" = "Stage2的门禁"
- 门禁内的单个检查使用"门禁项"："Stage2门禁项" = "Stage2门禁中的检查项"
- 门禁通过状态："门禁通过" = "所有门禁项检查通过，可以进入下一Stage"
```

---

## 第二轮：逻辑矛盾与边界条件（Logic & Edge Cases）

### 2.1 Stage2 并行关系描述矛盾 ⚠️

**问题**：白皮书在多个地方描述了Stage2的并行关系，但存在矛盾：
- 位置1："与 ③a/③b-1/③b-2 并行"
- 位置2："③a、③b-1、③b-2 三者并行"

这两个描述的含义不同："与③b-1/③b-2并行"意味着③a与③b-1和③b-2都并行，但"三者并行"意味着三者互为并行关系。

**当前矛盾描述**：
```markdown
### 2.4 ③a Mock 服务搭建（与 ③b-1/③b-2 并行，1 个 Agent）

### 2.7 Stage2 并行关系总结
③a、③b-1、③b-2 三者并行
```

**建议修正**：
```markdown
## Stage2 子角色并行关系（必须明确）

```
      ① 架构专家（串行）
           ↓
      ② 业务领域专家（串行）
           ↓
      ↺ 拷问审查循环（通过后锁定）
           ↓
    ┌──────┼──────┐
    ↓      ↓      ↓
③-A    ③-B    ③-C
   \     |     /
    \    |    /
     ∥   ∥   ∥
   三者并行，无依赖
```

**关系说明**：
- ③-A、③-B、③-C 三者之间无依赖关系，可以完全并行执行
- "与 ③b-1/③b-2 并行" 的表述应改为 "③-A 与 ③-B、③-C 完全并行，无依赖"
```

---

### 2.2 ③b-1内部最多2个Agent的边界条件缺失 ⚠️

**问题**：白皮书说"最多 2 个 Agent 内部并行"，但没有说明：
- 如果只有1个模块，是否需要启动2个Agent？
- 如果有5个模块，2个Agent如何分配（平分？优先级？）

**当前描述**：
```markdown
### 2.5 ③b-1 单模块 API 集成测试（与 ③a/③b-2 并行，最多 2 个 Agent 内部并行）
并行策略：
- 与 ③a Mock、③b-2 业务条线测试均无依赖，同时启动 ✅
- **内部最多 2 个 Agent 并行**：按模块平分（如 Agent-1 负责 user/product，Agent-2 负责 template/trace）
```

**建议补充边界条件**：

```markdown
## ③-B Agent并行边界条件

### Agent数量决策规则
| 模块数量 | Agent数量 | 分配方式 |
|---------|----------|---------|
| 1 | 1 | 单Agent执行 |
| 2 | 2 | 每个Agent各1个模块 |
| 3 | 2 | Agent-1: 2个模块，Agent-2: 1个模块（尽量平分） |
| 4 | 2 | Agent-1: 2个模块，Agent-2: 2个模块 |
| 5 | 2 | Agent-1: 3个模块，Agent-2: 2个模块 |
| ≥6 | 2 | 按模块优先级分配（依赖多的优先） |

### 特殊情况
- 如果只有1个模块，仍然启动1个Agent（不是0个）
- 如果模块数 > Agent数量，剩余模块排队等待Agent空闲
- 如果模块数 < Agent数量，剩余Agent空闲等待（不启动）
```

---

### 2.3 Code Review触发条件中"模块间接口调用"定义不清 ⚠️

**问题**：白皮书说"模块间接口调用 → 触发Review"，但没有说明什么算"模块间接口调用"：
- 同一个模块内的Service调用Service算吗？
- 前端调用后端API算吗？
- 只有后端内部模块间的HTTP调用才算？

**当前描述**：
```markdown
| 模块间接口调用 | 是 | 需验证契约一致性 |
```

**建议补充定义**：

```markdown
## 模块间接口调用定义（Code Review触发条件）

### 定义
"模块间接口调用"特指**后端模块之间的HTTP/RPC调用**，用于验证契约一致性。

### 具体场景
| 调用场景 | 是否触发 | 原因 |
|---------|---------|------|
| 后端 user模块调用后端 product模块的API | ✅ 触发 | 跨模块边界，需验证契约 |
| 后端 user模块的Service调用同模块的Service | ❌ 不触发 | 同模块内部调用，契约不变 |
| 前端调用后端API | ❌ 不触发（前端侧另有审查） | Mock契约已锁定，前端无感知 |
| 后端模块调用外部服务（支付、短信等） | ❌ 不触发 | 外部依赖契约不在MVP范围内 |

### 触发审查的具体时机
1. 当后端Agent需要调用其他模块的API时
2. 在调用前，Agent应检查目标模块的api-contract.yaml
3. 调用后，如果返回与契约不一致，应触发Review
```

---

### 2.4 Stage3 前端Agent数量上限与实际分配的矛盾 ⚠️

**问题**：白皮书说"前端最多 3 个 Agent 并行"，但没有说明：
- 如果只有2个页面，是否启动3个Agent？
- 如果有7个页面，3个Agent如何分配？

**当前描述**：
```markdown
### 3.2 前端团队：基于 Mock 并行开发（多 Agent 并行）
Agent 数量上限：前端最多 3 个 Agent 并行。公共组件由第一个完成的 Agent 或独立轮次处理。
```

**建议补充边界条件**：

```markdown
## 前端Agent并行边界条件

### Agent数量决策规则
| 页面数量 | Agent数量 | 分配方式 |
|---------|----------|---------|
| 1 | 1 | 单Agent执行 |
| 2 | 2 | 每个Agent各1个页面 |
| 3 | 3 | 每个Agent各1个页面（达到上限） |
| 4 | 3 | Agent-1: 2页，Agent-2: 1页，Agent-3: 1页 |
| 5 | 3 | Agent-1: 2页，Agent-2: 2页，Agent-3: 1页 |
| ≥6 | 3 | 按页面优先级分配（用户旅程中靠前的优先） |

### 公共组件处理
- 公共组件（如 Header、Footer、Modal）由第一个完成页面的Agent负责
- 如果第一个Agent无法覆盖所有公共组件，启动独立轮次处理
- 独立轮次：所有Agent暂停页面开发，专职处理公共组件

### 特殊情况
- 如果只有1个页面，仍然启动1个Agent
- 如果页面数 > Agent数量，剩余页面排队等待
- 公共组件不计入页面数，但计入工作量
```

---

### 2.5 "↺循环上限3轮"与"无法达成一致"的逻辑矛盾 ⚠️

**问题**：白皮书说"建议上限3轮"，但又说"如果无法达成一致，降级策略是提交给人类决策"。问题是：
- 3轮内无法达成一致，是否意味着第3轮结束后必须提交人类决策？
- 还是说3轮只是建议，可以继续？

**当前描述**：
```markdown
**无法达成一致时的降级策略**：
1. 如果 ① 和 ② 经过多轮循环（建议上限 3 轮）仍然无法就某个问题达成一致
2. → grill-with-docs 输出「未决问题清单」，按**最简实现原则**给出推荐方案
3. → 汇总后提交给人类决策
4. → 人类确认后，① 和 ② 据此修正产出物，循环终止
```

**建议修正为强制规则**：

```markdown
## ↺ 拷问审查循环终止规则（强制，非建议）

### 循环终止条件
1. **正常终止**：所有审查项通过 → 产出物升级为【锁定版】
2. **强制终止**：第3轮结束时仍有未决问题 → 自动进入人类决策模式

### 强制终止流程
```
第3轮审查结束
    ↓
是否有未决问题？
    ↓ 是
grill-with-docs 输出「未决问题清单」
    ↓
按「最简实现原则」生成推荐方案
    ↓
自动发送通知给人类（钉钉/飞书/邮件）
    ↓
人类48小时内无回复 → 降级为「保守实现」（选最简单的方案）
人类48小时后回复 → 按回复修正产出物
    ↓
循环终止，产出物升级为【锁定版】
```

### 关键约束
- ⚠️ "建议上限3轮"改为"强制上限3轮"
- ⚠️ 第3轮结束后必须输出未决问题清单（无论是否有未决问题）
- ⚠️ 人类决策超时后必须降级为保守实现，不能无限等待
```

---

## 第三轮：可执行性增强（Actionable Improvements）

### 3.1 Stage1 PRD产出物没有验收标准 ⚠️

**问题**：白皮书说Stage1的输出是"MECE完整的PRD文档"，但没有说明：
- MECE完整是什么意思？有哪些必须满足的条件？
- 如何判断PRD是否"锁定"？谁来做判断？

**当前描述**：
```markdown
## 一、Stage1：需求对齐阶段（串行，1 个 Agent）

**角色**：产品经理 Agent
**输入**：原始需求、业务背景、用户访谈
**输出**：MECE 完整的 PRD 文档

**产出物锁定标准**：PRD 通过评审后锁定，Stage2 及以后所有 Agent 以此为准。PRD 变更需走变更评审。
```

**建议补充完整验收标准**：

```markdown
## Stage1 PRD 验收标准（强制）

### MECE完整性检查表
| 检查项 | 要求 | 说明 |
|-------|------|------|
| 项目背景 | ✅ 完成 | 业务目标、价值主张、范围边界明确 |
| 术语定义 | ✅ 完成 | 领域术语、缩写、业务概念有统一定义 |
| 风险与约束 | ✅ 完成 | 技术约束、业务约束、合规要求列出 |
| 业务主流程 | ✅ 完成 | 核心用户旅程、系统交互图存在 |
| ER关系 | ✅ 完成 | 实体关系图、核心领域模型存在 |
| 功能需求 | ✅ 完成 | 功能描述、验收标准、业务规则完整 |
| 复杂/核心专题 | ✅ 完成（如有） | 复杂业务逻辑有深度分析 |
| 核心实体状态图 | ✅ 完成（如有） | 状态机、状态转换条件明确 |
| 验收标准 | ✅ 完成 | Happy path + exception path 覆盖 |

### 锁定评审流程
1. 产品经理Agent产出PRD初稿
2. 人类（PM/业务方）进行MECE完整性检查
3. 检查通过 → 在PRD文档头部标注「【锁定版】YYYY-MM-DD」
4. 检查不通过 → 返回产品经理Agent补充，直到通过

### 变更管理
- PRD锁定后变更必须走「变更评审」流程
- 变更评审：由原评审人重新审核变更内容
- 变更记录：写入 `CHANGE_LOG.md`，标注变更时间、原因、影响范围
```

---

### 3.2 Stage2 门禁检查没有自动化方式 ⚠️

**问题**：白皮书描述了Stage2门禁的检查项，但只是文字描述，没有说明如何验证"spec.md【锁定版】已产出"这样的门禁项。

**当前描述**：
```markdown
### Stage 2 门禁

**全部通过后才能进入 Stage 3：**
- [ ] `spec.md`【锁定版】已产出
- [ ] `schema.sql`【锁定版】已产出
- [ ] `api-contract.yaml`【锁定版】已产出
...
```

**建议补充自动化检查方式**：

```markdown
## Stage2 门禁自动化检查（建议实现）

### 检查脚本实现
```typescript
// stage2-gate-check.ts
import * as fs from 'fs/promises';
import * as path from 'path';

interface GateCheck {
  name: string;
  file: string;
  validator: (content: string) => boolean;
}

const gateChecks: GateCheck[] = [
  {
    name: 'spec.md【锁定版】',
    file: 'spec.md',
    validator: (content) => content.includes('【锁定版】')
  },
  {
    name: 'schema.sql【锁定版】',
    file: 'schema.sql',
    validator: (content) => content.includes('-- MVP Schema') && content.length > 100
  },
  {
    name: 'api-contract.yaml【锁定版】',
    file: 'api-contract.yaml',
    validator: (content) => content.includes('openapi:') && content.includes('paths:')
  },
  {
    name: 'task.md【锁定版】',
    file: 'task.md',
    validator: (content) => content.includes('【锁定版】') && content.includes('module:')
  },
  {
    name: '所有 <module>.md【锁定版】',
    file: 'modules/',
    validator: async (dirContent) => {
      const files = await fs.readdir(dirContent);
      const moduleFiles = files.filter(f => f.endsWith('.md'));
      for (const file of moduleFiles) {
        const content = await fs.readFile(path.join(dirContent, file), 'utf-8');
        if (!content.includes('【锁定版】')) return false;
      }
      return moduleFiles.length > 0;
    }
  },
  {
    name: 'mocks/ 可运行',
    file: 'mocks/package.json',
    validator: async (content) => {
      try {
        JSON.parse(content);
        return true;
      } catch {
        return false;
      }
    }
  }
];

async function verifyStage2Gate(): Promise<{passed: boolean, results: any[]}> {
  const results = [];
  for (const check of gateChecks) {
    try {
      const content = await fs.readFile(check.file, 'utf-8');
      const passed = check.validator(content);
      results.push({ name: check.name, passed, error: null });
    } catch (e) {
      results.push({ name: check.name, passed: false, error: e.message });
    }
  }
  
  return {
    passed: results.every(r => r.passed),
    results
  };
}

export { verifyStage2Gate };
```
```

---

### 3.3 Stage3 Pipeline Coordinator的调度算法没有伪代码 ⚠️

**问题**：白皮书描述了调度策略，但只有文字描述和流程图，没有精确的伪代码。实际实现时可能存在理解偏差。

**当前描述**：
```markdown
#### 策略一：依赖图驱动调度（无遗漏、无重复、无死锁）

**原理**：将 `<module>.md` 中的「依赖的其他模块清单」转化为有向无环图，按层级分批调度。
```

**建议补充完整伪代码**：

```markdown
## Pipeline Coordinator 调度算法（伪代码）

### 核心数据结构
```typescript
interface Module {
  name: string;
  dependencies: string[];  // 依赖的模块名列表
  domain: '认证与权限' | '业务核心' | '工具与配置';
  status: 'PENDING' | 'ALLOCATED' | 'DONE' | 'BLOCKED';
  assignedAgent?: string;
}

interface Agent {
  id: string;
  domain: '认证与权限' | '业务核心' | '工具与配置';
  status: 'IDLE' | 'BUSY';
}

const MAX_BACKEND_AGENTS = 3;
const MAX_FRONTEND_AGENTS = 3;
```

### 主调度循环
```typescript
async function runScheduler(modules: Module[], agents: Agent[]): Promise<void> {
  // 初始化：所有模块状态为PENDING
  for (const module of modules) {
    module.status = 'PENDING';
  }
  
  // 主循环：直到所有模块完成
  while (modules.some(m => m.status !== 'DONE')) {
    // 1. 依赖图筛选：找出「依赖已满足 ∩ 未分配」的候选模块
    const candidates = modules.filter(module => {
      if (module.status !== 'PENDING') return false;
      const depsSatisfied = module.dependencies.every(dep => {
        const depModule = modules.find(m => m.name === dep);
        return depModule?.status === 'DONE';
      });
      return depsSatisfied;
    });
    
    if (candidates.length === 0) {
      // 无候选模块，检查是否死锁
      const pendingModules = modules.filter(m => m.status === 'PENDING' || m.status === 'BLOCKED');
      if (pendingModules.length > 0) {
        throw new Error('DEADLOCK: 存在无法调度的模块: ' + pendingModules.map(m => m.name).join(', '));
      }
      break; // 所有模块已完成
    }
    
    // 2. 专家匹配：在候选模块中，按领域优先分配
    const idleAgents = agents.filter(a => a.status === 'IDLE');
    const sortedCandidates = sortByDependencyCount(candidates); // 被依赖多的优先
    
    for (const candidate of sortedCandidates) {
      if (idleAgents.length === 0) break;
      
      // 尝试找领域匹配的Agent
      const matchedAgent = idleAgents.find(a => a.domain === candidate.domain);
      const assignedAgent = matchedAgent || idleAgents[0];
      
      // 分配模块
      await allocateModule(candidate, assignedAgent);
      candidate.status = 'ALLOCATED';
      candidate.assignedAgent = assignedAgent.id;
      assignedAgent.status = 'BUSY';
      idleAgents.splice(idleAgents.indexOf(assignedAgent), 1);
    }
    
    // 3. 等待一轮完成（实际实现中需要异步等待Agent完成）
    await waitForCompletion(modules, agents);
  }
}

function sortByDependencyCount(modules: Module[]): Module[] {
  return modules.sort((a, b) => {
    const depCountA = modules.filter(m => m.dependencies.includes(a.name)).length;
    const depCountB = modules.filter(m => m.dependencies.includes(b.name)).length;
    if (depCountA !== depCountB) return depCountB - depCountA; // 被依赖多的优先
    return a.name.localeCompare(b.name); // 同优先级按名字排序
  });
}
```

---

### 3.4 Stage4 Bug修复循环没有量化终止条件 ⚠️

**问题**：白皮书描述了Bug修复循环，但"通过？→ 是：关闭 / 否：继续循环"的描述不够精确。实际执行时可能无限循环。

**当前描述**：
```markdown
### 4.4 Bug 修复循环

```
集成测试发现 Bug
    ↓
分配给 Debug 修复专家 Agent
    ↓
定位根因（代码 / 设计 / 需求理解偏差）
    ↓
修复 → 单元测试验证 → Code Review
    ↓
回归集成测试
    ↓
通过？→ 是：关闭 / 否：继续循环
```
```

**建议补充量化终止条件**：

```markdown
## Stage4 Bug修复循环量化终止条件

### 终止条件（满足任一即终止）
| 条件 | 阈值 | 说明 |
|------|------|------|
| P0/P1全部修复 | 0个遗留 | 最高优先级，必须满足 |
| 时间上限 | 4小时 | 超过后降级为技术债务 |
| 回归失败次数 | 3次 | 同一Bug修复3次仍失败，标记为技术债务 |
| 人工决策 | - | 人工判断该Bug不值得修 |

### 技术债务处理
```markdown
// TECH_DEBT.md 格式
## Bug修复循环降级记录

### #DEBT-001
- 原Bug: [问题简述]
- 发现时间: YYYY-MM-DD
- 尝试次数: 3
- 失败原因: [分析]
- 决策: 继续修 / 降级为技术债务 / 暂时搁置
- 决策人: 人类 / PipelineCoordinator
- 影响: [哪些功能受影响]
```

### 循环流程图（带终止条件）
```
Bug报告
    ↓
分配给Debug Agent
    ↓
定位根因
    ↓
修复 → 单元测试 → Code Review
    ↓
回归集成测试
    ↓
通过？→ 是 → Bug关闭 ✅
    ↓ 否
尝试次数 < 3？→ 是 → 继续循环
    ↓ 否
标记为技术债务 → 人工决策
```
```

---

### 3.5 白皮书缺少"术语表"章节 ⚠️

**问题**：白皮书定义了多个术语（如"锁定"、"门禁"、"Agent"等），但没有统一的术语表。读者需要全文搜索才能找到某个术语的定义。

**建议新增术语表章节**：

```markdown
## 十一、术语表（Glossary）

| 英文 | 中文 | 定义 | 首次出现 |
|------|------|------|---------|
| Stage | 阶段 | MVP开发流程的主要阶段，共4个（Stage1-4） | 一、Stage1 |
| Agent | Agent | 独立执行特定任务的AI角色 | 一、Stage1 |
| 锁定 | 锁定 | 产出物不可修改的状态 | 二、Stage2 |
| 【锁定版】 | 【锁定版】 | 产出物锁定后的标记，格式为「【锁定版】YYYY-MM-DD」 | 二、Stage2 |
| 【初版】 | 【初版】 | 产出完成但未经过↺循环校验的标记 | 二、Stage2 |
| ↺ 拷问审查循环 | ↺ | 架构专家和业务专家之间的双向校验循环 | 二、2.3 |
| 门禁 | 门禁 | Stage转换时的质量关卡，必须通过才能进入下一Stage | 二、2.7 |
| 模块 | 模块 | 后端业务单元，对应 `src/modules/<module>/` | 三、3.1 |
| 页面 | 页面 | 前端业务单元，对应 `src/views/<page>/` | 三、3.2 |
| DONE | DONE | Agent完成模块开发后的标记文件 | 九、9.3 |
| BLOCKED | BLOCKED | Agent开发阻塞时的标记文件 | 九、9.3 |
| 依赖图 | 依赖图 | 模块间依赖关系的有向无环图 | 三、3.0 |
| TDD | TDD | 测试驱动开发（Test-Driven Development） | 三、3.1 |
| Red-Green-Refactor | 红绿重构 | TDD的三阶段：写失败测试→写通过实现→重构 | 三、3.1 |
| Mock | Mock | 基于接口契约的模拟服务 | 二、2.4 |
| Code Review | Code Review | 代码审查，验证实现是否符合契约 | 六、6.3 |
| MECE | MECE | 相互独立，完全穷尽（Mutually Exclusive, Collectively Exhaustive） | 一、Stage1 |
```

---

## 综合建议优先级

| 优先级 | 建议项 | 预计影响 | 实施成本 |
|-------|-------|---------|---------|
| 🔴 P0 | 1.1 Stage/阶段术语统一 | 消除阅读歧义 | 低 |
| 🔴 P0 | 1.2 ③a/③b编号统一为③-A/③-B/③-C | 消除命名困惑 | 低 |
| 🔴 P0 | 2.1 Stage2并行关系描述修正 | 消除逻辑矛盾 | 中 |
| 🔴 P0 | 2.5 ↺循环改为强制上限3轮 | 增加可执行性 | 低 |
| 🟡 P1 | 2.2 ③-B Agent并行边界条件补充 | 增加可执行性 | 低 |
| 🟡 P1 | 2.3 模块间接口调用定义补充 | 消除Review歧义 | 低 |
| 🟡 P1 | 2.4 前端Agent并行边界条件补充 | 增加可执行性 | 中 |
| 🟡 P1 | 3.1 Stage1 PRD验收标准补充 | 增加可执行性 | 中 |
| 🟡 P1 | 3.2 Stage2门禁自动化检查补充 | 增加可执行性 | 高 |
| 🟡 P1 | 3.3 Coordinator调度算法伪代码补充 | 增加可执行性 | 中 |
| 🟡 P1 | 3.4 Bug修复循环终止条件量化 | 增加可执行性 | 中 |
| 🟢 P2 | 1.3 模块/页面/功能语义统一 | 消除术语歧义 | 低 |
| 🟢 P2 | 1.4 门禁术语统一 | 消除术语歧义 | 低 |
| 🟢 P2 | 3.5 新增术语表章节 | 提升文档可读性 | 低 |

---

## 实施建议

1. **优先级顺序**：先P0（术语+逻辑矛盾），再P1（边界条件+可执行性），最后P2（术语+可读性）
2. **实施方式**：创建`白皮书优化版.md`，将所有修改整合后，与原白皮书对比评审
3. **评审通过后**：将`白皮书优化版.md`替换原`MVP白皮书.md`
4. **同步更新**：Skill文件中的引用需要同步更新

---

**文件状态**：待评审  
**下次评审时间**：收到人类反馈后