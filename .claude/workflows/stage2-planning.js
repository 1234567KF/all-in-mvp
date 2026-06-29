/**
 * Stage 2: 规划校验 — 架构 + 业务 + 审查循环 + Mock + 测试
 *
 * Dynamic Workflow 脚本（Claude Code 专有）
 * 自包含：prompt 内嵌，不依赖运行时读取 agents/*.md
 *
 * 用法:
 *   Workflow({ scriptPath: '.claude/workflows/stage2-planning.js', args: { prdPath: 'PRD.md' } })
 *
 * 模型分配:
 *   Architect / Grill Reviewer → deepseek-v4-pro
 *   Domain Expert / Mock / Test Writer / Test Reviewer → deepseek-v4-flash
 *
 * 输出: spec.md, schema.sql, api-contract.yaml, task.md, modules/*.md, mocks/, integration-tests/*
 */

// ─── Meta ───────────────────────────────────────────────────────────────────
const meta = {
  name: 'manual-driving-stage2',
  description: '规划校验 — 架构 + 业务 + 审查循环 + Mock + 测试',
  phases: [
    { title: '架构设计', detail: 'Architect → spec/schema/api-contract' },
    { title: '业务规划', detail: 'Domain Expert → task/modules' },
    { title: '交叉审查', detail: 'Grill Review ↺ 修正循环' },
    { title: 'Mock与测试', detail: 'Mock + 单元测试 + E2E → Test Review' },
  ],
};

// ─── 常量 ───────────────────────────────────────────────────────────────────
const MAX_GRILL_ROUNDS = 6;
const CONSECUTIVE_PASS_THRESHOLD = 2;

// ─── Prompt: Architect（压缩版）─────────────────────────────────────────────
const ARCHITECT_PROMPT = `你是一个系统架构师 Agent，负责基于锁定的 PRD 设计系统架构、数据库 Schema 和 API 契约。

## 核心产出物
| 产出物 | 格式 | 内容 |
|--------|------|------|
| spec.md | Markdown | 架构设计：模块划分、技术选型、分层架构、数据流 |
| schema.sql | SQL / Drizzle Schema | 数据库 Schema：所有表的字段、类型、约束、关系 |
| api-contract.yaml | YAML (OpenAPI 3.0) | 接口契约：路由、方法、请求/响应 DTO、错误码 |

## 技术栈（默认推荐，用户指定则遵从）
- Backend: Hono (TypeScript)
- Database: Drizzle ORM + SQLite
- Frontend: Vue 3 + Vite
- Testing: Vitest

## 约束
- Schema 全局唯一——所有模块共享同一数据库
- 接口契约是前后端唯一同步点
- DTO 设计覆盖所有 PRD 功能需求的输入输出
- 错误码统一规划：400/401/403/404/409/500
- 产出物标记为【初版】——经 Grill 审查通过后升级为【锁定版】

## 手动驾驶协议（IoC）
- MQAP: 先输出「架构理解确认清单」（技术方案+替代方案+风险），等待用户确认
- CEP: 确认后输出卡片式执行计划（全面性+难点+主线）
- 决策日志: 产出 decisions/stage2-arch-decisions.md（理解确认+CEP+技术决策+产出确认）`;

// ─── Prompt: Domain Expert（压缩版）─────────────────────────────────────────
const DOMAIN_EXPERT_PROMPT = `你是一个业务领域专家 Agent，负责基于 PRD 和架构产出物进行模块拆分、边界定义和验收标准制定。

## 核心产出物
| 产出物 | 内容 |
|--------|------|
| task.md | 任务全景图：所有模块清单、依赖关系（DAG 无环）、模块间通信方式 |
| modules/<module>.md | 每个模块的详细定义（每模块一个文件） |

## 每个 module.md 必须包含
1. 模块职责边界（做什么、不做什么）
2. 依赖的其他模块清单（供 Coordinator 依赖图调度）
3. 所属领域（认证与权限 / 业务核心 / 工具与配置）
4. 接口清单（路由、方法、DTO）
5. 数据库表（字段、类型、约束）
6. 验收标准（单功能 happy path + exception path）

## 约束
- 模块之间边界必须清晰，避免功能重叠
- 依赖关系必须无环
- 产出物标记为【初版】

## 手动驾驶协议（IoC）
- MQAP: 先输出「模块划分确认清单」，等待用户确认
- CEP: 确认后输出卡片式执行计划
- 决策日志: 产出 decisions/stage2-biz-decisions.md`;

