#!/usr/bin/env node
/**
 * token-watcher.cjs — 从 AI IDE 会话 JSONL 提取真实 Token 用量
 *
 * 支持 Qoder (.qoder/cache/projects/) 和 Claude Code (.claude/projects/)
 * 零侵入：不修改 BASE_URL，不拦截 API。
 * 直接读取 IDE 写入的会话 transcript 文件。
 *
 * 用法:
 *   node token-watcher.cjs                    # 扫描当前会话并输出报告
 *   node token-watcher.cjs --watch             # 持续监视（每 30s 扫描一次）
 *   node token-watcher.cjs --session <path>    # 指定 JSONL 文件路径
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── IDE 检测 ───────────────────────────────

function detectIDE() {
  const home = os.homedir();
  // Qoder 优先：如果在 Qoder 中运行，.qoder 目录必然存在
  if (fs.existsSync(path.join(home, '.qoder', 'cache', 'projects'))) return 'qoder';
  if (fs.existsSync(path.join(home, '.claude', 'projects'))) return 'claude';
  return null;
}

// ─── 项目根 + 会话定位 ───────────────────────

function resolveProjectRoot() {
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    dir = path.dirname(dir);
    if (fs.existsSync(path.join(dir, 'ultra-cost-effective'))) return dir;
  }
  return process.cwd();
}

function findActiveSession() {
  const home = os.homedir();
  const ide = detectIDE();

  if (ide === 'qoder') return findQoderSession(home);
  if (ide === 'claude') return findClaudeSession(home);
  return null;
}

function findQoderSession(home) {
  const projectsDir = path.join(home, '.qoder', 'cache', 'projects');
  if (!fs.existsSync(projectsDir)) return null;

  const projectName = path.basename(resolveProjectRoot());

  // 匹配项目目录: <projectName>-<hash>
  const dirs = fs.readdirSync(projectsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith(projectName + '-'));

  if (dirs.length === 0) {
    console.log(`⚠ 未找到当前项目 "${projectName}" 的会话目录`);
    return null;
  }

  // 遍历 conversation-history/<session>/<session>.jsonl
  let latest = null;
  let latestTime = 0;
  for (const dir of dirs) {
    const convDir = path.join(projectsDir, dir.name, 'conversation-history');
    if (!fs.existsSync(convDir)) continue;
    try {
      const sessions = fs.readdirSync(convDir, { withFileTypes: true })
        .filter(d => d.isDirectory());
      for (const session of sessions) {
        const jsonlFile = path.join(convDir, session.name, session.name + '.jsonl');
        if (!fs.existsSync(jsonlFile)) continue;
        const stat = fs.statSync(jsonlFile);
        if (stat.mtimeMs > latestTime) {
          latestTime = stat.mtimeMs;
          latest = jsonlFile;
        }
      }
    } catch {}
  }

  return latest;
}

function findClaudeSession(home) {
  const projectsDir = path.join(home, '.claude', 'projects');
  if (!fs.existsSync(projectsDir)) return null;

  const projectName = path.basename(resolveProjectRoot());

  const dirs = fs.readdirSync(projectsDir, { withFileTypes: true })
    .filter(d => d.isDirectory());

  // 按当前项目名过滤（Claude Code 路径编码如 C--Users-KF--all-in-mvp）
  const projLower = projectName.toLowerCase();
  const matching = dirs.filter(d => {
    const lower = d.name.toLowerCase();
    return lower.includes(projLower) || lower.endsWith('-' + projLower);
  });
  const searchDirs = matching.length > 0 ? matching : dirs;

  let latest = null;
  let latestTime = 0;
  for (const dir of searchDirs) {
    try {
      const dirPath = path.join(projectsDir, dir.name);
      const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.jsonl'));
      for (const f of files) {
        const fp = path.join(dirPath, f);
        const stat = fs.statSync(fp);
        if (stat.mtimeMs > latestTime) {
          latestTime = stat.mtimeMs;
          latest = fp;
        }
      }
    } catch {}
  }

  return latest;
}

// ─── 解析 JSONL ──────────────────────────────

/**
 * Qoder JSONL 不含 usage 字段，从消息内容估算 Token。
 * 混合中英文场景: ~2 chars/token（偏保守，实际 1.5-3.5）
 */
