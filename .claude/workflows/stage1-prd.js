/**
 * Stage 1: 需求对齐 — PM Agent 产出 PRD.md
 * 
 * Dynamic Workflow 脚本（Claude Code 专有）
 * 自包含：prompt 内嵌，不依赖运行时读取 agents/*.md
 * 
 * 用法:
 *   Workflow({ scriptPath: '.claude/workflows/stage1-prd.js', args: { userRequirement: '...', context: '...' } })
 * 
 * 模型: deepseek-v4-pro（需求理解错误会级联到所有下游）
 * 并行度: 串行，1 个子 Agent
 * 输出: PRD.md + decisions/stage1-prd-decisions.md
 */

// ─── Meta ───────────────────────────────────────────────────────────────────
const meta = {
  name: 'manual-driving-stage1',
  description: '需求对齐 — PM Agent 产出 PRD.md',
  phases: [
    { title: '需求理解', detail: 'PM Agent 理解确认' },
    { title: 'PRD撰写', detail: 'PM Agent 产出结构化 PRD' },
  ],
};

// ─── PRD Schema（约束 PM Agent 产出 9 个必需章节）───────────────────────────
const PRD_SCHEMA = {
  type: 'object',
  properties: {
    projectBackground: {
      type: 'string',
      description: '项目背景、业务目标、价值主张、范围边界',
    },
    glossary: {
      type: 'string',
      description: '术语定义、缩写、业务概念',
    },
    risksAndConstraints: {
      type: 'string',
      description: '技术约束、业务约束、合规要求',
    },
    mainFlow: {
      type: 'string',
      description: '核心用户旅程、系统交互图',
    },
    erRelations: {
      type: 'string',
      description: '实体关系图、核心领域模型',
    },
    functionalRequirements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          description: { type: 'string' },
          acceptanceCriteria: { type: 'string' },
          businessRules: { type: 'string' },
        },
        required: ['id', 'description', 'acceptanceCriteria'],
      },
    },
    complexTopics: {
      type: 'string',
      description: '复杂业务逻辑的深度分析',
    },
    stateMachine: {
      type: 'string',
      description: '核心实体状态图、状态转换条件',
    },
    acceptanceStandards: {
      type: 'string',
      description: '集成测试场景（happy path + exception path）',
    },
  },
  required: [
    'projectBackground',
    'glossary',
    'risksAndConstraints',
    'mainFlow',
    'erRelations',
    'functionalRequirements',
    'acceptanceStandards',
  ],
};

// ─── PM Agent Prompt（压缩版，基于 agents/pm-agent.md 核心指令）─────────────
const PM_PROMPT = `你是一个资深产品经理 Agent，负责将用户原始需求转化为 MECE 完整的 PRD 文档。
你工作在手动驾驶模式下——禁止自行假设，所有不清楚的点必须列出并等待用户确认。

## 核心指令
1. **理解确认**：先用自己的话复述用户需求，列出不清楚的点，等待用户确认
2. **CEP 卡片**：产出卡片式执行计划（全面性 + 难点 + 主线计划）
3. **PRD 撰写**：按以下 9 个章节产出结构化 PRD
4. **产出确认清单**：产出后让用户审阅，确认后才锁定

## PRD 必须包含的 9 个章节

| 章节 | 内容 |
|------|------|
| 项目背景 | 业务目标、价值主张、范围边界 |
| 术语定义 | 领域术语、缩写、业务概念 |
| 风险与约束 | 技术约束、业务约束、合规要求 |
| 业务主流程 | 核心用户旅程、系统交互图 |
| ER 关系 | 实体关系图、核心领域模型 |
| 功能需求 | 功能描述、验收标准、业务规则（每项必须有验收标准） |
| 复杂/核心专题 | 复杂业务逻辑的深度分析 |
| 核心实体状态图 | 状态机、状态转换条件 |
| 验收标准 | 集成测试场景（happy path + exception path） |

## 手动驾驶协议（IoC）

### MQAP 流程（强制，不可跳过）
1. 阅读用户需求
2. 输出「理解确认清单」：用自己的话复述 + 边界 + 不清楚的点（不允许留空）
3. 用户确认 ✅/⚠️
4. 输出「CEP 卡片」：🔭全面性 + ⚠️难点 + 🧭主线计划
5. 用户确认卡片 ✅/⚠️
6. 记录 Q&A + 卡片到决策日志
7. 基于确认后的理解执行 PRD 撰写
8. 输出 PRD 草案
9. 输出「产出物确认清单」：我产出了什么 + 关键决策 + 与卡片的差异 + 风险点
10. 用户确认 ✅锁定 / ⚠️驳回(RRR)

### 禁止自行假设
- 即使是“显然”的，也必须列出来确认
- 沉默的假设是最危险的

### 决策日志产出要求
产出 decisions/stage1-prd-decisions.md，包含：
- 理解确认阶段（Agent 复述 + 用户确认内容）
- CEP 卡片（全面性 + 难点 + 主线）
- 决策记录（候选方案 + 选择 + 理由）
- 产出物确认（用户 ✅/⚠️ 记录）

## 约束
- 必须 MECE（Mutually Exclusive, Collectively Exhaustive）
- 每项功能需求必须有明确的验收标准
- 术语定义必须在全文档中保持一致
- 不涉及技术实现细节（那是 Stage2 架构师的职责）
- 如果需求模糊，先追问澄清再写 PRD`;

