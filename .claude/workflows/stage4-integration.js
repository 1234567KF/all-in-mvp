/**
 * Stage 4: 集成验收 — 后端合并 + 前后端联调 + 集成测试 + Bug 修复
 *
 * Dynamic Workflow 脚本（Claude Code 专有）
 * 自包含：prompt 内嵌，不依赖运行时读取 agents/*.md
 *
 * 用法:
 *   Workflow({ scriptPath: '.claude/workflows/stage4-integration.js', args: { srcDir: 'src/', mockDir: 'mocks/' } })
 *
 * 模型分配:
 *   Stage4 Coordinator → deepseek-v4-pro
 *   合并 / 联调 / 测试 / Bug 修复 → deepseek-v4-flash
 *
 * 输出: delivery/ 归档 + 测试报告 + 质量审计报告
 */

// ─── Meta ───────────────────────────────────────────────────────────────────
const meta = {
  name: 'manual-driving-stage4',
  description: '集成验收 — 后端合并 + 前后端联调 + 集成测试 + Bug修复',
  phases: [
    { title: '后端合并', detail: '路由合并 + Schema 一致性验证' },
    { title: '前后端联调', detail: 'Mock 切换真实 API' },
    { title: '集成测试', detail: '全量测试执行' },
    { title: 'Bug修复', detail: '修复循环 + 回归验证' },
  ],
};

// ─── 常量 ───────────────────────────────────────────────────────────────────
const MAX_BUG_FIX_ROUNDS = 3;

// ─── Prompt: Stage4 Coordinator（压缩版）────────────────────────────────────
const STAGE4_COORD_PROMPT = `你是 Stage4 的集成协调者，负责编排后端合并、前后端联调、集成测试和 Bug 修复的串行流程。

## 编排流程
4.1 后端模块合并：合并各模块路由到统一入口 → 验证全局 Schema 一致性 → 运行全量单元测试
4.2 前后端联调：前端切换 Mock → 真实后端 API，按模块逐个联调
4.3 集成测试执行：运行 integration-tests/modules/ + integration-tests/scenarios/
4.4 Bug 修复循环：分析 Bug → 修复 → 回归验证

## 联调问题分类
| 分类 | 判定 | 修复方向 |
|------|------|---------|
| 契约问题 | 接口响应与 api-contract.yaml 不一致 | 修正后端 |
| 实现问题 | 接口符合契约但数据/逻辑错误 | 修正后端 |
| 理解偏差 | 前端对接口理解与后端设计不一致 | 修正前端 + Mock |
| Mock偏差 | Mock 与真实 API 不一致 | 修正 Mock |

## 约束
- 只编排不开发，不直接修改业务代码
- 遇到的问题必须分类归档

## 手动驾驶协议（IoC）
- 集成计划必须向用户确认后才能执行
- MSVP 检查点：MSVP-2（后端合并后）、MSVP-3（联调后）、MSVP-4（交付前）
- 每个 MSVP 检查点必须经人类确认后才能继续
- 决策日志: 产出 decisions/stage4-integration-decisions.md`;

// ─── Prompt: Backend Merge（压缩版）─────────────────────────────────────────
const MERGE_PROMPT = `你是一个后端合并专家，负责将各模块路由合并到统一入口并验证一致性。

## 任务
1. 合并各模块路由到统一入口（app.ts / main.ts）
2. 验证全局 Schema 一致性（跨 module 表定义无冲突）
3. 运行全量单元测试
4. 输出合并报告

## 合并报告格式
\`\`\`markdown
# 合并报告
- 合并模块数: N
- 路由冲突: [有/无]
- Schema 冲突: [有/无]
- 单元测试: [X/Y 通过]
- 合并状态: [成功/失败]
\`\`\``;

// ─── Prompt: Frontend Integration（压缩版）───────────────────────────────────
const FRONTEND_INTEGRATION_PROMPT = `你是一个前后端联调专家，负责将前端从 Mock 切换到真实后端 API 并逐模块联调。

## 联调策略
1. 前端 api.config.ts 中按模块映射 baseURL
2. 逐模块切换：user(mock→real) → product(mock→real) → ...
3. 每模块联调后记录接口不匹配问题

## 切换后发现问题
→ 标记该模块 BLOCKED → 回退到 Mock → Debug Agent 修复 → 再次切换

## 产出
- integration-issues.md：所有接口不匹配问题（分类：契约/实现/理解偏差/Mock偏差）
- 各模块联调状态（PASS/FAIL）`;

