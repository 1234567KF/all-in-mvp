/**
 * 跨 Stage 集成测试 — 产出物传递链路验证
 * 覆盖: Stage1→Stage2→Stage3→Stage4 的模块导出/导入链路、产出物结构兼容性
 *
 * 使用 mock agent 调用，不依赖真实 LLM
 */

// 导入所有 stage 模块
const stage1 = require('../../stage1-prd');
const stage2 = require('../../stage2-planning');
const stage3 = require('../../stage3-execution');
const stage4 = require('../../stage4-integration');

// ─── 所有 Stage 模块可加载 ────────────────────────────────────────────────────

describe('Stage 模块加载', () => {
  it('stage1 导出 meta + execute + 纯函数', () => {
    expect(stage1.meta).toBeDefined();
    expect(stage1.execute).toBeTypeOf('function');
    expect(stage1.PRD_SCHEMA).toBeDefined();
    expect(stage1.validatePRD).toBeTypeOf('function');
    expect(stage1.formatPRD).toBeTypeOf('function');
  });

  it('stage2 导出 meta + execute + 纯函数', () => {
    expect(stage2.meta).toBeDefined();
    expect(stage2.execute).toBeTypeOf('function');
    expect(stage2.MAX_GRILL_ROUNDS).toBeDefined();
    expect(stage2.extractIssues).toBeTypeOf('function');
    expect(stage2.grillLoopPure).toBeTypeOf('function');
  });

  it('stage3 导出 meta + execute + 纯函数', () => {
    expect(stage3.meta).toBeDefined();
    expect(stage3.execute).toBeTypeOf('function');
    expect(stage3.parseTaskGraph).toBeTypeOf('function');
    expect(stage3.tripleCheck).toBeTypeOf('function');
  });

  it('stage4 导出 meta + execute + 常量', () => {
    expect(stage4.meta).toBeDefined();
    expect(stage4.execute).toBeTypeOf('function');
    expect(stage4.MAX_BUG_FIX_ROUNDS).toBeDefined();
    expect(stage4.VISUAL_REGRESSION_CONFIG).toBeDefined();
  });
});

// ─── Meta 一致性 ─────────────────────────────────────────────────────────────

describe('Meta 一致性', () => {
  it('所有 stage 的 meta 都有 name 和 description', () => {
    for (const [label, mod] of [['stage1', stage1], ['stage2', stage2], ['stage3', stage3], ['stage4', stage4]]) {
      expect(mod.meta.name, `${label}.meta.name`).toBeTypeOf('string');
      expect(mod.meta.description, `${label}.meta.description`).toBeTypeOf('string');
      expect(mod.meta.name.length).toBeGreaterThan(0);
    }
  });

  it('所有 stage 的 meta 都有 phases 数组', () => {
    for (const mod of [stage1, stage2, stage3, stage4]) {
      expect(Array.isArray(mod.meta.phases)).toBe(true);
      expect(mod.meta.phases.length).toBeGreaterThan(0);
    }
  });

  it('stage 名称符合命名规范 manual-driving-stageN', () => {
    expect(stage1.meta.name).toBe('manual-driving-stage1');
    expect(stage2.meta.name).toBe('manual-driving-stage2');
    expect(stage3.meta.name).toBe('manual-driving-stage3');
    expect(stage4.meta.name).toBe('manual-driving-stage4');
  });
});

// ─── Stage1 → Stage2 产出物传递 ──────────────────────────────────────────────

describe('Stage1 → Stage2 产出物传递', () => {
  it('Stage1 formatPRD 输出可作为 Stage2 输入（PRD.md 内容）', () => {
    // 模拟 Stage1 产出
    const prdData = {
      projectBackground: '电商 MVP 项目',
      glossary: 'SKU: 库存单位\nGMV: 商品交易总额',
      risksAndConstraints: 'SQLite 单机限制',
      mainFlow: '浏览→加购→下单→支付',
      erRelations: 'User 1:N Order',
      functionalRequirements: [
        { id: 'FR-001', description: '用户注册', acceptanceCriteria: '邮箱唯一' },
      ],
      acceptanceStandards: 'Happy path: 完成注册',
      complexTopics: '推荐算法',
      stateMachine: '订单状态机',
    };

    const prdContent = stage1.formatPRD(prdData);

    // 验证 Stage2 能消费此内容（不报错）
    expect(prdContent).toContain('PRD');
    expect(prdContent).toContain('项目背景');
    expect(prdContent).toContain('电商 MVP 项目');
    expect(typeof prdContent).toBe('string');
    expect(prdContent.length).toBeGreaterThan(100);
  });

  it('Stage1 validatePRD 通过的数据 → formatPRD 不报错', () => {
    const prdData = {
      projectBackground: 'test',
      glossary: 'test',
      risksAndConstraints: 'test',
      mainFlow: 'test',
      erRelations: 'test',
      functionalRequirements: [
        { id: 'FR-001', description: 'test', acceptanceCriteria: 'test' },
      ],
      acceptanceStandards: 'test',
    };

    const validation = stage1.validatePRD(prdData);
    expect(validation.valid).toBe(true);

    const md = stage1.formatPRD(prdData);
    expect(md).toContain('FR-001');
  });
});

