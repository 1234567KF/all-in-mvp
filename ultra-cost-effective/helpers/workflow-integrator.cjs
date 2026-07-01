#!/usr/bin/env node
/**
 * workflow-integrator.cjs — UltraCostEffective × Claude Code Dynamic Workflows 集成引擎
 *
 * Claude Code Dynamic Workflows (v2.1.154+) 将计划从聊天剥离为可复跑的 JS 脚本，
 * 由运行时编排最多 1000 个子 agent 并发执行。
 *
 * 本模块在三个层面与 Dynamic Workflows 深度集成：
 *
 *   1. Pre-Workflow Compression（预工作流压缩）
 *      在 workflow 脚本生成前压缩上下文 → 脚本生成更精准 → 所有子 agent 继承压缩上下文
 *      乘法级节省：单体压缩比 × N 个子 agent
 *
 *   2. Workflow-Aware Guard（工作流感知守卫）
 *      检测 ultracode/workflow 触发词，自动触发预压缩
 *      区分 workflow 与普通 agent spawn 的压缩策略
 *
 *   3. Deterministic ROI Backtesting（确定性 ROI 回测）
 *      利用 workflow 脚本的确定性（可重跑）特性：
 *      - 记录每次 workflow 运行的上下文健康基线
 *      - 对比启用/未启用压缩的 token 消耗
 *      - 生成精确 ROI 报告
 *
 * 用法:
 *   node workflow-integrator.cjs detect "<prompt>"          # 检测 workflow 触发
 *   node workflow-integrator.cjs pre-workflow <agentCount>  # 预工作流压缩策略
 *   node workflow-integrator.cjs profile <workflow-type>    # 获取工作流专属预设
 *   node workflow-integrator.cjs roi [workflow-name]        # ROI 回测报告
 *   node workflow-integrator.cjs track <name> <tokens>      # 记录一次 workflow 运行
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── 数据文件 ──────────────────────────────────

const TRACKER_FILE = path.join(os.tmpdir(), 'ultra-cost-effective-perf-tracker.json');
const MEMORY_FILE = path.join(os.tmpdir(), 'ultra-cost-effective-session-memory.json');
const WORKFLOW_LOG = path.join(os.tmpdir(), 'ultra-cost-effective-workflow-log.json');

// ─── Workflow 触发检测 ─────────────────────────

/**
 * Workflow 触发关键词与模式
 * 覆盖 Claude Code Dynamic Workflows 的所有触发方式
 */
const WORKFLOW_PATTERNS = [
  /\bultracode\b/i,                              // ultracode 关键词触发
  /\/deep-research\b/,                            // 内置工作流命令
  /\/workflows?\b/,                               // /workflows 管理命令
  /\/effort\s+ultracode\b/i,                      // /effort ultracode 模式
  /\bdynamic\s+workflow\b/i,                      // 自然语言 "dynamic workflow"
  /\brun\s+(a\s+)?workflow\b/i,                   // "run a workflow"
  /\buse\s+(a\s+)?workflow\b/i,                   // "use a workflow"
  /\bworkflow\s+script\b/i,                       // "workflow script"
  /\/\w[\w-]+(?=\s|$)/,                           // 已保存的工作流命令如 /audit-api
];

/**
 * 已知的内置工作流类型
 */
const BUILTIN_WORKFLOWS = {
  'deep-research': {
    name: 'deep-research',
    description: '多源交叉验证研究',
    recommendedPreset: 'moderate',
    estimatedAgents: 20,
    contextSensitivity: 'high' // 需要引用追溯
  }
};

/**
 * 工作流专属压缩预设
 */
const WORKFLOW_PRESETS = {
  moderate: {
    name: 'moderate',
    compression: 0.65,     // 65% 压缩比
    preserveCode: true,    // 保留代码精确度
    preserveRefs: true,    // 保留引用追溯
    description: '中等压缩，保留引用追溯'
  },
  aggressive: {
    name: 'aggressive',
    compression: 0.80,
    preserveCode: true,
    preserveRefs: false,
    description: '激进压缩，代码精确但丢弃引用'
  },
  codeAudit: {
    name: 'codeAudit',
    compression: 0.75,
    preserveCode: true,
    preserveRefs: false,
    description: '代码审计：代码精确，文档激进压缩'
  },
  migration: {
    name: 'migration',
    compression: 0.70,
    preserveCode: true,
    preserveRefs: true,
    description: '迁移：代码精确，保留文档引用'
  },
  refactor: {
    name: 'refactor',
    compression: 0.60,
    preserveCode: true,
    preserveRefs: true,
    description: '重构：高可靠性，保守压缩'
  }
};