// ─── Prompt: Grill Reviewer（压缩版）─────────────────────────────────────────
const GRILL_REVIEW_PROMPT = `你是一个拷问审查 Agent，负责对照 PRD 双向校验架构和业务产出物，确保一致性和完整性。

## 审查维度（4 项）
| 维度 | 检查内容 |
|------|---------|
| 需求覆盖完整性 | PRD 功能需求 → spec.md 都有对应接口/表？ |
| 模块边界合理性 | module docs 接口/表分配 ↔ schema + api-contract 一致？ |
| 术语一致性 | PRD/spec/module docs 同一概念同一术语？（警惕中英文混用） |
| 验收标准对齐 | module docs 验收标准 ↔ PRD 验收标准完全覆盖？ |

## 产出格式
逐项列出 PASS/FAIL 及原因。FAIL 项标明：文件路径 + 具体位置 + 修正建议。
如无问题，输出 "ZERO_FINDINGS"。

## 约束
- 对照 PRD 逐条审查，不遗漏
- 审查报告必须可操作（path + line + 修正建议）

## 手动驾驶协议（IoC）
- Grill 审查报告产出后需经人类审阅
- 决策日志: 产出 decisions/stage2-grill-decisions.md（审查报告+修正记录+通过状态）`;

// ─── Prompt: Fix（修正指令，flash 模型执行）─────────────────────────────────
const FIX_PROMPT = `你是一个修正 Agent，负责根据 Grill 审查报告修正架构和业务产出物。

## 修正原则
- 严格按照审查报告指出的问题修正，不做额外改动
- 修正后在变更处标注【已修正】
- 如涉及术语统一，全文同步替换
- 保持产出物的整体结构不变`;

// ─── Prompt: Mock Service（压缩版）──────────────────────────────────────────
const MOCK_PROMPT = `你是一个前后端 Mock 专家，负责基于锁定的接口契约为前端提供独立的 Mock 服务。

## 产出
mocks/ 目录：每个模块的 Mock 路由实现 + 模拟数据

## 约束
- 按模块组织：mocks/<module>/routes.ts
- Mock 数据有真实感（非空对象，合理示例数据）
- exception path 覆盖：参数校验失败、资源不存在、权限不足
- Mock 服务可独立运行（用于前端开发）

## 手动驾驶协议（IoC）
- MQAP 轻量版: 输出「Mock 覆盖确认清单」，等待用户确认
- 决策日志: 产出 decisions/stage2-mock-decisions.md`;

// ─── Prompt: Unit Test（压缩版）─────────────────────────────────────────────
const UNIT_TEST_PROMPT = `你是一个单模块 API 集成测试专家，负责基于验收标准和接口契约编写模块级集成测试用例。

## 产出
integration-tests/modules/<module>.test.ts

## 覆盖范围
- 接口输入/输出验证（请求参数校验、响应结构验证）
- 数据库读写正确性
- 异常路径（参数校验失败、资源不存在 404、权限不足 401/403、边界值）

## 约束
- 只写测试用例，不执行（Stage4 才运行）
- 测试间互相独立，不共享状态
- 使用 Vitest 语法
- 不依赖其他模块的测试数据

## 手动驾驶协议（IoC）
- MQAP 轻量版: 输出「测试覆盖确认清单」，等待用户确认
- 决策日志: 产出 decisions/stage2-test-decisions.md`;

// ─── Prompt: E2E Scenario Test（压缩版）─────────────────────────────────────
const SCENARIO_TEST_PROMPT = `你是一个业务条线端到端测试专家，负责基于 PRD 业务主流程编写跨模块场景测试用例。

## 产出
integration-tests/scenarios/<scenario>.test.ts

## 覆盖范围
- 完整用户旅程（从开始到结束的完整业务流程）
- 多模块协作流程（跨越 3+ 个模块的协作场景）
- 复合业务规则（涉及多个实体和状态转换的复杂场景）

## 约束
- 每个测试文件是一条完整故事线（以角色旅程组织，不以接口组织）
- 只写用例，不执行
- 使用 Vitest 语法

## 手动驾驶协议（IoC）
- MQAP 轻量版: 输出「场景测试覆盖确认清单」
- 决策日志: 产出 decisions/stage2-scenario-decisions.md`;

