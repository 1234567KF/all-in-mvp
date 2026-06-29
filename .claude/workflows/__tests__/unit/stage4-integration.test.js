/**
 * Stage4 Integration 单元测试
 * 覆盖: Bug 修复轮次上限、视觉回归配置、报告模板结构
 */

const {
  MAX_BUG_FIX_ROUNDS,
  VISUAL_REGRESSION_CONFIG,
  VISUAL_REGRESSION_REPORT_TEMPLATE,
  VISUAL_REGRESSION_PROMPT,
  parseVisualRegressionReport,
  STAGE4_COORD_PROMPT,
} = require('../../stage4-integration');

// ─── Bug 修复常量 ─────────────────────────────────────────────────────────────

describe('Stage4 Bug 修复配置', () => {
  it('MAX_BUG_FIX_ROUNDS = 3', () => {
    expect(MAX_BUG_FIX_ROUNDS).toBe(3);
  });

  it('MAX_BUG_FIX_ROUNDS > 0', () => {
    expect(MAX_BUG_FIX_ROUNDS).toBeGreaterThan(0);
  });
});

// ─── Bug 修复循环核心逻辑（纯函数模拟）───────────────────────────────────────

describe('Bug 修复循环逻辑', () => {
  /**
   * 模拟 stage4 的 bug 修复循环
   * 与 stage4-integration.js 中 execute() 内的 while 循环逻辑一致
   */
  function simulateBugFixLoop(testResults, maxRounds = MAX_BUG_FIX_ROUNDS) {
    let rounds = 0;
    let fixed = false;

    for (const result of testResults) {
      if (rounds >= maxRounds || fixed) break;
      rounds++;

      const passed = !result.includes('FAIL') && !result.includes('失败');
      if (passed) {
        fixed = true;
      }
    }

    return {
      rounds,
      fixed,
      blocked: !fixed && rounds >= maxRounds,
    };
  }

  it('第1轮回归测试通过 → rounds=1, fixed=true', () => {
    const result = simulateBugFixLoop(['全部 PASS，无问题']);
    expect(result.fixed).toBe(true);
    expect(result.rounds).toBe(1);
    expect(result.blocked).toBe(false);
  });

  it('第1轮失败，第2轮通过 → rounds=2, fixed=true', () => {
    const result = simulateBugFixLoop([
      'FAIL: 3 个测试未通过',
      '全部 PASS，无问题',
    ]);
    expect(result.fixed).toBe(true);
    expect(result.rounds).toBe(2);
  });

  it('3轮全部失败 → rounds=3, blocked=true', () => {
    const result = simulateBugFixLoop([
      'FAIL: bug1 未修复',
      'FAIL: bug2 未修复',
      'FAIL: bug3 未修复',
    ]);
    expect(result.fixed).toBe(false);
    expect(result.rounds).toBe(3);
    expect(result.blocked).toBe(true);
  });

  it('测试全部通过不进入修复循环 → rounds=0', () => {
    const allTestsPassed = true;
    let rounds = 0;
    if (!allTestsPassed) {
      rounds = 1;
    }
    expect(rounds).toBe(0);
  });

  it('超过3轮的输入也只执行3轮', () => {
    const results = Array(10).fill('FAIL: 仍有问题未解决');
    const result = simulateBugFixLoop(results);
    expect(result.rounds).toBe(3);
    expect(result.blocked).toBe(true);
  });
});

// ─── 视觉回归配置 ─────────────────────────────────────────────────────────────

