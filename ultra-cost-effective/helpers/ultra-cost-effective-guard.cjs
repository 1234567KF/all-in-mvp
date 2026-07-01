#!/usr/bin/env node
/**
 * ultra-cost-effective-guard.cjs — 跨技能生效保障引擎 (UltraCostEffective 兼容层)
 *
 * 当项目中有多个技能共存时，确保 UltraCostEffective 的每一层优化确实生效：
 *   1. PreToolUse:  验证 UltraCostEffective 管道未被其他技能移除
 *   2. PostToolUse:  验证压缩曾实际执行，检测绕过
 *   3. Effectiveness: 逐调用审计哪些层激活了
 *
 * 设计原则:
 *   - 非阻塞：永远不阻止命令执行，只审计
 *   - 零依赖：纯 Node.js，读已有数据文件
 *   - 多技能友好：检测到其他压缩工具时给出兼容提示
 *
 * 用法:
 *   node ultra-cost-effective-guard.cjs pre-check "<command>"        # 执行前检查
 *   node ultra-cost-effective-guard.cjs post-verify <output_size>     # 执行后验证
 *   node ultra-cost-effective-guard.cjs audit                         # 本次会话生效审计
 *   node ultra-cost-effective-guard.cjs report                        # 跨技能兼容性报告
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── 基准路径 ──────────────────────────────────

const TRACKER_FILE = path.join(os.tmpdir(), 'ultra-cost-effective-perf-tracker.json');
const MEMORY_FILE = path.join(os.tmpdir(), 'ultra-cost-effective-session-memory.json');
const GUARD_LOG = path.join(os.tmpdir(), 'ultra-cost-effective-guard-log.json');
const WORKFLOW_LOG = path.join(os.tmpdir(), 'ultra-cost-effective-workflow-log.json');

// ─── Agent spawn 检测关键词 ───────────────────

const AGENT_SPAWN_PATTERNS = [
  /\bAgent\b.*\(/i,          // Agent tool call
  /\bspawn\b.*agent/i,        // spawn agent
  /\bsubagent\b/i,            // subagent keyword
  /\bsub_agent\b/i,           // sub_agent keyword
  /\blaunch.*agent\b/i,       // launch agent
  /subagent_type/i,           // subagent_type parameter
];

// ─── Workflow 触发检测关键词 ─────────────────

const WORKFLOW_TRIGGER_PATTERNS = [
  /\bultracode\b/i,              // ultracode 关键词
  /\/deep-research\b/,            // 内置工作流命令
  /\/workflows?\b/,               // /workflows 管理命令
  /\/effort\s+ultracode\b/i,      // /effort ultracode
  /\bdynamic\s+workflow\b/i,      // 自然语言
  /\brun\s+(a\s+)?workflow\b/i,   // "run a workflow"
  /\buse\s+(a\s+)?workflow\b/i,   // "use a workflow"
];

// ─── 已知的第三方压缩/节能工具 ──────────────────

const KNOWN_COMPRESSORS = [
  { pattern: /tokenforge/i,        name: 'tokenforge (UltraCostEffective)',         conflicts: false },
  { pattern: /headroom/i,          name: 'Headroom (UltraCostEffective CCR)',       conflicts: false },
  { pattern: /claude-token-optim/i,name: 'claude-token-optimizer',     conflicts: true  },
  { pattern: /llmlingua/i,         name: 'LLMLingua',                  conflicts: true  },
  { pattern: /compressor/i,        name: '第三方压缩器(通用)',         conflicts: true  },
  { pattern: /\|\s*sed\b/i,        name: 'sed 行过滤',                 conflicts: false },
  { pattern: /\|\s*grep\b/i,       name: 'grep 过滤',                  conflicts: false },
  { pattern: /\|\s*head\b/i,       name: 'head 截断',                  conflicts: false },
  { pattern: /\|\s*tail\b/i,       name: 'tail 截断',                  conflicts: false },
  { pattern: /jq\b/,               name: 'jq JSON处理',                conflicts: false },
];

// ─── 生效审计日志 ──────────────────────────────

function loadGuardLog() {
  try {
    if (fs.existsSync(GUARD_LOG)) return JSON.parse(fs.readFileSync(GUARD_LOG, 'utf-8'));
  } catch {}
  return { calls: [], lastAudit: null, totalChecks: 0, bypassed: 0 };
}

function saveGuardLog(log) {
  if (log.calls.length > 200) log.calls = log.calls.slice(-200);
  fs.writeFileSync(GUARD_LOG, JSON.stringify(log, null, 2), 'utf-8');
}

function appendGuardEntry(entry) {
  const log = loadGuardLog();
  log.totalChecks++;
  if (!entry.ultraCostEffectiveApplied) log.bypassed++;
  log.calls.push({ ...entry, time: Date.now() });
  saveGuardLog(log);
}

// ─── 1. Agent Spawn 检测 ─────────────────────────

/**
 * 检测命令或上下文是否涉及 Agent spawn
 */
