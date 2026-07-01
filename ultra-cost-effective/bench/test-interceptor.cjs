#!/usr/bin/env node
/**
 * test-interceptor.cjs — UltraCostEffective AOP Context Interceptor 验证测试
 *
 * 验证:
 *  1. 上下文健康检测（green/yellow/red 三色灯）
 *  2. preAgentSpawn 提示生成
 *  3. 与 session-memory 集成
 *  4. ultra-cost-effective-guard agent-spawn 拦截
 */

'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');

const TEST_DIR = __dirname;
const HELPERS_DIR = path.join(TEST_DIR, '..', 'helpers');
const TRACKER_FILE = path.join(os.tmpdir(), 'ultra-cost-effective-perf-tracker.json');
const MEMORY_FILE = path.join(os.tmpdir(), 'ultra-cost-effective-session-memory.json');
const GUARD_LOG = path.join(os.tmpdir(), 'ultra-cost-effective-guard-log.json');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; return true; }
  else { console.error(`  ❌ FAIL: ${msg}`); failed++; return false; }
}

// ─── Setup ──────────────────────────────────────

function setupTracker(calls = 5, startMinutesAgo = 3) {
  const tracker = {
    sessionId: 'test-sess-interceptor',
    startTime: Date.now() - (startMinutesAgo * 60000),
    totalCalls: calls,
    layerSavings: {
      L1_tokenforge: { calls: calls, savedTokens: calls * 500 },
      L2_kvCache: { calls: 0 },
      L7_router: { calls: 0, flashDowngrades: 0 }
    }
  };
  fs.writeFileSync(TRACKER_FILE, JSON.stringify(tracker, null, 2), 'utf-8');
}

function setupMemory(recordCount = 5) {
  const records = [];
  for (let i = 0; i < recordCount; i++) {
    records.push({
      id: `tf_test${i}_${Date.now().toString(36)}`,
      compressor: i % 3 === 0 ? 'headroom' : 'tokenforge',
      ts: Date.now() - (recordCount - i) * 30000,
      origSize: 5000 + i * 2000,
      compSize: 500 + i * 100,
      ratio: (90 - i * 5).toFixed(1),
      type: i % 2 === 0 ? 'output' : 'code'
    });
  }
  const memory = {
    sessionId: 'sess_test_interceptor',
    startTime: Date.now() - 300000,
    records
  };
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2), 'utf-8');
}

function cleanup() {
  try { fs.unlinkSync(TRACKER_FILE); } catch {}
  try { fs.unlinkSync(MEMORY_FILE); } catch {}
  try { fs.unlinkSync(GUARD_LOG); } catch {}
}

// ─── Tests ──────────────────────────────────────

console.log('═══ UltraCostEffective AOP Context Interceptor 验证测试 ═══\n');

// Test 1: Context Health — Green (cold start)
console.log('─── 1. 上下文健康检测 ───');
{
  cleanup();
  setupTracker(3, 5); // 3 calls, 5 minutes
  
  const interceptor = require(path.join(HELPERS_DIR, 'context-interceptor.cjs'));
  const health = interceptor.getContextHealth();
  
  assert(health.status === 'green', '冷启动(3 calls/5min) → green');
  assert(health.ratio < 60, `ratio=${health.ratio}% < 60%`);
  assert(health.calls === 3, `calls=${health.calls}`);
  console.log(`  ✅ Green: ${health.estimatedTokens.toLocaleString()} / ${health.windowSize.toLocaleString()} tokens (${health.ratio}%)`);
}

// Test 2: Context Health — Yellow
{
  cleanup();
  setupTracker(45, 40); // 45 calls, 40 minutes → ~74% → yellow
  
  const interceptor = require(path.join(HELPERS_DIR, 'context-interceptor.cjs'));
  const health = interceptor.getContextHealth();
  
  assert(health.status === 'yellow', `45 calls/40min → yellow (got: ${health.status}, ratio=${health.ratio}%)`);
  console.log(`  ✅ Yellow: ${health.estimatedTokens.toLocaleString()} / ${health.windowSize.toLocaleString()} tokens (${health.ratio}%)`);
}