// ─── Prompt: Test Review（增强版 8 项检查）───────────────────────────────────────
const TEST_REVIEW_PROMPT = `你是一个测试用例静态审查 Agent，负责审查测试用例质量。只审查，不执行，不修改文件。

## 8 项检查

### 基础检查（缺失即 ERROR）
| # | 检查项 | 判定标准 |
|---|--------|--------|
| 1 | 文件存在性 | 每个模块都有对应测试文件且非空 → 缺失 = ERROR |
| 2 | API路由有效性 | test 引用的路由在 api-contract.yaml 中存在 → 无效 = ERROR |
| 3 | 场景覆盖完整性 | 场景测试覆盖 PRD 主流程所有步骤 → 缺失 = ERROR |
| 4 | fixture 类型一致性 | fixture 字段与 schema.sql 类型匹配 → 不匹配 = ERROR |

### 深度检查
| # | 检查项 | 判定标准 |
|---|--------|--------|
| 5 | 异常路径覆盖 | 每个接口的 exception path（400/401/403/404/409）有测试 → 缺失 = WARNING |
| 6 | 测试隔离性 | 测试间不共享状态、不依赖执行顺序 → 违反 = WARNING |
| 7 | 模块边界越界 | 模块测试不直接访问其他模块的 DB 表或内部函数 → 越界 = ERROR |
| 8 | 状态机转换测试 | PRD 定义的状态转换都有对应测试 → 缺失 = WARNING |

## 严重级别
- **ERROR**：阻断性，必须修复
- **WARNING**：影响质量，建议修复
- **INFO**：可选优化

## 通过标准
- 无 ERROR → PASS
- 无 ERROR + WARNING ≤ 模块数×2 → CONDITIONAL_PASS（需人工确认）
- 有 ERROR 或 WARNING 过多 → FAIL

## 产出格式
test-review-report.md：
1. 总结表格：每模块 8 项检查结果矩阵
2. ERROR 清单（path + line + 修正建议）
3. WARNING 清单
4. 审查结论：PASS / CONDITIONAL_PASS / FAIL`;

// ─── Test Review 结果解析（纯函数，供测试用）─────────────────────────────────

/**
 * 解析 test-review-report 的审查结论
 * @param {string} report - test-review-report.md 内容
 * @returns {{ conclusion: string, errorCount: number, warningCount: number, passed: boolean }}
 */
function parseTestReviewReport(report) {
  if (!report || typeof report !== 'string') {
    return { conclusion: 'FAIL', errorCount: 0, warningCount: 0, passed: false };
  }

  const errorMatches = report.match(/\bERROR\b/g);
  const warningMatches = report.match(/\bWARNING\b/g);
  const errorCount = errorMatches ? errorMatches.length : 0;
  const warningCount = warningMatches ? warningMatches.length : 0;

  let conclusion;
  if (report.includes('FAIL')) {
    conclusion = 'FAIL';
  } else if (report.includes('CONDITIONAL_PASS')) {
    conclusion = 'CONDITIONAL_PASS';
  } else if (report.includes('PASS')) {
    conclusion = 'PASS';
  } else {
    conclusion = errorCount > 0 ? 'FAIL' : (warningCount > 0 ? 'CONDITIONAL_PASS' : 'PASS');
  }

  return {
    conclusion,
    errorCount,
    warningCount,
    passed: conclusion !== 'FAIL',
  };
}

// ─── Grill 循环算法 ──────────────────────────────────────────────────────────