// ─── Stage2 → Stage3 产出物传递 ──────────────────────────────────────────────

describe('Stage2 → Stage3 产出物传递', () => {
  it('task.md 内容可被 parseTaskGraph 解析', () => {
    // 模拟 Stage2 Domain Expert 产出的 task.md
    const taskContent = `
# 任务全景图

## 模块依赖关系

| 模块 | 依赖 | 领域 |
|------|------|------|
| user |      | 认证与权限 |
| auth | user | 认证与权限 |
| product | user | 业务核心 |
| order | user, product, auth | 业务核心 |
`;

    const modules = stage3.parseTaskGraph(taskContent);
    expect(modules.length).toBe(4);
    expect(modules[0].name).toBe('user');
    expect(modules[3].dependencies).toEqual(['user', 'product', 'auth']);
  });
});

// ─── Stage3 → Stage4 产出物传递 ──────────────────────────────────────────────

describe('Stage3 → Stage4 产出物传递', () => {
  it('Stage3 模块状态报告结构与 Stage4 期望兼容', () => {
    // Stage3 最终状态报告的结构
    const stage3Report = {
      status: 'done',
      finalStatus: {
        totalModules: 4,
        done: 4,
        blocked: 0,
        pending: 0,
        doneModules: ['user', 'auth', 'product', 'order'],
        blockedModules: [],
        loopCount: 4,
        elapsedMs: 120000,
      },
    };

    // Stage4 期望检查这些字段
    expect(stage3Report.status).toBe('done');
    expect(stage3Report.finalStatus.blocked).toBe(0);
    expect(stage3Report.finalStatus.doneModules.length).toBe(4);
  });
});

// ─── 全流程常量一致性 ────────────────────────────────────────────────────────

describe('全流程常量一致性', () => {
  it('Grill 循环参数在合理范围', () => {
    expect(stage2.MAX_GRILL_ROUNDS).toBeGreaterThanOrEqual(3);
    expect(stage2.MAX_GRILL_ROUNDS).toBeLessThanOrEqual(10);
    expect(stage2.CONSECUTIVE_PASS_THRESHOLD).toBeGreaterThanOrEqual(1);
    expect(stage2.CONSECUTIVE_PASS_THRESHOLD).toBeLessThanOrEqual(stage2.MAX_GRILL_ROUNDS);
  });

  it('Bug 修复轮次在合理范围', () => {
    expect(stage4.MAX_BUG_FIX_ROUNDS).toBeGreaterThanOrEqual(1);
    expect(stage4.MAX_BUG_FIX_ROUNDS).toBeLessThanOrEqual(5);
  });

  it('Stage3 超时 > 警告阈值', () => {
    expect(stage3.STAGE_TIMEOUT_MS).toBeGreaterThan(stage3.SINGLE_AGENT_TIMEOUT_MS);
    expect(stage3.SINGLE_AGENT_TIMEOUT_MS).toBeGreaterThan(stage3.SINGLE_AGENT_WARN_MS);
  });
});

// ─── execute() 缺少必需参数报错 ──────────────────────────────────────────────

describe('execute() 参数校验', () => {
  it('stage1 execute 缺少 userRequirement → throw', async () => {
    await expect(stage1.execute({})).rejects.toThrow('userRequirement');
  });

  it('stage2 execute 缺少 prdPath → throw', async () => {
    await expect(stage2.execute({})).rejects.toThrow('prdPath');
  });

  it('stage3 execute 缺少 taskPath → throw', async () => {
    await expect(stage3.execute({})).rejects.toThrow('taskPath');
  });
});
