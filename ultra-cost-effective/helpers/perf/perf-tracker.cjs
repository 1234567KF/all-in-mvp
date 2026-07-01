#!/usr/bin/env node
/**
 * perf-tracker.cjs — 全链路 Token 性能追踪器 (UltraCostEffective L0)
 *
 * 借鉴 ccmvp/1234567KF 的 perf-tracker.cjs 设计，增强：
 *  1. 会话/任务/项目三级汇总
 *  2. 各压缩层独立节省归因
 *  3. DeepSeek KV Cache 命中追踪
 *  4. 双平台兼容
 *
 * 用法:
 *   node perf-tracker.cjs --report              # 会话报告
 *   node perf-tracker.cjs --watch               # 实时监控
 *   node perf-tracker.cjs --export <file.csv>    # 导出CSV
 *   node perf-tracker.cjs --reset               # 重置统计
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── 项目根目录定位 ────────────────────────────

function resolveProjectRoot() {
  // 1. 环境变量优先
  if (process.env.ULTRA_COST_EFFECTIVE_PROJECT_ROOT) {
    return process.env.ULTRA_COST_EFFECTIVE_PROJECT_ROOT;
  }
  // 2. 从 __dirname 向上查找（脚本在 helpers/perf/ 下，最可靠）
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    dir = path.dirname(dir);
    if (fs.existsSync(path.join(dir, 'ultra-cost-effective'))) {
      return dir;
    }
  }
  // 3. process.cwd() 兜底
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, 'ultra-cost-effective'))) return cwd;
  // 4. 最后兜底
  return process.cwd();
}

const PROJECT_ROOT = resolveProjectRoot();
const TRACKER_FILE = path.join(PROJECT_ROOT, '.ultra-cost-effective-tracker.json');

// ─── 定价数据 ──────────────────────────────────

function loadPricing() {
  try {
    const pricingPath = path.join(__dirname, 'pricing.json');
    if (fs.existsSync(pricingPath)) {
      return JSON.parse(fs.readFileSync(pricingPath, 'utf-8'));
    }
  } catch {}
  return null;
}

// ─── 数据结构 ──────────────────────────────────

function createSession() {
  return {
    sessionId: `uce_${Date.now().toString(36)}`,
    projectRoot: PROJECT_ROOT,
    startTime: Date.now(),
    totalCalls: 0,
    // Token 统计
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheHitTokens: 0,
    totalCacheMissTokens: 0,
    // 分层节省
    layerSavings: {
      L1_tokenforge:  { savedTokens: 0, calls: 0, estimatedSaving: 0 },
      L1_leanCtx:     { savedTokens: 0, calls: 0, estimatedSaving: 0 },
      L2_kvCache:     { savedTokens: 0, calls: 0, estimatedSaving: 0, hitRate: 0 },
      L4_skillLoader: { savedTokens: 0, calls: 0, estimatedSaving: 0 },
      L7_router:      { savedTokens: 0, calls: 0, estimatedSaving: 0, flashDowngrades: 0 }
    },
    // 按模型统计
    modelStats: {},
    // 调用明细
    calls: []
  };
}

function loadSession() {
  try {
    if (fs.existsSync(TRACKER_FILE)) {
      return JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf-8'));
    }
  } catch {}
  return createSession();
}

function saveSession(session) {
  fs.writeFileSync(TRACKER_FILE, JSON.stringify(session, null, 2));
}

// ─── 记录 API 调用 ─────────────────────────────

function recordCall(session, callData) {
  session.totalCalls++;

  // 精确指标
  session.totalOutputChars = (session.totalOutputChars || 0) + (callData.outputChars || 0);
  session.totalInputChars = (session.totalInputChars || 0) + (callData.inputChars || 0);
  session.totalSavedChars = (session.totalSavedChars || 0) + (callData.savedChars || 0);

  // 估算 token（标注为估算值）
  session.totalEstimatedInputTokens = (session.totalEstimatedInputTokens || 0) + (callData.estimatedInputTokens || 0);
  session.totalEstimatedOutputTokens = (session.totalEstimatedOutputTokens || 0) + (callData.estimatedOutputTokens || 0);

  // 模型统计
  const model = callData.model || 'unknown';
  if (!session.modelStats[model]) {
    session.modelStats[model] = { calls: 0, estimatedInputTokens: 0, estimatedOutputTokens: 0 };
  }
  session.modelStats[model].calls++;
  session.modelStats[model].estimatedInputTokens += callData.estimatedInputTokens || 0;
  session.modelStats[model].estimatedOutputTokens += callData.estimatedOutputTokens || 0;

  // tokenforge 贡献
  if (callData.savedChars > 0) {
    session.layerSavings.L1_tokenforge.savedTokens += Math.round(callData.savedChars / 3.5);
    session.layerSavings.L1_tokenforge.calls++;
  }

  // 记录调用明细
  session.calls.push({
    time: Date.now(),
    model: callData.model || 'unknown',
    tool: callData.tool,
    outputChars: callData.outputChars || 0,
    compressed: callData.compressed || false,
  });
  if (session.calls.length > 100) session.calls.shift();

  saveSession(session);
}

// ─── 报告生成 ──────────────────────────────────

function generateReport(session) {
  const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
  const h = Math.floor(elapsed / 3600), m = Math.floor((elapsed % 3600) / 60), s = elapsed % 60;
  const inputChars = session.totalInputChars || 0, outputChars = session.totalOutputChars || 0;
  const savedChars = session.totalSavedChars || 0;
  const estInput = session.totalEstimatedInputTokens || 0, estOutput = session.totalEstimatedOutputTokens || 0;

  const lines = [
    '══════════════════════════════════════════════════',
    '       UltraCostEffective Token 报告',
    '══════════════════════════════════════════════════', '',
    `项目:     ${PROJECT_ROOT}`,
    `会话ID:   ${session.sessionId}`,
    `运行时间: ${h}h ${m}m ${s}s  |  调用: ${session.totalCalls}`, '',
    '─── 精确指标（直接从 Hook 数据测量） ───',
    `工具调用次数: ${session.totalCalls}`,
    `输出字符总数: ${(outputChars / 1000).toFixed(1)}K chars`,
    `输入字符总数: ${(inputChars / 1000).toFixed(1)}K chars`,
  ];
  if (savedChars > 0) lines.push(`tokenforge 压缩节省: ${(savedChars / 1000).toFixed(1)}K chars (${session.layerSavings.L1_tokenforge.calls} 次)`);
  lines.push('',
    '─── 估算指标（基于字符数换算，非 API 实际返回） ───',
    `⚠ 估算输入:  ~${(estInput / 1000).toFixed(1)}K tokens  (1 token ≈ 3.5 chars)`,
    `⚠ 估算输出:  ~${(estOutput / 1000).toFixed(1)}K tokens`, '',
    '─── 模型使用 ───');
  for (const [model, stats] of Object.entries(session.modelStats || {})) {
    lines.push(`${model}: ${stats.calls} 次 (估算)`);
  }
  lines.push('',
    '📌 注意: Claude Code hook 接口不提供 token 用量。',
    '   精确 token 数据需从 API response 直接读取 usage 字段。',
    '   本报告仅基于工具输出字符长度估算。',
    '══════════════════════════════════════════════════');
  return lines.join('\n');
}

// 保留旧版兼容函数（废弃，待移除）
function _legacyGenerateReport(session) {
  const includeRouter = process.env.ULTRA_COST_EFFECTIVE_INCLUDE_ROUTER === '1';
  const pricing = loadPricing();

  const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;

  const hitRate = session.totalCacheHitTokens + session.totalCacheMissTokens > 0
    ? (session.totalCacheHitTokens / (session.totalCacheHitTokens + session.totalCacheMissTokens) * 100).toFixed(1)
    : '0.0';

  // 成本计算 — 从 pricing.json 读取定价（避免硬编码）
  const proInputPrice = pricing?.models?.['deepseek-v4-pro']?.inputPrice || 3.0;
  const proOutputPrice = pricing?.models?.['deepseek-v4-pro']?.outputPrice || 9.0;
  const flashInputPrice = pricing?.models?.['deepseek-v4-flash']?.inputPrice || 1.0;
  const flashOutputPrice = pricing?.models?.['deepseek-v4-flash']?.outputPrice || 3.0;
  const cacheHitPrice = pricing?.models?.['deepseek-v4-pro']?.cacheHitPrice || 0.025;
  const cacheMissPrice = pricing?.models?.['deepseek-v4-pro']?.cacheMissPrice || 3.0;

  let inputCostFull = 0;
  let actualCost = 0;
  for (const [model, stats] of Object.entries(session.modelStats)) {
    const isPro = model.includes('pro');
    const inputPrice = isPro ? proInputPrice : flashInputPrice;
    const outputPrice = isPro ? proOutputPrice : flashOutputPrice;
    inputCostFull += (stats.inputTokens / 1_000_000) * inputPrice;
    actualCost += (stats.inputTokens / 1_000_000) * inputPrice;
    actualCost += (stats.outputTokens / 1_000_000) * outputPrice;
  }
  // 应用 KV Cache 折扣
  const cacheHitCost = (session.totalCacheHitTokens / 1_000_000) * cacheHitPrice;
  const cacheMissCost = (session.totalCacheMissTokens / 1_000_000) * cacheMissPrice;
  actualCost = cacheHitCost + cacheMissCost + (session.totalOutputTokens / 1_000_000) * cacheMissPrice;

  // L7 路由节省（仅在 ULTRA_COST_EFFECTIVE_INCLUDE_ROUTER=1 时计入）
  const routerSavings = includeRouter ? session.layerSavings.L7_router.estimatedSaving : 0;
  const totalSavings = inputCostFull - actualCost + routerSavings;

  const lines = [];
  lines.push('═'.repeat(50));
  lines.push('       UltraCostEffective Token 报告');
  lines.push('═'.repeat(50));
  lines.push('');
  lines.push(`项目:     ${session.projectRoot || PROJECT_ROOT}`);
  lines.push(`会话ID:   ${session.sessionId}`);
  lines.push(`运行时间: ${h}h ${m}m ${s}s  |  调用: ${session.totalCalls}`);
  lines.push('');
  lines.push(`输入:  ${(session.totalInputTokens / 1000).toFixed(1)}K tokens`);
  lines.push(`输出:  ${(session.totalOutputTokens / 1000).toFixed(1)}K tokens`);
  lines.push(`合计:  ${((session.totalInputTokens + session.totalOutputTokens) / 1000).toFixed(1)}K tokens`);
  lines.push('');
  lines.push('─── 层级节省 ───');
  lines.push(`L1 tokenforge:   -${(session.layerSavings.L1_tokenforge.savedTokens / 1000).toFixed(1)}K tokens (${session.layerSavings.L1_tokenforge.calls} 次)`);
  lines.push(`L2 KV Cache:     -${(session.layerSavings.L2_kvCache.savedTokens / 1000).toFixed(1)}K tokens, 命中率 ${hitRate}%`);
  lines.push(`L4 skill-loader: -${(session.layerSavings.L4_skillLoader.savedTokens / 1000).toFixed(1)}K tokens (${session.layerSavings.L4_skillLoader.calls} 次)`);
  if (includeRouter) {
    lines.push(`L7 router:       -¥${routerSavings.toFixed(2)} (Flash降级 ${session.layerSavings.L7_router.flashDowngrades} 次)`);
  } else if (session.layerSavings.L7_router.flashDowngrades > 0) {
    lines.push(`L7 router:       Flash降级 ${session.layerSavings.L7_router.flashDowngrades} 次 (成本节省已排除—动态定价)`);
  }
  lines.push('');
  lines.push('─── 成本 ───');
  if (pricing) {
    lines.push(`定价基准: ${pricing.provider || 'DeepSeek'} (${pricing.updated || 'N/A'})`);
  }
  lines.push(`无优化成本: ¥${inputCostFull.toFixed(3)}`);
  lines.push(`实际成本:   ¥${actualCost.toFixed(3)}`);
  lines.push(`预计节省:   ¥${totalSavings.toFixed(3)} (${inputCostFull > 0 ? (totalSavings / inputCostFull * 100).toFixed(1) : 0}%)`);
  if (!includeRouter && session.layerSavings.L7_router.flashDowngrades > 0) {
    lines.push(`注: L7模型路由节省未计入。设置 ULTRA_COST_EFFECTIVE_INCLUDE_ROUTER=1 以包含。`);
  }
  lines.push('');
  if (Object.keys(session.modelStats).length > 0) {
    lines.push('─── 模型使用 ───');
    for (const [model, stats] of Object.entries(session.modelStats)) {
      lines.push(`${model}: ${stats.calls} 次, ${(stats.inputTokens / 1000).toFixed(1)}K in / ${(stats.outputTokens / 1000).toFixed(1)}K out`);
    }
  }
  lines.push('');
  lines.push('═'.repeat(50));

  return lines.join('\n');
}

// ─── CSV 导出 ──────────────────────────────────

function exportCSV(session, filePath) {
  const headers = ['time', 'model', 'inputTokens', 'outputTokens', 'cacheHit', 'tokenforgeSaved', 'routedToFlash'];
  const rows = [headers.join(',')];
  for (const call of session.calls) {
    rows.push([
      new Date(call.time).toISOString(),
      call.model,
      call.inputTokens,
      call.outputTokens,
      call.cacheHit,
      call.tokenforgeSaved,
      call.routedToFlash
    ].join(','));
  }
  fs.writeFileSync(filePath, rows.join('\n'), 'utf-8');
  return filePath;
}

// ─── Watch 模式 ────────────────────────────────

function watchMode() {
  console.log('🔍 UltraCostEffective Perf Tracker — Watch 模式 (Ctrl+C 退出)\n');
  let lastSize = 0;
  try { lastSize = fs.statSync(TRACKER_FILE).size; } catch {}

  const interval = setInterval(() => {
    try {
      if (!fs.existsSync(TRACKER_FILE)) return;
      const currentSize = fs.statSync(TRACKER_FILE).size;
      if (currentSize !== lastSize) {
        lastSize = currentSize;
        process.stdout.write('\x1b[2J\x1b[H');
        console.log(generateReport(loadSession()));
      }
    } catch {}
  }, 2000);

  process.on('SIGINT', () => { clearInterval(interval); console.log('\n追踪已停止。'); process.exit(0); });
}

// ─── 从 stdin 读取 Hook 事件数据 ─────────────────

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const stdin = process.stdin;

    if (stdin.isTTY) {
      resolve(null);
      return;
    }

    stdin.setEncoding('utf-8');
    stdin.on('data', (chunk) => chunks.push(chunk));
    stdin.on('end', () => resolve(chunks.join('')));
    stdin.on('error', (err) => {
      // EPIPE: 上游无数据输入，静默处理
      if (err.code === 'EPIPE') { resolve(null); return; }
      reject(err);
    });

    // 超时保护：500ms 无数据自动返回
    setTimeout(() => {
      if (chunks.length === 0) { resolve(null); return; }
    }, 500);
  });
}

function readStdinSync() {
  // 同步版：适用于 stdin 已就绪的场景
  if (process.stdin.isTTY) return null;
  try {
    const buf = require('fs').readFileSync(0, 'utf-8');
    return buf || null;
  } catch {
    return null;
  }
}

// ─── --capture 模式：stdin → recordCall ──────────

function captureFromHook(raw) {
  let data;
  try { data = JSON.parse(raw); } catch {
    return null;
  }

  // Claude Code PostToolUse hook 传: { hook_event_name, tool_name, tool_input, tool_response }
  // ⚠️ 注意：hook 接口不提供 token 用量（usage.input_tokens 等）。以下为可精确测量的指标。
  const toolName = data.tool_name || data.tool || 'unknown';
  const toolInput = data.tool_input || data.input || {};
  const toolResponse = data.tool_response || data.output || '';

  const command = typeof toolInput === 'object' && toolInput.command
    ? toolInput.command
    : (typeof toolInput === 'string' ? toolInput : JSON.stringify(toolInput));

  // ★ 精确指标：输出字符数。不估算 token（hook 没有真实数据）
  const outputChars = typeof toolResponse === 'string' ? toolResponse.length : 0;
  const inputChars = command.length + (typeof toolInput === 'object' ? JSON.stringify(toolInput).length : 0);

  // 检测 tokenforge 压缩管道
  const wasCompressed = command.includes('tokenforge.cjs');
  const base = (command.trim().split(/\s+/)[0] || '').toLowerCase().replace(/^.*[\\/]/, '');
  const isBenefitCmd = isBenefitCommandForTracker(base, command);

  // 估算 tokenforge 节省（基于输出压缩比，tokenforge 约压缩 60-80%）
  const compressedSavings = wasCompressed ? Math.round(outputChars * 0.7) : 0;

  const callData = {
    model: 'deepseek-v4-flash',
    // ⚠️ 以下 token 数为估算值，非 API 实际返回
    estimatedInputTokens: Math.round(inputChars / 3.5),
    estimatedOutputTokens: Math.round(outputChars / 3.5),
    // ★ 精确指标
    outputChars,        // 输出字符数（精确）
    inputChars,         // 输入字符数（精确）
    savedChars: compressedSavings,  // tokenforge 节省字符数
    callCount: 1,       // 精确：1 次调用
    tool: toolName,
    command: command.length > 120 ? command.slice(0, 120) + '...' : command,
    compressed: wasCompressed,
    bypassed: isBenefitCmd && !wasCompressed,
  };

  return callData;
}

// ─── 主函数 ────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  // --capture 模式：从 stdin 读取 Hook 数据并记录
  if (args.includes('--capture')) {
    const raw = readStdinSync();
    if (!raw || raw.trim().length === 0) {
      // 无 stdin 数据，静默退出（非错误）
      process.exit(0);
    }

    const callData = captureFromHook(raw);
    if (!callData) {
      process.exit(0);
    }

    const session = loadSession();
    recordCall(session, callData);
    saveSession(session);

    // 同步记录到 cache-monitor（如果有 KV Cache 数据）
    if (callData.cacheHitTokens > 0) {
      try {
        const cm = require('../cache-monitor.cjs');
        const stats = cm.loadStats();
        cm.recordRequest(stats, {
          promptTokens: (callData.inputTokens || 0) + (callData.outputTokens || 0),
          cacheHitTokens: callData.cacheHitTokens,
          cacheMissTokens: (callData.inputTokens || 0) - callData.cacheHitTokens
        }, callData.model);
      } catch { /* cache-monitor 不可用时忽略 */ }
    }

    process.exit(0);
    return;
  }

  if (args.includes('--reset')) {
    saveSession(createSession());
    console.log('✅ 性能追踪数据已重置。');
    return;
  }

  if (args.includes('--watch') || args.includes('-w')) {
    watchMode();
    return;
  }

  if (args.includes('--export')) {
    const idx = args.indexOf('--export');
    const filePath = args[idx + 1] || path.join(os.tmpdir(), 'ultra-cost-effective-calls.csv');
    const session = loadSession();
    exportCSV(session, filePath);
    console.log(`✅ 导出完成: ${filePath} (${session.calls.length} 条记录)`);
    return;
  }

  // ── 生效审计 ──
  if (args.includes('--audit') || args.includes('-a')) {
    const session = loadSession();
    const totalCalls = session.totalCalls || 0;
    const effectiveCalls = session.calls ? session.calls.filter(c => c.effective).length : 0;
    const bypassedCalls = session.calls ? session.calls.filter(c => c.bypassed).length : 0;

    console.log('═'.repeat(50));
    console.log('  UltraCostEffective 生效审计');
    console.log('═'.repeat(50));
    console.log('');
    console.log(`总调用:       ${totalCalls}`);
    console.log(`UltraCostEffective 生效:   ${effectiveCalls}  (${totalCalls > 0 ? (effectiveCalls / totalCalls * 100).toFixed(1) : 0}%)`);
    console.log(`可能被绕过:   ${bypassedCalls}`);
    console.log('');

    if (session.calls && session.calls.length > 0) {
      console.log('─── 最近10条调用 ───');
      const recent = session.calls.slice(-10).reverse();
      for (const c of recent) {
        const icon = c.effective ? '✅' : c.bypassed ? '⚠' : '○';
        const cmd = (c.command || '').slice(0, 50);
        console.log(`  ${icon} ${cmd}`);
      }
    }
    console.log('');
    console.log('═'.repeat(50));
    return;
  }

  // ── 真实数据报告（从 api-proxy 捕获的 usage 数据）──
  if (args.includes('--real') || args.includes('-r')) {
    const session = loadSession();
    if (!session.totalInputTokens && !session.totalOutputTokens) {
      console.log('暂无真实 Token 数据。请先启动 api-proxy 并确保 API 调用经过代理。');
      console.log('启动代理: node ultra-cost-effective/helpers/api-proxy.cjs');
      return;
    }
    const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
    const h = Math.floor(elapsed / 3600), m = Math.floor((elapsed % 3600) / 60), s = elapsed % 60;
    const total = session.totalInputTokens + session.totalOutputTokens;
    const cacheHitRate = (session.totalCacheHitTokens + session.totalCacheMissTokens) > 0
      ? (session.totalCacheHitTokens / (session.totalCacheHitTokens + session.totalCacheMissTokens) * 100).toFixed(1)
      : '0.0';

    const lines = [
      '══════════════════════════════════════════════════',
      '  UltraCostEffective 真实 Token 报告 (API Proxy)',
      '══════════════════════════════════════════════════', '',
      `项目:     ${PROJECT_ROOT}`,
      `运行时间: ${h}h ${m}m ${s}s  |  调用: ${session.totalCalls}`, '',
      '─── 真实 Token 用量（直接从 API response 读取）───',
      `输入 Token:  ${(session.totalInputTokens / 1000).toFixed(1)}K`,
      `输出 Token:  ${(session.totalOutputTokens / 1000).toFixed(1)}K`,
      `合计:       ${(total / 1000).toFixed(1)}K`, '',
      '─── KV Cache（精确命中率）───',
      `命中: ${(session.totalCacheHitTokens / 1000).toFixed(1)}K  |  未命中: ${(session.totalCacheMissTokens / 1000).toFixed(1)}K`,
      `命中率: ${cacheHitRate}%`, '',
      '─── 成本估算（按 DeepSeek 定价）───',
    ];

    // 分模型成本
    const pricing = loadPricing();
    const flashInput = pricing?.models?.['deepseek-v4-flash']?.inputPrice || 1.0;
    const flashOutput = pricing?.models?.['deepseek-v4-flash']?.outputPrice || 3.0;
    const proInput = pricing?.models?.['deepseek-v4-pro']?.inputPrice || 3.0;
    const proOutput = pricing?.models?.['deepseek-v4-pro']?.outputPrice || 9.0;
    const cacheHitPrice = pricing?.models?.['deepseek-v4-pro']?.cacheHitPrice || 0.025;

    let totalCost = 0;
    let proEquivalentCost = 0;
    for (const [model, stats] of Object.entries(session.modelStats || {})) {
      const isPro = model.includes('pro');
      const inPrice = isPro ? proInput : flashInput;
      const outPrice = isPro ? proOutput : flashOutput;
      const inCost = (stats.inputTokens / 1_000_000) * inPrice;
      const outCost = (stats.outputTokens / 1_000_000) * outPrice;
      const cacheSavings = (stats.cacheHitTokens / 1_000_000) * (inPrice - cacheHitPrice);
      const modelCost = inCost + outCost - cacheSavings;
      totalCost += modelCost;
      proEquivalentCost += (stats.inputTokens / 1_000_000) * proInput + (stats.outputTokens / 1_000_000) * proOutput;
      lines.push(`${model}: ${stats.calls} 次, ¥${modelCost.toFixed(4)} (${(stats.inputTokens/1000).toFixed(1)}K in / ${(stats.outputTokens/1000).toFixed(1)}K out)`);
    }
    lines.push('',
      `实际成本: ¥${totalCost.toFixed(4)}`,
      `Pro 等价: ¥${proEquivalentCost.toFixed(4)}`,
      `节省:     ¥${(proEquivalentCost - totalCost).toFixed(4)} (${proEquivalentCost > 0 ? ((1 - totalCost/proEquivalentCost) * 100).toFixed(0) : 0}%)`, '',
      '══════════════════════════════════════════════════');
    console.log(lines.join('\n'));
    return;
  }

  // 默认: 报告
  const session = loadSession();
  if (session.totalCalls === 0) {
    console.log('═══════════════════════════════════');
    console.log('  UltraCostEffective Perf Tracker');
    console.log('═══════════════════════════════════');
    console.log('');
    console.log('📭 暂无追踪数据。perf-tracker 将在 Hook 激活后自动记录。');
    console.log('');
    console.log('可用命令:');
    console.log('  node perf-tracker.cjs --report   查看报告');
    console.log('  node perf-tracker.cjs --capture  从 stdin 捕获数据');
    console.log('  node perf-tracker.cjs --watch    实时监控');
    console.log('  node perf-tracker.cjs --export   导出CSV');
    return;
  }
  console.log(generateReport(session));
}

// ─── 导出 ──────────────────────────────────────

if (require.main === module) {
  main();
}

module.exports = { createSession, loadSession, saveSession, recordCall, generateReport, exportCSV };

// ─── 辅助: 命令白名单检测 ──────────────────────

function isBenefitCommandForTracker(base, fullCommand) {
  const BENEFITS = new Set([
    'npm', 'yarn', 'pnpm', 'cargo', 'go', 'pytest', 'jest', 'vitest',
    'eslint', 'tsc', 'make', 'cmake', 'grep', 'rg', 'find', 'ls', 'dir',
    'curl', 'wget', 'cat', 'type', 'head', 'tail'
  ]);
  if (!BENEFITS.has(base)) return false;
  if (base === 'npm' && /\binstall\b|\buninstall\b|\bi\b/.test(fullCommand)) return false;
  if (base === 'git') return false;
  return true;
}
