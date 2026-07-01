#!/usr/bin/env node
/**
 * session-memory.cjs — 统一会话压缩记忆索引 (UltraCostEffective L6)
 *
 * 无论用 tokenforge 还是 headroom，每次管道压缩都记录到此索引。
 * 切换压缩机时，LLM 可追溯之前压缩过的内容。
 *
 * 存储结构（临时目录 ultra-cost-effective-session-memory.json）：
 * {
 *   sessionId: "sess_xxx",
 *   startTime: 1718000000000,
 *   records: [
 *     { id, compressor, ts, origSize, compSize, ratio, type, fileHint }
 *   ]
 * }
 *
 * 用法:
 *   node session-memory.cjs record <id> <compressor> <origSize> <compSize> <type>
 *   node session-memory.cjs summary                          # 人类可读摘要
 *   node session-memory.cjs get-retrieve-hint <id>           # 取回提示
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const MEMORY_FILE = path.join(os.tmpdir(), 'ultra-cost-effective-session-memory.json');
const MAX_RECORDS = 200;
const MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2小时 TTL

// ── 内部函数 ──────────────────────────────────

function loadSession() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      const raw = fs.readFileSync(MEMORY_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {}
  return null;
}

function saveSession(session) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(session, null, 2), 'utf-8');
}

function getOrCreateSession() {
  let session = loadSession();

  // 检查过期
  if (session && session.startTime && (Date.now() - session.startTime) > MAX_AGE_MS) {
    session = null;
  }

  if (!session) {
    session = {
      sessionId: 'sess_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex'),
      startTime: Date.now(),
      records: []
    };
    saveSession(session);
  }

  return session;
}

// ── 公开 API ──────────────────────────────────

/**
 * 记录一次压缩
 * @param {string} id - 原文存储ID（tf_xxx 或 hr_xxx）
 * @param {'tokenforge'|'headroom'} compressor
 * @param {object} meta
 * @param {number} meta.origSize
 * @param {number} meta.compSize
 * @param {string} meta.type - 'output'|'code'|'json'|'context'|'auto'
 * @param {string} [meta.command] - 触发命令（可选）
 */
function record(id, compressor, meta = {}) {
  const session = getOrCreateSession();

  session.records.push({
    id,
    compressor,
    ts: Date.now(),
    origSize: meta.origSize || 0,
    compSize: meta.compSize || 0,
    ratio: meta.origSize > 0 ? ((1 - meta.compSize / meta.origSize) * 100).toFixed(1) : '0',
    type: meta.type || 'auto',
    command: meta.command || ''
  });

  // 截断旧记录
  if (session.records.length > MAX_RECORDS) {
    session.records = session.records.slice(-MAX_RECORDS);
  }

  saveSession(session);
  return session.records.length;
}

/**
 * 获取当前会话摘要（供 LLM 上下文注入）
 * @returns {string} 紧凑的可读摘要
 */
function getSummary() {
  const session = getOrCreateSession();
  if (session.records.length === 0) return null;

  const tfCount = session.records.filter(r => r.compressor === 'tokenforge').length;
  const hrCount = session.records.filter(r => r.compressor === 'headroom').length;

  let summary = `[UltraCostEffective会话压缩索引: ${session.records.length}条记录`;

  // 分压缩机统计
  if (tfCount > 0) {
    const tfTotal = session.records
      .filter(r => r.compressor === 'tokenforge')
      .reduce((s, r) => s + r.origSize, 0);
    summary += `, tokenforge:${tfCount}条(${(tfTotal / 1024).toFixed(1)}KB原文)`;
  }
  if (hrCount > 0) {
    const hrTotal = session.records
      .filter(r => r.compressor === 'headroom')
      .reduce((s, r) => s + r.origSize, 0);
    summary += `, headroom:${hrCount}条(${(hrTotal / 1024).toFixed(1)}KB原文)`;
  }
  summary += ']';

  // 最近5条详情
  const recent = session.records.slice(-5).reverse();
  if (recent.length > 0) {
    summary += '\n最近压缩:';
    for (const r of recent) {
      const age = Math.floor((Date.now() - r.ts) / 1000);
      const ageStr = age < 60 ? `${age}s前` : `${Math.floor(age / 60)}min前`;
      summary += `\n  ${r.id.slice(0,14)} [${r.compressor}] ${r.type} ${(r.origSize/1024).toFixed(1)}→${(r.compSize/1024).toFixed(1)}KB (${r.ratio}%) ${ageStr}`;
    }
  }

  return summary;
}

/**
 * 获取可检索的所有 ID 列表
 */
function getRetrievable() {
  const session = getOrCreateSession();
  return session.records.map(r => ({
    id: r.id,
    compressor: r.compressor,
    ts: r.ts,
    type: r.type,
    origSize: r.origSize
  }));
}

/**
 * 获取特定 ID 的检索提示
 */
function getRetrieveHint(id) {
  const session = getOrCreateSession();
  const rec = session.records.find(r => r.id === id);
  if (!rec) return null;

  const adapterPath = path.join(__dirname, 'headroom-adapter.cjs');
  return {
    id,
    compressor: rec.compressor,
    available: true,
    retrieveCmd: `node "${adapterPath}" retrieve ${id}`,
    instruction: `调用 headroom_retrieve("${id}") 或执行上面的命令取回原文`,
    originalSize: rec.origSize,
    expiresAfter: '2小时'
  };
}

