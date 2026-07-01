#!/usr/bin/env node
/**
 * compressor-selector.cjs — 智能压缩器选择器 (UltraCostEffective L6 决策层)
 *
 * 根据内容特征、上下文、预设等级、会话深度，自动选择 tokenforge (快速管道) 或 headroom (CCR 可逆)。
 * 支持会话内热切换：早期简单问答用 tokenforge，深度对话自动切换 Headroom。
 *
 * 决策维度:
 *  1. 预设等级:  quick → tokenforge, extreme → headroom, standard → 混合
 *  2. 内容大小:  >10KB → headroom 倾向, <2KB → tokenforge 倾向
 *  3. 内容类型:  code → headroom, cli/text → tokenforge
 *  4. 任务关键度: 设计/架构 → headroom (零损失), 构建/测试 → tokenforge (速度)
 *  5. Headroom可用: 不可用 → tokenforge fallback
 *  6. 会话深度:  轮次越多/时间越长 → headroom 倾向越强（热切换核心）
 *
 * 用法:
 *   node compressor-selector.cjs decide <content> [--context <json>]
 *   node compressor-selector.cjs --test          运行决策矩阵测试
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── 配置 ──────────────────────────────────────

const PRESET_PREFERENCE = {
  quick:    { tokenforge: 0.9, headroom: 0.1 },
  standard: { tokenforge: 0.7, headroom: 0.3 },
  extreme:  { tokenforge: 0.2, headroom: 0.8 }
};

// 内容类型 → headroom 倾向分数 (0=tokenforge, 1=headroom)
const TYPE_SCORES = {
  code:       0.7,   // CCR 对代码更安全
  context:    0.6,   // 大块上下文适合 CCR
  json:       0.4,   // JSON 两种都可以
  output:     0.1,   // CLI 输出适合快速管道
  text:       0.2,
  unknown:    0.3
};

// 任务关键词 → headroom 倾向
const TASK_SCORES = {
  high:   ['architecture', 'design', 'spec', 'plan', 'architecture review', '方案', '架构', '设计'],
  medium: ['code', 'implement', 'refactor', 'debug', '实现', '重构', '修复'],
  low:    ['test', 'build', 'lint', 'format', 'ci', '测试', '构建', '检查']
};

// ─── 检测 headroom 可用性 ─────────────────────

let _headroomAvailable = null;
let _headroomVersion = null;

function isHeadroomAvailable() {
  if (_headroomAvailable !== null) return _headroomAvailable;
  try {
    const { detectHeadroom } = require('./headroom-adapter.cjs');
    const result = detectHeadroom();
    _headroomAvailable = result.available;
    _headroomVersion = result.version;
  } catch {
    _headroomAvailable = false;
  }
  return _headroomAvailable;
}

/**
 * [测试用] 覆盖 Headroom 可用性（无需实际安装 headroom）
 */
function _overrideHeadroomAvailable(val) {
  _headroomAvailable = !!val;
  _headroomVersion = val ? 'mock' : null;
}

// ─── 内容分析 ──────────────────────────────────

function analyzeContent(content) {
  if (!content || content.length === 0) {
    return { type: 'unknown', size: 0, estimatedTokens: 0 };
  }

  const lines = content.split('\n');
  const len = content.length;
  const estimatedTokens = Math.round(len / 4);

  // 检测类型
  let type = 'unknown';
  const firstLine = lines[0] || '';

  // 代码特征
  const codeIndicators = [
    /^(import |from |const |let |var |function |class |def |public |private |protected |@)/m,
    /[{}\[\];]=/,
    /^\s*\/\//m,
    /^\s*#include/m,
    /^\s*package\s/m
  ];
  const codeScore = codeIndicators.filter(r => r.test(content)).length;
  const codeLineRatio = lines.filter(l => /^[\s{}();]*$/.test(l) || /^\s{2,}/.test(l)).length / Math.max(lines.length, 1);

  // JSON 检测
  const jsonLike = firstLine.trim().startsWith('{') || firstLine.trim().startsWith('[');

  // 构建/测试输出特征
  const cliIndicators = [
    /^(PASS|FAIL|✓|✗|error|warning|info)\b/mi,
    /^\s*\d+\)\s/m,
    /(passed|failed|error|warning)s?\s*:/mi,
    /elapsed|time:/i
  ];
  const cliScore = cliIndicators.filter(r => r.test(content)).length;

  if (codeScore >= 2 || codeLineRatio > 0.3) {
    type = 'code';
  } else if (jsonLike) {
    type = 'json';
  } else if (cliScore >= 2) {
    type = 'output';
  } else if (len > 5000) {
    type = 'context';
  } else {
    type = 'text';
  }

  return { type, size: len, estimatedTokens, lines: lines.length };
}

