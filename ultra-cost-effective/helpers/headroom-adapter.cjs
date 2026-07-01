#!/usr/bin/env node
/**
 * headroom-adapter.cjs — Headroom CCR 可逆压缩适配器 (UltraCostEffective L6)
 *
 * 封装 headroom Python CLI，提供：
 *  1. compress: 调用 headroom compress，存储原文供检索
 *  2. retrieve: 按 ID 取回原文（CCR 可逆压缩协议）
 *  3. detect:  检测 headroom 是否可用
 *  4. 优雅降级: headroom 不可用时返回 tokenforge fallback hint
 *
 * 用法:
 *   node headroom-adapter.cjs compress <input>     # 压缩并存储
 *   node headroom-adapter.cjs retrieve <id>         # 取回原文
 *   node headroom-adapter.cjs detect                # 检测可用性
 */

'use strict';

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const STORE_DIR = path.join(os.tmpdir(), 'ultra-cost-effective-headroom-store');

// ─── 检测 Headroom 可用性 ─────────────────────

function detectHeadroom() {
  try {
    const result = spawnSync('headroom', ['--version'], {
      timeout: 5000,
      encoding: 'utf-8',
      shell: true
    });
    if (result.status === 0) {
      const version = (result.stdout || '').trim();
      return { available: true, version: version || 'unknown', error: null };
    }
    return { available: false, version: null, error: result.stderr || 'headroom returned non-zero' };
  } catch (e) {
    return { available: false, version: null, error: e.message };
  }
}

// ─── 存储管理 ─────────────────────────────────

function ensureStore() {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }
}

function generateId(content) {
  const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
  const ts = Date.now().toString(36);
  return `hr_${ts}_${hash}`;
}

function storeOriginal(id, content) {
  ensureStore();
  fs.writeFileSync(path.join(STORE_DIR, `${id}.orig`), content, 'utf-8');
}

function retrieveOriginal(id) {
  const file = path.join(STORE_DIR, `${id}.orig`);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf-8');
}

function cleanupOld(maxAge = 30 * 60 * 1000) {
  ensureStore();
  const now = Date.now();
  const files = fs.readdirSync(STORE_DIR);
  for (const file of files) {
    const filePath = path.join(STORE_DIR, file);
    try {
      if ((now - fs.statSync(filePath).mtimeMs) > maxAge) {
        fs.unlinkSync(filePath);
      }
    } catch {}
  }
}

// ─── 压缩 ─────────────────────────────────────

/**
 * 调用 Headroom 进行 CCR 压缩
 * @param {string} content - 原文
 * @param {object} opts
 * @param {string} opts.mode - 'code' | 'text' | 'auto'
 * @param {number} opts.budget - 压缩目标 token 数 (0=最大压缩)
 * @returns {{ compressed: string, originalId: string, stats: object }}
 */
function compress(content, opts = {}) {
  const detection = detectHeadroom();
  if (!detection.available) {
    return {
      compressed: content,
      originalId: null,
      method: 'headroom',
      error: `Headroom unavailable: ${detection.error}`,
      fallback: true,
      stats: { originalTokens: 0, compressedTokens: 0, ratio: 1 }
    };
  }

  const id = generateId(content);
  storeOriginal(id, content);

  const mode = opts.mode || 'auto';
  const budget = opts.budget || 0;

  try {
    const args = ['compress'];
    if (budget > 0) args.push('--budget', String(budget));
    if (mode !== 'auto') args.push('--mode', mode);

    const child = spawnSync('headroom', args, {
      input: content,
      encoding: 'utf-8',
      timeout: 15000,
      maxBuffer: 10 * 1024 * 1024,
      shell: true
    });

    if (child.status !== 0) {
      return {
        compressed: content,
        originalId: id,
        method: 'headroom',
        error: child.stderr || 'headroom compress failed',
        fallback: true,
        stats: estimateStats(content, content, 0)
      };
    }

    const compressed = (child.stdout || '').trim();

    // Headroom 输出可能包含统计信息在 stderr
    const statsRaw = child.stderr || '';
    const stats = parseHeadroomStats(statsRaw, content, compressed);

    return {
      compressed,
      originalId: id,
      method: 'headroom',
      error: null,
      fallback: false,
      stats,
      retrieveHint: `headroom_retrieve("${id}")`
    };
  } catch (e) {
    return {
      compressed: content,
      originalId: id,
      method: 'headroom',
      error: e.message,
      fallback: true,
      stats: estimateStats(content, content, 0)
    };
  }
}

// ─── 管道模式（stdin → headroom → stdout）────

