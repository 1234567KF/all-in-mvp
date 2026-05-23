// 白皮书核心数据

export interface Stage {
  id: number;
  name: string;
  title: string;
  description: string;
  outputs: string[];
  color: string;
  icon: string;
}

export interface Role {
  name: string;
  stage: string;
  stageNum: number;
  output: string;
  parallel: string;
  color: string;
}

export interface Principle {
  title: string;
  type: 'serial' | 'parallel';
  items: string[];
}

export interface QualityGate {
  stage: string;
  items: string[];
}

export const stages: Stage[] = [
  {
    id: 1,
    name: 'Stage 1',
    title: '需求对齐',
    description: '产品经理 Agent 将原始需求转化为 MECE 完整的 PRD 文档',
    outputs: ['PRD.md（9个强制章节）', '术语定义', '业务主流程', '验收标准'],
    color: '#4f46e5',
    icon: '📋',
  },
  {
    id: 2,
    name: 'Stage 2',
    title: '规划阶段',
    description: '架构专家 → 业务专家 → ↺拷问审查循环 → Mock + 测试并行',
    outputs: ['spec.md', 'schema.sql', 'api-contract.yaml', 'task.md', '<module>.md', 'mocks/', 'integration-tests/'],
    color: '#7c3aed',
    icon: '🏗️',
  },
  {
    id: 3,
    name: 'Stage 3',
    title: '执行阶段',
    description: 'Pipeline Coordinator 调度，后端 TDD + 前端 Mock 并行开发',
    outputs: ['后端模块代码', '前端页面组件', '单元测试', '边界用例补充'],
    color: '#06b6d4',
    icon: '⚡',
  },
  {
    id: 4,
    name: 'Stage 4',
    title: '集成验收',
    description: '后端合并 → 前后端联调 → 集成测试 → Bug 修复循环',
    outputs: ['集成测试报告', 'Bug 修复记录', 'delivery/ 归档包'],
    color: '#ec4899',
    icon: '✅',
  },
];

export const roles: Role[] = [
  { name: '产品经理', stage: 'Stage 1', stageNum: 1, output: 'PRD', parallel: '串行', color: '#4f46e5' },
  { name: '架构专家', stage: 'Stage 2①', stageNum: 2, output: 'spec + schema + api-contract', parallel: '串行', color: '#7c3aed' },
  { name: '业务领域专家', stage: 'Stage 2②', stageNum: 2, output: 'task.md + <module>.md', parallel: '串行', color: '#7c3aed' },
  { name: '拷问审查', stage: 'Stage 2↺', stageNum: 2, output: '审查报告', parallel: '串行循环', color: '#7c3aed' },
  { name: 'Mock 专家', stage: 'Stage 2③a', stageNum: 2, output: 'mocks/', parallel: '并行', color: '#7c3aed' },
  { name: '单模块测试', stage: 'Stage 2③b-1', stageNum: 2, output: 'modules/*.test.ts', parallel: '内部2Agent', color: '#7c3aed' },
  { name: '业务条线测试', stage: 'Stage 2③b-2', stageNum: 2, output: 'scenarios/*.test.ts', parallel: '串行', color: '#7c3aed' },
  { name: '测试审查', stage: 'Stage 2③c', stageNum: 2, output: '审查报告', parallel: '串行', color: '#7c3aed' },
  { name: 'Pipeline Coordinator', stage: 'Stage 3', stageNum: 3, output: '调度指令', parallel: '中枢', color: '#06b6d4' },
  { name: '后端开发', stage: 'Stage 3', stageNum: 3, output: '模块代码 + 测试', parallel: '最多3Agent', color: '#06b6d4' },
  { name: '前端开发', stage: 'Stage 3', stageNum: 3, output: '页面 + 组件', parallel: '最多3Agent', color: '#06b6d4' },
  { name: '测试补充', stage: 'Stage 3', stageNum: 3, output: '边界用例', parallel: '事件驱动', color: '#06b6d4' },
  { name: 'Code Review', stage: 'Stage 3', stageNum: 3, output: 'Review意见', parallel: '按需触发', color: '#06b6d4' },
  { name: 'Stage4 Coordinator', stage: 'Stage 4', stageNum: 4, output: '联调编排', parallel: '串行', color: '#ec4899' },
  { name: 'Debug 修复', stage: 'Stage 4', stageNum: 4, output: 'Bug修复', parallel: '按需触发', color: '#ec4899' },
  { name: '复盘 Agent', stage: 'Stage 5', stageNum: 5, output: 'retrospective.md', parallel: '串行', color: '#f59e0b' },
];

export const principles: Principle[] = [
  {
    title: '什么时候必须串行？',
    type: 'serial',
    items: [
      'PRD 未锁定前：所有 Stage2 Agent 必须等待',
      '↺ 拷问审查循环未通过前：Mock、TDD 必须等待',
      '模块间强依赖：如订单依赖用户',
      '接口契约变更：所有依赖 Agent 必须同步',
      '集成测试阶段：必须等前后端都完成',
    ],
  },
  {
    title: '什么时候可以并行？',
    type: 'parallel',
    items: [
      '③a Mock、③b-1 单模块测试、③b-2 场景测试：↺通过后并行',
      '③b-1 内部：最多 2 Agent 按模块平分',
      '无依赖模块的后端开发：用户管理 vs 类目管理',
      '前端 vs 后端：Mock 就绪后前端即可并行',
      'Stage3 测试补充：事件驱动，与后端同步',
    ],
  },
];

export const qualityGates: QualityGate[] = [
  {
    stage: 'Stage 1 → Stage 2',
    items: ['PRD 文件 > 1KB', '9 个章节标题全存在', 'MECE 检查通过'],
  },
  {
    stage: 'Stage 2 → Stage 3',
    items: ['所有产出物存在', 'MD5 与锁定时刻一致', 'YAML/JSON 语义可解析'],
  },
  {
    stage: 'Stage 3 → Stage 4',
    items: ['所有模块目录存在 DONE 标记', 'schema.sql 语法正确', 'L1-L5 测试全部通过'],
  },
  {
    stage: 'Stage 4 → 交付',
    items: ['集成测试报告非空', '0 个 P0/P1 Bug', 'Mock-后端一致性验证'],
  },
];

export const metrics = [
  { name: 'Grill 首次通过率', target: '≥ 75%', value: 75 },
  { name: '首次 CR 通过率', target: '≥ 70%', value: 70 },
  { name: 'Bug 逃逸率', target: '≤ 20%', value: 20 },
  { name: '并行度利用率', target: '≥ 80%', value: 80 },
];

export const stats = [
  { label: 'Agent 角色', value: '16+' },
  { label: '开发阶段', value: '4' },
  { label: '测试层级', value: '5' },
  { label: '并行上限', value: '3+3' },
];