// ─── 任务关键度评估 ─────────────────────────────

function evaluateCriticality(command, context = {}) {
  const cmd = (command || '').toLowerCase();
  const ctx = (context.task || '').toLowerCase();

  for (const kw of [...TASK_SCORES.high, ...ctx.split(/\s+/)]) {
    if (TASK_SCORES.high.some(k => cmd.includes(k) || ctx.includes(k))) {
      return 'high';
    }
  }
  for (const kw of TASK_SCORES.medium) {
    if (cmd.includes(kw) || ctx.includes(kw)) {
      return 'medium';
    }
  }
  return 'low';
}

// ─── 会话深度感知（热切换核心）────────────────

const PERF_TRACKER_FILE = path.join(os.tmpdir(), 'ultra-cost-effective-perf-tracker.json');

// 深度曲线：调用次数 → headroom 倾向 (0=tokenforge, 1=headroom)
// 前5轮几乎不触发，6-15轮渐进升温，15+轮强烈倾向
function callsToDepthScore(calls) {
  if (calls <= 3)   return 0.05;
  if (calls <= 6)   return 0.15;
  if (calls <= 10)  return 0.35;
  if (calls <= 15)  return 0.55;
  if (calls <= 25)  return 0.75;
  return 0.90;
}

// 时间曲线：会话时长 → headroom 倾向
function durationToDepthScore(minutes) {
  if (minutes <= 5)   return 0.05;
  if (minutes <= 15)  return 0.20;
  if (minutes <= 30)  return 0.40;
  if (minutes <= 60)  return 0.60;
  return 0.85;
}

let _sessionDepthCache = null;
let _sessionDepthTime = 0;
const DEPTH_CACHE_TTL = 10000; // 10秒缓存，避免每次调用都读文件

function getSessionDepth() {
  const now = Date.now();
  if (_sessionDepthCache !== null && (now - _sessionDepthTime) < DEPTH_CACHE_TTL) {
    return _sessionDepthCache;
  }

  try {
    if (fs.existsSync(PERF_TRACKER_FILE)) {
      const raw = fs.readFileSync(PERF_TRACKER_FILE, 'utf-8');
      const session = JSON.parse(raw);
      const calls = session.totalCalls || 0;
      const duration = session.startTime ? Math.floor((now - session.startTime) / 60000) : 0;

      const callsScore = callsToDepthScore(calls);
      const durationScore = durationToDepthScore(duration);
      // 取两者中较高者（轮次多 OR 时间长都说明深度对话）
      const depthScore = Math.max(callsScore, durationScore);

      _sessionDepthCache = { calls, duration, callsScore, durationScore, depthScore };
      _sessionDepthTime = now;
      return _sessionDepthCache;
    }
  } catch { /* 无会话数据 → 视为冷启动 */ }

  // 无历史 = 冷启动
  _sessionDepthCache = { calls: 0, duration: 0, callsScore: 0, depthScore: 0 };
  _sessionDepthTime = now;
  return _sessionDepthCache;
}

/**
 * 清除深度缓存（会话重置时调用）
 */
function resetSessionDepth() {
  _sessionDepthCache = null;
  _sessionDepthTime = 0;
}

// ─── 核心决策 ──────────────────────────────────

/**
 * 选择压缩方案
 * @param {string} content - 待压缩内容
 * @param {object} ctx
 * @param {string} ctx.command - 触发命令
 * @param {string} ctx.task - 任务描述
 * @param {string} ctx.preset - 预设等级 (quick|standard|extreme)
 * @returns {{ engine: 'tokenforge'|'headroom', level: string, reason: string, scores: object }}
 */