function isAgentSpawn(command, toolName = '') {
  if (!command && !toolName) return false;

  // 工具名直接匹配
  if (toolName && (toolName === 'Agent' || toolName === 'spawn' || toolName.toLowerCase().includes('agent'))) {
    return true;
  }

  // 命令模式匹配
  if (command) {
    for (const pattern of AGENT_SPAWN_PATTERNS) {
      if (pattern.test(command)) return true;
    }
  }

  return false;
}

/**
 * 检测命令是否触发 Dynamic Workflow
 * @param {string} command - 命令或提示
 * @returns {{ isWorkflow: boolean, trigger: string|null }}
 */
function isWorkflowTrigger(command) {
  if (!command) return { isWorkflow: false, trigger: null };

  for (const pattern of WORKFLOW_TRIGGER_PATTERNS) {
    if (pattern.test(command)) {
      return { isWorkflow: true, trigger: command.match(pattern)?.[0] || 'workflow' };
    }
  }

  return { isWorkflow: false, trigger: null };
}

/**
 * Workflow 触发前置拦截：生成预工作流压缩策略
 * @param {string} command - 触发命令
 * @returns {{ isWorkflow: boolean, hint: string|null, contextHealth: object|null }}
 */
function preWorkflow(command) {
  const detection = isWorkflowTrigger(command);
  if (!detection.isWorkflow) {
    return { isWorkflow: false, hint: null, contextHealth: null };
  }

  let contextHealth = null;
  try {
    const interceptor = require('./context-interceptor.cjs');
    const hint = interceptor.preWorkflowHint();
    contextHealth = interceptor.getContextHealth();

    // 记录到 guard log
    appendGuardEntry({
      phase: 'workflow',
      command: command.slice(0, 120),
      trigger: detection.trigger,
      ultraCostEffectiveApplied: true,
      engine: 'workflow-integrator',
      shouldApply: true,
      warnings: contextHealth.status !== 'green' ? [`上下文${contextHealth.status}，已注入预工作流压缩提示`] : [],
      conflicts: [],
      reason: `Workflow 触发拦截: 上下文${contextHealth.status} (${contextHealth.ratio}%)`
    });

    return { isWorkflow: true, hint, contextHealth };
  } catch {
    return { isWorkflow: true, hint: '[UltraCostEffective] Workflow 触发检测到，建议预压缩上下文', contextHealth: null };
  }
}

/**
 * Agent spawn 前置拦截：生成压缩上下文指导
 * 在 LLM 即将 spawn agent 时调用，确保子 agent 获得压缩上下文
 * @param {string} [command] - 触发命令
 * @param {string} [toolName] - 工具名
 * @returns {{ isSpawn: boolean, hint: string|null, contextHealth: object|null }}
 */
function preAgentSpawn(command = '', toolName = '') {
  if (!isAgentSpawn(command, toolName)) {
    return { isSpawn: false, hint: null, contextHealth: null };
  }

  let contextHealth = null;
  try {
    const interceptor = require('./context-interceptor.cjs');
    const hint = interceptor.preAgentSpawnHint();
    contextHealth = interceptor.getContextHealth();

    // 记录到 guard log
    appendGuardEntry({
      phase: 'agent-spawn',
      command: command.slice(0, 120),
      toolName,
      ultraCostEffectiveApplied: true,
      engine: 'context-interceptor',
      shouldApply: true,
      warnings: contextHealth.status !== 'green' ? [`上下文${contextHealth.status}，已注入压缩提示`] : [],
      conflicts: [],
      reason: `Agent spawn 拦截: 上下文${contextHealth.status} (${contextHealth.ratio}%)`
    });

    return { isSpawn: true, hint, contextHealth };
  } catch {
    // context-interceptor 不可用
    return { isSpawn: true, hint: '[UltraCostEffective] Agent spawn 检测到，建议传递压缩上下文', contextHealth: null };
  }
}