async function grillLoop(prdContent, archOutputs, bizOutputs) {
  let round = 0;
  let consecutiveZero = 0;
  let currentArch = { ...archOutputs };
  let currentBiz = { ...bizOutputs };
  const grillHistory = [];

  while (consecutiveZero < CONSECUTIVE_PASS_THRESHOLD && round < MAX_GRILL_ROUNDS) {
    round++;

    // 审查（pro 模型，深度分析）
    const reviewResult = await agent(
      `${GRILL_REVIEW_PROMPT}

## 当前审查轮次: Round ${round}

### PRD（基准）
${prdContent}

### 架构产出物（来自 Architect）
${currentArch.spec || ''}
${currentArch.schema || ''}
${currentArch.apiContract || ''}

### 业务产出物（来自 Domain Expert）
${currentBiz.task || ''}
${currentBiz.modules || ''}

请按 4 个审查维度逐项审查，输出审查报告。如无问题输出 ZERO_FINDINGS。`,
      {
        model: 'deepseek-v4-pro',
        label: `Grill-Round${round}`,
      }
    );

    grillHistory.push({ round, result: reviewResult });

    // 判断是否有发现
    const hasFindings = !reviewResult.includes('ZERO_FINDINGS') &&
      (reviewResult.includes('FAIL') || reviewResult.includes('ERROR'));

    if (!hasFindings) {
      consecutiveZero++;
      log(`Round ${round}: 零问题通过 (${consecutiveZero}/${CONSECUTIVE_PASS_THRESHOLD})`);
    } else {
      consecutiveZero = 0;
      log(`Round ${round}: 发现问题，进入修正`);

      // 重复问题检测：与前两轮比较
      if (round >= 3) {
        const prevTwo = grillHistory.slice(-3, -1).map(h => h.result);
        const hasRepeat = prevTwo.some(prev =>
          extractIssues(prev).some(issue =>
            reviewResult.includes(issue)
          )
        );
        if (hasRepeat) {
          log(`Round ${round}: 检测到重复问题，修正无效 → 标记 BLOCKED`);
          return { allPassed: false, reason: 'repeated_issues', history: grillHistory };
        }
      }

      // 修正（flash 模型，快速修改）
      const fixResult = await agent(
        `${FIX_PROMPT}

## Grill 审查报告（Round ${round}）
${reviewResult}

## 需要修正的架构产出物
${currentArch.spec || ''}
${currentArch.schema || ''}
${currentArch.apiContract || ''}

## 需要修正的业务产出物
${currentBiz.task || ''}
${currentBiz.modules || ''}

请根据审查报告逐项修正。修正后在变更处标注【已修正】。`,
        {
          model: 'deepseek-v4-flash',
          label: `Fix-Round${round}`,
        }
      );

      // 更新产出物（修正后的版本）
      if (fixResult.updatedArch) {
        currentArch = { ...currentArch, ...fixResult.updatedArch };
      }
      if (fixResult.updatedBiz) {
        currentBiz = { ...currentBiz, ...fixResult.updatedBiz };
      }
    }
  }

  const allPassed = consecutiveZero >= CONSECUTIVE_PASS_THRESHOLD;
  return {
    allPassed,
    rounds: round,
    history: grillHistory,
    finalArch: currentArch,
    finalBiz: currentBiz,
    reason: allPassed ? 'consecutive_pass' : 'max_rounds_reached',
  };
}

function extractIssues(reviewText) {
  // 提取 FAIL/ERROR 行作为问题标识
  return reviewText
    .split('\n')
    .filter(line => line.includes('FAIL') || line.includes('ERROR'))
    .map(line => line.trim())
    .filter(line => line.length > 10);
}

// ─── Grill 循环核心算法（纯函数，不依赖 agent 调用）──────────────────────
// 用于单元测试验证终止条件

function grillLoopPure(reviewResults, maxRounds = MAX_GRILL_ROUNDS, passThreshold = CONSECUTIVE_PASS_THRESHOLD) {
  let round = 0;
  let consecutiveZero = 0;
  const history = [];
  let blocked = false;
  let blockedReason = null;

  for (const reviewText of reviewResults) {
    if (consecutiveZero >= passThreshold || round >= maxRounds) break;
    round++;

    history.push({ round, result: reviewText });

    const hasFindings = !reviewText.includes('ZERO_FINDINGS') &&
      (reviewText.includes('FAIL') || reviewText.includes('ERROR'));

    if (!hasFindings) {
      consecutiveZero++;
    } else {
      consecutiveZero = 0;

      // 重复问题检测：与前两轮比较
      if (round >= 3) {
        const prevTwo = history.slice(-3, -1).map(h => h.result);
        const currentIssues = extractIssues(reviewText);
        const hasRepeat = prevTwo.some(prev =>
          extractIssues(prev).some(issue =>
            currentIssues.includes(issue)
          )
        );
        if (hasRepeat) {
          blocked = true;
          blockedReason = 'repeated_issues';
          break;
        }
      }
    }
  }

  const allPassed = consecutiveZero >= passThreshold;
  return {
    allPassed,
    rounds: round,
    consecutiveZero,
    history,
    blocked,
    blockedReason,
    reason: blocked ? blockedReason : (allPassed ? 'consecutive_pass' : 'max_rounds_reached'),
  };
}

