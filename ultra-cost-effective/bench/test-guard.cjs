#!/usr/bin/env node
/**
 * test-guard.cjs — 跨技能生效保障验证
 *
 * 场景：
 *  1. UltraCostEffective 正常注入 → 生效检测通过
 *  2. 第三方压缩器冲突 → UltraCostEffective 跳过，记录冲突
 *  3. 命令无 UltraCostEffective 管道但应被注入 → 标记为"绕过"
 *  4. 生效审计显示各调用状态
 *
 * 用法: node bench/test-guard.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const GUARD = path.join(__dirname, '..', 'helpers', 'ultra-cost-effective-guard.cjs');
const TRACKER = path.join(__dirname, '..', 'helpers', 'perf', 'perf-tracker.cjs');
const HOOK = path.join(__dirname, '..', 'helpers', 'tokenforge-hook.cjs');
const GUARD_LOG = path.join(os.tmpdir(), 'ultra-cost-effective-guard-log.json');
const TRACKER_FILE = path.join(os.tmpdir(), 'ultra-cost-effective-perf-tracker.json');

function cleanup() {
  try { fs.unlinkSync(GUARD_LOG); } catch {}
  try { fs.unlinkSync(TRACKER_FILE); } catch {}
}

const OK = '✅', NG = '❌';
let passed = 0, failed = 0;
function assert(cond, label) {
  if (cond) { console.log(`  ${OK} ${label}`); passed++; }
  else      { console.log(`  ${NG} ${label}`); failed++; }
}

console.log('══════════════════════════════════════════════════');
console.log('  跨技能生效保障验证');
console.log('══════════════════════════════════════════════════\n');

cleanup();

// ── 场景1: 正常命令 → UltraCostEffective 应检测到需注入 ──
console.log('── 场景1: 正常命令预检 ──');
const guard = require(GUARD);

let result = guard.preCheck('npm test');
assert(result.shouldApply === true, 'npm test 应被 UltraCostEffective 覆盖');
assert(result.ultraCostEffectivePresent === false, '未注入时 ultraCostEffectivePresent=false');
assert(result.conflicts.length === 0, '无第三方冲突');

result = guard.preCheck('npm test | node tokenforge.cjs compress output');
assert(result.ultraCostEffectivePresent === true, '已注入时 ultraCostEffectivePresent=true');
assert(result.engine === 'tokenforge', '检测到 tokenforge 引擎');

result = guard.preCheck('git status');
assert(result.shouldApply === false, 'git status 不在白名单');
assert(result.ultraCostEffectivePresent === false, 'git 命令不注入');

console.log('');

// ── 场景2: 第三方压缩器冲突 ──
console.log('── 场景2: 第三方压缩器冲突 ──');
result = guard.preCheck('npm test | python llmlingua compress');
const hasConflict = result.conflicts.some(c => c.includes('LLMLingua'));
assert(hasConflict === true, '检测到 LLMLingua 冲突');
assert(result.safe === false, '冲突时 safe=false');

result = guard.preCheck('npm test | node claude-token-optimizer');
const hasClaudeOpt = result.conflicts.some(c => c.includes('claude-token-optimizer'));
assert(hasClaudeOpt === true, '检测到 claude-token-optimizer');

console.log('');

// ── 场景3: Guard log 累积 ──
console.log('── 场景3: Guard 日志累积 ──');
// 模拟几次调用
guard.appendGuardEntry({ phase: 'pre', command: 'npm test', ultraCostEffectiveApplied: true, engine: 'tokenforge', shouldApply: true, warnings: [], conflicts: [], reason: 'ok' });
guard.appendGuardEntry({ phase: 'pre', command: 'npm run build', ultraCostEffectiveApplied: true, engine: 'tokenforge', shouldApply: true, warnings: [], conflicts: [], reason: 'ok' });
guard.appendGuardEntry({ phase: 'pre', command: 'npm test | llmlingua', ultraCostEffectiveApplied: false, engine: 'skipped', shouldApply: true, warnings: [], conflicts: ['LLMLingua'], reason: '冲突跳过' });
guard.appendGuardEntry({ phase: 'pre', command: 'git push', ultraCostEffectiveApplied: false, engine: 'none', shouldApply: false, warnings: [], conflicts: [], reason: '不适用' });

const log = guard.loadGuardLog();
assert(log.calls.length >= 4, `日志已累积: ${log.calls.length}条`);

const { text, grade } = guard.auditEffectiveness();
assert(grade === 'C' || grade === 'B', `审计等级: ${grade} (4条记录2条绕过, 预期C)`);
console.log(`  审计输出 (前3行):`);
text.split('\n').slice(0, 5).forEach(l => console.log(`    ${l}`));

console.log('');

// ── 场景4: 执行后验证 ──
console.log('── 场景4: 执行后验证 ──');
result = guard.postVerify('npm test | node tokenforge.cjs compress output', 150, '[tokenforge] output/medium: ~500→~150 tokens (70%)');
assert(result.verified === true, 'tokenforge 标记检测到 → verified=true');
assert(result.compressed === true, '已压缩');
assert(result.usedTokenforge === true, '使用 tokenforge');

result = guard.postVerify('npm test', 5000, '');  // 无 UltraCostEffective 管道，大输出
assert(result.verified === true, '无管道命令无需验证 → verified=true (不算失败)');
assert(result.compressed === false, '未注入所以 uncompressed');

result = guard.postVerify('npm test | node tokenforge.cjs compress output', 50, '');
assert(result.compressed === true, '极小输出+有管道 → 推测已压缩');
assert(result.hints.some(h => h.includes('极小')), '提示"输出极小，疑似被压缩"');

console.log('');

// ── 场景5: tokenforge-hook 集成 ──
console.log('── 场景5: Hook 冲突跳过 ──');
process.env.ULTRA_COST_EFFECTIVE_DEBUG = '1';
delete require.cache[require.resolve(HOOK)];
const hook = require(HOOK);

// 测试正常注入
const inject1 = hook.injectTokenforge('npm test', { type: 'output', level: 'medium' }, 'claude');
assert(inject1 !== null, '正常命令注入成功');
assert(inject1.includes('--store'), '注入命令包含 --store');
assert(inject1.includes('tokenforge.cjs'), '注入命令包含 tokenforge');

// 测试第三方压缩器跳过
const inject2 = hook.injectTokenforge('npm test | python llmlingua compress', { type: 'output', level: 'medium' }, 'claude');
assert(inject2 === null, 'LLMLingua已存在时跳过注入');

// 测试已注入时跳过
const inject3 = hook.injectTokenforge('npm test | node tokenforge.cjs compress output', { type: 'output', level: 'medium' }, 'claude');
assert(inject3 === null, 'tokenforge已存在时跳过重复注入');

delete process.env.ULTRA_COST_EFFECTIVE_DEBUG;

console.log('');

// ── 场景6: 声明生成 ──
console.log('── 场景6: 防绕过声明 ──');
const stmt = guard.generateGuardStatement();
if (stmt) {
  console.log(`  声明: ${stmt}`);
  assert(stmt.includes('勿禁用'), '声明包含防绕过提醒');
} else {
  console.log('  无声明 (perf-tracker 无数据)');
}

// 模拟 perf-tracker 数据
fs.writeFileSync(TRACKER_FILE, JSON.stringify({
  totalCalls: 8,
  totalInputTokens: 5000,
  totalOutputTokens: 2000,
  layerSavings: {
    L1_tokenforge: { savedTokens: 3000, calls: 7, estimatedSaving: 2.5 },
    L2_kvCache:    { savedTokens: 1000, calls: 3, estimatedSaving: 1.0, hitRate: 85 },
    L7_router:     { savedTokens: 0, calls: 2, estimatedSaving: 1.2, flashDowngrades: 2 }
  }
}));

const stmt2 = guard.generateGuardStatement();
assert(stmt2 !== null, '有 tracker 数据时生成声明');
console.log(`  带数据的声明: ${stmt2}`);

console.log('');

// ── 场景7: 完整 audit 报告 ──
console.log('── 场景7: 完整生效审计 ──');
const { text: auditText, grade: finalGrade } = guard.auditEffectiveness();
console.log(auditText);
// 5条记录, 3条绕过 (4条场景3 + 1条场景5的hook冲突), tracker有L1/L2/L7数据
// 3层激活但等级B (绕过率高), 这反映了真实场景
assert(finalGrade === 'C' || finalGrade === 'B', `综合评分: ${finalGrade} (有历史绕过记录)`);

// ── 清理 ──
cleanup();

console.log(`\n══════════════════════════════════════════════════`);
console.log(`  结果: ${OK} ${passed} 通过, ${failed > 0 ? NG + ' ' + failed + ' 失败' : '0 失败'}`);
console.log(`══════════════════════════════════════════════════`);

if (failed > 0) process.exit(1);
