/**
 * Manual-driving Agent prompt 模板测试
 *
 * 验证所有 agent .md 文件的增强内容与 workflow 脚本对齐：
 * - mock-test.md: 8 项 Test Review
 * - msvp-verifier.md: 视觉回归测试
 * - grill-review.md: 6 轮 + 连续 2 轮 + 重复检测
 * - pipeline-coordinator.md: task.md 解析规范
 * - stage4-coordinator.md: 视觉回归阶段 (4.5)
 * - pm-agent.md: PRD 结构化自校验
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_DIR = resolve(__dirname, '../../../../.qoder/skills/manual-driving/agents');

function readAgent(name) {
  return readFileSync(resolve(AGENTS_DIR, name), 'utf-8');
}

// ─── mock-test.md: 8 项 Test Review ──────────────────────────────────────────

describe('mock-test.md — 8 项 Test Review', () => {
  let content;
  beforeAll(() => { content = readAgent('mock-test.md'); });

  it('包含 Phase 2.5 自审阶段', () => {
    expect(content).toContain('Phase 2.5');
  });

  it.each([
    ['检查 #1 文件存在性', '文件存在性'],
    ['检查 #2 API路由有效性', 'API 路由有效性'],
    ['检查 #3 场景覆盖完整性', '场景覆盖完整性'],
    ['检查 #4 fixture类型一致性', 'fixture 类型一致性'],
    ['检查 #5 异常路径覆盖', '异常路径覆盖'],
    ['检查 #6 测试隔离性', '测试隔离性'],
    ['检查 #7 模块边界越界', '模块边界越界'],
    ['检查 #8 状态机转换测试', '状态机转换测试'],
  ])('包含 %s', (_, keyword) => {
    expect(content).toContain(keyword);
  });

  it('包含三级结论 PASS/CONDITIONAL_PASS/FAIL', () => {
    expect(content).toContain('PASS');
    expect(content).toContain('CONDITIONAL_PASS');
    expect(content).toContain('FAIL');
  });

  it('包含 WARNING 和 ERROR 两级严重度', () => {
    expect(content).toContain('= ERROR');
    expect(content).toContain('= WARNING');
  });

  it('产出物确认清单包含 8 项自审结果表', () => {
    expect(content).toContain('8 项自审结果');
  });

  it('与 workflow Test Review 对齐标注', () => {
    expect(content).toContain('workflow Test Review');
  });
});

// ─── msvp-verifier.md: 视觉回归测试 ──────────────────────────────────────────

describe('msvp-verifier.md — 视觉回归测试', () => {
  let content;
  beforeAll(() => { content = readAgent('msvp-verifier.md'); });

  it('包含视觉回归测试章节', () => {
    expect(content).toContain('视觉回归测试');
  });

  it('包含 pixelmatch 工具引用', () => {
    expect(content).toContain('pixelmatch');
  });

  it('包含 baseline/current/diff 三目录结构', () => {
    expect(content).toContain('baseline/');
    expect(content).toContain('current/');
    expect(content).toContain('diff/');
  });

  it('包含 viewport 配置参数', () => {
    expect(content).toContain('1280');
    expect(content).toContain('720');
  });

  it('包含 VISUAL_PENDING 替代规则', () => {
    expect(content).toContain('VISUAL_PENDING 替代规则');
  });

  it('包含 VISUAL_REGRESSION_FAIL 判定', () => {
    expect(content).toContain('VISUAL_REGRESSION_FAIL');
  });

  it('包含视觉回归报告模板', () => {
    expect(content).toContain('视觉回归测试报告');
  });

  it('与 workflow VISUAL_REGRESSION_PROMPT 对齐标注', () => {
    expect(content).toContain('workflow VISUAL_REGRESSION_PROMPT');
  });
});

// ─── grill-review.md: 循环规则增强 ───────────────────────────────────────────

describe('grill-review.md — 循环规则增强', () => {
  let content;
  beforeAll(() => { content = readAgent('grill-review.md'); });

  it('包含 grillLoopPure 算法对齐标注', () => {
    expect(content).toContain('grillLoopPure');
  });

  it('包含 6 轮上限', () => {
    expect(content).toContain('6 轮');
  });

  it('包含连续 2 轮通过条件', () => {
    expect(content).toContain('连续 2 轮');
  });

  it('包含重复问题检测', () => {
    expect(content).toContain('重复问题检测');
  });

  it('包含 REPEATED 终止条件', () => {
    expect(content).toContain('REPEATED');
  });

  it('包含 MAX_ROUNDS 终止条件', () => {
    expect(content).toContain('MAX_ROUNDS');
  });

  it('包含修正无效判定', () => {
    expect(content).toContain('修正无效');
  });

  it('保留 4 个审查维度', () => {
    expect(content).toContain('需求覆盖完整性');
    expect(content).toContain('模块边界合理性');
    expect(content).toContain('术语一致性');
    expect(content).toContain('验收标准对齐');
  });
});

// ─── pipeline-coordinator.md: task.md 解析规范 ───────────────────────────────

describe('pipeline-coordinator.md — task.md 解析规范', () => {
  let content;
  beforeAll(() => { content = readAgent('pipeline-coordinator.md'); });

  it('包含 parseTaskGraph 对齐标注', () => {
    expect(content).toContain('parseTaskGraph');
  });

  it('包含 task.md 解析规范章节', () => {
    expect(content).toContain('task.md 解析规范');
  });

  it('包含 slice(1, -1) 正确解析方法', () => {
    expect(content).toContain('slice(1, -1)');
  });

  it('包含 filter(Boolean) 陷阱警告', () => {
    expect(content).toContain('filter(Boolean)');
  });

  it('包含中英文表头支持', () => {
    expect(content).toContain('中文表头');
    expect(content).toContain('英文表头');
  });

  it('保留三检机制', () => {
    expect(content).toContain('全集校验');
    expect(content).toContain('依赖校验');
    expect(content).toContain('容量校验');
  });

  it('包含 VISUAL_PENDING 不作为 DONE 规则', () => {
    expect(content).toContain('VISUAL_PENDING');
    expect(content).toContain('不作为 DONE');
  });
});

// ─── stage4-coordinator.md: 视觉回归阶段 ─────────────────────────────────────

describe('stage4-coordinator.md — 视觉回归阶段', () => {
  let content;
  beforeAll(() => { content = readAgent('stage4-coordinator.md'); });

  it('包含 Phase 4.5 视觉回归测试', () => {
    expect(content).toContain('Phase 4.5');
    expect(content).toContain('视觉回归测试');
  });

  it('包含 workflow VISUAL_REGRESSION 对齐标注', () => {
    expect(content).toContain('VISUAL_REGRESSION');
  });

  it('包含 pixelmatch 对比流程', () => {
    expect(content).toContain('pixelmatch');
  });

  it('包含 baseline 首次保存逻辑', () => {
    expect(content).toContain('baseline');
  });

  it('CEP 卡片包含 4.5 视觉回归', () => {
    expect(content).toContain('4.5：视觉回归测试');
  });

  it('门禁包含视觉回归检查', () => {
    expect(content).toContain('视觉回归测试全部 PASS');
  });

  it('保留 MSVP-2/3/4 检查点', () => {
    expect(content).toContain('MSVP-2');
    expect(content).toContain('MSVP-3');
    expect(content).toContain('MSVP-4');
  });

  it('包含联调问题分类', () => {
    expect(content).toContain('契约问题');
    expect(content).toContain('实现问题');
    expect(content).toContain('理解偏差');
    expect(content).toContain('Mock偏差');
  });
});

// ─── pm-agent.md: PRD 结构化自校验 ──────────────────────────────────────────

describe('pm-agent.md — PRD 结构化自校验', () => {
  let content;
  beforeAll(() => { content = readAgent('pm-agent.md'); });

  it('包含 PRD 结构化自校验章节', () => {
    expect(content).toContain('PRD 结构化自校验');
  });

  it('包含 validatePRD 对齐标注', () => {
    expect(content).toContain('validatePRD');
  });

  it('包含 10 章节完整性校验', () => {
    expect(content).toContain('10 章节完整性');
  });

  it('包含功能需求数组校验', () => {
    expect(content).toContain('功能需求数组');
  });

  it('包含验收标准配套校验', () => {
    expect(content).toContain('每条功能有验收标准');
  });

  it('包含状态图覆盖校验', () => {
    expect(content).toContain('状态图覆盖');
  });

  it('保留 10 个必需章节', () => {
    expect(content).toContain('项目背景');
    expect(content).toContain('术语定义');
    expect(content).toContain('风险与约束');
    expect(content).toContain('业务主流程');
    expect(content).toContain('ER 关系');
    expect(content).toContain('功能需求');
    expect(content).toContain('核心实体状态图');
    expect(content).toContain('验收标准');
  });

  it('保留 MQAP 完整协议', () => {
    expect(content).toContain('MQAP');
    expect(content).toContain('Phase 0');
    expect(content).toContain('Phase 1');
    expect(content).toContain('Phase 2');
    expect(content).toContain('Phase 3');
  });

  it('保留 RRR 驳回处理', () => {
    expect(content).toContain('RRR');
    expect(content).toContain('驳回');
  });
});

// ─── 全局一致性：所有 Agent 的 MQAP 协议 ────────────────────────────────────

describe('全局一致性 — MQAP 协议', () => {
  const agentFiles = [
    'pm-agent.md',
    'architect.md',
    'domain-expert.md',
    'mock-test.md',
    'backend-dev.md',
    'frontend-dev.md',
    'code-reviewer.md',
    'grill-review.md',
    'pipeline-coordinator.md',
    'stage4-coordinator.md',
    'retrospective-agent.md',
  ];

  it.each(agentFiles)('%s 包含手动驾驶协议', (file) => {
    const content = readAgent(file);
    // Every agent must have manual-driving protocol
    expect(content).toContain('手动驾驶');
  });

  it.each(agentFiles.filter(f => !['grill-review.md', 'pipeline-coordinator.md', 'retrospective-agent.md', 'code-reviewer.md'].includes(f)))(
    '%s 包含 MQAP 协议引用',
    (file) => {
      const content = readAgent(file);
      expect(content).toContain('MQAP');
    }
  );

  it.each(agentFiles)('%s 包含 Constraints 章节', (file) => {
    const content = readAgent(file);
    expect(content).toContain('Constraints');
  });
});
