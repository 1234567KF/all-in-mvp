/**
 * Stage2 Planning 单元测试
 * 覆盖: Grill 循环终止条件（6轮硬上限/连续2轮零发现）、extractIssues、重复问题检测
 */

const {
  MAX_GRILL_ROUNDS,
  CONSECUTIVE_PASS_THRESHOLD,
  extractIssues,
  grillLoopPure,
  parseTestReviewReport,
  ARCHITECT_PROMPT,
  DOMAIN_EXPERT_PROMPT,
  GRILL_REVIEW_PROMPT,
  MOCK_PROMPT,
  UNIT_TEST_PROMPT,
  SCENARIO_TEST_PROMPT,
} = require('../../stage2-planning');

// ─── 常量验证 ─────────────────────────────────────────────────────────────────

describe('Stage2 常量', () => {
  it('MAX_GRILL_ROUNDS = 6', () => {
    expect(MAX_GRILL_ROUNDS).toBe(6);
  });

  it('CONSECUTIVE_PASS_THRESHOLD = 2', () => {
    expect(CONSECUTIVE_PASS_THRESHOLD).toBe(2);
  });
});

// ─── extractIssues ────────────────────────────────────────────────────────────

describe('extractIssues', () => {
  it('提取 FAIL 行', () => {
    const text = `需求覆盖完整性: PASS
模块边界合理性: FAIL — spec.md 缺少 auth 模块接口
术语一致性: PASS`;
    const issues = extractIssues(text);
    expect(issues.length).toBe(1);
    expect(issues[0]).toContain('FAIL');
    expect(issues[0]).toContain('auth');
  });

  it('提取 ERROR 行', () => {
    const text = `文件存在性: ERROR — 缺少 order.test.ts
API路由有效性: PASS`;
    const issues = extractIssues(text);
    expect(issues.length).toBe(1);
    expect(issues[0]).toContain('ERROR');
  });

  it('同时提取 FAIL 和 ERROR', () => {
    const text = `check1: FAIL — 问题描述足够长以通过长度过滤
check2: ERROR — 另一个问题描述也足够长
check3: PASS`;
    const issues = extractIssues(text);
    expect(issues.length).toBe(2);
  });

  it('ZERO_FINDINGS 返回空数组', () => {
    const text = 'ZERO_FINDINGS — 全部审查通过，无任何问题';
    const issues = extractIssues(text);
    expect(issues.length).toBe(0);
  });

  it('过滤掉过短的行（≤10 字符）', () => {
    const text = `FAIL: 短
ERROR: 也短
FAIL — 这行足够长应该被提取出来`;
    const issues = extractIssues(text);
    expect(issues.length).toBe(1);
  });
});

// ─── grillLoopPure: 终止条件 ───────────────────────────────────────────────────