function decide(content, ctx = {}) {
  const preset = ctx.preset || process.env.ULTRA_COST_EFFECTIVE_LEVEL || 'standard';
  const headroomAvail = isHeadroomAvailable();
  const analysis = analyzeContent(content);

  // ── 维度 1: 预设偏好 ──
  const pref = PRESET_PREFERENCE[preset] || PRESET_PREFERENCE.standard;

  // ── 维度 2: 内容大小 ──
  let sizeScore = 0;
  if (analysis.size > 20000) sizeScore = 0.9;      // >20KB → 强烈倾向 headroom
  else if (analysis.size > 10000) sizeScore = 0.7;  // >10KB
  else if (analysis.size > 5000) sizeScore = 0.5;   // >5KB
  else if (analysis.size > 1000) sizeScore = 0.3;   // 中等
  else sizeScore = 0.1;                              // 小块 → tokenforge

  // ── 维度 3: 内容类型 ──
  const typeScore = TYPE_SCORES[analysis.type] || 0.3;

  // ── 维度 4: 任务关键度 ──
  const criticality = evaluateCriticality(ctx.command, ctx);
  const criticalityScore = criticality === 'high' ? 0.8 : criticality === 'medium' ? 0.4 : 0.1;

  // ── 维度 6: 会话深度（热切换核心）──
  const depth = getSessionDepth();
  const depthScore = depth.depthScore;

  // ── 热切换短路：深度对话 (>10轮 或 >15min) 直接切 Headroom ──
  // 这是"冷启动 tokenforge → 深聊自动 Headroom"的热切换机制
  // 即使 standard 预设，深度对话也优先保证信息完整性
  if (depthScore >= 0.55 && headroomAvail && analysis.size > 200) {
    return {
      engine: 'headroom',
      level: 'auto',
      reason: `会话深度(${depth.calls}轮/${depth.duration}min, 倾向=${depthScore.toFixed(2)}) → 热切 Headroom CCR`,
      scores: { headroom: 1.0, tokenforge: 0, size: sizeScore, type: typeScore, criticality: criticalityScore, depth: depthScore },
      fallback: false,
      analysis
    };
  }

  // ── 加权计算 ──
  // 预设 45% + 大小 15% + 类型 8% + 关键度 12% + 会话深度 20%
  // 会话深度占最大权重，确保长时间/多轮对话自动热切到 Headroom
  const headroomScore =
    pref.headroom * 0.45 +
    sizeScore * 0.15 +
    typeScore * 0.08 +
    criticalityScore * 0.12 +
    depthScore * 0.20;

  const tokenforgeScore = 1 - headroomScore;

  // ── 维度 5: 可用性检查 ──
  if (!headroomAvail && headroomScore > 0.5) {
    return {
      engine: 'tokenforge',
      level: preset === 'extreme' ? 'aggressive' : 'medium',
      reason: `headroom 不可用，回退 tokenforge (headroomScore=${headroomScore.toFixed(2)}, 会话深度=${depth.calls}轮/${depth.duration}min)`,
      scores: { headroom: headroomScore, tokenforge: tokenforgeScore, size: sizeScore, type: typeScore, criticality: criticalityScore, depth: depthScore },
      fallback: true,
      analysis
    };
  }

  // ── 强制规则覆盖 ──
  // extreme 预设 + headroom 可用 → 大内容强制 headroom
  if (preset === 'extreme' && headroomAvail && analysis.size > 5000) {
    return {
      engine: 'headroom',
      level: 'auto',
      reason: `extreme 预设 + 大内容(${analysis.size}chars) → Headroom CCR`,
      scores: { headroom: 1.0, tokenforge: 0, size: sizeScore, type: typeScore, criticality: criticalityScore },
      fallback: false,
      analysis
    };
  }

  // quick 预设 → 强制 tokenforge（用户选了快速模式）
  if (preset === 'quick') {
    return {
      engine: 'tokenforge',
      level: 'medium',
      reason: 'quick 预设 → tokenforge 零延迟管道',
      scores: { headroom: 0, tokenforge: 1.0, size: 0, type: 0, criticality: 0 },
      fallback: false,
      analysis
    };
  }

  // ── 最终决策 ──
  const useHeadroom = headroomScore > 0.55;

  return {
    engine: useHeadroom ? 'headroom' : 'tokenforge',
    level: useHeadroom
      ? (headroomScore > 0.8 ? 'max' : 'auto')
      : (headroomScore > 0.3 ? 'medium' : 'aggressive'),
    reason: useHeadroom
      ? `Headroom CCR (score=${headroomScore.toFixed(2)}): 内容${analysis.size}chars, 类型=${analysis.type}, 关键度=${criticality}`
      : `tokenforge (score=${tokenforgeScore.toFixed(2)}): 内容${analysis.size}chars, 类型=${analysis.type}, 关键度=${criticality}`,
    scores: { headroom: headroomScore, tokenforge: tokenforgeScore, size: sizeScore, type: typeScore, criticality: criticalityScore },
    fallback: false,
    analysis
  };
}

