/**
 * Stage3 Execution 单元测试
 * 覆盖: parseTaskGraph 依赖图解析、tripleCheck 三检机制、超时常量
 */

const {
  parseTaskGraph,
  tripleCheck,
  SINGLE_AGENT_TIMEOUT_MS,
  STAGE_TIMEOUT_MS,
  SINGLE_AGENT_WARN_MS,
  COORDINATOR_PROMPT,
  BACKEND_DEV_PROMPT,
  FRONTEND_DEV_PROMPT,
} = require('../../stage3-execution');

// ─── parseTaskGraph ───────────────────────────────────────────────────────────

describe('parseTaskGraph — 依赖图解析', () => {
  it('解析标准 Markdown 表格格式', () => {
    const taskContent = `
# 模块依赖图

| 模块 | 依赖 | 说明 |
|------|------|------|
| user |      | 用户基础模块 |
| auth | user | 认证模块 |
| product | user | 商品模块 |
| order | user, product, auth | 订单模块 |
`;
    const modules = parseTaskGraph(taskContent);
    expect(modules.length).toBe(4);
    expect(modules[0]).toEqual({ name: 'user', dependencies: [] });
    expect(modules[1]).toEqual({ name: 'auth', dependencies: ['user'] });
    expect(modules[2]).toEqual({ name: 'product', dependencies: ['user'] });
    expect(modules[3]).toEqual({ name: 'order', dependencies: ['user', 'product', 'auth'] });
  });

  it('解析中文表头 "模块"', () => {
    const taskContent = `
| 模块 | 依赖 |
|------|------|
| user |      |
| auth | user |
`;
    const modules = parseTaskGraph(taskContent);
    expect(modules.length).toBe(2);
    expect(modules[0].name).toBe('user');
    expect(modules[1].name).toBe('auth');
  });

  it('解析 "Module" 英文表头（大小写不敏感）', () => {
    const taskContent = `
| Module | Dependencies |
|--------|-------------|
| user   |              |
| auth   | user         |
`;
    const modules = parseTaskGraph(taskContent);
    expect(modules.length).toBe(2);
  });

  it('空内容 → 空数组', () => {
    const modules = parseTaskGraph('');
    expect(modules).toEqual([]);
  });

  it('无表格内容 → 空数组', () => {
    const modules = parseTaskGraph('这是一段没有表格的文本\n只有普通段落。');
    expect(modules).toEqual([]);
  });

  it('分隔行（---）被跳过', () => {
    const taskContent = `
| 模块 | 依赖 |
|------|------|
| user |      |
`;
    const modules = parseTaskGraph(taskContent);
    expect(modules.length).toBe(1);
    expect(modules[0].name).toBe('user');
  });

  it('单模块无依赖 → dependencies 为空数组', () => {
    const taskContent = `
| 模块 | 依赖 |
|------|------|
| standalone | |
`;
    const modules = parseTaskGraph(taskContent);
    expect(modules[0]).toEqual({ name: 'standalone', dependencies: [] });
  });

  it('多依赖逗号分隔 → 正确拆分', () => {
    const taskContent = `
| 模块 | 依赖 |
|------|------|
| payment | order, user, product |
`;
    const modules = parseTaskGraph(taskContent);
    expect(modules[0].dependencies).toEqual(['order', 'user', 'product']);
  });
});

// ─── tripleCheck — 三检机制 ───────────────────────────────────────────────────

describe('tripleCheck — 三检机制', () => {
  const modules = [
    { name: 'user', dependencies: [] },
    { name: 'auth', dependencies: ['user'] },
    { name: 'product', dependencies: ['user'] },
    { name: 'order', dependencies: ['user', 'product', 'auth'] },
  ];

  it('① 全集校验 — 正常状态无错误', () => {
    const done = new Set(['user']);
    const inProgress = new Set(['auth', 'product']);
    const unallocated = new Set(['order']);
    const errors = tripleCheck(modules, done, inProgress, unallocated);
    expect(errors.filter(e => e.check === '全集校验')).toEqual([]);
  });

  it('① 全集校验 — 总数不匹配报错', () => {
    const done = new Set(['user']);
    const inProgress = new Set(['auth']);
    const unallocated = new Set(); // 少了 product 和 order
    const errors = tripleCheck(modules, done, inProgress, unallocated);
    const universeErrors = errors.filter(e => e.check === '全集校验');
    expect(universeErrors.length).toBe(1);
    expect(universeErrors[0].message).toContain('不匹配');
  });

  it('② 依赖校验 — 依赖已满足无错误', () => {
    const done = new Set(['user', 'product', 'auth']);
    const inProgress = new Set(['order']);
    const unallocated = new Set();
    const errors = tripleCheck(modules, done, inProgress, unallocated);
    const depErrors = errors.filter(e => e.check === '依赖校验');
    expect(depErrors).toEqual([]);
  });

  it('② 依赖校验 — inProgress 模块的依赖未满足报错', () => {
    const done = new Set(['user']);
    const inProgress = new Set(['order']); // order 依赖 user, product, auth，但只有 user done
    const unallocated = new Set(['auth', 'product']);
    const errors = tripleCheck(modules, done, inProgress, unallocated);
    const depErrors = errors.filter(e => e.check === '依赖校验');
    expect(depErrors.length).toBe(1);
    expect(depErrors[0].module).toBe('order');
    expect(depErrors[0].unmetDeps).toContain('product');
    expect(depErrors[0].unmetDeps).toContain('auth');
  });

  it('inProgress 为空 → 无依赖校验错误', () => {
    const done = new Set(['user']);
    const inProgress = new Set();
    const unallocated = new Set(['auth', 'product', 'order']);
    const errors = tripleCheck(modules, done, inProgress, unallocated);
    const depErrors = errors.filter(e => e.check === '依赖校验');
    expect(depErrors).toEqual([]);
  });

  it('全部 DONE → 零错误', () => {
    const done = new Set(['user', 'auth', 'product', 'order']);
    const inProgress = new Set();
    const unallocated = new Set();
    const errors = tripleCheck(modules, done, inProgress, unallocated);
    expect(errors).toEqual([]);
  });

  it('多模块同时 inProgress 且部分依赖未满足 → 每个模块单独报错', () => {
    const done = new Set();
    const inProgress = new Set(['auth', 'order']); // auth 依赖 user(未完成), order 依赖 user,product,auth(均未完成)
    const unallocated = new Set(['user', 'product']);
    const errors = tripleCheck(modules, done, inProgress, unallocated);
    const depErrors = errors.filter(e => e.check === '依赖校验');
    expect(depErrors.length).toBe(2); // auth 和 order 各一个
  });
});