function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  // 中文字符约 1.5 chars/token，英文约 3.5 chars/token
  // 混合场景取 2.0 作为保守估计
  const chineseChars = (text.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length;
  const otherChars = text.length - chineseChars;
  // 中文: ~1.8 chars/token, 其他: ~3.5 chars/token
  return Math.ceil(chineseChars / 1.8 + otherChars / 3.5);
}

function extractQoderEntry(entry) {
  if (!entry.message?.content) return null;
  // 提取纯文本
  const textParts = [];
  const content = Array.isArray(entry.message.content)
    ? entry.message.content
    : [entry.message.content];
  for (const part of content) {
    if (typeof part === 'string') { textParts.push(part); }
    else if (part && part.text) { textParts.push(part.text); }
  }
  const text = textParts.join('');
  if (!text.trim()) return null;

  const tokens = estimateTokens(text);
  return {
    time: null,
    model: 'unknown',
    usage: {
      input_tokens: entry.role === 'user' ? tokens : 0,
      output_tokens: entry.role === 'assistant' ? tokens : 0,
    },
    estimated: true,
  };
}

function extractClaudeEntry(entry) {
  if (!entry.message?.usage) return null;
  return {
    time: entry.timestamp,
    model: entry.message.model || 'unknown',
    usage: entry.message.usage,
    estimated: false,
  };
}

function parseJsonl(filePath, lastPosition = 0, platform = 'claude') {
  if (!fs.existsSync(filePath)) return { entries: [], lastPos: 0, newEntries: 0 };

  const stat = fs.statSync(filePath);
  if (stat.size <= lastPosition) return { entries: [], lastPos: lastPosition, newEntries: 0 };

  // 只读新增部分
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(stat.size - lastPosition);
  fs.readSync(fd, buf, 0, buf.length, lastPosition);
  fs.closeSync(fd);

  const text = buf.toString('utf-8');
  const lines = text.split('\n').filter(l => l.trim());
  const entries = [];

  const extract = platform === 'qoder' ? extractQoderEntry : extractClaudeEntry;

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      const result = extract(entry);
      if (result) entries.push(result);
    } catch {}
  }

  return { entries, lastPos: stat.size, newEntries: entries.length };
}

// ─── 写入 tracker ─────────────────────────────

function writeTracker(entries) {
  const PROJECT_ROOT = resolveProjectRoot();
  const TRACKER_FILE = path.join(PROJECT_ROOT, '.ultra-cost-effective-tracker.json');

  let session;
  try {
    session = JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf-8'));
  } catch {
    session = {
      sessionId: 'watcher_' + Date.now().toString(36),
      projectRoot: PROJECT_ROOT,
      startTime: Date.now(),
      totalCalls: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheHitTokens: 0,
      totalCacheMissTokens: 0,
      estimatedCalls: 0,
      modelStats: {},
      calls: [],
    };
  }

  for (const entry of entries) {
    const u = entry.usage;
    const input = u.input_tokens || 0;
    const output = u.output_tokens || 0;
    const cacheHit = u.cache_read_input_tokens || 0;
    const cacheMiss = input - cacheHit;
    const model = entry.model || 'unknown';

    session.totalCalls++;
    session.totalInputTokens += input;
    session.totalOutputTokens += output;
    session.totalCacheHitTokens += cacheHit;
    session.totalCacheMissTokens += Math.max(0, cacheMiss);
    if (entry.estimated) session.estimatedCalls = (session.estimatedCalls || 0) + 1;

    if (!session.modelStats[model]) {
      session.modelStats[model] = { calls: 0, inputTokens: 0, outputTokens: 0, cacheHitTokens: 0 };
    }
    session.modelStats[model].calls++;
    session.modelStats[model].inputTokens += input;
    session.modelStats[model].outputTokens += output;
    session.modelStats[model].cacheHitTokens += cacheHit;

    session.calls.push({ time: entry.time, model, inputTokens: input, outputTokens: output, cacheHitTokens: cacheHit, estimated: entry.estimated || false });
    if (session.calls.length > 200) session.calls.shift();
  }

  fs.writeFileSync(TRACKER_FILE, JSON.stringify(session, null, 2));
  return session;
}