describe('grillLoopPure — 终止条件', () => {
  const PASS = 'ZERO_FINDINGS — 全部通过，无任何 FAIL 或 ERROR';
  const FAIL = '需求覆盖完整性: FAIL — spec.md 缺少接口定义（此行为有效问题描述）';

  it('连续2轮零发现 → allPassed=true, reason=consecutive_pass', () => {
    const result = grillLoopPure([PASS, PASS]);
    expect(result.allPassed).toBe(true);
    expect(result.reason).toBe('consecutive_pass');
    expect(result.rounds).toBe(2);
    expect(result.consecutiveZero).toBe(2);
  });

  it('第一轮零发现，第二轮有发现 → 重置计数器，需再连续2轮', () => {
    const result = grillLoopPure([PASS, FAIL, PASS, PASS]);
    expect(result.allPassed).toBe(true);
    expect(result.rounds).toBe(4);
    expect(result.consecutiveZero).toBe(2);
  });

  it('6轮全部有发现 → allPassed=false, reason=max_rounds_reached', () => {
    // 每轮用不同的问题描述，避免触发重复问题检测
    const reviews = [
      'Round1: FAIL — spec.md 缺少 user 模块接口定义（此行为有效问题描述一）',
      'Round2: FAIL — spec.md 缺少 auth 模块接口定义（此行为有效问题描述二）',
      'Round3: FAIL — spec.md 缺少 order 模块接口定义（此行为有效问题描述三）',
      'Round4: FAIL — schema.sql 缺少 payment 表定义字段（此行为有效问题描述四）',
      'Round5: FAIL — api-contract 缺少 notification 路由定义内容（此行为有效问题描述五）',
      'Round6: FAIL — task.md 缺少 report 模块边界描述内容（此行为有效问题描述六）',
    ];
    const result = grillLoopPure(reviews);
    expect(result.allPassed).toBe(false);
    expect(result.reason).toBe('max_rounds_reached');
    expect(result.rounds).toBe(6);
  });

  it('5轮有发现 + 第6轮零发现 → allPassed=false（只连续1轮）', () => {
    const reviews = [
      'R1: FAIL — 问题描述一足够长以通过长度过滤检查确认',
      'R2: FAIL — 问题描述二足够长以通过长度过滤检查确认',
      'R3: FAIL — 问题描述三足够长以通过长度过滤检查确认',
      'R4: FAIL — 问题描述四足够长以通过长度过滤检查确认',
      'R5: FAIL — 问题描述五足够长以通过长度过滤检查确认',
      PASS,
    ];
    const result = grillLoopPure(reviews);
    expect(result.allPassed).toBe(false);
    expect(result.rounds).toBe(6);
    expect(result.consecutiveZero).toBe(1);
  });

  it('交替 PASS/FAIL 永不满足连续2轮 → 6轮后 max_rounds_reached', () => {
    const reviews = [
      PASS,
      'R2: FAIL — 交替问题描述二足够长以通过长度过滤检查',
      PASS,
      'R4: FAIL — 交替问题描述四足够长以通过长度过滤检查',
      PASS,
      'R6: FAIL — 交替问题描述六足够长以通过长度过滤检查',
    ];
    const result = grillLoopPure(reviews);
    expect(result.allPassed).toBe(false);
    expect(result.reason).toBe('max_rounds_reached');
    expect(result.rounds).toBe(6);
  });

  it('空输入 → allPassed=false（0轮未达阈值）', () => {
    const result = grillLoopPure([]);
    expect(result.allPassed).toBe(false);
    expect(result.rounds).toBe(0);
  });

  it('超过6轮的输入也只执行6轮', () => {
    const reviews = [
      'R1: FAIL — 超出轮次问题描述一足够长用于测试检查',
      'R2: FAIL — 超出轮次问题描述二足够长用于测试检查',
      'R3: FAIL — 超出轮次问题描述三足够长用于测试检查',
      'R4: FAIL — 超出轮次问题描述四足够长用于测试检查',
      'R5: FAIL — 超出轮次问题描述五足够长用于测试检查',
      'R6: FAIL — 超出轮次问题描述六足够长用于测试检查',
      'R7: FAIL — 超出轮次问题描述七足够长用于测试检查',
    ];
    const result = grillLoopPure(reviews);
    expect(result.rounds).toBe(6);
  });
});

// ─── grillLoopPure: 重复问题检测 ─────────────────────────────────────────────

describe('grillLoopPure — 重复问题检测', () => {
  // 同一问题在连续轮次重复出现
  const SAME_FAIL = '模块边界合理性: FAIL — spec.md 缺少 auth 模块接口定义（此描述足够长）';

  it('同一问题在第3轮再次出现 → blocked=true, reason=repeated_issues', () => {
    // round 1: 有此问题, round 2: 有此问题, round 3: 仍有此问题 → 重复
    const reviews = [SAME_FAIL, SAME_FAIL, SAME_FAIL];
    const result = grillLoopPure(reviews);
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('repeated_issues');
    expect(result.allPassed).toBe(false);
  });

  it('不同问题不触发重复检测', () => {
    const FAIL_A = '需求覆盖完整性: FAIL — spec.md 缺少 user 接口（此描述足够长用于测试）';
    const FAIL_B = '术语一致性: FAIL — PRD 用"订单"但 spec 用"order"（此描述足够长）';
    const FAIL_C = '验收标准对齐: FAIL — module docs 缺少退款场景验收标准（此描述足够长）';
    const result = grillLoopPure([FAIL_A, FAIL_B, FAIL_C, FAIL_A, FAIL_B, FAIL_C]);
    expect(result.blocked).toBe(false);
    expect(result.rounds).toBe(6);
  });
});

// ─── grillLoopPure: 自定义参数 ────────────────────────────────────────────────

describe('grillLoopPure — 自定义参数', () => {
  const PASS = 'ZERO_FINDINGS — 全部通过';
  const FAIL = 'FAIL — 有问题的审查结果描述（此行长度超过十个字符用于测试）';

  it('passThreshold=1 → 1轮零发现即通过', () => {
    const result = grillLoopPure([PASS], 6, 1);
    expect(result.allPassed).toBe(true);
    expect(result.rounds).toBe(1);
  });

  it('maxRounds=3 → 最多3轮', () => {
    const result = grillLoopPure([FAIL, FAIL, FAIL, FAIL], 3, 2);
    expect(result.rounds).toBe(3);
    expect(result.allPassed).toBe(false);
  });
});