// ─── 数据读取 ──────────────────────────────────

function loadTracker() {
  try {
    if (fs.existsSync(TRACKER_FILE)) {
      return JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf-8'));
    }
  } catch {}
  return null;
}

function loadMemory() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
    }
  } catch {}
  return null;
}

function loadWorkflowLog() {
  try {
    if (fs.existsSync(WORKFLOW_LOG)) {
      return JSON.parse(fs.readFileSync(WORKFLOW_LOG, 'utf-8'));
    }
  } catch {}
  return { runs: [], lastAudit: null };
}

function saveWorkflowLog(log) {
  // 保留最近 50 次运行记录
  if (log.runs.length > 50) log.runs = log.runs.slice(-50);
  fs.writeFileSync(WORKFLOW_LOG, JSON.stringify(log, null, 2), 'utf-8');
}

// ─── 1. Workflow 触发检测 ─────────────────────

/**
 * 检测用户输入是否触发了 Dynamic Workflow
 * @param {string} prompt - 用户输入
 * @returns {{ isWorkflow: boolean, trigger: string|null, triggerType: string|null }}
 */
function detectWorkflowTrigger(prompt) {
  if (!prompt) return { isWorkflow: false, trigger: null, triggerType: null };

  // 优先级：/effort ultracode > ultracode > /deep-research > 自然语言 > 已保存命令
  if (/\/effort\s+ultracode\b/i.test(prompt)) {
    return { isWorkflow: true, trigger: 'effort-ultracode', triggerType: 'effort' };
  }

  if (/\bultracode\b/i.test(prompt)) {
    return { isWorkflow: true, trigger: 'ultracode', triggerType: 'keyword' };
  }

  if (/\/deep-research\b/.test(prompt)) {
    return { isWorkflow: true, trigger: 'deep-research', triggerType: 'builtin' };
  }

  if (/\/workflows?\b/.test(prompt)) {
    return { isWorkflow: true, trigger: 'workflows-manage', triggerType: 'management' };
  }

  // 自然语言请求
  const nlPatterns = [
    { pattern: /\bdynamic\s+workflow\b/i, label: 'dynamic-workflow' },
    { pattern: /\brun\s+(a\s+)?workflow\b/i, label: 'run-workflow' },
    { pattern: /\buse\s+(a\s+)?workflow\b/i, label: 'use-workflow' },
  ];

  for (const { pattern, label } of nlPatterns) {
    if (pattern.test(prompt)) {
      return { isWorkflow: true, trigger: label, triggerType: 'natural-language' };
    }
  }

  // 检查已保存的自定义工作流命令（/xxx 格式）
  const cmdMatch = prompt.match(/^\/(\w[\w-]*)/);
  if (cmdMatch) {
    const cmdName = cmdMatch[1].toLowerCase();
    if (cmdName !== 'workflows' && cmdName !== 'workflow') {
      // 可能是已保存的自定义工作流
      return { isWorkflow: false, trigger: cmdName, triggerType: 'saved-command' };
    }
  }

  return { isWorkflow: false, trigger: null, triggerType: null };
}

// ─── 2. 预工作流压缩策略 ─────────────────────

/**
 * 估算 workflow 运行将产生的 agent 数和 token 消耗
 * @param {object} [workflowInfo] - 工作流信息
 * @returns {{ estimatedAgents: number, estimatedTokens: number, multiplier: number }}
 */
function estimateWorkflowScale(workflowInfo = {}) {
  // 默认估算：基于 Dynamic Workflows 的文档
  const MAX_CONCURRENT = 16;
  const DEFAULT_PHASES = 3;
  const DEFAULT_AGENTS_PER_PHASE = 5;

  const totalAgents = workflowInfo.estimatedAgents
    || (DEFAULT_PHASES * DEFAULT_AGENTS_PER_PHASE);

  // 每个 agent 平均 token 消耗（基于 Claude Code 文档中的典型值）
  const AVG_AGENT_TOKENS = 15000;

  return {
    estimatedAgents: totalAgents,
    estimatedTokens: totalAgents * AVG_AGENT_TOKENS,
    multiplier: totalAgents,
    maxConcurrent: Math.min(totalAgents, MAX_CONCURRENT)
  };
}

/**
 * 生成预工作流压缩策略
 * 在 workflow 脚本生成前调用，为所有子 agent 预设压缩上下文
 *
 * @param {number} [agentCount] - 预期 agent 数量
 * @param {string} [workflowType] - 工作流类型
 * @returns {object} 压缩策略对象
 */