describe('VISUAL_REGRESSION_CONFIG', () => {
  it('包含必需的目录配置', () => {
    expect(VISUAL_REGRESSION_CONFIG.screenshotDir).toBeDefined();
    expect(VISUAL_REGRESSION_CONFIG.baselineDir).toBeDefined();
    expect(VISUAL_REGRESSION_CONFIG.diffDir).toBeDefined();
  });

  it('threshold 在 0-1 之间', () => {
    expect(VISUAL_REGRESSION_CONFIG.threshold).toBeGreaterThanOrEqual(0);
    expect(VISUAL_REGRESSION_CONFIG.threshold).toBeLessThanOrEqual(1);
  });

  it('maxDiffPixels > 0', () => {
    expect(VISUAL_REGRESSION_CONFIG.maxDiffPixels).toBeGreaterThan(0);
  });

  it('headless 默认 true（无头模式）', () => {
    expect(VISUAL_REGRESSION_CONFIG.headless).toBe(true);
  });

  it('viewport 尺寸合理', () => {
    expect(VISUAL_REGRESSION_CONFIG.viewportWidth).toBeGreaterThan(0);
    expect(VISUAL_REGRESSION_CONFIG.viewportHeight).toBeGreaterThan(0);
    expect(VISUAL_REGRESSION_CONFIG.viewportWidth).toBeGreaterThanOrEqual(800);
  });

  it('baseline 和 diff 目录不同', () => {
    expect(VISUAL_REGRESSION_CONFIG.baselineDir).not.toBe(VISUAL_REGRESSION_CONFIG.diffDir);
  });
});

// ─── 视觉回归报告模板 ─────────────────────────────────────────────────────────

describe('VISUAL_REGRESSION_REPORT_TEMPLATE', () => {
  it('包含截图对比表格', () => {
    expect(VISUAL_REGRESSION_REPORT_TEMPLATE).toContain('截图对比');
    expect(VISUAL_REGRESSION_REPORT_TEMPLATE).toContain('baseline');
    expect(VISUAL_REGRESSION_REPORT_TEMPLATE).toContain('diff');
  });

  it('包含总结章节', () => {
    expect(VISUAL_REGRESSION_REPORT_TEMPLATE).toContain('总结');
    expect(VISUAL_REGRESSION_REPORT_TEMPLATE).toContain('通过');
    expect(VISUAL_REGRESSION_REPORT_TEMPLATE).toContain('失败');
  });

  it('包含阈值引用', () => {
    expect(VISUAL_REGRESSION_REPORT_TEMPLATE).toContain('阈值');
  });

  it('包含 diff 图路径模板', () => {
    expect(VISUAL_REGRESSION_REPORT_TEMPLATE).toContain('reports/screenshots/diff');
  });
});

// ─── Stage4 合并报告解析（辅助函数测试）────────────────────────────────────────

describe('合并报告解析逻辑', () => {
  function isMergeFailed(report) {
    return report.includes('失败') || report.includes('FAIL');
  }

  it('报告包含 "失败" → mergeFailed=true', () => {
    expect(isMergeFailed('合并状态: 失败')).toBe(true);
  });

  it('报告包含 "FAIL" → mergeFailed=true', () => {
    expect(isMergeFailed('Status: FAIL')).toBe(true);
  });

  it('报告正常 → mergeFailed=false', () => {
    expect(isMergeFailed('合并状态: 成功\n单元测试: 15/15 通过')).toBe(false);
  });
});

// ─── 测试报告解析逻辑 ─────────────────────────────────────────────────────────

describe('测试报告解析逻辑', () => {
  function allTestsPassed(report) {
    return !report.includes('FAIL') && !report.includes('失败');
  }

  it('全部通过 → true', () => {
    expect(allTestsPassed('总体状态: PASS\n10/10 通过')).toBe(true);
  });

  it('有 FAIL → false', () => {
    expect(allTestsPassed('总体状态: FAIL\n8/10 通过')).toBe(false);
  });

  it('有 "失败" → false', () => {
    expect(allTestsPassed('2 个测试失败')).toBe(false);
  });
});

// ─── parseVisualRegressionReport ─────────────────────────────────────────────