// ─── 简化 API ──────────────────────────────────

/**
 * 为 tokenforge-hook 提供快速决策
 * @returns {{ useHeadroom: boolean, tokenforgeLevel: string, reason: string }}
 */
function quickDecide(command, contentPreview = '', context = {}) {
  // 无 Headroom 时快速返回
  if (!isHeadroomAvailable()) {
    return { useHeadroom: false, tokenforgeLevel: context.level || 'medium', reason: 'headroom 不可用' };
  }

  const analysis = analyzeContent(contentPreview);
  const preset = process.env.ULTRA_COST_EFFECTIVE_LEVEL || 'standard';
  const depth = getSessionDepth();

  // ── 会话记忆上下文（切换时注入）──
  let sessionContext = null;
  try {
    const sessionMemory = require('./session-memory.cjs');
    const tfCount = sessionMemory.getOrCreateSession().records.filter(r => r.compressor === 'tokenforge').length;
    const hrCount = sessionMemory.getOrCreateSession().records.filter(r => r.compressor === 'headroom').length;
    if (tfCount > 0 || hrCount > 0) {
      sessionContext = sessionMemory.getSummary();
    }
  } catch { /* session-memory 不可用 */ }

  // ── 会话深度热切换规则 ──
  // 深度对话（>10轮 或 >15min）+ 内容>200chars → 热切 Headroom
  if ((depth.calls > 10 || depth.duration > 15) && analysis.size > 200) {
    return {
      useHeadroom: true,
      tokenforgeLevel: null,
      reason: `会话深度(${depth.calls}轮/${depth.duration}min) → 热切 Headroom`,
      sessionMemory: sessionContext
    };
  }

  // quick 预设 — 不折腾
  if (preset === 'quick') {
    return { useHeadroom: false, tokenforgeLevel: 'medium', reason: 'quick 预设', sessionMemory: sessionContext };
  }

  // extreme + 大内容 → headroom
  if (preset === 'extreme' && analysis.size > 5000) {
    return { useHeadroom: true, tokenforgeLevel: null, reason: `extreme+大内容(${analysis.size}chars)`, sessionMemory: sessionContext };
  }

  // 标准：大内容或代码 → headroom
  if (analysis.size > 10000 || analysis.type === 'code') {
    return { useHeadroom: true, tokenforgeLevel: null, reason: `${analysis.type} ${analysis.size}chars`, sessionMemory: sessionContext };
  }

  return { useHeadroom: false, tokenforgeLevel: analysis.size > 2000 ? 'aggressive' : 'medium', reason: `tokenforge (${analysis.size}chars ${analysis.type})`, sessionMemory: sessionContext };
}

// ─── 主函数 ────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--test')) {
    runDecisionMatrix();
    return;
  }

  if (args[0] === 'decide') {
    const content = args.slice(1).join(' ');
    const ctxIdx = args.indexOf('--context');
    let context = {};
    if (ctxIdx !== -1 && args[ctxIdx + 1]) {
      try { context = JSON.parse(args[ctxIdx + 1]); } catch {}
    }
    const result = decide(content, context);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // 默认: 显示状态
  const avail = isHeadroomAvailable();
  const depth = getSessionDepth();
  console.log('═══════════════════════════════════');
  console.log('  UltraCostEffective Compressor Selector');
  console.log('═══════════════════════════════════');
  console.log('');
  console.log(`  Headroom: ${avail ? '✅ 可用' + (_headroomVersion ? ` (${_headroomVersion})` : '') : '❌ 不可用'}`);
  console.log(`  预设:     ${process.env.ULTRA_COST_EFFECTIVE_LEVEL || 'standard'}`);
  if (depth.calls > 0 || depth.duration > 0) {
    console.log(`  会话深度: ${depth.calls} 轮 / ${depth.duration} 分钟 → 热切倾向 ${depth.depthScore.toFixed(2)}`);
  } else {
    console.log(`  会话深度: 冷启动`);
  }
  console.log('');
  console.log('决策矩阵:');
  console.log('  quick    → tokenforge (零延迟)');
  console.log('  standard → 混合: 大内容/代码 → headroom, 输出 → tokenforge');
  console.log('  extreme  → headroom 优先 (CCR 可逆)');
  console.log('  会话深度  → 10+轮/15+min 自动热切 Headroom');
  console.log('');
  console.log('测试: node compressor-selector.cjs --test');
}

