#!/usr/bin/env node
/**
 * test-session-memory.cjs — 会话记忆全链路验证
 *
 * 模拟完整会话流程：
 *  轮1-3: tokenforge --store → 存原文 + 写索引
 *  轮4-8: tokenforge --store → 继续存
 *  轮9+:  热切 headroom → 存原文 + 可检索引擎
 *  验证:    原文可检索、会话摘要完整、切换可追溯
 *
 * 用法: node bench/test-session-memory.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const HELPER_DIR = path.join(__dirname, '..', 'helpers');
const TOKENFORGE = path.join(HELPER_DIR, 'tokenforge.cjs');
const SESSION_MEM = path.join(HELPER_DIR, 'session-memory.cjs');
const STORE_DIR = path.join(os.tmpdir(), 'ultra-cost-effective-headroom-store');
const MEM_FILE = path.join(os.tmpdir(), 'ultra-cost-effective-session-memory.json');
const TRACKER_FILE = path.join(os.tmpdir(), 'ultra-cost-effective-perf-tracker.json');

// 清理旧数据
function cleanup() {
  try { fs.unlinkSync(MEM_FILE); } catch {}
  try { fs.unlinkSync(TRACKER_FILE); } catch {}
  if (fs.existsSync(STORE_DIR)) {
    fs.readdirSync(STORE_DIR).forEach(f => {
      try { fs.unlinkSync(path.join(STORE_DIR, f)); } catch {}
    });
  }
}

const TEST_PASS = '✅';
const TEST_FAIL = '❌';
let passed = 0, failed = 0;

function assert(cond, label) {
  if (cond) { console.log(`  ${TEST_PASS} ${label}`); passed++; }
  else      { console.log(`  ${TEST_FAIL} ${label}`); failed++; }
}

// ── 模拟管道压缩（等价于 command | node tokenforge.cjs compress output --level medium --store）
function pipeThroughTokenforge(content, type = 'output', level = 'medium') {
  const result = spawnSync('node', [TOKENFORGE, 'compress', type, '--level', level, '--store'], {
    input: content,
    encoding: 'utf-8',
    timeout: 10000,
    maxBuffer: 10 * 1024 * 1024,
    shell: true
  });
  return { stdout: (result.stdout || '').trim(), stderr: (result.stderr || '').trim(), status: result.status };
}

function pipeThroughHeadroom(content, mode = 'auto') {
  // headroom 未安装时 pipeCompress 会透传，不需要实际 headroom
  // 但会走存储逻辑
  const adapter = path.join(HELPER_DIR, 'headroom-adapter.cjs');
  const result = spawnSync('node', [adapter, 'compress', '--pipe', mode === 'code' ? '--code' : ''], {
    input: content,
    encoding: 'utf-8',
    timeout: 10000,
    maxBuffer: 10 * 1024 * 1024,
    shell: true
  });
  return { stdout: (result.stdout || '').trim(), stderr: (result.stderr || '').trim(), status: result.status };
}

// ══════════════════════════════════════════════════
console.log('══════════════════════════════════════════════════');
console.log('  会话记忆全链路验证');
console.log('══════════════════════════════════════════════════\n');

cleanup();

// ─── Phase 1: 冷启动 — 3次 tokenforge 压缩 ───
console.log('── Phase 1: 冷启动 (tokenforge --store) ──');

const C1 = 'x'.repeat(500) + '\nPASS: 10 tests\n' + 'y'.repeat(300);
const r1 = pipeThroughTokenforge(C1, 'output', 'medium');
assert(r1.status === 0, '第1轮 tokenforge 执行成功');
assert(r1.stdout.length < C1.length, '第1轮输出被压缩 (' + C1.length + '→' + r1.stdout.length + ')');

const C2 = '# Architecture\n\nSystem design...\n' + 'z'.repeat(2000);
const r2 = pipeThroughTokenforge(C2, 'context', 'medium');
assert(r2.status === 0, '第2轮 tokenforge 执行成功');

const C3 = 'FAIL\n  test1 ✗ expected true got false\n' + 'w'.repeat(800);
const r3 = pipeThroughTokenforge(C3, 'output', 'aggressive');
assert(r3.status === 0, '第3轮 tokenforge aggressive 执行成功');

// 验证原文存盘
assert(fs.existsSync(STORE_DIR), 'store 目录已创建');
const origFiles = fs.readdirSync(STORE_DIR).filter(f => f.startsWith('tf_') && f.endsWith('.orig'));
assert(origFiles.length >= 3, `tokenforge 原文已存盘: ${origFiles.length}个文件`);

// 验证会话索引
assert(fs.existsSync(MEM_FILE), '会话记忆文件已创建');
const sessionRaw = JSON.parse(fs.readFileSync(MEM_FILE, 'utf-8'));
assert(sessionRaw.records.length >= 3, `会话索引: ${sessionRaw.records.length}条记录`);
const tfRecords = sessionRaw.records.filter(r => r.compressor === 'tokenforge');
assert(tfRecords.length >= 3, `tokenforge 记录: ${tfRecords.length}条`);

// 验证会话摘要可读
const { getSummary } = require(SESSION_MEM);
const summary1 = getSummary();
assert(summary1 !== null, '有会话摘要');
assert(summary1.includes('tokenforge:3'), '摘要提到 tokenforge');
console.log(`  摘要预览: ${summary1.split('\n')[0]}`);

// 验证原文可检索
const firstId = sessionRaw.records[0].id;
const retrieveCmd = spawnSync('node', [SESSION_MEM, 'get-retrieve-hint', firstId], {
  encoding: 'utf-8', timeout: 5000, shell: true
});
const hint = JSON.parse(retrieveCmd.stdout);
assert(hint.available === true, `原文可检索: ${firstId}`);
assert(hint.compressor === 'tokenforge', `检索到 tokenforge 原文`);

// 验证原文内容匹配
const origPath = path.join(STORE_DIR, `${firstId}.orig`);
const origContent = fs.readFileSync(origPath, 'utf-8');
assert(origContent === C1, `原文内容完整性: ${origContent.length}==${C1.length}`);

console.log('');

// ─── Phase 2: 继续 tokenforge，累积到 8 轮 ───
console.log('── Phase 2: 持续 tokenforge (累计8轮) ──');
const fakeOutputs = [
  'Running build...\n'.repeat(50),
  'Test results: 42 passed\n'.repeat(20),
  'Lint output: 0 errors\n'.repeat(30),
  'Coverage: 85%\n'.repeat(40),
  'Bundle size: 245KB\n'.repeat(15),
];
for (const out of fakeOutputs) {
  const r = pipeThroughTokenforge(out, 'output', 'aggressive');
  assert(r.status === 0, `tokenforge ${out.split('\n')[0].substring(0, 30)}`);
}

// 更新 perf-tracker 模拟深度会话
fs.writeFileSync(TRACKER_FILE, JSON.stringify({
  totalCalls: 12,
  startTime: Date.now() - 25 * 60000
}));

const session2 = JSON.parse(fs.readFileSync(MEM_FILE, 'utf-8'));
assert(session2.records.length >= 8, `会话索引已累积: ${session2.records.length}条`);
console.log('');

// ─── Phase 3: 模拟热切换 → headroom ───
console.log('── Phase 3: 深度对话 → 热切 headroom ──');

// 清除缓存，重载 compressor-selector 以获取最新会话深度
Object.keys(require.cache).forEach(k => {
  if (k.includes('compressor-selector') || k.includes('session-memory')) {
    delete require.cache[k];
  }
});
const selector = require(path.join(HELPER_DIR, 'compressor-selector.cjs'));
selector._overrideHeadroomAvailable(true);
selector.resetSessionDepth();

const decision = selector.quickDecide('cat design.md', '# Architecture\n\n'.repeat(200), { level: 'medium' });
console.log(`  决策: ${decision.useHeadroom ? 'Headroom' : 'tokenforge'}`);
console.log(`  原因: ${decision.reason}`);
assert(decision.useHeadroom, '深度会话 → 热切 Headroom');

// 验证决策带会话记忆
if (decision.sessionMemory) {
  console.log(`  记忆: ${decision.sessionMemory.split('\n')[0]}`);
  assert(decision.sessionMemory.includes('tokenforge'), '会话记忆提及 tokenforge 历史');
} else {
  console.log('  记忆: (无)');
}

// 模拟 headroom 管道压缩
const C4 = '# Architecture\n## Components\n\n'.repeat(300);
const r4 = pipeThroughHeadroom(C4);
assert(r4.status === 0 || r4.stdout.length > 0, 'headroom 管道执行完成');

// 验证 headroom 原文也存盘了
const hrFiles = fs.readdirSync(STORE_DIR).filter(f => f.startsWith('hr_') && f.endsWith('.orig'));
assert(hrFiles.length >= 1, `headroom 原文已存盘: ${hrFiles.length}个文件`);

// 验证索引同时包含 tf 和 hr
const session3 = JSON.parse(fs.readFileSync(MEM_FILE, 'utf-8'));
const finalTf = session3.records.filter(r => r.compressor === 'tokenforge').length;
const finalHr = session3.records.filter(r => r.compressor === 'headroom').length;
console.log(`  会话记忆: ${finalTf}个 tokenforge + ${finalHr}个 headroom`);
assert(finalTf >= 8, 'tokenforge 记录保留');
assert(finalHr >= 1, 'headroom 记录追加');

// 验证最终摘要
const summaryF = getSummary();
console.log(`  最终摘要: ${summaryF.split('\n')[0]}`);
assert(summaryF.includes('tokenforge') && summaryF.includes('headroom'), '最终摘要包含两种压缩机');

console.log('');

// ─── Phase 4: 验证原文可跨压缩机检索 ───
console.log('── Phase 4: 跨压缩机检索 ──');
const tfId = session3.records.find(r => r.compressor === 'tokenforge').id;
const hrId = session3.records.find(r => r.compressor === 'headroom').id;

// tokenforge 原文
const tfFile = path.join(STORE_DIR, `${tfId}.orig`);
assert(fs.existsSync(tfFile), `tokenforge 原文存在: ${tfId}`);
const hrFile = path.join(STORE_DIR, `${hrId}.orig`);
assert(fs.existsSync(hrFile), `headroom 原文存在: ${hrId}`);

// 通过 headroom-adapter retrieve 也可取回 tokenforge 原文
const headroomAdapter = require(path.join(HELPER_DIR, 'headroom-adapter.cjs'));
const retrievedTf = headroomAdapter.retrieveOriginal(tfId);
assert(retrievedTf !== null, `通过 headroom-adapter 检索 tokenforge 原文成功`);
assert(retrievedTf === C1, `tokenforge 检索到的原文与原始一致`);

const retrievedHr = headroomAdapter.retrieveOriginal(hrId);
assert(retrievedHr !== null, `通过 headroom-adapter 检索 headroom 原文成功`);

// ─── 清理 ──
selector._overrideHeadroomAvailable(false);
cleanup();

console.log(`\n══════════════════════════════════════════════════`);
console.log(`  结果: ${TEST_PASS} ${passed} 通过, ${failed > 0 ? TEST_FAIL + ' ' + failed + ' 失败' : '0 失败'}`);
console.log(`══════════════════════════════════════════════════`);

if (failed > 0) process.exit(1);