// ─── Prompt: Integration Test Runner（压缩版）───────────────────────────────
const TEST_RUNNER_PROMPT = `你是一个集成测试执行者，负责运行所有集成测试并输出完整报告。

## 任务
1. 运行 integration-tests/modules/（单模块测试）
2. 运行 integration-tests/scenarios/（场景测试）
3. 运行 L1-L5 全部测试层
4. 输出测试报告 + 覆盖率报告

## 通过标准
- Happy Path 100%
- Exception Path ≥ 80%
- 覆盖率 ≥ 80%

## 测试报告格式
\`\`\`markdown
# 集成测试报告
- 运行时间: <timestamp>
- 总体状态: [PASS/FAIL]

## 模块测试
| 模块 | 用例数 | 通过 | 失败 | 跳过 |
|------|--------|------|------|------|

## 场景测试
| 场景 | 步骤数 | 通过 | 失败 |
|------|--------|------|------|

## 覆盖率
| 类型 | 覆盖率 |
|------|--------|
| Statements | X% |
| Branches | X% |
| Functions | X% |

## 失败用例详情
| 用例 | 期望 | 实际 | 原因 |
|------|------|------|------|
\`\`\``;

// ─── Prompt: Debug Fixer（压缩版）───────────────────────────────────────────
const DEBUG_FIX_PROMPT = `你是一个 Debug 修复专家，负责接收 Bug 报告并快速定位根因、修复问题。

## 工作流程
1. 复现 Bug → 确认 Bug 存在
2. 定位根因 → 判断是代码缺陷、接口不一致还是需求理解偏差
3. 制定修复方案 → 最小改动原则
4. 修复 → 补充回归测试 → 运行单元测试验证
5. 高风险修改（影响 >1 模块）→ 走 Code Review

## Bug 分类与修复策略
| 类型 | 根因 | 修复策略 |
|------|------|---------|
| 代码缺陷 | 实现逻辑错误、边界条件遗漏 | 修正代码 + 补充测试 |
| 接口不一致 | 实现与 api-contract.yaml 不匹配 | 修正实现或更新契约 |
| 需求理解偏差 | 实现与 PRD 描述不一致 | 回归 PRD 确认需求 → 修正实现 |
| 集成问题 | 模块间接口不匹配、数据格式不一致 | 协调双方同步修正 |

## 约束
- 最小改动原则：只修 Bug 不重构
- 每次修复必须补充回归测试
- 修复后运行全量单元测试，不引入回归`;

// ─── Prompt: Visual Regression（视觉回归测试，替代 VISUAL_PENDING 人工确认）──
const VISUAL_REGRESSION_PROMPT = `你是一个视觉回归测试 Agent，负责为前端页面生成 Playwright 无头截图并用 pixelmatch 进行像素对比，替代人工 VISUAL_PENDING 确认。

## 工作流程
1. **解析页面清单**：从 task.md + src/views/ 推断所有前端页面路由
2. **生成 Playwright 测试脚本**：为每个页面生成截图 + 对比测试
3. **首次运行**：截图保存为 baseline（首次无对比）
4. **后续运行**：当前截图 vs baseline，pixelmatch 像素对比
5. **产出 diff 图**：差异超过阈值的页面输出 diff 图

## 生成的 Playwright 测试结构
\`\`\`typescript
// reports/visual-regression/<page>.test.ts
import { test, expect } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'fs';

test('视觉回归: <page>', async ({ page }) => {
  await page.goto('http://localhost:5173/<route>');
  await page.waitForLoadState('networkidle');

  const current = await page.screenshot({ fullPage: true });
  const currentPng = PNG.sync.read(current);

  const baselinePath = 'reports/screenshots/baseline/<page>.png';
  if (!fs.existsSync(baselinePath)) {
    fs.writeFileSync(baselinePath, current);
    return; // 首次运行，保存 baseline
  }

  const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
  const diff = new PNG({ width: baseline.width, height: baseline.height });

  const diffPixels = pixelmatch(
    baseline.data, currentPng.data, diff.data,
    baseline.width, baseline.height, { threshold: 0.1 }
  );

  fs.writeFileSync('reports/screenshots/diff/<page>.png', PNG.sync.write(diff));
  expect(diffPixels).toBeLessThanOrEqual(100); // 最大允许 100 像素差异
});
\`\`\`

## 配置参数
- viewport: 1280x720（无头模式）
- threshold: 0.1（像素色差阈值 0-1）
- maxDiffPixels: 100（每页最大允许差异像素）
- 首次运行自动创建 baseline，不报错

## 产出
- reports/screenshots/baseline/*.png（基线截图）
- reports/screenshots/current/*.png（当前截图）
- reports/screenshots/diff/*.png（差异图，仅失败时）
- reports/visual-regression-report.md（汇总报告）

## VISUAL_PENDING 替代规则
- 所有页面视觉回归测试 PASS → 自动替代 VISUAL_PENDING，无需人工确认
- 任一页面 FAIL → 标记 VISUAL_REGRESSION_FAIL，需人工查看 diff 图确认

## 手动驾驶协议（IoC）
- 视觉回归测试结果需人类确认（MSVP-4 的一部分）
- 任一页面 FAIL 时必须提供 diff 图供人类审阅`;

