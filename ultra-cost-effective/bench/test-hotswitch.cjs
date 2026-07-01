#!/usr/bin/env node
/**
 * test-hotswitch.cjs — 会话深度热切换验证
 *
 * 模拟 deep session → 验证冷启动 tokenforge → 深度对话自动 Headroom 的热切换路径
 *
 * 用法: node bench/test-hotswitch.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const SELECTOR_PATH = path.join(__dirname, '..', 'helpers', 'compressor-selector.cjs');
const TRACKER_FILE = path.join(os.tmpdir(), 'ultra-cost-effective-perf-tracker.json');

// ── 清理旧缓存，重载模块 ──
Object.keys(require.cache).forEach(k => {
  if (k.includes('compressor-selector') || k.includes('headroom-adapter')) {
    delete require.cache[k];
  }
});
const mod = require(SELECTOR_PATH);

// 模拟 Headroom 可用
mod._overrideHeadroomAvailable(true);
mod.resetSessionDepth();

process.env.ULTRA_COST_EFFECTIVE_LEVEL = 'standard';

console.log('══════════════════════════════════════════════════');
console.log('  会话深度热切换测试 (Headroom=mock✅)');
console.log('══════════════════════════════════════════════════\n');

// ── 阶段1: 冷启动（0轮）──
fs.writeFileSync(TRACKER_FILE, JSON.stringify({
  totalCalls: 2,
  startTime: Date.now() - 3 * 60000
}));
mod.resetSessionDepth();

console.log('── 阶段1: 冷启动 (2轮, 3min) ──');
const cold1 = mod.quickDecide('npm test', 'PASS 10 tests\n✓ ok', { level: 'medium' });
console.log(`  小型测试输出 → ${cold1.useHeadroom ? 'Headroom' : 'tokenforge'} (${cold1.reason})`);
assert(!cold1.useHeadroom, '冷启动小输出应选 tokenforge');

const cold2 = mod.quickDecide('cat src/app.ts', 'import React from "react";\n'.repeat(100), { level: 'medium' });
console.log(`  中型代码文件 → ${cold2.useHeadroom ? 'Headroom' : 'tokenforge'} (${cold2.reason})`);
// 冷启动代码默认选 Headroom（类型=code 倾向高）

// ── 阶段2: 温对话（7轮）──
fs.writeFileSync(TRACKER_FILE, JSON.stringify({
  totalCalls: 7,
  startTime: Date.now() - 12 * 60000
}));
mod.resetSessionDepth();

console.log('\n── 阶段2: 温对话 (7轮, 12min) ──');
const warm1 = mod.quickDecide('npm test', 'FAIL: 3 tests', { level: 'medium' });
console.log(`  测试失败输出 → ${warm1.useHeadroom ? 'Headroom' : 'tokenforge'} (${warm1.reason})`);
assert(!warm1.useHeadroom, '温对话小输出应仍 tokenforge');

// ── 阶段3: 深度对话（18轮）──
fs.writeFileSync(TRACKER_FILE, JSON.stringify({
  totalCalls: 18,
  startTime: Date.now() - 40 * 60000
}));
mod.resetSessionDepth();

console.log('\n── 阶段3: 深度对话 (18轮, 40min) ──');
const deep1 = mod.quickDecide('cat design.md', '# Architecture\n\nSystem design...'.repeat(100), { level: 'medium' });
console.log(`  设计文档读取 → ${deep1.useHeadroom ? 'Headroom ✅' : 'tokenforge'} (${deep1.reason})`);
assert(deep1.useHeadroom, '🔥 深度对话+大内容 → 必须热切 Headroom！');

const deep2 = mod.quickDecide('cat src/auth.ts', 'export function login() {'.repeat(50), { level: 'medium' });
console.log(`  源代码读取   → ${deep2.useHeadroom ? 'Headroom ✅' : 'tokenforge'} (${deep2.reason})`);
assert(deep2.useHeadroom, '🔥 深度对话+代码 → 必须热切 Headroom！');

const deep3 = mod.quickDecide('npm test', 'PASS', { level: 'medium' });
console.log(`  极小测试输出 → ${deep3.useHeadroom ? 'Headroom' : 'tokenforge'} (${deep3.reason})`);
// 极小内容（<200chars）仍用 tokenforge，避免浪费 headroom

// ── 阶段4: 深度 + extreme 预设 ──
process.env.ULTRA_COST_EFFECTIVE_LEVEL = 'extreme';
mod.resetSessionDepth();

console.log('\n── 阶段4: extreme+深度 ──');
const ext1 = mod.quickDecide('cat ARCH.md', 'x'.repeat(6000), { level: 'max' });
console.log(`  超大文档     → ${ext1.useHeadroom ? 'Headroom ✅' : 'tokenforge'} (${ext1.reason})`);
assert(ext1.useHeadroom, 'extreme+深度 → 必须 Headroom');

// ── 清理 ──
mod._overrideHeadroomAvailable(false);
try { fs.unlinkSync(TRACKER_FILE); } catch {}
process.env.ULTRA_COST_EFFECTIVE_LEVEL = 'standard';

console.log('\n══════════════════════════════════════════════════');
console.log('  全部断言通过 ✅  热切换逻辑正确');
console.log('══════════════════════════════════════════════════');

function assert(cond, msg) {
  if (!cond) {
    console.error(`\n❌ 断言失败: ${msg}`);
    process.exit(1);
  }
}