function preWorkflowStrategy(agentCount, workflowType) {
  let interceptor;
  try {
    interceptor = require('./context-interceptor.cjs');
  } catch {
    return null;
  }

  const health = interceptor.getContextHealth();
  const memory = loadMemory();
  const scale = estimateWorkflowScale({ estimatedAgents: agentCount });

  // 根据当前上下文健康度选择预设
  let presetName;
  if (health.status === 'red') {
    presetName = 'aggressive';
  } else if (health.status === 'yellow') {
    presetName = workflowType ? matchPreset(workflowType) : 'moderate';
  } else {
    presetName = workflowType ? matchPreset(workflowType) : 'moderate';
  }

  const preset = WORKFLOW_PRESETS[presetName] || WORKFLOW_PRESETS.moderate;

  // 构建提示
  let hint = '[UltraCostEffective Pre-Workflow Compression]';
  hint += `\n上下文健康: ${health.status} (${health.estimatedTokens}/${health.windowSize} tokens, ${health.ratio}%)`;
  hint += `\n工作流规模: ~${scale.estimatedAgents} 个 agent, ~${(scale.estimatedTokens/1000).toFixed(0)}K tokens (未压缩)`;
  hint += `\n压缩预设: ${preset.name} (${preset.description})`;

  // 乘法级节省估算
  const baselineTokens = scale.estimatedTokens;
  const compressedTokens = Math.round(baselineTokens * (1 - preset.compression));
  const savedTokens = baselineTokens - compressedTokens;
  hint += `\n预计节省: ${baselineTokens.toLocaleString()} → ${compressedTokens.toLocaleString()} tokens (${(savedTokens/baselineTokens*100).toFixed(0)}%)`;
  hint += `\n   (单体压缩 ${(preset.compression*100).toFixed(0)}% × ${scale.estimatedAgents} agent 乘法级传播)`;

  // session-memory 注入
  if (memory && memory.records && memory.records.length > 0) {
    hint += `\n\n会话记忆索引: ${memory.records.length} 条已压缩记录`;
    const recentRecords = memory.records.slice(-5);
    for (const r of recentRecords) {
      hint += `\n  · ${r.id.slice(0,16)} [${r.compressor}] ${(r.origSize/1024).toFixed(1)}KB→${(r.compSize/1024).toFixed(1)}KB`;
    }
    hint += `\n⚠ 所有子 agent 应传递 session-memory 索引引用，而非完整上下文历史。`;
  }

  // 红色紧急提示
  if (health.status === 'red') {
    hint += `\n🚨 上下文红色预警: 强烈建议先压缩主会话再生成工作流脚本。`;
    hint += `\n   未压缩状态下 ${scale.estimatedAgents} 个子 agent 将消耗 ${(scale.estimatedTokens/1000).toFixed(0)}K tokens。`;
  }

  return {
    hint,
    health,
    scale,
    preset,
    estimatedSavings: {
      baseline: baselineTokens,
      compressed: compressedTokens,
      saved: savedTokens,
      savingsRatio: savedTokens / baselineTokens
    }
  };
}

// ─── 3. 工作流专属预设匹配 ─────────────────────

/**
 * 根据工作流类型匹配压缩预设
 */
function matchPreset(workflowType) {
  if (!workflowType) return 'moderate';

  const type = workflowType.toLowerCase();

  // 内置工作流
  if (BUILTIN_WORKFLOWS[type]) {
    return BUILTIN_WORKFLOWS[type].recommendedPreset;
  }

  // 关键词匹配
  if (/audit|review|scan|lint/.test(type)) return 'codeAudit';
  if (/migrat|port|convert|transform/.test(type)) return 'migration';
  if (/refactor|restructur|rewrite/.test(type)) return 'refactor';
  if (/research|investigate|analyze/.test(type)) return 'moderate';

  return 'moderate';
}

/**
 * 获取工作流专属预设详情
 */
function getWorkflowPreset(workflowType) {
  const presetName = matchPreset(workflowType);
  const preset = WORKFLOW_PRESETS[presetName];
  return { presetName, ...preset };
}

// ─── 4. Workflow ROI 回测引擎 ──────────────────

/**
 * 记录一次 workflow 运行
 */