// ─── 报告 ─────────────────────────────────────

function printReport(session) {
  const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const total = session.totalInputTokens + session.totalOutputTokens;
  const hitRate = (session.totalCacheHitTokens + session.totalCacheMissTokens) > 0
    ? (session.totalCacheHitTokens / (session.totalCacheHitTokens + session.totalCacheMissTokens) * 100).toFixed(1)
    : '0.0';
  const isEstimated = session.estimatedCalls > 0;

  const title = isEstimated
    ? 'UltraCostEffective Token 报告 (JSONL Watcher) [估算]'
    : 'UltraCostEffective 真实 Token 报告 (JSONL Watcher)';

  const lines = [
    '',
    '══════════════════════════════════════════════════',
    `  ${title}`,
    '══════════════════════════════════════════════════', '',
    `运行时间: ${h}h ${m}m  |  LLM 调用: ${session.totalCalls}`, '',
    `输入 Token:   ${(session.totalInputTokens / 1000).toFixed(1)}K`,
    `输出 Token:   ${(session.totalOutputTokens / 1000).toFixed(1)}K`,
    `合计:         ${(total / 1000).toFixed(1)}K`, '',
  ];

  if (isEstimated) {
    lines.push(`⚠ 其中 ${session.estimatedCalls} 条记录为估算值（Qoder 不提供 usage 字段）`, '');
  } else {
    lines.push(`KV Cache 命中: ${(session.totalCacheHitTokens / 1000).toFixed(1)}K  (${hitRate}%)`,
               `KV Cache 未命中: ${(session.totalCacheMissTokens / 1000).toFixed(1)}K`, '');
  }

  lines.push('─── 模型 ───');

  for (const [model, stats] of Object.entries(session.modelStats)) {
    const si = stats.inputTokens || 0;
    const so = stats.outputTokens || 0;
    lines.push(`  ${model}: ${stats.calls} 次, ${(si/1000).toFixed(1)}K in, ${(so/1000).toFixed(1)}K out`);
  }

  lines.push('', '══════════════════════════════════════════════════');
  return lines.join('\n');
}

// ─── 主逻辑 ────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const platform = detectIDE() || 'claude';

  let jsonlPath = args.includes('--session') ? args[args.indexOf('--session') + 1] : null;
  if (!jsonlPath) jsonlPath = findActiveSession();

  if (!jsonlPath) {
    console.log('未找到活跃的 AI IDE 会话。请指定 --session <path>');
    process.exit(1);
  }

  console.log(`📂 监视 (${platform}): ${jsonlPath}`);

  const { entries, newEntries } = parseJsonl(jsonlPath, 0, platform);
  const estLabel = platform === 'qoder' ? '（估算）' : '';
  console.log(`📊 发现 ${entries.length} 条 LLM 调用记录${estLabel}`);

  if (entries.length > 0) {
    const session = writeTracker(entries);
    console.log(printReport(session));
  }

  if (args.includes('--watch') || args.includes('-w')) {
    let lastPos = fs.statSync(jsonlPath).size;
    console.log('👁 持续监视中（每 30s）...\n');
    setInterval(() => {
      const { entries: newOnes, lastPos: newPos } = parseJsonl(jsonlPath, lastPos, platform);
      if (newOnes.length > 0) {
        const session = writeTracker(newOnes);
        const last = newOnes[newOnes.length - 1];
        const input = last.usage.input_tokens || 0;
        const output = last.usage.output_tokens || 0;
        const cache = last.usage.cache_read_input_tokens || 0;
        const est = last.estimated ? ' [估]' : '';
        console.log(`  📊 +${newOnes.length} 调用${est} | ${input} in / ${output} out | cache: ${cache}`);
      }
      lastPos = newPos;
    }, 30000);
  }
}

main();