function pipeCompress(opts = {}) {
  // 读取 stdin 全部内容（需要完整读取才能存原文）
  const stdin = fs.readFileSync(0, 'utf-8');

  // ── 存原文到磁盘 + 写会话记忆索引（无论 headroom 是否可用都存）──
  if (stdin.length > 200) {
    const id = generateId(stdin);
    storeOriginal(id, stdin);
    try {
      const sessionMemory = require('./session-memory.cjs');
      sessionMemory.record(id, 'headroom', {
        origSize: stdin.length,
        compSize: 0, // 压缩后才能知道
        type: opts.mode || 'auto'
      });
    } catch { /* session-memory 不可用时不阻塞 */ }
  }

  const detection = detectHeadroom();
  if (!detection.available) {
    // 无 Headroom，透传原文（原文已存，后续可检索）
    process.stdout.write(stdin);
    process.exit(0);
  }

  const mode = opts.mode || 'auto';
  const budget = opts.budget || 0;
  const args = ['compress'];
  if (budget > 0) args.push('--budget', String(budget));
  if (mode !== 'auto') args.push('--mode', mode);

  try {
    const result = spawnSync('headroom', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
      timeout: 30000,
      maxBuffer: 50 * 1024 * 1024,
      shell: true,
      input: stdin
    });
    process.stdout.write(result.stdout || '');
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status || 0);
  } catch (e) {
    process.stderr.write(`[headroom] error: ${e.message}\n`);
    process.exit(1);
  }
}

// ─── 解析 Headroom 输出统计 ───────────────────

function parseHeadroomStats(stderr, original, compressed) {
  // Headroom 通常在 stderr 输出统计信息，格式不定
  const stats = estimateStats(original, compressed, 0);
  const match = stderr.match(/(\d+\.?\d*)%/);
  if (match) {
    const pct = parseFloat(match[1]);
    stats.ratio = (100 - pct) / 100;
  }
  return stats;
}

function estimateStats(original, compressed, ratio) {
  return {
    originalChars: original.length,
    compressedChars: compressed.length,
    originalTokens: Math.round(original.length / 4),
    compressedTokens: Math.round(compressed.length / 4),
    ratio: ratio || (original.length > 0 ? 1 - compressed.length / original.length : 0)
  };
}

// ─── 批量清理 ─────────────────────────────────

function cleanup(daysOld = 1) {
  ensureStore();
  const now = Date.now();
  const maxAge = daysOld * 24 * 60 * 60 * 1000;
  let cleaned = 0;
  const files = fs.readdirSync(STORE_DIR);
  for (const file of files) {
    const filePath = path.join(STORE_DIR, file);
    try {
      if ((now - fs.statSync(filePath).mtimeMs) > maxAge) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    } catch {}
  }
  return cleaned;
}

// ─── 检索信息 ─────────────────────────────────

function getRetrieveInstructions(id) {
  return {
    id,
    available: retrieveOriginal(id) !== null,
    instruction: `调用 headroom_retrieve("${id}") 取回原文`,
    expiresAfter: '30 分钟'
  };
}

// ─── 主函数 ────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (cmd === 'detect') {
    const d = detectHeadroom();
    console.log(JSON.stringify(d, null, 2));
    process.exit(d.available ? 0 : 1);
  }

  if (cmd === 'retrieve') {
    const id = args[1];
    if (!id) {
      console.error('用法: headroom-adapter.cjs retrieve <id>');
      process.exit(1);
    }
    const content = retrieveOriginal(id);
    if (content) {
      process.stdout.write(content);
      process.exit(0);
    }
    console.error(`[headroom] 未找到原文: ${id}`);
    process.exit(1);
  }

  if (cmd === 'compress') {
    // stdin 管道模式
    if (process.stdin.isTTY === false || args.includes('--pipe')) {
      pipeCompress({ mode: args.includes('--code') ? 'code' : 'auto' });
      return;
    }
    // 命令行参数模式
    const content = args.slice(1).join(' ');
    const result = compress(content);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.fallback ? 1 : 0);
  }

  if (cmd === 'cleanup') {
    const days = parseInt(args[1]) || 1;
    const count = cleanup(days);
    console.log(`清理完成: ${count} 条过期记录`);
    return;
  }

  // 默认: 状态
  const d = detectHeadroom();
  console.log('═══════════════════════════════════');
  console.log('  UltraCostEffective Headroom Adapter');
  console.log('═══════════════════════════════════');
  console.log('');
  console.log(`  可用: ${d.available ? '✅ 是' : '❌ 否'}`);
  if (d.version) console.log(`  版本: ${d.version}`);
  if (d.error) console.log(`  错误: ${d.error}`);
  console.log(`  存储: ${STORE_DIR}`);
  console.log('');
  console.log('命令:');
  console.log('  compress <text>    压缩并存储原文');
  console.log('  retrieve <id>       取回原文');
  console.log('  detect             检测可用性');
  console.log('  cleanup [days]      清理过期记录');
}

// ─── 导出 ──────────────────────────────────────

if (require.main === module) {
  main();
}

module.exports = {
  detectHeadroom,
  compress,
  pipeCompress,
  retrieveOriginal,
  storeOriginal,
  cleanup,
  getRetrieveInstructions,
  estimateStats
};