// ─── 2. 执行前检查 ──────────────────────────────

/**
 * 检查命令中 UltraCostEffective 的注入是否仍然存在
 * @returns {{ safe: boolean, ultraCostEffectivePresent: boolean, warnings: string[], conflicts: string[] }}
 */
function preCheck(command) {
  if (!command) return { safe: true, ultraCostEffectivePresent: false, warnings: [], conflicts: [], reason: '空命令' };

  const warnings = [];
  const conflicts = [];

  // 检测 UltraCostEffective 标记
  const hasTokenforge = command.includes('tokenforge.cjs') || command.includes('tokenforge');
  const hasHeadroom = command.includes('headroom-adapter.cjs') || command.includes('headroom');

  // 检测是否为 UltraCostEffective 受益命令（从 BENEFIT_COMMANDS 白名单判断）
  const base = (command.trim().split(/\s+/)[0] || '').toLowerCase().replace(/^.*[\\/]/, '');
  const ultraCostEffectiveShouldApply = isBenefitCommand(base, command);

  // 检测是否为 Agent spawn 操作
  const spawnDetected = isAgentSpawn(command);

  // 检测是否为 Workflow 触发
  const workflowDetection = isWorkflowTrigger(command);

  // 检测其他压缩器
  for (const comp of KNOWN_COMPRESSORS) {
    if (comp.pattern.test(command)) {
      if (comp.conflicts && !comp.name.includes('UltraCostEffective')) {
        conflicts.push(comp.name);
      }
    }
  }

  // 检查是否有 UltraCostEffective 被绕过的情况
  if (ultraCostEffectiveShouldApply && !hasTokenforge && !hasHeadroom) {
    warnings.push(`命令应被 UltraCostEffective 压缩但未注入管道: ${command.slice(0, 80)}`);
  }

  // Agent spawn 警告：建议传递压缩上下文
  if (spawnDetected && !workflowDetection.isWorkflow) {
    warnings.push(`Agent spawn 检测到，建议传递压缩上下文摘要 + session-memory 索引`);
  }

  // Workflow 警告：触发预压缩
  if (workflowDetection.isWorkflow) {
    warnings.push(`Workflow 触发检测到 (${workflowDetection.trigger})，建议预压缩上下文 + 传递 session-memory 索引给所有子 agent`);
  }

  // 检查是否有重复管道
  const pipeCount = (command.match(/\|\s*node\s+/g) || []).length;
  if (pipeCount > 2) {
    warnings.push(`检测到 ${pipeCount} 个 node 管道，可能存在多层技能注入`);
  }

  // 如果其他技能已注入压缩，但 UltraCostEffective 也在
  if (conflicts.length > 0 && (hasTokenforge || hasHeadroom)) {
    warnings.push(`UltraCostEffective 与 ${conflicts.join(', ')} 可能产生双重压缩，建议禁用其一`);
  }

  return {
    safe: conflicts.length === 0,
    ultraCostEffectivePresent: hasTokenforge || hasHeadroom,
    engine: hasHeadroom ? 'headroom' : hasTokenforge ? 'tokenforge' : 'none',
    shouldApply: ultraCostEffectiveShouldApply,
    isAgentSpawn: spawnDetected,
    isWorkflow: workflowDetection.isWorkflow,
    workflowTrigger: workflowDetection.trigger,
    warnings,
    conflicts,
    reason: warnings.length > 0 ? warnings[0] : 'ok'
  };
}

// ─── 2. 执行后验证 ─────────────────────────────

/**
 * 验证压缩是否实际发生
 * @param {string} command - 已执行的命令
 * @param {number} outputSize - 输出大小（字节）
 * @param {string} stderr - stderr 内容（可选，查找压缩标记）
 * @returns {{ verified: boolean, compressed: boolean, hints: string[] }}
 */