// ─── 主执行流程 ──────────────────────────────────────────────────────────────

async function execute(args) {
  const { prdPath } = args;

  if (!prdPath) {
    throw new Error('Stage2 缺少必需参数: args.prdPath');
  }

  const prdContent = await readFile(prdPath);

  // ── 串行段：pipeline 模式 ──────────────────────────────────────────────

  // 阶段①: Architect (pro)
  log('Stage2: 开始阶段① — Architect');
  const archResult = await agent(
    `${ARCHITECT_PROMPT}

## 当前任务
基于以下已锁定的 PRD，设计系统架构、数据库 Schema 和 API 契约。

### PRD（锁定版）
${prdContent}

请产出 spec.md、schema.sql、api-contract.yaml 的内容。`,
    {
      model: 'deepseek-v4-pro',
      label: 'Architect',
    }
  );

  // 阶段②: Domain Expert (flash)
  log('Stage2: 开始阶段② — Domain Expert');
  const bizResult = await agent(
    `${DOMAIN_EXPERT_PROMPT}

## 当前任务
基于以下 PRD 和架构产出物，进行模块拆分和业务规划。

### PRD（锁定版）
${prdContent}

### 架构产出物（初版）
${archResult}

请产出 task.md 和每个模块的 module.md 内容。`,
    {
      model: 'deepseek-v4-flash',
      label: 'Domain-Expert',
    }
  );

  // 阶段↺: Grill Review Loop (pro for review, flash for fix)
  log('Stage2: 开始阶段↺ — Grill Review Loop');
  const grillResult = await grillLoop(prdContent, archResult, bizResult);

  if (!grillResult.allPassed) {
    log(`Stage2 Grill 循环未通过: ${grillResult.reason}，标记 BLOCKED`);
    return {
      status: 'blocked',
      reason: `Grill loop failed: ${grillResult.reason}`,
      rounds: grillResult.rounds,
      history: grillResult.history,
    };
  }

  log(`Stage2 Grill 通过: ${grillResult.rounds} 轮后连续 ${CONSECUTIVE_PASS_THRESHOLD} 轮零发现`);

  // 写入锁定版产出物
  const finalArch = grillResult.finalArch || archResult;
  const finalBiz = grillResult.finalBiz || bizResult;

  await writeFile('spec.md', finalArch.spec || finalArch);
  await writeFile('schema.sql', finalArch.schema || '');
  await writeFile('api-contract.yaml', finalArch.apiContract || '');
  await writeFile('task.md', finalBiz.task || finalBiz);

  // 写入各 module.md
  if (finalBiz.modules) {
    const modules = typeof finalBiz.modules === 'object' ? finalBiz.modules : {};
    for (const [name, content] of Object.entries(modules)) {
      await writeFile(`modules/${name}.md`, content);
    }
  }

  // ── 并行段：barrier（串行段全部通过后才进入）──────────────────────────

  log('Stage2: 进入并行段 — Mock + Tests');

  const parallelResults = await parallel([
    // ③a: Mock Service (flash)
    async () => {
      log('Stage2 ③a: Mock Service');
      return agent(
        `${MOCK_PROMPT}

## 当前任务
基于以下锁定的接口契约和模块清单，搭建 Mock 服务。

### api-contract.yaml（锁定版）
${finalArch.apiContract || ''}

### task.md（锁定版）
${finalBiz.task || ''}

请产出 mocks/ 目录下各模块的 Mock 路由和模拟数据。`,
        { model: 'deepseek-v4-flash', label: 'Mock-Service' }
      );
    },

    // ③b-1: Unit Tests (flash, 最多2并行)
    async () => {
      log('Stage2 ③b-1: Unit Tests');
      return agent(
        `${UNIT_TEST_PROMPT}

## 当前任务
为每个模块编写集成测试用例。

### 各模块验收标准（锁定版）
${finalBiz.modules || ''}

### api-contract.yaml（锁定版）
${finalArch.apiContract || ''}

请产出 integration-tests/modules/<module>.test.ts 文件内容。`,
        { model: 'deepseek-v4-flash', label: 'Unit-Tests' }
      );
    },

    // ③b-2: E2E Scenario Tests (flash, 串行)
    async () => {
      log('Stage2 ③b-2: E2E Scenario Tests');
      return agent(
        `${SCENARIO_TEST_PROMPT}

## 当前任务
基于 PRD 业务主流程编写跨模块场景测试用例。

### PRD（锁定版）— 业务主流程 + 验收标准章节
${prdContent}

### task.md（锁定版）— 跨模块依赖关系
${finalBiz.task || ''}

请产出 integration-tests/scenarios/<scenario>.test.ts 文件内容。`,
        { model: 'deepseek-v4-flash', label: 'E2E-Tests' }
      );
    },
  ]);

  // ③c: Test Review (flash) — 等并行段全部完成
  log('Stage2 ③c: Test Review（并行段完成后）');
  const testReviewResult = await agent(
    `${TEST_REVIEW_PROMPT}

## 当前任务
审查以下测试用例的质量。

### task.md（模块清单）
${finalBiz.task || ''}

### api-contract.yaml
${finalArch.apiContract || ''}

### schema.sql
${finalArch.schema || ''}

### PRD（业务主流程章节）
${prdContent}

请按 4 项检查维度逐项审查，产出 test-review-report.md。`,
    { model: 'deepseek-v4-flash', label: 'Test-Review' }
  );

  await writeFile('test-review-report.md', testReviewResult);

  // 检查 Test Review 是否通过（使用结构化解析）
  const reviewAnalysis = parseTestReviewReport(testReviewResult);
  const testReviewPassed = reviewAnalysis.passed;
  const testReviewStatus = reviewAnalysis.conclusion; // PASS / CONDITIONAL_PASS / FAIL

  // 产出 Stage2 决策日志（manual-driving IoC 协议）
  await writeFile(
    'decisions/stage2-summary-decisions.md',
    `# Stage2 决策日志汇总

## 阶段① 架构设计
- 产出: spec.md + schema.sql + api-contract.yaml
- 状态: 已锁定（Grill ${grillResult.rounds} 轮通过）

## 阶段② 业务规划
- 产出: task.md + modules/*.md
- 状态: 已锁定

## Grill 审查循环
- 总轮次: ${grillResult.rounds}
- 终止原因: ${grillResult.reason}
- 最终状态: ${grillResult.allPassed ? 'PASS' : 'BLOCKED'}

## 并行段
- Mock: 已产出
- 单元测试: 已产出
- E2E 测试: 已产出
- Test Review: ${testReviewStatus}（${reviewAnalysis.errorCount}E/${reviewAnalysis.warningCount}W）

## Stage2 门禁状态
- spec.md: LOCKED
- schema.sql: LOCKED
- api-contract.yaml: LOCKED
- task.md: LOCKED
- modules/*.md: LOCKED
- mocks/: DONE
- integration-tests/: DONE
- test-review: ${testReviewStatus}
`
  );

  return {
    status: testReviewPassed ? 'done' : 'blocked',
    outputs: {
      spec: 'spec.md',
      schema: 'schema.sql',
      apiContract: 'api-contract.yaml',
      task: 'task.md',
      modules: 'modules/',
      mocks: 'mocks/',
      unitTests: 'integration-tests/modules/',
      scenarioTests: 'integration-tests/scenarios/',
      testReview: 'test-review-report.md',
      decisions: 'decisions/stage2-summary-decisions.md',
    },
    grillRounds: grillResult.rounds,
    testReviewPassed,
    testReviewStatus,
    testReviewErrors: reviewAnalysis.errorCount,
    testReviewWarnings: reviewAnalysis.warningCount,
    summary: testReviewPassed
      ? `Stage2 完成: 全部产出物已锁定，Grill ${grillResult.rounds} 轮通过，Test Review ${testReviewStatus}（${reviewAnalysis.errorCount}E/${reviewAnalysis.warningCount}W）。`
      : 'Stage2 BLOCKED: Test Review FAIL，请查看 test-review-report.md。',
  };
}

// ─── 导出 ────────────────────────────────────────────────────────────────────────
module.exports = {
  meta,
  execute,
  // 导出纯函数/常量供测试
  MAX_GRILL_ROUNDS,
  CONSECUTIVE_PASS_THRESHOLD,
  extractIssues,
  grillLoopPure,
  parseTestReviewReport,
  // 导出 prompts 供测试验证 IoC 协议
  ARCHITECT_PROMPT,
  DOMAIN_EXPERT_PROMPT,
  GRILL_REVIEW_PROMPT,
  MOCK_PROMPT,
  UNIT_TEST_PROMPT,
  SCENARIO_TEST_PROMPT,
};