// ─── parseTestReviewReport ─────────────────────────────────────────────────────

describe('parseTestReviewReport — Test Review 结果解析', () => {
  it('全 PASS 报告 → conclusion=PASS, passed=true', () => {
    const report = `# Test Review Report\n审查结论: PASS\n全部检查通过，无任何问题。`;
    const result = parseTestReviewReport(report);
    expect(result.conclusion).toBe('PASS');
    expect(result.passed).toBe(true);
    expect(result.errorCount).toBe(0);
  });

  it('有 ERROR → conclusion=FAIL, passed=false', () => {
    const report = `# Test Review\n1. 文件存在性: ERROR — 缺少 order.test.ts\n审查结论: FAIL`;
    const result = parseTestReviewReport(report);
    expect(result.conclusion).toBe('FAIL');
    expect(result.passed).toBe(false);
    expect(result.errorCount).toBeGreaterThanOrEqual(1);
  });

  it('CONDITIONAL_PASS → passed=true', () => {
    const report = `# Test Review\nWARNING — 异常路径覆盖不足\n审查结论: CONDITIONAL_PASS`;
    const result = parseTestReviewReport(report);
    expect(result.conclusion).toBe('CONDITIONAL_PASS');
    expect(result.passed).toBe(true);
  });

  it('空报告 → FAIL', () => {
    const result = parseTestReviewReport('');
    expect(result.conclusion).toBe('FAIL');
    expect(result.passed).toBe(false);
  });

  it('null 输入 → FAIL', () => {
    const result = parseTestReviewReport(null);
    expect(result.conclusion).toBe('FAIL');
    expect(result.passed).toBe(false);
  });

  it('多个 ERROR 和 WARNING 正确计数', () => {
    const report = `ERROR: 问题1\nERROR: 问题2\nWARNING: 问题3\nWARNING: 问题4\nWARNING: 问题5`;
    const result = parseTestReviewReport(report);
    expect(result.errorCount).toBe(2);
    expect(result.warningCount).toBe(3);
  });

  it('只有 WARNING 无 ERROR → CONDITIONAL_PASS', () => {
    const report = `WARNING: 异常路径覆盖不足\nWARNING: 测试隔离性差`;
    const result = parseTestReviewReport(report);
    expect(result.conclusion).toBe('CONDITIONAL_PASS');
    expect(result.passed).toBe(true);
  });
});

// ─── Prompt IoC 协议注入验证 ──────────────────────────────────────────────

describe('Stage2 Prompt IoC 协议', () => {
  it.each([
    ['ARCHITECT_PROMPT', () => ARCHITECT_PROMPT],
    ['DOMAIN_EXPERT_PROMPT', () => DOMAIN_EXPERT_PROMPT],
    ['GRILL_REVIEW_PROMPT', () => GRILL_REVIEW_PROMPT],
    ['MOCK_PROMPT', () => MOCK_PROMPT],
    ['UNIT_TEST_PROMPT', () => UNIT_TEST_PROMPT],
    ['SCENARIO_TEST_PROMPT', () => SCENARIO_TEST_PROMPT],
  ])('%s 包含手动驾驶协议（IoC）', (name, getPrompt) => {
    expect(getPrompt()).toContain('手动驾驶协议');
  });

  it('ARCHITECT_PROMPT 包含决策日志路径', () => {
    expect(ARCHITECT_PROMPT).toContain('decisions/stage2-arch-decisions.md');
  });

  it('DOMAIN_EXPERT_PROMPT 包含决策日志路径', () => {
    expect(DOMAIN_EXPERT_PROMPT).toContain('decisions/stage2-biz-decisions.md');
  });

  it('GRILL_REVIEW_PROMPT 包含决策日志路径', () => {
    expect(GRILL_REVIEW_PROMPT).toContain('decisions/stage2-grill-decisions.md');
  });

  it('MOCK_PROMPT 包含 MQAP 轻量版', () => {
    expect(MOCK_PROMPT).toContain('MQAP 轻量版');
  });

  it('UNIT_TEST_PROMPT 包含 MQAP 轻量版', () => {
    expect(UNIT_TEST_PROMPT).toContain('MQAP 轻量版');
  });
});