// ─── 视觉回归测试报告解析（纯函数，供测试用）─────────────────────────

/**
 * 解析视觉回归报告
 * @param {string} report - visual-regression-report.md 内容
 * @returns {{ total: number, passed: number, failed: number, allPassed: boolean }}
 */
function parseVisualRegressionReport(report) {
  if (!report || typeof report !== 'string') {
    return { total: 0, passed: 0, failed: 0, allPassed: false };
  }

  // 尝试从报告提取数字
  const totalMatch = report.match(/\u603b\u9875\u9762\u6570[:\uff1a]\s*(\d+)/);
  const passedMatch = report.match(/\u901a\u8fc7[:\uff1a]\s*(\d+)/);
  const failedMatch = report.match(/\u5931\u8d25[:\uff1a]\s*(\d+)/);

  const total = totalMatch ? parseInt(totalMatch[1], 10) : 0;
  const passed = passedMatch ? parseInt(passedMatch[1], 10) : 0;
  const failed = failedMatch ? parseInt(failedMatch[1], 10) : 0;

  // 如果无法解析数字，用关键词推断
  if (total === 0) {
    const hasFail = report.includes('FAIL') || report.includes('\u5931\u8d25');
    return { total: 0, passed: 0, failed: hasFail ? 1 : 0, allPassed: !hasFail };
  }

  return { total, passed, failed, allPassed: failed === 0 };
}

// ─── Prompt: Quality Audit（质量审计）────────────────────────────────────────
const QUALITY_AUDIT_PROMPT = `你是一个质量审计 Agent，负责在 Stage4 结束时输出完整的质量审计报告。

## 审计维度
### 测试覆盖审计
- L1-L5 全部测试层是否通过
- V1-V3 视觉防线是否通过
- 安全测试 / 性能测试 / 错误恢复测试

### 一致性审计
- Mock 与后端响应格式是否一致
- 有头与无头测试结果是否一致
- 数据库 schema 与 Drizzle 定义是否一致
- API 实现与 api-contract.yaml 是否一致

### 稳定性审计
- 无 flaky tests
- 无内存泄漏
- 无 race condition

## 产出格式
\`\`\`markdown
# MVP 质量审计报告
- 审计时间: <timestamp>
- 总体评估: [PASS/FAIL]
- 遗留风险: [描述]
\`\`\``;

// ─── 主执行流程 ──────────────────────────────────────────────────────────────