function trackWorkflowRun(workflowName, tokenUsage) {
  const log = loadWorkflowLog();

  const entry = {
    name: workflowName,
    tokens: typeof tokenUsage === 'number' ? tokenUsage : 0,
    timestamp: Date.now(),
    compressionEnabled: true,
    contextHealth: (() => {
      try {
        const interceptor = require('./context-interceptor.cjs');
        return interceptor.getContextHealth();
      } catch { return null; }
    })()
  };

  log.runs.push(entry);
  log.lastAudit = Date.now();
  saveWorkflowLog(log);

  return entry;
}

/**
 * 生成 ROI 回测报告
 * @param {string} [workflowName] - 过滤特定工作流
 * @returns {object} ROI 报告
 */
function generateROIReport(workflowName) {
  const log = loadWorkflowLog();
  let runs = log.runs;

  if (workflowName) {
    runs = runs.filter(r => r.name === workflowName);
  }

  if (runs.length === 0) {
    return {
      hasData: false,
      text: '[UltraCostEffective Workflow ROI] 尚无工作流运行记录。运行一次 workflow 后可查看。'
    };
  }

  const totalRuns = runs.length;
  const totalTokens = runs.reduce((s, r) => s + (r.tokens || 0), 0);
  const avgTokens = Math.round(totalTokens / totalRuns);

  // 读取压缩统计
  const tracker = loadTracker();
  const tfCalls = tracker?.layerSavings?.L1_tokenforge?.calls || 0;
  const tfSaved = tracker?.layerSavings?.L1_tokenforge?.savedTokens || 0;
  const avgCompressionRatio = tracker?.totalCompressionRatio || 0;

  // 估算未压缩基线
  const estimatedBaseline = avgCompressionRatio > 0
    ? Math.round(totalTokens / (1 - avgCompressionRatio))
    : Math.round(totalTokens * 3); // 粗估 3x

  const estimatedSavings = estimatedBaseline - totalTokens;
  const savingsPercent = estimatedBaseline > 0
    ? ((estimatedSavings / estimatedBaseline) * 100).toFixed(1)
    : 'N/A';

  // 构建报告
  const lines = [];
  lines.push('═'.repeat(55));
  lines.push('  UltraCostEffective × Dynamic Workflows ROI');
  lines.push('═'.repeat(55));
  lines.push('');
  lines.push(`工作流运行次数: ${totalRuns}`);
  lines.push(`总 Token 消耗:  ${totalTokens.toLocaleString()} tokens`);
  lines.push(`平均每次:       ${avgTokens.toLocaleString()} tokens`);
  lines.push('');

  if (workflowName) {
    lines.push(`工作流: ${workflowName}`);
    const matchingRuns = runs.filter(r => r.name === workflowName);
    lines.push(`  运行次数: ${matchingRuns.length}`);
    if (matchingRuns.length >= 2) {
      const tokens = matchingRuns.map(r => r.tokens);
      lines.push(`  Token 范围: ${Math.min(...tokens).toLocaleString()} ~ ${Math.max(...tokens).toLocaleString()}`);
      lines.push(`  Token 趋势: ${tokens[tokens.length-1] > tokens[0] ? '↗ 上升' : tokens[tokens.length-1] < tokens[0] ? '↘ 下降' : '→ 持平'}`);
    }
    lines.push('');
  }

  lines.push('─── 压缩效果 ───');
  lines.push(`tokenforge 调用: ${tfCalls} 次`);
  lines.push(`已省 Token:      ${(tfSaved/1000).toFixed(1)}K tokens`);
  lines.push('');
  lines.push('─── ROI 估算 ───');
  lines.push(`估算基线(未压缩): ${(estimatedBaseline/1000).toFixed(0)}K tokens`);
  lines.push(`实际消耗(已压缩): ${(totalTokens/1000).toFixed(0)}K tokens`);
  lines.push(`估算节省:         ${(estimatedSavings/1000).toFixed(0)}K tokens (${savingsPercent}%)`);
  lines.push('');

  // 乘法级节省
  const allAgents = runs.reduce((s, r) => {
    const scale = estimateWorkflowScale();
    return s + (r._agentCount || scale.estimatedAgents);
  }, 0);

  if (allAgents > 0) {
    lines.push('─── 乘法级传播 ───');
    lines.push(`总子 agent 数:    ${allAgents}`);
    lines.push(`单体压缩:         ~${(avgCompressionRatio * 100).toFixed(0) || 65}%`);
    lines.push(`传播后总节省:     ${(avgCompressionRatio * allAgents).toFixed(0)}× 单体节省`);
    lines.push('');
  }

  lines.push('═'.repeat(55));

  return {
    hasData: true,
    text: lines.join('\n'),
    totalRuns,
    totalTokens,
    avgTokens,
    estimatedBaseline,
    estimatedSavings,
    savingsPercent
  };
}