// ─── 执行流程 ───────────────────────────────────────────────────────────────

async function execute(args) {
  const { userRequirement, context } = args;

  if (!userRequirement) {
    throw new Error('Stage1 缺少必需参数: args.userRequirement');
  }

  // Phase 1: 需求理解
  const understandingResult = await agent(
    `${PM_PROMPT}

## 当前任务：需求理解

用户原始需求：
${userRequirement}

${context ? `业务背景：\n${context}` : ''}

请先用自己的话复述需求，列出不清楚的点，产出理解确认清单。`,
    {
      model: 'deepseek-v4-pro',
      label: 'PM-Understanding',
    }
  );

  // Human Gate: 用户确认理解是否正确
  const userConfirmation = await humanGate({
    title: 'Stage1 — 需求理解确认',
    content: understandingResult,
    prompt: '请确认 PM Agent 对需求的理解是否正确。输入 ✅ 确认通过，或输入修正意见。',
  });

  // Phase 2: PRD 撰写
  const prdResult = await agent(
    `${PM_PROMPT}

## 当前任务：PRD 撰写

用户原始需求：
${userRequirement}

${context ? `业务背景：\n${context}` : ''}

需求理解确认结果：
${userConfirmation}

请按 9 个章节产出完整的 PRD 文档。每个章节必须内容充实，不可留空。
功能需求必须以结构化列表形式呈现，每项包含 id、description、acceptanceCriteria。`,
    {
      model: 'deepseek-v4-pro',
      label: 'PM-PRD',
      schema: PRD_SCHEMA,
    }
  );

  // 产出 PRD.md
  await writeFile('PRD.md', formatPRD(prdResult));

  // 产出决策日志（manual-driving IoC 协议：完整记录 MQAP 过程）
  await writeFile(
    'decisions/stage1-prd-decisions.md',
    `# Stage1 PRD 决策日志

## D-S1-001: PRD 结构
- 决策: 采用 9 章节标准结构
- 理由: MECE 覆盖需求全维度

## 理解确认阶段
${userConfirmation}

## CEP 卡片摘要
- 全面性: PRD 9 章节全覆盖
- 难点: 功能需求 MECE 拆分 + 验收标准制定
- 主线: 需求理解确认 → PRD 草案 → 产出确认

## 产出物确认
- PRD.md: 已产出，9 章节齐全
- 用户确认: ${userConfirmation}
- 产出时间: ${new Date().toISOString()}
`
  );

  return {
    status: 'done',
    outputs: {
      prd: 'PRD.md',
      decisions: 'decisions/stage1-prd-decisions.md',
    },
    summary: 'Stage1 完成: PRD.md 已产出，9 章节齐全，待主 Agent 审查锁定。',
  };
}

// ─── 辅助函数 ───────────────────────────────────────────────────────────────

function formatPRD(data) {
  const sections = [
    { key: 'projectBackground', title: '项目背景' },
    { key: 'glossary', title: '术语定义' },
    { key: 'risksAndConstraints', title: '风险与约束' },
    { key: 'mainFlow', title: '业务主流程' },
    { key: 'erRelations', title: 'ER 关系' },
    { key: 'complexTopics', title: '复杂/核心专题' },
    { key: 'stateMachine', title: '核心实体状态图' },
    { key: 'acceptanceStandards', title: '验收标准' },
  ];

  let md = `# PRD — 产品需求文档【锁定版】\n\n`;

  for (const { key, title } of sections) {
    if (data[key]) {
      md += `## ${title}\n\n${data[key]}\n\n---\n\n`;
    }
  }

  // 功能需求（数组）
  if (data.functionalRequirements && data.functionalRequirements.length > 0) {
    md += `## 功能需求\n\n`;
    for (const req of data.functionalRequirements) {
      md += `### ${req.id}: ${req.description}\n\n`;
      md += `**验收标准**: ${req.acceptanceCriteria}\n\n`;
      if (req.businessRules) {
        md += `**业务规则**: ${req.businessRules}\n\n`;
      }
    }
    md += `---\n\n`;
  }

  return md;
}

// ─── Schema 校验（纯函数，可供测试）──────────────────────────────────────────

function validatePRD(data) {
  const errors = [];
  for (const key of PRD_SCHEMA.required) {
    if (!data[key] && data[key] !== 0) {
      errors.push(`缺少必需字段: ${key}`);
    }
  }
  if (data.functionalRequirements) {
    if (!Array.isArray(data.functionalRequirements)) {
      errors.push('functionalRequirements 必须是数组');
    } else {
      data.functionalRequirements.forEach((item, i) => {
        for (const req of ['id', 'description', 'acceptanceCriteria']) {
          if (!item[req]) {
            errors.push(`functionalRequirements[${i}] 缺少必需字段: ${req}`);
          }
        }
      });
    }
  }
  return { valid: errors.length === 0, errors };
}

// ─── 导出 ───────────────────────────────────────────────────────────────────
module.exports = {
  meta,
  execute,
  // 导出纯函数供测试
  PRD_SCHEMA,
  PM_PROMPT,
  formatPRD,
  validatePRD,
};