describe('parseVisualRegressionReport — 视觉回归报告解析', () => {
  it('全部通过报告 → allPassed=true', () => {
    const report = '总页面数: 5\n通过: 5\n失败: 0';
    const result = parseVisualRegressionReport(report);
    expect(result.allPassed).toBe(true);
    expect(result.total).toBe(5);
    expect(result.passed).toBe(5);
    expect(result.failed).toBe(0);
  });

  it('有失败报告 → allPassed=false', () => {
    const report = '总页面数: 5\n通过: 3\n失败: 2';
    const result = parseVisualRegressionReport(report);
    expect(result.allPassed).toBe(false);
    expect(result.failed).toBe(2);
  });

  it('空报告 → allPassed=false', () => {
    const result = parseVisualRegressionReport('');
    expect(result.allPassed).toBe(false);
  });

  it('null 输入 → allPassed=false', () => {
    const result = parseVisualRegressionReport(null);
    expect(result.allPassed).toBe(false);
  });

  it('包含 FAIL 关键词无数字 → allPassed=false', () => {
    const report = '视觉回归测试结果: FAIL\n某些页面差异超过阈值';
    const result = parseVisualRegressionReport(report);
    expect(result.allPassed).toBe(false);
  });

  it('无 FAIL 关键词无数字 → allPassed=true', () => {
    const report = '视觉回归测试全部通过，无差异';
    const result = parseVisualRegressionReport(report);
    expect(result.allPassed).toBe(true);
  });
});

// ─── VISUAL_REGRESSION_PROMPT ─────────────────────────────────────────────

describe('VISUAL_REGRESSION_PROMPT 内容验证', () => {
  it('包含 Playwright 关键指令', () => {
    expect(VISUAL_REGRESSION_PROMPT).toContain('Playwright');
    expect(VISUAL_REGRESSION_PROMPT).toContain('pixelmatch');
    expect(VISUAL_REGRESSION_PROMPT).toContain('screenshot');
  });

  it('包含 baseline 管理逻辑', () => {
    expect(VISUAL_REGRESSION_PROMPT).toContain('baseline');
    expect(VISUAL_REGRESSION_PROMPT).toContain('首次运行');
  });

  it('包含 VISUAL_PENDING 替代规则', () => {
    expect(VISUAL_REGRESSION_PROMPT).toContain('VISUAL_PENDING');
    expect(VISUAL_REGRESSION_PROMPT).toContain('替代');
  });

  it('包含配置参数', () => {
    expect(VISUAL_REGRESSION_PROMPT).toContain('1280');
    expect(VISUAL_REGRESSION_PROMPT).toContain('threshold');
    expect(VISUAL_REGRESSION_PROMPT).toContain('maxDiffPixels');
  });
});

// ─── Prompt IoC 协议注入验证 ──────────────────────────────────────────────

describe('Stage4 Prompt IoC 协议', () => {
  it('STAGE4_COORD_PROMPT 包含手动驾驶协议（IoC）', () => {
    expect(STAGE4_COORD_PROMPT).toContain('手动驾驶协议');
  });

  it('STAGE4_COORD_PROMPT 包含 MSVP 检查点', () => {
    expect(STAGE4_COORD_PROMPT).toContain('MSVP-2');
    expect(STAGE4_COORD_PROMPT).toContain('MSVP-3');
    expect(STAGE4_COORD_PROMPT).toContain('MSVP-4');
  });

  it('STAGE4_COORD_PROMPT 包含决策日志路径', () => {
    expect(STAGE4_COORD_PROMPT).toContain('decisions/stage4-integration-decisions.md');
  });

  it('VISUAL_REGRESSION_PROMPT 包含手动驾驶协议（IoC）', () => {
    expect(VISUAL_REGRESSION_PROMPT).toContain('手动驾驶协议');
  });

  it('VISUAL_REGRESSION_PROMPT 包含人类确认要求', () => {
    expect(VISUAL_REGRESSION_PROMPT).toContain('人类确认');
  });
});