function postVerify(command, outputSize, stderr = '') {
  const hints = [];
  let compressed = false;

  // 检查命令中的 UltraCostEffective 管道
  const hadTokenforge = command.includes('tokenforge.cjs');
  const hadHeadroom = command.includes('headroom-adapter.cjs');

  // 检查 stderr 中的压缩标记
  if (stderr) {
    if (stderr.includes('[tokenforge]')) {
      compressed = true;
      hints.push('tokenforge 标记检测到 (stderr)');
    }
    if (stderr.includes('[headroom]')) {
      compressed = true;
      hints.push('headroom 标记检测到 (stderr)');
    }
  }

  // 检测输出中是否有 UltraCostEffective 压缩摘要行（stderr 写到了输出）
  if (!compressed && hadTokenforge) {
    // 管道模式下 tokenforge summary 写到 stderr，stdout 只有压缩后内容
    // 如果 stdout 很小（<100字节），可能是被压缩了
    if (outputSize < 200 && outputSize > 0) {
      compressed = true;
      hints.push(`输出极小(${outputSize}字节)，疑似被 tokenforge 压缩`);
    }
  }

  // 如果命令有 UltraCostEffective 管道但没检测到压缩标记
  if ((hadTokenforge || hadHeadroom) && !compressed) {
    hints.push(`⚠ 命令有 UltraCostEffective 管道但未检测到压缩标记，可能被绕过`);
  }

  return {
    verified: compressed || (!hadTokenforge && !hadHeadroom), // 没管道就不需要验证
    compressed,
    usedTokenforge: hadTokenforge,
    usedHeadroom: hadHeadroom,
    hints
  };
}

// ─── 3. 缩放效果综合审计 ──────────────────────

/**
 * 逐调动生效审计
 */
