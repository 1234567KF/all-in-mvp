#!/usr/bin/env node
/**
 * test-workflow.cjs — UltraCostEffective × Dynamic Workflows 集成测试
 *
 * 测试:
 *   1. Workflow 触发检测（所有触发方式）
 *   2. Guard workflow 检测
 *   3. 预工作流压缩策略
 *   4. 工作流专属预设匹配
 *   5. Workflow ROI 追踪与报告
 *   6. Context-interceptor workflow 方法
 *   7. 集成: Guard + Interceptor + Workflow
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// 路径
const HELPERS_DIR = path.join(__dirname, '..', 'helpers');
const WORKFLOW_INTEGRATOR = path.join(HELPERS_DIR, 'workflow-integrator.cjs');
const CONTEXT_INTERCEPTOR = path.join(HELPERS_DIR, 'context-interceptor.cjs');
const GUARD = path.join(HELPERS_DIR, 'ultra-cost-effective-guard.cjs');

const TRACKER_FILE = path.join(os.tmpdir(), 'ultra-cost-effective-perf-tracker.json');
const MEMORY_FILE = path.join(os.tmpdir(), 'ultra-cost-effective-session-memory.json');
const WORKFLOW_LOG = path.join(os.tmpdir(), 'ultra-cost-effective-workflow-log.json');
const GUARD_LOG = path.join(os.tmpdir(), 'ultra-cost-effective-guard-log.json');

// 测试框架
let passed = 0;
let failed = 0;
let total = 0;

function assert(condition, msg) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ ${msg}`);
  } else {
    failed++;
    console.log(`  ❌ ${msg}`);
  }
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

// ─── 数据准备 ──────────────────────────────

// 备份
const backups = {};
for (const f of [TRACKER_FILE, MEMORY_FILE, WORKFLOW_LOG, GUARD_LOG]) {
  try { backups[f] = fs.readFileSync(f, 'utf-8'); } catch { backups[f] = null; }
}

function restore() {
  for (const [f, data] of Object.entries(backups)) {
    if (data) fs.writeFileSync(f, data, 'utf-8');
    else { try { fs.unlinkSync(f); } catch {} }
  }
}

// 模拟 tracker 数据（用于 context-interceptor 和 guard 测试）
function seedTracker(calls = 20) {
  fs.writeFileSync(TRACKER_FILE, JSON.stringify({
    totalCalls: calls,
    totalOutputBytes: calls * 2000,
    totalCompressedBytes: calls * 400,
    totalCacheHitTokens: calls * 500,
    totalCacheMissTokens: calls * 100,
    totalCompressionRatio: 0.65,
    layerSavings: {
      L1_tokenforge: { calls: calls, savedTokens: calls * 800, savedBytes: calls * 1600 },
      L2_kvCache: { calls: calls, savedTokens: calls * 200 },
      L7_router: { calls: 5, flashDowngrades: 3 }
    },
    sessionStart: Date.now() - 3600000
  }), 'utf-8');
}

// 模拟 session-memory
function seedMemory(records = 5) {
  const recs = [];
  for (let i = 0; i < records; i++) {
    recs.push({
      id: `tf_${Date.now()}_${i}`,
      compressor: 'tokenforge',
      type: 'command-output',
      origSize: 8000 + i * 1000,
      compSize: 1500 + i * 200,
      ratio: 80 + i,
      ts: Date.now() - (i * 300000)
    });
  }
  fs.writeFileSync(MEMORY_FILE, JSON.stringify({ records: recs, lastUpdated: Date.now() }), 'utf-8');
}

// 清理 workflow log
function clearWorkflowLog() {
  try { fs.unlinkSync(WORKFLOW_LOG); } catch {}
}

// 清理 guard log
function clearGuardLog() {
  try { fs.unlinkSync(GUARD_LOG); } catch {}
}

// ─── 加载模块 ──────────────────────────────

let wfIntegrator, ctxInterceptor, guard;

try {
  wfIntegrator = require(WORKFLOW_INTEGRATOR);
  ctxInterceptor = require(CONTEXT_INTERCEPTOR);
  guard = require(GUARD);
} catch (e) {
  console.error('模块加载失败:', e.message);
  process.exit(1);
}

// ─── 测试 1: Workflow 触发检测 ─────────────

section('1. Workflow 触发检测');

// ultracode 关键词
let det = wfIntegrator.detectWorkflowTrigger('ultracode: audit every API endpoint');
assert(det.isWorkflow === true, 'ultracode 关键词触发');
assert(det.trigger === 'ultracode', 'ultracode trigger 标识正确');
assert(det.triggerType === 'keyword', 'ultracode triggerType 正确');

// /deep-research
det = wfIntegrator.detectWorkflowTrigger('/deep-research What changed in Node.js v22?');
assert(det.isWorkflow === true, '/deep-research 触发');
assert(det.trigger === 'deep-research', '/deep-research trigger 标识');

// /effort ultracode
det = wfIntegrator.detectWorkflowTrigger('/effort ultracode');
assert(det.isWorkflow === true, '/effort ultracode 触发');
assert(det.triggerType === 'effort', '/effort triggerType 正确');

// 自然语言
det = wfIntegrator.detectWorkflowTrigger('run a workflow for the codebase');
assert(det.isWorkflow === true, '自然语言 "run a workflow" 触发');
assert(det.triggerType === 'natural-language', '自然语言 triggerType 正确');

det = wfIntegrator.detectWorkflowTrigger('use a dynamic workflow to analyze');
assert(det.isWorkflow === true, '"use a dynamic workflow" 触发');

// 非 workflow
det = wfIntegrator.detectWorkflowTrigger('fix the bug in utils.js');
assert(det.isWorkflow === false, '普通请求不触发');
assert(det.trigger === null, '普通请求 trigger 为 null');

// /workflows 管理
det = wfIntegrator.detectWorkflowTrigger('/workflows');
assert(det.isWorkflow === true, '/workflows 管理命令触发');
assert(det.triggerType === 'management', '/workflows triggerType 正确');

// 空输入
det = wfIntegrator.detectWorkflowTrigger('');
assert(det.isWorkflow === false, '空输入不触发');

det = wfIntegrator.detectWorkflowTrigger(null);
assert(det.isWorkflow === false, 'null 输入不触发');

// ─── 测试 2: Guard workflow 检测 ───────────

section('2. Guard workflow 检测');

clearGuardLog();
seedTracker(20);
seedMemory(5);

let guardResult = guard.isWorkflowTrigger('ultracode: audit API endpoints');
assert(guardResult.isWorkflow === true, 'Guard: ultracode 触发检测');
assert(guardResult.trigger !== null, 'Guard: trigger 不为 null');

guardResult = guard.isWorkflowTrigger('fix this bug');
assert(guardResult.isWorkflow === false, 'Guard: 普通命令不触发');

guardResult = guard.isWorkflowTrigger('/deep-research Node.js changes');
assert(guardResult.isWorkflow === true, 'Guard: /deep-research 触发');

guardResult = guard.isWorkflowTrigger('');
assert(guardResult.isWorkflow === false, 'Guard: 空字符串不触发');

// preWorkflow
const preWf = guard.preWorkflow('ultracode: audit the codebase');
assert(preWf.isWorkflow === true, 'Guard preWorkflow: 检测为 workflow');
assert(preWf.hint !== null, 'Guard preWorkflow: hint 不为 null');
assert(typeof preWf.hint === 'string', 'Guard preWorkflow: hint 为字符串');

const preWfNormal = guard.preWorkflow('fix this bug');
assert(preWfNormal.isWorkflow === false, 'Guard preWorkflow: 非 workflow 返回 false');

// preCheck 中的 workflow 检测
const preCheckResult = guard.preCheck('ultracode: audit API');
assert(preCheckResult.isWorkflow === true, 'Guard preCheck: isWorkflow 字段存在');
assert(preCheckResult.workflowTrigger !== null, 'Guard preCheck: workflowTrigger 不为 null');

// ─── 测试 3: 预工作流压缩策略 ─────────────

section('3. 预工作流压缩策略');

const strategy = wfIntegrator.preWorkflowStrategy(20, 'audit');
assert(strategy !== null, 'preWorkflowStrategy: 返回非 null');
assert(strategy.hint.includes('Pre-Workflow'), 'preWorkflowStrategy: hint 包含 Pre-Workflow');
assert(strategy.preset.name === 'codeAudit', 'audit 类型匹配 codeAudit 预设');
assert(strategy.scale.estimatedAgents === 20, 'scale: agent 数量正确');
assert(strategy.estimatedSavings.baseline > 0, 'estimatedSavings: baseline > 0');
assert(strategy.estimatedSavings.saved > 0, 'estimatedSavings: saved > 0');
assert(strategy.estimatedSavings.savingsRatio > 0, 'estimatedSavings: ratio > 0');

// 默认（无参数）
const defaultStrategy = wfIntegrator.preWorkflowStrategy();
assert(defaultStrategy !== null, 'preWorkflowStrategy 默认参数: 返回非 null');
assert(defaultStrategy.scale.estimatedAgents === 15, '默认 agent 数量 15');
assert(defaultStrategy.preset.name === 'moderate', '默认预设 moderate');

// ─── 测试 4: 工作流专属预设匹配 ───────────

section('4. 工作流专属预设匹配');

assert(wfIntegrator.matchPreset('audit') === 'codeAudit', 'audit → codeAudit');
assert(wfIntegrator.matchPreset('deep-research') === 'moderate', 'deep-research → moderate');
assert(wfIntegrator.matchPreset('migration') === 'migration', 'migration → migration');
assert(wfIntegrator.matchPreset('refactor') === 'refactor', 'refactor → refactor');
assert(wfIntegrator.matchPreset('review') === 'codeAudit', 'review → codeAudit');
assert(wfIntegrator.matchPreset('scan') === 'codeAudit', 'scan → codeAudit');
assert(wfIntegrator.matchPreset('research') === 'moderate', 'research → moderate');
assert(wfIntegrator.matchPreset('unknown-task') === 'moderate', 'unknown → moderate');
assert(wfIntegrator.matchPreset(null) === 'moderate', 'null → moderate');

// getWorkflowPreset 返回完整信息
const auditPreset = wfIntegrator.getWorkflowPreset('audit');
assert(auditPreset.presetName === 'codeAudit', 'getWorkflowPreset: presetName 正确');
assert(auditPreset.description.includes('代码审计'), 'getWorkflowPreset: description 包含代码审计');
assert(auditPreset.compression === 0.75, 'getWorkflowPreset: compression 正确');

// ─── 测试 5: Workflow ROI 追踪与报告 ─────

section('5. Workflow ROI 追踪与报告');

clearWorkflowLog();
seedTracker(30);

// 记录 3 次运行
wfIntegrator.trackWorkflowRun('audit-api', 320000);
wfIntegrator.trackWorkflowRun('audit-api', 290000);
wfIntegrator.trackWorkflowRun('deep-research', 450000);

// 验证日志
const log = wfIntegrator.loadWorkflowLog();
assert(log.runs.length === 3, 'trackWorkflowRun: 3 次记录');
assert(log.runs[0].name === 'audit-api', '第1次: audit-api');
assert(log.runs[2].name === 'deep-research', '第3次: deep-research');

// ROI 报告（全部）
const roiAll = wfIntegrator.generateROIReport();
assert(roiAll.hasData === true, 'ROI 报告有数据');
assert(roiAll.totalRuns === 3, 'ROI: 3 次运行');
assert(roiAll.totalTokens === 320000 + 290000 + 450000, 'ROI: 总 Token 正确');
assert(roiAll.text.includes('ROI'), 'ROI 报告文本包含 ROI');

// ROI 报告（按名称过滤）
const roiAudit = wfIntegrator.generateROIReport('audit-api');
assert(roiAudit.hasData === true, 'ROI audit-api 有数据');
assert(roiAudit.totalRuns === 2, 'ROI audit-api: 2 次运行');

const roiNone = wfIntegrator.generateROIReport('nonexistent');
assert(roiNone.hasData === false, 'ROI 不存在的 workflow 无数据');

// 清空后的报告
clearWorkflowLog();
const roiEmpty = wfIntegrator.generateROIReport();
assert(roiEmpty.hasData === false, '清空后 ROI 无数据');

// ─── 测试 6: Context-interceptor workflow 方法 ──

section('6. Context-interceptor workflow 方法');

seedTracker(25);
seedMemory(3);

const preWfHint = ctxInterceptor.preWorkflowHint(30);
assert(typeof preWfHint === 'string', 'preWorkflowHint: 返回字符串');
assert(preWfHint.includes('Pre-Workflow'), 'preWorkflowHint: 包含 Pre-Workflow');
assert(preWfHint.includes('30 agent'), 'preWorkflowHint: 包含 agent 数量');
assert(preWfHint.includes('乘法级节省'), 'preWorkflowHint: 包含乘法级节省');

const defaultHint = ctxInterceptor.preWorkflowHint();
assert(defaultHint.includes('15 agent'), 'preWorkflowHint 默认: 15 agent');

// estimateWorkflowTokens
const est = ctxInterceptor.estimateWorkflowTokens(50);
assert(est.baseline === 50 * 15000, 'estimateWorkflowTokens: baseline 正确');
assert(est.compressed === Math.round(est.baseline * 0.35), 'estimateWorkflowTokens: compressed 正确');
assert(est.saved > 0, 'estimateWorkflowTokens: saved > 0');
assert(est.ratio > 0 && est.ratio < 1, 'estimateWorkflowTokens: ratio 在 0-1 之间');

// ─── 测试 7: 集成 Guard + Interceptor + Workflow ──

section('7. 集成: Guard + Interceptor + Workflow');

clearGuardLog();
clearWorkflowLog();
seedTracker(35);
seedMemory(5);

// 模拟完整的 workflow 触发→拦截→记录流程
const triggerCmd = 'ultracode: audit all API endpoints for auth issues';

// Step 1: Guard 检测
const guardCheck = guard.preCheck(triggerCmd);
assert(guardCheck.isWorkflow === true, '集成: Guard 检测到 workflow 触发');

// Step 2: Guard 预拦截
const guardPreWf = guard.preWorkflow(triggerCmd);
assert(guardPreWf.isWorkflow === true, '集成: Guard preWorkflow 触发');
assert(guardPreWf.hint !== null, '集成: Guard preWorkflow 生成 hint');
assert(guardPreWf.contextHealth !== null, '集成: Guard preWorkflow 有 contextHealth');

// Step 3: Workflow integrator 策略
const wfStrategy = wfIntegrator.preWorkflowStrategy(15, 'audit');
assert(wfStrategy !== null, '集成: Workflow integrator 策略生成');
assert(wfStrategy.preset.name === 'codeAudit', '集成: 预设匹配 codeAudit');

// Step 4: 记录运行
wfIntegrator.trackWorkflowRun('audit-api', 280000);

// Step 5: 验证 guard log
const guardLogData = guard.loadGuardLog();
const wfEntries = guardLogData.calls.filter(c => c.phase === 'workflow');
assert(wfEntries.length >= 1, '集成: Guard log 有 workflow 记录');
assert(wfEntries[0].trigger === 'ultracode', '集成: Guard log 记录 ultracode trigger');

// Step 6: 审计报告
const auditReport = guard.auditEffectiveness();
assert(auditReport.text.includes('Dynamic Workflow'), '集成: 审计报告包含 Dynamic Workflow');

// Step 7: ROI 报告
const roiReport = wfIntegrator.generateROIReport();
assert(roiReport.hasData === true, '集成: ROI 报告有数据');

// Step 8: Guard statement
const guardStmt = guard.generateGuardStatement();
assert(guardStmt !== null, '集成: Guard statement 非 null');

// ─── 测试 8: estimateWorkflowScale ─────────

section('8. estimateWorkflowScale');

const scale = wfIntegrator.estimateWorkflowScale({ estimatedAgents: 50 });
assert(scale.estimatedAgents === 50, 'scale: 自定义 agent 数 50');
assert(scale.estimatedTokens === 50 * 15000, 'scale: token 估算正确');
assert(scale.maxConcurrent === 16, 'scale: 最大并发 16');

const defaultScale = wfIntegrator.estimateWorkflowScale();
assert(defaultScale.estimatedAgents === 15, 'scale 默认: 15 agent');
assert(defaultScale.maxConcurrent === 15, 'scale 默认: 并发 15 (min(15, 16))');

const smallScale = wfIntegrator.estimateWorkflowScale({ estimatedAgents: 5 });
assert(smallScale.maxConcurrent === 5, 'scale: 小并发 5');

// ─── 测试 9: BUILTIN_WORKFLOWS 配置 ──────

section('9. BUILTIN_WORKFLOWS 配置');

assert(wfIntegrator.BUILTIN_WORKFLOWS['deep-research'] !== undefined, 'deep-research 配置存在');
assert(wfIntegrator.BUILTIN_WORKFLOWS['deep-research'].recommendedPreset === 'moderate', 'deep-research 推荐 moderate');
assert(wfIntegrator.BUILTIN_WORKFLOWS['deep-research'].contextSensitivity === 'high', 'deep-research 上下文敏感度高');

// ─── 测试 10: generateWorkflowStatement ────

section('10. generateWorkflowStatement');

clearWorkflowLog();
let stmt = wfIntegrator.generateWorkflowStatement();
assert(stmt === null, '无运行记录时 statement 为 null');

wfIntegrator.trackWorkflowRun('test-workflow', 100000);
stmt = wfIntegrator.generateWorkflowStatement();
assert(stmt !== null, '有运行记录时 statement 非 null');
assert(stmt.includes('1次工作流运行'), 'statement 包含运行次数');

// ─── 清理 & 结果 ──────────────────────────

restore();

console.log('\n═══════════════════════════════════');
console.log(`  Workflow Integration Tests`);
console.log(`  ${passed} passed, ${failed} failed, ${total} total`);
console.log('═══════════════════════════════════');

process.exit(failed > 0 ? 1 : 0);