// ─── 5. 工作流感知 Guard 辅助 ──────────────────

/**
 * 是否为 workflow 相关操作（区别于单个 agent spawn）
 */
function isWorkflowOperation(prompt) {
  if (!prompt) return false;

  // 直接关键词
  if (/\bultracode\b/i.test(prompt)) return true;
  if (/\/deep-research\b/.test(prompt)) return true;
  if (/\/workflows?\b/.test(prompt)) return true;
  if (/\/effort\s+ultracode\b/i.test(prompt)) return true;

  // 自然语言
  if (/\bdynamic\s+workflow\b/i.test(prompt)) return true;
  if (/\brun\s+(a\s+)?workflow\b/i.test(prompt)) return true;
  if (/\buse\s+(a\s+)?workflow\b/i.test(prompt)) return true;

  return false;
}

/**
 * 生成 workflow 防绕过声明（注入系统提示）
 */
function generateWorkflowStatement() {
  const log = loadWorkflowLog();
  if (log.runs.length === 0) return null;

  const totalRuns = log.runs.length;
  const totalTokens = log.runs.reduce((s, r) => s + (r.tokens || 0), 0);
  return `[UltraCostEffective Workflow集成: ${totalRuns}次工作流运行, ${(totalTokens/1000).toFixed(0)}K tokens。ultracode/workflow 触发前自动预压缩。]`;
}

// ─── 命令行接口 ────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (cmd === 'detect') {
    const prompt = args.slice(1).join(' ');
    const result = detectWorkflowTrigger(prompt);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === 'pre-workflow') {
    const agentCount = parseInt(args[1]) || undefined;
    const workflowType = args[2] || undefined;
    const strategy = preWorkflowStrategy(agentCount, workflowType);
    if (strategy) {
      console.log(strategy.hint);
      console.log('\n--- JSON ---');
      console.log(JSON.stringify({
        preset: strategy.preset.name,
        scale: strategy.scale,
        savings: strategy.estimatedSavings
      }, null, 2));
    } else {
      console.log('[UltraCostEffective] context-interceptor 不可用，无法生成预工作流策略');
    }
    return;
  }

  if (cmd === 'profile') {
    const workflowType = args[1] || 'default';
    const profile = getWorkflowPreset(workflowType);
    console.log(JSON.stringify(profile, null, 2));
    return;
  }

  if (cmd === 'roi') {
    const workflowName = args[1] || undefined;
    const report = generateROIReport(workflowName);
    console.log(report.text);
    return;
  }

  if (cmd === 'track') {
    const name = args[1] || 'unnamed';
    const tokens = parseInt(args[2]) || 0;
    const entry = trackWorkflowRun(name, tokens);
    console.log(`已记录: ${name} | ${tokens.toLocaleString()} tokens | ${new Date(entry.timestamp).toISOString()}`);
    return;
  }

  if (cmd === 'statement') {
    const stmt = generateWorkflowStatement();
    if (stmt) console.log(stmt);
    else console.log('[UltraCostEffective Workflow] 暂无工作流运行记录');
    return;
  }

  // 默认: 状态概览
  const log = loadWorkflowLog();
  const totalRuns = log.runs.length;
  const totalTokens = log.runs.reduce((s, r) => s + (r.tokens || 0), 0);

  console.log('═══════════════════════════════════');
  console.log('  UltraCostEffective × Dynamic Workflows');
  console.log('═══════════════════════════════════');
  console.log(`  工作流运行: ${totalRuns} 次`);
  console.log(`  总Token:    ${(totalTokens/1000).toFixed(1)}K`);
  console.log('');
  console.log('命令:');
  console.log('  detect <prompt>        检测 workflow 触发');
  console.log('  pre-workflow [agents]  预工作流压缩策略');
  console.log('  profile <type>         工作流专属预设');
  console.log('  roi [name]             ROI 回测报告');
  console.log('  track <name> <tokens>  记录运行');
  console.log('  statement              防绕过声明');
}

if (require.main === module) {
  main();
}

module.exports = {
  detectWorkflowTrigger,
  isWorkflowOperation,
  preWorkflowStrategy,
  getWorkflowPreset,
  matchPreset,
  estimateWorkflowScale,
  trackWorkflowRun,
  generateROIReport,
  generateWorkflowStatement,
  loadWorkflowLog,
  WORKFLOW_PATTERNS,
  WORKFLOW_PRESETS,
  BUILTIN_WORKFLOWS
};