// ─── 超时常量 ─────────────────────────────────────────────────────────────────

describe('超时常量', () => {
  it('SINGLE_AGENT_TIMEOUT_MS = 30分钟', () => {
    expect(SINGLE_AGENT_TIMEOUT_MS).toBe(30 * 60 * 1000);
  });

  it('STAGE_TIMEOUT_MS = 2小时', () => {
    expect(STAGE_TIMEOUT_MS).toBe(2 * 60 * 60 * 1000);
  });

  it('SINGLE_AGENT_WARN_MS = 15分钟', () => {
    expect(SINGLE_AGENT_WARN_MS).toBe(15 * 60 * 1000);
  });

  it('警告阈值 < 超时阈值', () => {
    expect(SINGLE_AGENT_WARN_MS).toBeLessThan(SINGLE_AGENT_TIMEOUT_MS);
  });
});

// ─── 调度候选集计算（间接验证 parseTaskGraph + 依赖逻辑）─────────────────────

describe('调度候选集计算', () => {
  const modules = [
    { name: 'user', dependencies: [] },
    { name: 'auth', dependencies: ['user'] },
    { name: 'product', dependencies: ['user'] },
    { name: 'order', dependencies: ['user', 'product', 'auth'] },
    { name: 'payment', dependencies: ['order'] },
    { name: 'notification', dependencies: ['user', 'order'] },
  ];

  function getCandidates(modules, done, blocked) {
    return modules.filter(m =>
      !done.has(m.name) &&
      !blocked.has(m.name) &&
      m.dependencies.every(d => done.has(d))
    );
  }

  it('第1轮: 只有 user 无依赖 → 候选集 = [user]', () => {
    const candidates = getCandidates(modules, new Set(), new Set());
    expect(candidates.map(c => c.name)).toEqual(['user']);
  });

  it('第2轮: user DONE → 候选集 = [auth, product]', () => {
    const candidates = getCandidates(modules, new Set(['user']), new Set());
    expect(candidates.map(c => c.name)).toEqual(['auth', 'product']);
  });

  it('第3轮: user+auth+product DONE → 候选集 = [order]', () => {
    const candidates = getCandidates(modules, new Set(['user', 'auth', 'product']), new Set());
    expect(candidates.map(c => c.name)).toEqual(['order']);
  });

  it('第4轮: order DONE → 候选集 = [payment, notification]', () => {
    const done = new Set(['user', 'auth', 'product', 'order']);
    const candidates = getCandidates(modules, done, new Set());
    expect(candidates.map(c => c.name)).toEqual(['payment', 'notification']);
  });

  it('全部 DONE → 候选集为空', () => {
    const done = new Set(['user', 'auth', 'product', 'order', 'payment', 'notification']);
    const candidates = getCandidates(modules, done, new Set());
    expect(candidates).toEqual([]);
  });

  it('BLOCKED 模块排除出候选集', () => {
    const candidates = getCandidates(modules, new Set(['user']), new Set(['auth']));
    const names = candidates.map(c => c.name);
    expect(names).not.toContain('auth');
    expect(names).toContain('product');
  });
});

// ─── Prompt IoC 协议注入验证 ──────────────────────────────────────────────

describe('Stage3 Prompt IoC 协议', () => {
  it.each([
    ['COORDINATOR_PROMPT', () => COORDINATOR_PROMPT],
    ['BACKEND_DEV_PROMPT', () => BACKEND_DEV_PROMPT],
    ['FRONTEND_DEV_PROMPT', () => FRONTEND_DEV_PROMPT],
  ])('%s 包含手动驾驶协议（IoC）', (name, getPrompt) => {
    expect(getPrompt()).toContain('手动驾驶协议');
  });

  it('COORDINATOR_PROMPT 包含调度方案确认要求', () => {
    expect(COORDINATOR_PROMPT).toContain('调度方案必须向用户汇报并确认');
  });

  it('BACKEND_DEV_PROMPT 包含模块开发计划卡片', () => {
    expect(BACKEND_DEV_PROMPT).toContain('模块开发计划卡片');
  });

  it('BACKEND_DEV_PROMPT 包含决策日志路径', () => {
    expect(BACKEND_DEV_PROMPT).toContain('decisions/stage3-backend');
  });

  it('FRONTEND_DEV_PROMPT 包含页面开发计划卡片', () => {
    expect(FRONTEND_DEV_PROMPT).toContain('页面开发计划卡片');
  });
});
