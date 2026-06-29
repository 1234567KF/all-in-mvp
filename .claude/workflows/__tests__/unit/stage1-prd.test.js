/**
 * Stage1 PRD 单元测试
 * 覆盖: PRD_SCHEMA 结构、validatePRD 校验、formatPRD 输出格式
 */

const path = require('path');

const {
  PRD_SCHEMA,
  validatePRD,
  formatPRD,
  PM_PROMPT,
} = require('../../stage1-prd');

// ─── 工具: 生成完整有效 PRD 数据 ─────────────────────────────────────────────
function makeValidPRD(overrides = {}) {
  return {
    projectBackground: '项目背景：电商 MVP',
    glossary: 'SKU: 库存单位',
    risksAndConstraints: '技术约束：SQLite',
    mainFlow: '用户浏览商品→加购→下单→支付',
    erRelations: 'User 1:N Order N:N Product',
    functionalRequirements: [
      {
        id: 'FR-001',
        description: '用户注册',
        acceptanceCriteria: '邮箱唯一，密码≥8位',
        businessRules: '注册后自动登录',
      },
    ],
    acceptanceStandards: 'Happy path: 用户完成注册；Exception: 邮箱重复',
    // 可选字段
    complexTopics: '推荐算法逻辑',
    stateMachine: '订单: PENDING→PAID→SHIPPED→DELIVERED',
    ...overrides,
  };
}

// ─── PRD_SCHEMA 结构 ──────────────────────────────────────────────────────────

describe('PRD_SCHEMA 结构', () => {
  it('应包含 7 个 required 字段', () => {
    expect(PRD_SCHEMA.required).toEqual([
      'projectBackground',
      'glossary',
      'risksAndConstraints',
      'mainFlow',
      'erRelations',
      'functionalRequirements',
      'acceptanceStandards',
    ]);
  });

  it('properties 应包含全部 9 个章节定义', () => {
    const keys = Object.keys(PRD_SCHEMA.properties);
    expect(keys).toContain('projectBackground');
    expect(keys).toContain('glossary');
    expect(keys).toContain('complexTopics');
    expect(keys).toContain('stateMachine');
    expect(keys.length).toBe(9);
  });

  it('functionalRequirements items 应要求 id/description/acceptanceCriteria', () => {
    const items = PRD_SCHEMA.properties.functionalRequirements.items;
    expect(items.required).toEqual(['id', 'description', 'acceptanceCriteria']);
  });
});

// ─── validatePRD ──────────────────────────────────────────────────────────────

describe('validatePRD', () => {
  it('完整有效数据 → valid=true, errors=[]', () => {
    const result = validatePRD(makeValidPRD());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('缺少 projectBackground → valid=false', () => {
    const data = makeValidPRD({ projectBackground: undefined });
    const result = validatePRD(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('缺少必需字段: projectBackground');
  });

  it('缺少多个必需字段 → 返回所有错误', () => {
    const data = makeValidPRD({
      projectBackground: undefined,
      glossary: undefined,
      erRelations: undefined,
    });
    const result = validatePRD(data);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(3);
  });

  it('functionalRequirements 不是数组 → 报错', () => {
    const data = makeValidPRD({ functionalRequirements: 'not-an-array' });
    const result = validatePRD(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('functionalRequirements 必须是数组');
  });

  it('functionalRequirements item 缺少 id → 报错', () => {
    const data = makeValidPRD({
      functionalRequirements: [
        { description: 'desc', acceptanceCriteria: 'ac' }, // 缺 id
      ],
    });
    const result = validatePRD(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('functionalRequirements[0]') && e.includes('id'))).toBe(true);
  });

  it('functionalRequirements item 缺少 acceptanceCriteria → 报错', () => {
    const data = makeValidPRD({
      functionalRequirements: [
        { id: 'FR-001', description: 'desc' }, // 缺 acceptanceCriteria
      ],
    });
    const result = validatePRD(data);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('acceptanceCriteria'))).toBe(true);
  });

  it('可选字段缺失不影响 valid', () => {
    const data = makeValidPRD({ complexTopics: undefined, stateMachine: undefined });
    const result = validatePRD(data);
    expect(result.valid).toBe(true);
  });

  it('空 functionalRequirements 数组 → valid=true', () => {
    const data = makeValidPRD({ functionalRequirements: [] });
    const result = validatePRD(data);
    expect(result.valid).toBe(true);
  });
});

// ─── formatPRD ────────────────────────────────────────────────────────────────

describe('formatPRD', () => {
  it('输出包含【锁定版】标题', () => {
    const md = formatPRD(makeValidPRD());
    expect(md).toContain('PRD — 产品需求文档【锁定版】');
  });

  it('输出包含所有已填充章节', () => {
    const md = formatPRD(makeValidPRD());
    expect(md).toContain('## 项目背景');
    expect(md).toContain('## 术语定义');
    expect(md).toContain('## 风险与约束');
    expect(md).toContain('## 业务主流程');
    expect(md).toContain('## ER 关系');
    expect(md).toContain('## 功能需求');
    expect(md).toContain('## 验收标准');
  });

  it('功能需求包含 id、验收标准', () => {
    const md = formatPRD(makeValidPRD());
    expect(md).toContain('### FR-001');
    expect(md).toContain('**验收标准**: 邮箱唯一，密码≥8位');
    expect(md).toContain('**业务规则**: 注册后自动登录');
  });

  it('可选章节有内容时也输出', () => {
    const md = formatPRD(makeValidPRD());
    expect(md).toContain('## 复杂/核心专题');
    expect(md).toContain('## 核心实体状态图');
  });

  it('可选章节无内容时不输出', () => {
    const data = makeValidPRD({ complexTopics: undefined, stateMachine: undefined });
    const md = formatPRD(data);
    expect(md).not.toContain('## 复杂/核心专题');
    expect(md).not.toContain('## 核心实体状态图');
  });

  it('functionalRequirements 为空数组时不输出功能需求章节', () => {
    const data = makeValidPRD({ functionalRequirements: [] });
    const md = formatPRD(data);
    expect(md).not.toContain('## 功能需求');
  });
});

// ─── PM_PROMPT ────────────────────────────────────────────────────────────────

describe('PM_PROMPT', () => {
  it('应包含 9 个章节名称', () => {
    expect(PM_PROMPT).toContain('项目背景');
    expect(PM_PROMPT).toContain('术语定义');
    expect(PM_PROMPT).toContain('风险与约束');
    expect(PM_PROMPT).toContain('业务主流程');
    expect(PM_PROMPT).toContain('ER 关系');
    expect(PM_PROMPT).toContain('功能需求');
    expect(PM_PROMPT).toContain('复杂/核心专题');
    expect(PM_PROMPT).toContain('核心实体状态图');
    expect(PM_PROMPT).toContain('验收标准');
  });

  it('应包含 MQAP 流程', () => {
    expect(PM_PROMPT).toContain('MQAP');
  });

  it('应包含 CEP 卡片', () => {
    expect(PM_PROMPT).toContain('CEP');
  });

  it('应包含手动驾驶协议（IoC）', () => {
    expect(PM_PROMPT).toContain('手动驾驶协议');
    expect(PM_PROMPT).toContain('禁止自行假设');
    expect(PM_PROMPT).toContain('理解确认清单');
    expect(PM_PROMPT).toContain('产出物确认清单');
  });

  it('应包含决策日志产出要求', () => {
    expect(PM_PROMPT).toContain('decisions/stage1-prd-decisions.md');
  });
});