// Test 3: Context Health — Red
{
  cleanup();
  setupTracker(80, 90); // 80 calls, 90 minutes
  
  const interceptor = require(path.join(HELPERS_DIR, 'context-interceptor.cjs'));
  const health = interceptor.getContextHealth();
  
  // 80 calls * 1200 avg + 80 turns * 800 avg + 4000 base + 90min bonus
  assert(health.status === 'red', `80 calls/90min → red (got: ${health.status})`);
  console.log(`  ✅ Red: ${health.estimatedTokens.toLocaleString()} / ${health.windowSize.toLocaleString()} tokens (${health.ratio}%)`);
}

// Test 4: Context Hint — green returns null
console.log('\n─── 2. LLM 上下文提示生成 ───');
{
  cleanup();
  setupTracker(3, 5);
  setupMemory(3);
  
  const interceptor = require(path.join(HELPERS_DIR, 'context-interceptor.cjs'));
  const hint = interceptor.generateContextHint();
  
  assert(hint === null, 'green 状态应返回 null 提示');
}

// Test 5: Context Hint — yellow returns hint with memory
{
  cleanup();
  setupTracker(45, 40);
  setupMemory(8);
  
  const interceptor = require(path.join(HELPERS_DIR, 'context-interceptor.cjs'));
  const hint = interceptor.generateContextHint();
  
  assert(hint !== null, 'yellow 状态应返回提示');
  assert(hint.includes('黄色'), '提示应包含黄色标记');
  assert(hint.includes('会话压缩索引'), '提示应包含 session-memory 索引');
  assert(hint.includes('retrieve'), '提示应提及 retrieve 命令');
  console.log('  ✅ Yellow 提示包含: 三色标记 + session-memory 索引 + retrieve 指引');
}

// Test 6: Context Hint — red returns urgent hint
{
  cleanup();
  setupTracker(80, 90);
  setupMemory(15);
  
  const interceptor = require(path.join(HELPERS_DIR, 'context-interceptor.cjs'));
  const hint = interceptor.generateContextHint();
  
  assert(hint !== null, 'red 状态应返回提示');
  assert(hint.includes('红色') || hint.includes('超出窗口'), 'red 提示应有紧急标记');
  console.log('  ✅ Red 提示包含: 紧急标记 + session-memory 索引');
}

// Test 7: preAgentSpawn — with memory
console.log('\n─── 3. Agent Spawn 拦截 ───');
{
  cleanup();
  setupTracker(15, 15);
  setupMemory(10);
  
  const interceptor = require(path.join(HELPERS_DIR, 'context-interceptor.cjs'));
  const hint = interceptor.preAgentSpawnHint();
  
  assert(hint !== null, 'pre-agent-spawn 应返回提示');
  assert(hint.includes('AgentSpawnGuard'), '提示应有 AgentSpawnGuard 标记');
  assert(hint.includes('tokenforge'), '提示应提及压缩器类型');
  assert(hint.includes('压缩上下文摘要'), '提示应建议传递压缩摘要');
  console.log('  ✅ Agent spawn 提示: AgentSpawnGuard + 压缩器统计 + 上下文传递建议');
}

// Test 8: preAgentSpawn — red warning
{
  cleanup();
  setupTracker(80, 90);
  setupMemory(12);
  
  const interceptor = require(path.join(HELPERS_DIR, 'context-interceptor.cjs'));
  const hint = interceptor.preAgentSpawnHint();
  
  assert(hint !== null, 'red 状态 pre-agent-spawn 应返回提示');
  assert(hint.includes('红色预警'), 'red 状态应有红色预警标记');
  console.log('  ✅ Red 状态 Agent spawn: 红色预警标记');
}