/**
 * 生成会话切换提示（热切换时注入到 LLM 上下文）
 */
function getSwitchContext() {
  const session = getOrCreateSession();
  if (session.records.length === 0) return null;

  const tfRecords = session.records.filter(r => r.compressor === 'tokenforge');
  const hrRecords = session.records.filter(r => r.compressor === 'headroom');
  const lastCompressor = session.records[session.records.length - 1]?.compressor;

  let ctx = '';

  // 如果之前用 tokenforge 压缩过，提示 LLM 可以取回原文
  if (tfRecords.length > 0 && lastCompressor !== 'tokenforge') {
    ctx += `\n[之前的 ${tfRecords.length} 条内容使用 tokenforge 有损压缩，如需完整原文可请求取回:`;
    for (const r of tfRecords.slice(-3)) {
      ctx += `\n  取回 ${r.id}: node "${path.join(__dirname, 'headroom-adapter.cjs')}" retrieve ${r.id}`;
    }
    ctx += ']';
  }

  return ctx || null;
}

/**
 * 生成上下文压缩提示 — 适合注入到系统 prompt
 * 返回极紧凑的一句话，告知 LLM 当前有哪些压缩内容可引用
 * @returns {string|null}
 */
function getContextCompressionHint() {
  const session = getOrCreateSession();
  if (session.records.length === 0) return null;

  const recent = session.records.slice(-6);
  const totalSaved = session.records.reduce((s, r) => s + (r.origSize - r.compSize), 0);

  let hint = `[UltraCostEffectiveMemory: ${session.records.length}条压缩记录, 共省${(totalSaved/1024).toFixed(1)}KB上下文. `;
  hint += `最近: `;
  hint += recent.map(r => `${r.id.slice(0,12)}(${(r.origSize/1024).toFixed(0)}→${(r.compSize/1024).toFixed(0)}K)`).join(', ');
  hint += '. 取回: retrieve <id>]';

  return hint;
}

/**
 * 生成 Agent Spawn 上下文摘要
 * 在 spawn agent 前传递，让子 agent 知道有哪些压缩内容可用
 * @returns {{ summary: string, recordCount: number, retrievableIds: string[] }|null}
 */
function getAgentSpawnContext() {
  const session = getOrCreateSession();
  if (session.records.length === 0) return null;

  const retrievableIds = session.records.slice(-20).map(r => r.id);

  const summary = getContextCompressionHint();

  return {
    summary: summary || `[UltraCostEffectiveMemory: ${session.records.length}条压缩记录]`,
    recordCount: session.records.length,
    retrievableIds
  };
}

/**
 * 重置当前会话
 */
function resetSession() {
  try { fs.unlinkSync(MEMORY_FILE); } catch {}
}

// ── 主函数 ────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (cmd === 'record') {
    // node session-memory.cjs record <id> <compressor> <origSize> <compSize> <type> [command]
    const id = args[1];
    const compressor = args[2];
    const origSize = parseInt(args[3]) || 0;
    const compSize = parseInt(args[4]) || 0;
    const type = args[5] || 'auto';
    const command = args.slice(6).join(' ') || '';
    if (!id || !compressor) {
      console.error('用法: session-memory.cjs record <id> <tokenforge|headroom> <origSize> <compSize> <type>');
      process.exit(1);
    }
    const idx = record(id, compressor, { origSize, compSize, type, command });
    console.log(`记录 #${idx}: ${id} [${compressor}]`);
    return;
  }

  if (cmd === 'summary') {
    const s = getSummary();
    if (s) {
      console.log(s);
    } else {
      console.log('[会话记忆为空]');
    }
    return;
  }

  if (cmd === 'get-retrieve-hint') {
    const id = args[1];
    if (!id) {
      console.error('用法: session-memory.cjs get-retrieve-hint <id>');
      process.exit(1);
    }
    const hint = getRetrieveHint(id);
    if (hint) {
      console.log(JSON.stringify(hint, null, 2));
    } else {
      console.log(`未找到记录: ${id}`);
      process.exit(1);
    }
    return;
  }

  if (cmd === 'switch-context') {
    const ctx = getSwitchContext();
    if (ctx) console.log(ctx);
    return;
  }

  if (cmd === 'reset') {
    resetSession();
    console.log('会话已重置');
    return;
  }

  if (cmd === 'list') {
    const recs = getRetrievable();
    console.log(JSON.stringify(recs, null, 2));
    return;
  }

  // 默认: 显示状态
  const session = getOrCreateSession();
  console.log('═══════════════════════════════════');
  console.log('  UltraCostEffective Session Memory');
  console.log('═══════════════════════════════════');
  console.log(`  Session: ${session.sessionId}`);
  console.log(`  记录数: ${session.records.length}`);
  console.log(`  TTL:     2小时`);
  console.log('');
  const s = getSummary();
  if (s) console.log(s);
}

if (require.main === module) {
  main();
}

module.exports = {
  record,
  getSummary,
  getRetrievable,
  getRetrieveHint,
  getSwitchContext,
  getContextCompressionHint,
  getAgentSpawnContext,
  resetSession,
  getOrCreateSession,
  MEMORY_FILE
};