// ─── 决策矩阵测试 ──────────────────────────────

function runDecisionMatrix() {
  const scenarios = [
    { content: 'x'.repeat(500), cmd: 'npm test', task: 'run tests', preset: 'quick' },
    { content: 'x'.repeat(500), cmd: 'npm test', task: 'run tests', preset: 'standard' },
    { content: 'x'.repeat(15000), cmd: 'cat spec.md', task: 'read design spec', preset: 'standard' },
    { content: 'function foo() {\n  return 1;\n}', cmd: 'cat src/app.ts', task: 'code review', preset: 'extreme' },
    { content: 'FAIL\n  test1 ✗\n  test2 ✗', cmd: 'npm test', task: 'test output', preset: 'standard' },
    { content: '# Architecture\n\nSystem design...' + 'x'.repeat(12000), cmd: 'cat ARCH.md', task: 'architecture review', preset: 'extreme' },
    { content: '{}', cmd: 'curl api', task: 'api call', preset: 'quick' },
    // 会话深度模拟（需要预置 perf-tracker 数据）
    { content: 'x'.repeat(3000), cmd: 'cat design.md', task: 'design review', preset: 'standard', depthOverride: { calls: 12, duration: 20 } },
    { content: 'x'.repeat(500), cmd: 'npm test', task: 'run tests', preset: 'quick', depthOverride: { calls: 20, duration: 45 } },
  ];

  const results = [];
  const avail = isHeadroomAvailable();

  console.log('══════════════════════════════════════════════════');
  console.log(`  Compressor Selector 决策矩阵 (Headroom: ${avail ? '✅' : '❌'})`);
  console.log('══════════════════════════════════════════════════\n');

  for (const s of scenarios) {
    // 深度覆盖：模拟多轮对话后的决策
    if (s.depthOverride) {
      _sessionDepthCache = {
        calls: s.depthOverride.calls,
        duration: s.depthOverride.duration,
        callsScore: callsToDepthScore(s.depthOverride.calls),
        durationScore: durationToDepthScore(s.depthOverride.duration),
        depthScore: Math.max(
          callsToDepthScore(s.depthOverride.calls),
          durationToDepthScore(s.depthOverride.duration)
        )
      };
      _sessionDepthTime = Date.now();
    } else {
      _sessionDepthCache = { calls: 0, duration: 0, callsScore: 0, depthScore: 0 };
      _sessionDepthTime = Date.now();
    }

    const d = decide(s.content, { command: s.cmd, task: s.task, preset: s.preset });
    results.push(d);
    const icon = d.engine === 'headroom' ? '🧠' : '⚡';
    const fl = d.fallback ? ' [回退]' : '';
    console.log(`${icon} [${s.preset}] ${s.cmd.slice(0,40).padEnd(40)} → ${d.engine}${fl}`);
    console.log(`   ${d.reason}`);
    if (!d.fallback) {
      console.log(`   scores: H=${d.scores.headroom.toFixed(2)} T=${d.scores.tokenforge.toFixed(2)} | size=${d.scores.size.toFixed(2)} type=${d.scores.type.toFixed(2)} crit=${d.scores.criticality.toFixed(2)}`);
    }
    console.log();
  }

  // 汇总
  const headroomCount = results.filter(r => r.engine === 'headroom').length;
  const fallbackCount = results.filter(r => r.fallback).length;
  console.log('─── 汇总 ───');
  console.log(`  headroom 决策: ${headroomCount}/${results.length}`);
  console.log(`  回退次数:     ${fallbackCount}`);
  console.log(`  tokenforge:   ${results.length - headroomCount}`);
}

// ─── 导出 ──────────────────────────────────────

if (require.main === module) {
  main();
}

module.exports = { decide, quickDecide, analyzeContent, evaluateCriticality, isHeadroomAvailable, getSessionDepth, resetSessionDepth, _overrideHeadroomAvailable };
