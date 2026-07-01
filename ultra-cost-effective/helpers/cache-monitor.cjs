#!/usr/bin/env node
/**
 * cache-monitor.cjs — KV Cache 命中率监控 (UltraCostEffective L2 · DeepSeek 专版)
 *
 * 从 API 响应中提取 KV Cache 命中信息，追踪命中率变化。
 * 专为 DeepSeek API 设计（分析其特有的 cache_hit_tokens 字段）。
 *
 * 用法:
 *   node cache-monitor.cjs --session    # 显示当前会话缓存统计
 *   node cache-monitor.cjs --watch      # 持续监控模式
 *   node cache-monitor.cjs --reset      # 重置统计
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const STATS_FILE = path.join(os.tmpdir(), 'ultra-cost-effective-cache-stats.json');

// ─── 统计结构 ──────────────────────────────────

function createStats() {
  return {
    sessionId: `uce_${Date.now().toString(36)}`,
    startTime: Date.now(),
    requests: 0,
    totalInputTokens: 0,
    cacheHitTokens: 0,
    cacheMissTokens: 0,
    l1PrefixHits: 0,
    l1PrefixMisses: 0,
    l2WarmupHits: 0,
    l2WarmupMisses: 0,
    estimatedSavings: 0,
    modelUsage: { pro: 0, flash: 0 }
  };
}

function loadStats() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      return JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
    }
  } catch {}
  return createStats();
}

function saveStats(stats) {
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
}

// ─── 从 API 响应提取缓存信息 ────────────────────

function parseCacheInfo(response) {
  // DeepSeek API 响应格式:
  // {
  //   "usage": {
  //     "prompt_tokens": 1000,
  //     "completion_tokens": 200,
  //     "total_tokens": 1200,
  //     "prompt_cache_hit_tokens": 400,     // DeepSeek 特有字段
  //     "prompt_cache_miss_tokens": 600
  //   }
  // }

  try {
    const data = typeof response === 'string' ? JSON.parse(response) : response;
    const usage = data.usage || data;

    return {
      promptTokens: usage.prompt_tokens || usage.input_tokens || 0,
      completionTokens: usage.completion_tokens || usage.output_tokens || 0,
      cacheHitTokens: usage.prompt_cache_hit_tokens || usage.cache_hit_tokens || 0,
      cacheMissTokens: usage.prompt_cache_miss_tokens || usage.cache_read_input_tokens ?
        (usage.cache_read_input_tokens || 0) - (usage.prompt_cache_hit_tokens || 0) : 0
    };
  } catch {
    return null;
  }
}

// ─── 记录请求 ──────────────────────────────────

function recordRequest(stats, model, cacheInfo) {
  stats.requests++;
  stats.totalInputTokens += cacheInfo.promptTokens;

  if (cacheInfo.cacheHitTokens > 0) {
    stats.cacheHitTokens += cacheInfo.cacheHitTokens;
    stats.l1PrefixHits++;
    // DeepSeek: 缓存命中部分 ¥0.025/M，未命中 ¥3.0/M
    const hitCost   = (cacheInfo.cacheHitTokens / 1_000_000) * 0.025;
    const missCost  = (cacheInfo.cacheMissTokens / 1_000_000) * 3.0;
    const fullCost  = (cacheInfo.promptTokens / 1_000_000) * 3.0;
    stats.estimatedSavings += (fullCost - hitCost - missCost);
  } else {
    stats.cacheMissTokens += cacheInfo.promptTokens;
    stats.l1PrefixMisses++;
  }

  if (model) {
    if (model.includes('pro')) stats.modelUsage.pro++;
    else if (model.includes('flash')) stats.modelUsage.flash++;
  }

  saveStats(stats);
  return stats;
}

// ─── 报告生成 ──────────────────────────────────

function generateReport(stats) {
  const elapsed = Math.floor((Date.now() - stats.startTime) / 1000);
  const hitRate = stats.l1PrefixHits + stats.l1PrefixMisses > 0
    ? (stats.l1PrefixHits / (stats.l1PrefixHits + stats.l1PrefixMisses) * 100).toFixed(1)
    : '0.0';

  const lines = [];
  lines.push('═'.repeat(50));
  lines.push('       UltraCostEffective KV Cache 监控报告');
  lines.push('═'.repeat(50));
  lines.push('');
  lines.push(`会话ID:    ${stats.sessionId}`);
  lines.push(`运行时间:  ${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m ${elapsed % 60}s`);
  lines.push(`请求总数:  ${stats.requests}`);
  lines.push(`输入Token: ${(stats.totalInputTokens / 1000).toFixed(1)}K`);
  lines.push('');
  lines.push('─── 缓存统计 ───');
  lines.push(`Cache Hit:  ${(stats.cacheHitTokens / 1000).toFixed(1)}K tokens`);
  lines.push(`Cache Miss: ${(stats.cacheMissTokens / 1000).toFixed(1)}K tokens`);
  lines.push(`命中率:     ${hitRate}% (L1 前缀命中)`);
  lines.push('');
  lines.push('─── 成本分析 (DeepSeek) ───');
  const fullCost = (stats.totalInputTokens / 1_000_000) * 3.0;
  lines.push(`无优化成本: ¥${fullCost.toFixed(4)}`);
  lines.push(`实际节省:   ¥${stats.estimatedSavings.toFixed(4)}`);
  lines.push(`节省比例:   ${fullCost > 0 ? (stats.estimatedSavings / fullCost * 100).toFixed(1) : 0}%`);
  lines.push('');
  lines.push('─── 模型使用 ───');
  lines.push(`Pro:   ${stats.modelUsage.pro} 次`);
  lines.push(`Flash: ${stats.modelUsage.flash} 次`);
  lines.push('');
  lines.push('═'.repeat(50));

  return lines.join('\n');
}

// ─── Watch 模式 ────────────────────────────────

function watchMode() {
  console.log('🔍 UltraCostEffective Cache Monitor — Watch 模式');
  console.log(`   监听文件: ${STATS_FILE}`);
  console.log('   Ctrl+C 退出\n');

  let lastSize = 0;
  try { lastSize = fs.statSync(STATS_FILE).size; } catch {}

  const interval = setInterval(() => {
    try {
      if (!fs.existsSync(STATS_FILE)) return;
      const currentSize = fs.statSync(STATS_FILE).size;
      if (currentSize !== lastSize) {
        lastSize = currentSize;
        const stats = loadStats();
        process.stdout.write('\x1b[2J\x1b[H'); // 清屏
        console.log(generateReport(stats));
      }
    } catch {}
  }, 2000);

  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\n监控已停止。');
    process.exit(0);
  });
}

// ─── 主函数 ────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--reset')) {
    saveStats(createStats());
    console.log('✅ 缓存统计数据已重置。');
    return;
  }

  if (args.includes('--watch') || args.includes('-w')) {
    watchMode();
    return;
  }

  // --session / 默认: 显示报告
  const stats = loadStats();

  if (stats.requests === 0) {
    console.log('═══════════════════════════════════');
    console.log('  UltraCostEffective KV Cache Monitor');
    console.log('═══════════════════════════════════');
    console.log('');
    console.log('📭 暂无缓存数据。');
    console.log('');
    console.log('可能原因:');
    console.log('  1. 尚未发起任何 API 调用');
    console.log('  2. perf-tracker 未运行');
    console.log('  3. 使用的不是 DeepSeek API');
    console.log('');
    console.log('API: 可通过 perf-tracker.cjs 自动记录');
    console.log('     或手动: node cache-monitor.cjs --record \'{"usage":{...}}\'');
    return;
  }

  console.log(generateReport(stats));
}

// ─── 导出 ──────────────────────────────────────

if (require.main === module) {
  main();
}

module.exports = { loadStats, saveStats, recordRequest, parseCacheInfo, generateReport, createStats };