async function execute(args) {
  const { srcDir, mockDir } = args;

  const srcPath = srcDir || 'src/';
  const mockPath = mockDir || 'mocks/';

  // 读取锁定版产出物
  const specContent = await readFile('spec.md').catch(() => '');
  const schemaContent = await readFile('schema.sql').catch(() => '');
  const apiContractContent = await readFile('api-contract.yaml').catch(() => '');
  const taskContent = await readFile('task.md').catch(() => '');
  const prdContent = await readFile('PRD.md').catch(() => '');

  // ── 阶段 4.1: 后端模块合并 (flash) ───────────────────────────────────────
  log('Stage4.1: 后端模块合并');

  const mergeResult = await agent(
    `${MERGE_PROMPT}

## 当前任务
合并以下项目的所有后端模块到统一入口。

### 项目结构
src 目录: ${srcPath}

### 全局 Schema（锁定版）
${schemaContent}

### API 契约（锁定版）
${apiContractContent}

### task.md（模块清单）
${taskContent}

请执行合并并输出合并报告。`,
    { model: 'deepseek-v4-flash', label: 'Backend-Merge' }
  );

  await writeFile('reports/merge-report.md', mergeResult);

  // 手动驾驶协议: MSVP-2（后端合并后冒烟）
  const msvp2Result = await humanGate({
    title: 'Stage4 — MSVP-2: 后端合并后冒烟确认',
    content: mergeResult,
    prompt: '后端合并已完成。请确认合并报告。输入 ✅ 确认通过，或输入问题。',
  });

  // 检查合并是否成功
  const mergeFailed = mergeResult.includes('失败') || mergeResult.includes('FAIL');
  if (mergeFailed) {
    log('Stage4.1: 合并失败，需要人工介入');
    return {
      status: 'blocked',
      phase: '4.1',
      reason: 'Backend merge failed',
      report: 'reports/merge-report.md',
    };
  }

  // ── 阶段 4.2: 前后端联调 (flash) ───────────────────────────────────────
  log('Stage4.2: 前后端联调');

  const integrationResult = await agent(
    `${FRONTEND_INTEGRATION_PROMPT}

## 当前任务
将前端从 Mock 切换到真实后端 API，逐模块联调。

### Mock 服务目录
${mockPath}

### API 契约（锁定版）
${apiContractContent}

### task.md（模块清单）
${taskContent}

请按模块逐个切换并联调，记录所有接口不匹配问题到 integration-issues.md。`,
    { model: 'deepseek-v4-flash', label: 'Frontend-Integration' }
  );

  await writeFile('integration-issues.md', integrationResult);

  // 手动驾驶协议: MSVP-3（联调后冒烟）
  const msvp3Result = await humanGate({
    title: 'Stage4 — MSVP-3: 联调后冒烟确认',
    content: integrationResult,
    prompt: '前后端联调已完成。请确认联调结果。输入 ✅ 确认通过，或输入问题。',
  });

  // ── 阶段 4.3: 集成测试执行 (flash) ─────────────────────────────────────
  log('Stage4.3: 集成测试执行');

  const testReportResult = await agent(
    `${TEST_RUNNER_PROMPT}

## 当前任务
运行所有集成测试并输出完整报告。

### 测试目录
- integration-tests/modules/（单模块测试）
- integration-tests/scenarios/（场景测试）

### PRD（验收标准章节）
${prdContent}

### API 契约（锁定版）
${apiContractContent}

请运行全部测试并输出测试报告。`,
    { model: 'deepseek-v4-flash', label: 'Test-Runner' }
  );

  await writeFile('reports/test-report.md', testReportResult);

  // 检查测试通过率
  const allTestsPassed = !testReportResult.includes('FAIL') &&
    !testReportResult.includes('失败');

  // ── 阶段 4.4: Bug 修复循环 (flash dev + pro reviewer) ──────────────────
  let bugFixRounds = 0;
  let bugsFixed = false;

  if (!allTestsPassed) {
    log('Stage4.4: 进入 Bug 修复循环');

    while (bugFixRounds < MAX_BUG_FIX_ROUNDS && !bugsFixed) {
      bugFixRounds++;
      log(`Stage4.4: Bug 修复 Round ${bugFixRounds}`);

      // 分析 Bug 列表 (pro)
      const bugAnalysis = await agent(
        `${STAGE4_COORD_PROMPT}

## 当前任务：分析 Bug 列表

### 测试报告（Round ${bugFixRounds}）
${testReportResult}

### integration-issues.md
${integrationResult}

请分类所有 Bug，标注优先级（P0/P1/P2），分配修复任务。`,
        { model: 'deepseek-v4-pro', label: `Bug-Analysis-R${bugFixRounds}` }
      );

      // 修复 Bug (flash)
      const fixResult = await agent(
        `${DEBUG_FIX_PROMPT}

## 当前任务：修复 Bug

### Bug 分析报告
${bugAnalysis}

### 相关代码目录
${srcPath}

### API 契约（锁定版）
${apiContractContent}

请按优先级修复所有 P0 Bug，并补充回归测试。`,
        { model: 'deepseek-v4-flash', label: `Bug-Fix-R${bugFixRounds}` }
      );

      // 回归测试验证
      log(`Stage4.4 Round ${bugFixRounds}: 回归测试验证`);
      const regressionResult = await agent(
        `${TEST_RUNNER_PROMPT}

## 当前任务：回归测试验证
请重新运行所有集成测试，验证 Bug 修复后无回归。`,
        { model: 'deepseek-v4-flash', label: `Regression-R${bugFixRounds}` }
      );

      const regressionPassed = !regressionResult.includes('FAIL') &&
        !regressionResult.includes('失败');

      if (regressionPassed) {
        bugsFixed = true;
        log(`Stage4.4: Round ${bugFixRounds} 回归测试全部通过`);
      } else {
        log(`Stage4.4: Round ${bugFixRounds} 仍有失败，继续修复`);
      }
    }

    if (!bugsFixed && bugFixRounds >= MAX_BUG_FIX_ROUNDS) {
      log('Stage4.4: 达到最大修复轮次，仍有 Bug 未解决 → 标记 BLOCKED');
      return {
        status: 'blocked',
        phase: '4.4',
        reason: `Max bug fix rounds (${MAX_BUG_FIX_ROUNDS}) reached`,
        bugFixRounds,
        reports: {
          merge: 'reports/merge-report.md',
          integration: 'integration-issues.md',
          tests: 'reports/test-report.md',
        },
      };
    }
  } else {
    bugsFixed = true;
    log('Stage4.4: 测试全部通过，跳过 Bug 修复循环');
  }

  // ── 阶段 4.5: 视觉回归测试（替代 VISUAL_PENDING 人工确认）────────────────
  log('Stage4.5: 视觉回归测试');

  const visualResult = await agent(
    `${VISUAL_REGRESSION_PROMPT}

## 当前任务：执行前端视觉回归测试

### task.md（模块清单 + 前端页面路由）
${taskContent}

### 前端源码目录
src/views/

请生成 Playwright 视觉回归测试并执行，产出报告。`,
    { model: 'deepseek-v4-flash', label: 'Visual-Regression' }
  );

  await writeFile('reports/visual-regression-report.md', visualResult);

  const visualAnalysis = parseVisualRegressionReport(visualResult);
  const visualPassed = visualAnalysis.allPassed;

  if (!visualPassed) {
    log(`Stage4.5: 视觉回归测试有失败，需人工查看 reports/screenshots/diff/`);
  } else {
    log('Stage4.5: 视觉回归测试全部通过，VISUAL_PENDING 已自动替代');
  }

  // ── 质量审计 ─────────────────────────────────────────────────────────────
  log('Stage4: 质量审计');

  const auditResult = await agent(
    `${QUALITY_AUDIT_PROMPT}

## 当前任务：输出质量审计报告

### 合并报告
${mergeResult}

### 联调问题记录
${integrationResult}

### 测试报告
${testReportResult}

### PRD（验收标准章节）
${prdContent}

请输出完整的 MVP 质量审计报告。`,
    { model: 'deepseek-v4-flash', label: 'Quality-Audit' }
  );

  await writeFile('reports/quality-audit.md', auditResult);

  // ── 交付归档 ─────────────────────────────────────────────────────────────
  log('Stage4: 交付归档');

  await writeFile('delivery/stage4-summary.md', `# Stage4 完成报告

## 执行摘要
- 后端合并: 成功
- 前后端联调: 完成
- 集成测试: ${allTestsPassed ? '全部通过' : '部分通过，已修复'}
- Bug 修复轮次: ${bugFixRounds}
- 视觉回归: ${visualPassed ? 'PASS（自动替代 VISUAL_PENDING）' : 'FAIL（需人工确认）'}
- 质量审计: 已产出

## MSVP 检查点
- MSVP-2（后端合并后）: ${msvp2Result}
- MSVP-3（联调后）: ${msvp3Result}
- MSVP-4（交付前）: 待确认

## 产出物清单
- reports/merge-report.md
- integration-issues.md
- reports/test-report.md
- reports/visual-regression-report.md
- reports/quality-audit.md
- delivery/stage4-summary.md
`);

  // 手动驾驶协议: MSVP-4（交付前全功能冒烟） + 交付确认
  const deliveryConfirmation = await humanGate({
    title: 'Stage4 — MSVP-4 + 交付确认',
    content: auditResult,
    prompt: '全部测试已通过，质量审计已产出。请确认交付。输入 ✅ 确认交付，或输入问题。',
  });

  // 产出 Stage4 决策日志（manual-driving IoC 协议）
  await writeFile(
    'decisions/stage4-integration-decisions.md',
    `# Stage4 决策日志

## 后端合并 (4.1)
- 状态: 成功
- MSVP-2: ${msvp2Result}

## 前后端联调 (4.2)
- 状态: 完成
- MSVP-3: ${msvp3Result}

## 集成测试 (4.3)
- 状态: ${allTestsPassed ? '全部通过' : '部分通过'}

## Bug 修复 (4.4)
- 轮次: ${bugFixRounds}
- 状态: ${bugsFixed ? '已修复' : '未完全修复'}

## 视觉回归 (4.5)
- 状态: ${visualPassed ? 'PASS' : 'FAIL'}
- 统计: 总${visualAnalysis.total}页 通过${visualAnalysis.passed} 失败${visualAnalysis.failed}

## 质量审计
- 状态: 已产出
- 文件: reports/quality-audit.md

## 交付确认 (MSVP-4)
- 用户确认: ${deliveryConfirmation}
`
  );

  return {
    status: visualPassed ? 'done' : 'blocked',
    outputs: {
      mergeReport: 'reports/merge-report.md',
      integrationIssues: 'integration-issues.md',
      testReport: 'reports/test-report.md',
      visualRegression: 'reports/visual-regression-report.md',
      qualityAudit: 'reports/quality-audit.md',
      summary: 'delivery/stage4-summary.md',
      decisions: 'decisions/stage4-integration-decisions.md',
    },
    bugFixRounds,
    visualPassed,
    visualStats: visualAnalysis,
    summary: visualPassed
      ? `Stage4 完成: 集成测试通过，Bug 修复 ${bugFixRounds} 轮，视觉回归 PASS，质量审计已产出。`
      : `Stage4 BLOCKED: 视觉回归测试有失败，请查看 reports/screenshots/diff/ 和 reports/visual-regression-report.md。`,
  };
}