// Test 9: ultra-cost-effective-guard isAgentSpawn detection
console.log('\n─── 4. ultra-cost-effective-guard Agent Spawn 检测 ───');
{
  cleanup();
  const guard = require(path.join(HELPERS_DIR, 'ultra-cost-effective-guard.cjs'));
  
  assert(guard.isAgentSpawn('Agent({description:"test"})', ''), 'Agent(...) → true');
  assert(guard.isAgentSpawn('', 'Agent'), 'toolName=Agent → true');
  assert(guard.isAgentSpawn('spawn agent for code review', ''), 'spawn agent → true');
  assert(guard.isAgentSpawn('launch subagent to debug', ''), 'subagent → true');
  assert(!guard.isAgentSpawn('npm test', ''), 'npm test → false');
  assert(!guard.isAgentSpawn('git status', ''), 'git status → false');
}

// Test 10: ultra-cost-effective-guard preAgentSpawn full flow
{
  cleanup();
  setupTracker(15, 15);
  setupMemory(10);
  
  const guard = require(path.join(HELPERS_DIR, 'ultra-cost-effective-guard.cjs'));
  
  // 非 spawn 命令
  const r1 = guard.preAgentSpawn('npm test', 'Bash');
  assert(r1.isSpawn === false, 'npm test → isSpawn=false');
  
  // Agent spawn
  const r2 = guard.preAgentSpawn('Agent({description:"review code"})', 'Agent');
  assert(r2.isSpawn === true, 'Agent(...) → isSpawn=true');
  assert(r2.hint !== null, 'Agent spawn → hint 非空');
  assert(r2.hint.includes('AgentSpawnGuard'), 'Agent spawn hint 含 AgentSpawnGuard');
  
  console.log('  ✅ preAgentSpawn 全流程: 非 spawn 命令跳过, Agent spawn 生成提示');
}

// Test 11: preCheck detects agent spawn in command
{
  cleanup();
  const guard = require(path.join(HELPERS_DIR, 'ultra-cost-effective-guard.cjs'));
  
  const r = guard.preCheck('Agent({description:"code review"})');
  assert(r.isAgentSpawn === true, 'preCheck 应检测到 Agent spawn');
  assert(r.warnings.some(w => w.includes('Agent spawn')), 'preCheck 应有 Agent spawn 警告');
  console.log('  ✅ preCheck Agent spawn 检测: isAgentSpawn=true + 警告');
}

// Test 12: session-memory getContextCompressionHint
console.log('\n─── 5. session-memory 上下文级记忆 ───');
{
  cleanup();
  setupMemory(6);
  
  const sm = require(path.join(HELPERS_DIR, 'session-memory.cjs'));
  const hint = sm.getContextCompressionHint();
  
  assert(hint !== null, 'getContextCompressionHint 应返回非空');
  assert(hint.includes('UltraCostEffectiveMemory'), '提示应含 UltraCostEffectiveMemory 标记');
  assert(hint.includes('retrieve'), '提示应含 retrieve 指引');
  console.log(`  ✅ 上下文压缩提示: ${hint.slice(0, 80)}...`);
}

// Test 13: session-memory getAgentSpawnContext
{
  cleanup();
  setupMemory(6);
  
  const sm = require(path.join(HELPERS_DIR, 'session-memory.cjs'));
  const ctx = sm.getAgentSpawnContext();
  
  assert(ctx !== null, 'getAgentSpawnContext 应返回非空');
  assert(ctx.recordCount === 6, `recordCount=${ctx.recordCount}`);
  assert(ctx.retrievableIds.length >= 6, `retrievableIds=${ctx.retrievableIds.length}`);
  assert(ctx.summary.includes('UltraCostEffectiveMemory'), 'summary 应含 UltraCostEffectiveMemory');
  console.log(`  ✅ Agent spawn 上下文: ${ctx.recordCount}条记录, ${ctx.retrievableIds.length}个可检索ID`);
}

// ─── Summary ────────────────────────────────────

console.log('');
console.log('═══════════════════════════════════');
console.log(`  ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════');

// Cleanup
cleanup();

process.exit(failed > 0 ? 1 : 0);
