#!/usr/bin/env node
/**
 * agent-spawn-guard.cjs — Agent Spawn PreToolUse 拦截器 (UltraCostEffective L6)
 *
 * PreToolUse Hook for Agent tool calls.
 * 在 LLM spawn 子 Agent 时，自动注入 session-memory 索引到 agent prompt 中。
 * 确保子 Agent 知道哪些内容已被压缩、如何取回原文。
 *
 * Claude Code PreToolUse Hook 集成:
 *   settings.json → hooks.PreToolUse → matcher: "Agent"
 *
 * 用法:
 *   node agent-spawn-guard.cjs                    # Hook 模式 (stdin)
 *   node agent-spawn-guard.cjs --test             # 测试
 *   node agent-spawn-guard.cjs status             # 查看当前状态
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const MEMORY_FILE = path.join(os.tmpdir(), 'ultra-cost-effective-session-memory.json');
const TRACKER_FILE = path.join(os.tmpdir(), 'ultra-cost-effective-perf-tracker.json');
const GUARD_LOG = path.join(os.tmpdir(), 'ultra-cost-effective-guard-log.json');

// ─── 数据读取 ──────────────────────────────────

function loadMemory() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
    }
  } catch {}
  return null;
}

function loadTracker() {
  try {
    if (fs.existsSync(TRACKER_FILE)) {
      return JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf-8'));
    }
  } catch {}
  return null;
}

// ─── 上下文估算 ────────────────────────────────

function estimateContextHealth() {
  const tracker = loadTracker();
  const memory = loadMemory();
  const windowSize = 128000;

  let estimatedTokens = 4000; // 系统提示基础

  if (tracker) {
    const totalCalls = tracker.totalCalls || 0;
    estimatedTokens += totalCalls * 1200; // 工具输出
    estimatedTokens += totalCalls * 800;  // LLM 响应
  }

  if (memory && memory.records) {
    estimatedTokens += memory.records.length * 200;
  }

  const ratio = estimatedTokens / windowSize;
  let status = 'green';
  if (ratio > 0.8) status = 'red';
  else if (ratio > 0.6) status = 'yellow';

  return { status, estimatedTokens, windowSize, ratio };
}

// ─── 生成 Agent 注入上下文 ────────────────────

function generateAgentContext() {
  const memory = loadMemory();
  const health = estimateContextHealth();
  const parts = [];

  // ★ 核心：session-memory 索引（始终注入）
  if (memory && memory.records && memory.records.length > 0) {
    const records = memory.records;
    const recentRecords = records.slice(-8);

    parts.push(`[UltraCostEffective 压缩上下文 — 父会话已压缩 ${records.length} 条工具输出]`);
    parts.push('');
    parts.push('以下工具输出已被压缩存储。如需查看原文，使用以下方式取回：');
    parts.push('  - 执行: node ultra-cost-effective/helpers/headroom-adapter.cjs retrieve <id>');
    parts.push('  - 或在对话中说: "取回 <id>"');
    parts.push('');

    // 最近压缩记录摘要
    parts.push('最近压缩记录:');
    for (const r of recentRecords) {
      const age = Math.floor((Date.now() - r.ts) / 1000);
      const ageStr = age < 60 ? `${age}s前` : `${Math.floor(age / 60)}min前`;
      const shortId = r.id.slice(0, 16);
      parts.push(`  ${shortId} | ${r.compressor} | ${r.type} | ${(r.origSize/1024).toFixed(1)}KB→${(r.compSize/1024).toFixed(1)}KB | ${r.ratio}% | ${ageStr}`);
    }

    // 按类型统计
    const typeStats = {};
    for (const r of records) {
      typeStats[r.type] = (typeStats[r.type] || 0) + 1;
    }
    parts.push('');
    parts.push(`压缩统计: ${Object.entries(typeStats).map(([k,v]) => `${k}:${v}`).join(', ')}`);
    parts.push(`总节省: ${(records.reduce((s,r) => s + r.origSize - r.compSize, 0)/1024).toFixed(1)}KB 上下文空间`);

    // 取回指令
    parts.push('');
    parts.push('⚠ 重要: 推理时优先使用上述索引引用，需要完整原文时再取回。不要在上下文中重复已压缩的原始内容。');
  }

  // 上下文健康（yellow/red 时附加）
  if (health.status !== 'green') {
    parts.push('');
    parts.push(`[父会话上下文: ${health.status === 'red' ? '🔴 红色' : '🟡 黄色'} ${(health.ratio*100).toFixed(0)}%]`);
    parts.push('父会话上下文已近上限，请精简推理，避免展开大量工具输出。');
  }

  return parts.length > 0 ? parts.join('\n') : null;
}

// ─── Claude Code PreToolUse Hook ───────────────

function handlePreToolUse(input) {
  try {
    const data = typeof input === 'string' ? JSON.parse(input) : input;
    const toolName = data.tool_name || '';

    // 仅处理 Agent 工具
    if (toolName !== 'Agent') {
      return JSON.stringify({ continue: true });
    }

    // 检查是否有 session-memory 数据
    const memory = loadMemory();
    if (!memory || !memory.records || memory.records.length === 0) {
      return JSON.stringify({ continue: true });
    }

    const agentContext = generateAgentContext();
    if (!agentContext) {
      return JSON.stringify({ continue: true });
    }

    // 修改 agent prompt，注入压缩上下文
    const toolInput = data.tool_input || {};
    const originalPrompt = toolInput.prompt || '';

    // 仅在 prompt 有意义且未包含压缩上下文时注入
    if (originalPrompt.includes('UltraCostEffective 压缩上下文')) {
      return JSON.stringify({ continue: true });
    }

    const enhancedPrompt = agentContext + '\n\n--- 原始任务 ---\n\n' + originalPrompt;

    // 记录到 guard log
    try {
      const guardLogFile = GUARD_LOG;
      let guardLog = { calls: [] };
      if (fs.existsSync(guardLogFile)) {
        guardLog = JSON.parse(fs.readFileSync(guardLogFile, 'utf-8'));
      }
      guardLog.calls.push({
        phase: 'agent-spawn',
        time: Date.now(),
        memoryRecords: memory.records.length,
        promptLen: originalPrompt.length,
        enhancedLen: enhancedPrompt.length
      });
      if (guardLog.calls.length > 100) guardLog.calls = guardLog.calls.slice(-100);
      fs.writeFileSync(guardLogFile, JSON.stringify(guardLog, null, 2), 'utf-8');
    } catch {}

    return JSON.stringify({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        permissionDecisionReason: `ultra-cost-effective: 注入 ${memory.records.length}条压缩索引到 Agent prompt`,
        updatedInput: {
          ...toolInput,
          prompt: enhancedPrompt
        }
      }
    });
  } catch (e) {
    return JSON.stringify({ continue: true });
  }
}

// ─── 测试模式 ──────────────────────────────────

function testMode() {
  console.log('═══ Agent Spawn Guard 测试 ═══\n');

  // 模拟 session-memory
  const testMemory = {
    records: [
      { id: 'tf_test001_abc', compressor: 'tokenforge', ts: Date.now() - 30000, origSize: 8000, compSize: 1200, ratio: '85', type: 'output' },
      { id: 'tf_test002_def', compressor: 'tokenforge', ts: Date.now() - 60000, origSize: 15000, compSize: 2000, ratio: '87', type: 'output' },
      { id: 'hr_test003_ghi', compressor: 'headroom', ts: Date.now() - 90000, origSize: 20000, compSize: 4000, ratio: '80', type: 'code' },
    ]
  };

  const storeDir = path.join(os.tmpdir(), 'ultra-cost-effective-headroom-store');
  if (!fs.existsSync(storeDir)) fs.mkdirSync(storeDir, { recursive: true });
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(testMemory, null, 2), 'utf-8');

  // 测试 Agent context 生成
  const ctx = generateAgentContext();
  console.log('── 生成的 Agent 上下文 ──');
  console.log(ctx);
  console.log('');

  // 测试 Hook 格式
  const hookInput = {
    tool_name: 'Agent',
    tool_input: {
      description: 'review code',
      prompt: 'Review the authentication module for security issues.',
      subagent_type: 'general-purpose'
    }
  };

  const hookOutput = JSON.parse(handlePreToolUse(JSON.stringify(hookInput)));
  console.log('── Hook 输出 ──');
  const hasUpdatedInput = hookOutput.hookSpecificOutput?.updatedInput?.prompt?.includes('UltraCostEffective');
  console.log(`  Agent prompt 已注入压缩上下文: ${hasUpdatedInput ? '✅' : '❌'}`);

  const enhancedLen = hookOutput.hookSpecificOutput?.updatedInput?.prompt?.length || 0;
  console.log(`  原始 prompt: ${hookInput.tool_input.prompt.length} 字符`);
  console.log(`  增强 prompt: ${enhancedLen} 字符`);

  // 测试非 Agent 工具
  const bashInput = { tool_name: 'Bash', tool_input: { command: 'npm test' } };
  const bashOutput = JSON.parse(handlePreToolUse(JSON.stringify(bashInput)));
  console.log(`  非 Agent 工具放行: ${bashOutput.continue === true ? '✅' : '❌'}`);

  // 无 session-memory 时
  try { fs.unlinkSync(MEMORY_FILE); } catch {}
  const noMemOutput = JSON.parse(handlePreToolUse(JSON.stringify(hookInput)));
  console.log(`  无记忆时放行: ${noMemOutput.continue === true && !noMemOutput.hookSpecificOutput ? '✅' : '❌'}`);

  // 清理
  try { fs.unlinkSync(MEMORY_FILE); } catch {}

  console.log('\n═══ 测试完成 ═══');
}

function statusMode() {
  const memory = loadMemory();
  const health = estimateContextHealth();

  console.log('═══════════════════════════════════');
  console.log('  UltraCostEffective Agent Guard');
  console.log('═══════════════════════════════════');
  console.log('');
  console.log(`  上下文健康: ${health.status.toUpperCase()} (${(health.ratio*100).toFixed(0)}%)`);
  console.log(`  Session Memory: ${memory ? memory.records.length : 0} 条压缩记录`);
  console.log('');

  if (memory && memory.records.length > 0) {
    console.log('── 最近压缩 ──');
    for (const r of memory.records.slice(-5).reverse()) {
      console.log(`  ${r.id.slice(0,16)} ${r.compressor} ${r.type} ${(r.origSize/1024).toFixed(1)}→${(r.compSize/1024).toFixed(1)}KB`);
    }
  }

  console.log('');
  console.log('  集成: PreToolUse Hook matcher: "Agent" → node agent-spawn-guard.cjs');
  console.log('═══════════════════════════════════');
}

// ─── 主函数 ────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--test') || args.includes('-t')) {
    testMode();
    return;
  }

  if (args.includes('status')) {
    statusMode();
    return;
  }

  // Hook 模式：从 stdin 读取
  const chunks = [];
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', chunk => chunks.push(chunk));
  process.stdin.on('end', () => {
    const input = chunks.join('').trim();
    if (!input) {
      console.log(JSON.stringify({ continue: true }));
      return;
    }
    process.stdout.write(handlePreToolUse(input));
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  handlePreToolUse,
  generateAgentContext,
  estimateContextHealth,
  loadMemory
};