function auditEffectiveness() {
  const report = loadGuardLog();
  const total = report.totalChecks || report.calls.length;
  const bypassed = report.bypassed || report.calls.filter(c => !c.ultraCostEffectiveApplied).length;

  // 读取 perf-tracker 获取分层数据
  let trackerData = null;
  try {
    if (fs.existsSync(TRACKER_FILE)) {
      trackerData = JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf-8'));
    }
  } catch {}

  // 读取 session-memory
  let memoryData = null;
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      memoryData = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
    }
  } catch {}

  const lines = [];
  lines.push('═'.repeat(55));
  lines.push('  UltraCostEffective 跨技能生效审计');
  lines.push('═'.repeat(55));
  lines.push('');

  // ── 命令级生效率 ──
  if (total > 0) {
    const rate = ((total - bypassed) / total * 100).toFixed(1);
    lines.push(`命令级生效率: ${rate}% (${total - bypassed}/${total})`);
    if (bypassed > 0) {
      lines.push(`  绕过次数:     ${bypassed}`);
      const bypassedCalls = report.calls.filter(c => !c.ultraCostEffectiveApplied).slice(-5);
      for (const c of bypassedCalls) {
        lines.push(`  ⚠ ${c.reason || '未知原因'} | ${(c.command || '').slice(0, 60)}`);
      }
    }
    lines.push('');
  }

  // ── 分层生效 ──
  if (trackerData && trackerData.layerSavings) {
    lines.push('─── 分层生效状态 ───');
    const ls = trackerData.layerSavings;

    const l1Status = ls.L1_tokenforge.calls > 0 ? '✅ 活跃' : '⚠ 无调用';
    lines.push(`L1 tokenforge:  ${l1Status}  (${ls.L1_tokenforge.calls}次, 省${(ls.L1_tokenforge.savedTokens/1000).toFixed(1)}K tokens)`);

    
    const l2Status = ls.L2_kvCache.calls > 0 || (trackerData.totalCacheHitTokens > 0) ? '✅ 活跃' : '⚠ 无命中';
    const hitRate = trackerData.totalCacheHitTokens + trackerData.totalCacheMissTokens > 0
      ? (trackerData.totalCacheHitTokens / (trackerData.totalCacheHitTokens + trackerData.totalCacheMissTokens) * 100).toFixed(1)
      : '0.0';
    lines.push(`L2 KV Cache:    ${l2Status}  (命中率 ${hitRate}%)`);

    const l7Status = ls.L7_router.calls > 0 ? '✅ 活跃' : '⚠ 无切换';
    lines.push(`L7 模型路由:     ${l7Status}  (${ls.L7_router.flashDowngrades}次Flash降级)`);
    lines.push('');
  }

  // ── 会话记忆生效 ──
  if (memoryData && memoryData.records) {
    const tf = memoryData.records.filter(r => r.compressor === 'tokenforge').length;
    const hr = memoryData.records.filter(r => r.compressor === 'headroom').length;
    lines.push('─── 记忆索引 ───');
    lines.push(`tokenforge 原文: ${tf}条  |  headroom 原文: ${hr}条`);
    lines.push(`总可检索: ${tf + hr}条  |  TTL: 2小时`);
    lines.push('');
  }

  // ── Agent Spawn 拦截 ──
  const spawnCalls = report.calls.filter(c => c.phase === 'agent-spawn');
  if (spawnCalls.length > 0) {
    lines.push('─── Agent Spawn 拦截 ───');
    lines.push(`拦截次数: ${spawnCalls.length}`);
    const redSpawns = spawnCalls.filter(c => c.reason && c.reason.includes('red'));
    const yellowSpawns = spawnCalls.filter(c => c.reason && c.reason.includes('yellow'));
    if (redSpawns.length > 0) lines.push(`  🔴 红色预警 spawn: ${redSpawns.length} 次`);
    if (yellowSpawns.length > 0) lines.push(`  🟡 黄色预警 spawn: ${yellowSpawns.length} 次`);
    lines.push('');
  }

  // ── Workflow 拦截 ──
  const workflowCalls = report.calls.filter(c => c.phase === 'workflow');
  if (workflowCalls.length > 0) {
    lines.push('─── Dynamic Workflow 拦截 ───');
    lines.push(`拦截次数: ${workflowCalls.length}`);
    const triggers = {};
    for (const c of workflowCalls) {
      const t = c.trigger || 'unknown';
      triggers[t] = (triggers[t] || 0) + 1;
    }
    for (const [t, count] of Object.entries(triggers)) {
      lines.push(`  ${t}: ${count} 次`);
    }
    lines.push('');
  }

  // ── Workflow ROI 摘要 ──
  let workflowLog = null;
  try {
    if (fs.existsSync(WORKFLOW_LOG)) {
      workflowLog = JSON.parse(fs.readFileSync(WORKFLOW_LOG, 'utf-8'));
    }
  } catch {}
  if (workflowLog && workflowLog.runs && workflowLog.runs.length > 0) {
    lines.push('─── Workflow ROI ───');
    const runs = workflowLog.runs;
    const totalTokens = runs.reduce((s, r) => s + (r.tokens || 0), 0);
    lines.push(`工作流运行: ${runs.length} 次 | 总Token: ${(totalTokens/1000).toFixed(1)}K`);
    lines.push(`详见: node workflow-integrator.cjs roi`);
    lines.push('');
  }

  // ── 跨技能兼容性 ──
  const conflictCalls = report.calls.filter(c => c.conflicts && c.conflicts.length > 0);
  if (conflictCalls.length > 0) {
    lines.push('─── 跨技能冲突 ───');
    lines.push(`检测到 ${conflictCalls.length} 次潜在冲突`);
    const seen = new Set();
    for (const c of conflictCalls) {
      for (const cft of c.conflicts) {
        if (!seen.has(cft)) {
          seen.add(cft);
          lines.push(`  ⚠ ${cft} — 可能与 UltraCostEffective 冲突`);
        }
      }
    }
    lines.push('');
  }

  // ── 综合评分 ──
  const scores = [];
  if (trackerData && trackerData.layerSavings && trackerData.layerSavings.L1_tokenforge.calls > 0) scores.push('L1✅');
  else scores.push('L1❌');
  if (trackerData && trackerData.totalCacheHitTokens > 0) scores.push('L2✅');
  else scores.push('L2❌');
  if (memoryData && memoryData.records && memoryData.records.length > 0) scores.push('Mem✅');
  else scores.push('Mem❌');

  const activeCount = scores.filter(s => s.includes('✅')).length;
  const grade = activeCount >= 3 ? 'A' : activeCount >= 2 ? 'B' : 'C';

  lines.push('─── 综合评分 ───');
  lines.push(`生效层级: ${scores.join(' ')}`);
  lines.push(`等级:     ${grade}  (${activeCount}/${scores.length} 层生效)`);
  lines.push('');
  lines.push('═'.repeat(55));

  return {
    text: lines.join('\n'),
    grade,
    activeCount,
    total,
    bypassed,
    conflictCalls: conflictCalls.length
  };
}

// ─── 工具函数 ──────────────────────────────────