// ─── 视觉回归测试辅助（Playwright 无头截图 + pixelmatch）──────────────────
// 用于替代纯人工 VISUAL_PENDING 确认

const VISUAL_REGRESSION_CONFIG = {
  screenshotDir: 'reports/screenshots',
  baselineDir: 'reports/screenshots/baseline',
  diffDir: 'reports/screenshots/diff',
  threshold: 0.1,          // 像素差异阈值（0-1）
  maxDiffPixels: 100,       // 最大允许差异像素数
  headless: true,           // 无头模式
  viewportWidth: 1280,
  viewportHeight: 720,
};

/**
 * 视觉回归测试报告结构（供 agent 生成参考）
 */
const VISUAL_REGRESSION_REPORT_TEMPLATE = `# 视觉回归测试报告

## 截图对比
| 页面 | baseline | current | diff | 差异像素 | 结果 |
|------|----------|---------|------|----------|------|

## 总结
- 总页面数: N
- 通过: N
- 失败: N (差异超过阈值)

## 失败详情
- 页面: [URL]
- 差异像素: N (阈值: 100)
- diff 图: reports/screenshots/diff/<page>.png
`;

// ─── 导出 ────────────────────────────────────────────────────────────────────────
module.exports = {
  meta,
  execute,
  // 导出常量/配置供测试
  MAX_BUG_FIX_ROUNDS,
  VISUAL_REGRESSION_CONFIG,
  VISUAL_REGRESSION_REPORT_TEMPLATE,
  VISUAL_REGRESSION_PROMPT,
  parseVisualRegressionReport,
  // 导出 prompts 供测试验证 IoC 协议
  STAGE4_COORD_PROMPT,
};