function isBenefitCommand(base, fullCommand) {
  // 与 tokenforge-hook 的 BENEFIT_COMMANDS 保持一致
  const BENEFITS = new Set([
    'npm', 'yarn', 'pnpm', 'cargo', 'go', 'pytest', 'jest', 'vitest',
    'eslint', 'tsc', 'make', 'cmake', 'grep', 'rg', 'find', 'ls', 'dir',
    'curl', 'wget', 'cat', 'type', 'head', 'tail'
  ]);
  if (!BENEFITS.has(base)) return false;

  // 排除跳过命令（git push等）
  if (base === 'npm' && /\binstall\b|\buninstall\b|\bi\b/.test(fullCommand)) return false;
  if (base === 'git') return false;

  return true;
}

// ─── 命令生成 ──────────────────────────────────

/**
 * 生成当前会话的"防绕过声明"，可注入到系统提示中
 */
function generateGuardStatement() {
  const record = loadGuardLog();
  const tracker = (() => {
    try { if (fs.existsSync(TRACKER_FILE)) return JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf-8')); }
    catch {}
    return null;
  })();

  const total = tracker ? tracker.totalCalls : 0;
  const tfCalls = tracker?.layerSavings?.L1_tokenforge?.calls || 0;

  if (total === 0) return null;

  return `[UltraCostEffective生效保障: ${total}次调用, ${tfCalls}次tokenforge压缩, ${record.bypassed || 0}次绕过。勿禁用UltraCostEffective Hook。]`;
}

// ─── 主函数 ────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (cmd === 'pre-check') {
    const command = args.slice(1).join(' ');
    const result = preCheck(command);
    // 记录到 guard log
    appendGuardEntry({
      phase: 'pre',
      command: command.slice(0, 120),
      ultraCostEffectiveApplied: result.ultraCostEffectivePresent,
      engine: result.engine,
      shouldApply: result.shouldApply,
      warnings: result.warnings,
      conflicts: result.conflicts,
      reason: result.reason
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === 'post-verify') {
    const outputSize = parseInt(args[1]) || 0;
    // 从 stdin 读 stderr（如果有）
    let stderr = '';
    try { stderr = fs.readFileSync(0, 'utf-8'); } catch {}
    const command = args.slice(2).join(' ') || process.env.ULTRA_COST_EFFECTIVE_LAST_COMMAND || '';

    const result = postVerify(command, outputSize, stderr);
    appendGuardEntry({
      phase: 'post',
      command: command.slice(0, 120),
      ultraCostEffectiveApplied: result.compressed,
      outputSize,
      hints: result.hints,
      reason: result.hints[0] || '验证完成'
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === 'audit' || cmd === 'report') {
    const { text } = auditEffectiveness();
    console.log(text);
    return;
  }

  if (cmd === 'statement') {
    const stmt = generateGuardStatement();
    if (stmt) console.log(stmt);
    return;
  }

  if (cmd === 'pre-agent-spawn') {
    const command = args.slice(1).join(' ');
    const toolName = args[1] || '';
    const result = preAgentSpawn(command, toolName);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === 'pre-workflow') {
    const command = args.slice(1).join(' ');
    const result = preWorkflow(command);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === 'detect-workflow') {
    const command = args.slice(1).join(' ');
    const result = isWorkflowTrigger(command);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // 默认: 状态概览
  const log = loadGuardLog();
  console.log('═══════════════════════════════════');
  console.log('  UltraCostEffective Guard — 跨技能保障');
  console.log('═══════════════════════════════════');
  console.log(`  检查总数: ${log.totalChecks || log.calls.length}`);
  console.log(`  绕过次数: ${log.bypassed || log.calls.filter(c => !c.ultraCostEffectiveApplied).length}`);
  console.log('');
  console.log('命令:');
  console.log('  pre-check <cmd>    执行前检查');
  console.log('  post-verify <size> 执行后验证');
  console.log('  audit              生效审计');
  console.log('  statement          防绕过声明');
  console.log('  reset              重置日志');
}

if (require.main === module) {
  main();
}

module.exports = {
  preCheck,
  postVerify,
  preAgentSpawn,
  preWorkflow,
  isAgentSpawn,
  isWorkflowTrigger,
  auditEffectiveness,
  generateGuardStatement,
  loadGuardLog,
  appendGuardEntry,
  isBenefitCommand
};
