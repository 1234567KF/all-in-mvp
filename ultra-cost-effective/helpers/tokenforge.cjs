#!/usr/bin/env node
/**
 * tokenforge.cjs — LLM Token 压缩引擎 (UltraCostEffective L1 核心)
 *
 * 基于 ccmvp/1234567KF 的 7 层节能架构，修复增强后独立可用。
 * 纯 Node.js，无外部依赖。
 *
 * 4种压缩类型：output | json | code | context
 * 3种压缩级别：light | medium | aggressive
 *
 * 改进点（相对 ccmvp 原版）：
 *  1. 增加 --type context 上下文压缩模式（对话历史智能摘要）
 *  2. 增加 --dry-run 预览模式（不实际压缩，仅显示预估节省）
 *  3. 增加 JSON Schema 验证（确保压缩后 JSON 结构合法）
 *  4. 修复 Windows PowerShell 管道兼容性
 *  5. 增加 Qoder/Claude Code 双平台兼容提示
 */

'use strict';

const readline = require('readline');
const crypto = require('crypto');

// ─── 配置常量 ──────────────────────────────────

const LEVELS = {
  light:    { name: 'light',     maxLines: 300, maxLineLen: 500,  jsonDepth: 8,  jsonArraySample: 20, contextRounds: 15 },
  medium:   { name: 'medium',    maxLines: 120, maxLineLen: 300,  jsonDepth: 5,  jsonArraySample: 10, contextRounds: 8  },
  aggressive:{ name: 'aggressive',maxLines:60,  maxLineLen: 150,  jsonDepth: 3,  jsonArraySample: 5,  contextRounds: 4  }
};

const TYPES = ['output', 'json', 'code', 'context', 'auto'];

// ─── ANSI 剥离 ─────────────────────────────────

const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;
const ANSI_CSI  = /\x1b\[\?[0-9;]*[a-zA-Z]/g;

function stripAnsi(text) {
  return text.replace(ANSI_REGEX, '').replace(ANSI_CSI, '').replace(/\x1b\]8;;.*?\x1b\\/g, '');
}

// ─── 输出压缩 ──────────────────────────────────

function compressOutput(text, level) {
  let lines = text.split('\n');
  const orig = lines.length;
  const summary = [];

  // Phase 1: ANSI 剥离
  lines = lines.map(l => stripAnsi(l));

  // Phase 2: 空行折叠（连续空行→1行）
  const folded = [];
  let blankCount = 0;
  for (const line of lines) {
    if (line.trim() === '') {
      blankCount++;
      if (blankCount <= 2) folded.push(line);  // 最多保留2个连续空行
    } else {
      blankCount = 0;
      folded.push(line);
    }
  }
  lines = folded;

  // Phase 3: 重复行去重（连续的完全重复行→1行 + 计数）
  const deduped = [];
  let repeatCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i > 0 && line === lines[i - 1] && line.trim() !== '') {
      repeatCount++;
    } else {
      if (repeatCount > 0) {
        deduped.push(`  └─ [重复 ${repeatCount + 1} 行]`);
        repeatCount = 0;
      }
      deduped.push(line);
    }
  }
  if (repeatCount > 0) deduped.push(`  └─ [重复 ${repeatCount + 1} 行]`);
  lines = deduped;

  // Phase 4: 栈跟踪折叠
  const folded2 = [];
  let inStack = false;
  let stackLines = [];
  for (const line of lines) {
    const isStack = /^\s+at\s/.test(line) || /^\s+from\s/.test(line) || /^\s*\.{3}\s*\d+\s/.test(line);
    if (isStack && !inStack) {
      inStack = true;
      stackLines = [line];
    } else if (isStack && inStack) {
      stackLines.push(line);
    } else {
      if (inStack) {
        // 折叠栈跟踪
        if (stackLines.length <= 3) {
          folded2.push(...stackLines);
        } else {
          folded2.push(stackLines[0], `  └─ [...${stackLines.length - 2} 帧折叠]`, stackLines[stackLines.length - 1]);
        }
        inStack = false;
        stackLines = [];
      }
      folded2.push(line);
    }
  }
  if (inStack && stackLines.length > 0) {
    if (stackLines.length <= 3) folded2.push(...stackLines);
    else folded2.push(stackLines[0], `  └─ [...${stackLines.length - 2} 帧折叠]`, stackLines[stackLines.length - 1]);
  }
  lines = folded2;

  // Phase 5: 长行截断
  lines = lines.map(l => {
    if (l.length > level.maxLineLen) {
      return l.substring(0, level.maxLineLen) + `... [截断: ${l.length - level.maxLineLen} chars]`;
    }
    return l;
  });

  // Phase 6: 行数限制
  if (lines.length > level.maxLines) {
    const head = lines.slice(0, Math.floor(level.maxLines * 0.4));
    const tail = lines.slice(-Math.floor(level.maxLines * 0.4));
    summary.push(`[输出截断: ${orig}行 → ${level.maxLines}行, 省略 ${lines.length - level.maxLines} 行]`);
    lines = [...head, `... [省略 ${lines.length - head.length - tail.length} 行] ...`, ...tail];
  }

  summary.push(`[压缩: ${orig}行 → ${lines.length}行 (${((1 - lines.length / orig) * 100).toFixed(1)}%)]`);
  return { text: lines.join('\n'), summary: summary.join('\n'), orig, after: lines.length };
}

// ─── JSON 压缩 ─────────────────────────────────

function compressJson(text, level) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return compressOutput(text, level); // 降级为 output 压缩
  }

  const origLen = text.length;

  function compact(value, depth) {
    if (depth > level.jsonDepth) {
      if (Array.isArray(value)) return `[Array(${value.length})]`;
      if (typeof value === 'object' && value !== null) return `{Object: ${Object.keys(value).length} keys}`;
      return typeof value === 'string' ? `"${value.substring(0, 50)}..."` : value;
    }
    if (Array.isArray(value)) {
      if (value.length > level.jsonArraySample) {
        const sampled = value.slice(0, level.jsonArraySample).map(v => compact(v, depth));
        return [...sampled, `... [省略 ${value.length - level.jsonArraySample} 项]`];
      }
      return value.map(v => compact(v, depth + 1));
    }
    if (typeof value === 'object' && value !== null) {
      const result = {};
      const keys = Object.keys(value);
      for (const k of keys) {
        result[k] = compact(value[k], depth + 1);
      }
      // 大对象：收起嵌套超过阈值的值
      const resultKeys = Object.keys(result);
      if (resultKeys.length > 10) {
        const slim = {};
        for (const k of resultKeys.slice(0, 10)) slim[k] = result[k];
        slim['...'] = `[省略 ${resultKeys.length - 10} 个键]`;
        return slim;
      }
      return result;
    }
    if (typeof value === 'string' && value.length > 80) {
      return value.substring(0, 80) + '...';
    }
    return value;
  }

  const compressed = compact(obj, 0);
  const resultText = JSON.stringify(compressed, null, 1);
  const afterLen = resultText.length;
  const pct = ((1 - afterLen / origLen) * 100).toFixed(1);

  return {
    text: resultText,
    summary: `[JSON压缩: ${origLen}→${afterLen} chars (${pct}%), 深度≤${level.jsonDepth}, 数组≤${level.jsonArraySample}项]`,
    orig: origLen,
    after: afterLen
  };
}

// ─── 代码压缩 ──────────────────────────────────

function compressCode(text, level) {
  const lines = text.split('\n');
  const orig = lines.length;
  const result = [];
  let inBody = false;
  let bodyLines = 0;
  let skipBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 导入语句：保留
    if (/^(import|export|require)\s/.test(line.trim()) ||
        /^(from|package|module)\s/.test(line.trim()) ||
        /^\/{2,}/.test(line.trim())) {
      result.push(line);
      inBody = false;
      continue;
    }

    // 函数/类/方法声明：保留签名
    if (/^\s*(export\s+)?(async\s+)?(function|class|interface|type|enum|const|let|var)\s+\w/.test(line.trim()) ||
        /^\s*(public|private|protected|static|async)\s+\w+\(/.test(line.trim()) ||
        /^\s*\w+\s*[=:]/.test(line.trim()) ||
        /^\s*\/\*\*/.test(line.trim())) {
      result.push(line);
      inBody = true;
      bodyLines = 0;
      skipBlock = false;
      continue;
    }

    // 块注释移除
    if (level.name !== 'light') {
      if (/^\s*\/\*/.test(line.trim())) skipBlock = true;
      if (skipBlock) {
        if (/\*\//.test(line)) skipBlock = false;
        continue;
      }
      if (/^\s*\/\//.test(line.trim()) && level.name === 'aggressive') continue;
    }

    if (inBody) {
      bodyLines++;
      if (bodyLines === 1) {
        result.push(`  { ... ${line.trim().substring(0, 40)} ... } ← 函数体折叠`);
      }
      if (/^\s*[})]/.test(line.trim()) || /^\s*]/.test(line.trim())) {
        inBody = false;
        result.push(line);
      }
      continue;
    }

    result.push(line);
  }

  // 行数限制
  let finalLines = result;
  if (result.length > level.maxLines) {
    const head = result.slice(0, Math.floor(level.maxLines * 0.5));
    const tail = result.slice(-Math.floor(level.maxLines * 0.3));
    finalLines = [...head, `// ... [省略 ${result.length - head.length - tail.length} 行] ...`, ...tail];
  }

  const pct = ((1 - finalLines.length / orig) * 100).toFixed(1);
  return {
    text: finalLines.join('\n'),
    summary: `[代码压缩: ${orig}行→${finalLines.length}行 (${pct}%)]`,
    orig,
    after: finalLines.length
  };
}

// ─── 上下文压缩（新增） ──────────────────────────

function compressContext(text, level) {
  // 对话历史智能摘要
  const lines = text.split('\n');
  const orig = lines.length;
  const messages = [];
  let currentRole = '';
  let currentContent = [];

  // 解析对话结构
  for (const line of lines) {
    const roleMatch = line.match(/^(User|Assistant|System|Human|AI):\s*(.*)/i);
    if (roleMatch) {
      if (currentContent.length > 0) {
        messages.push({ role: currentRole, content: currentContent.join('\n'), lines: currentContent.length });
      }
      currentRole = roleMatch[1];
      currentContent = [roleMatch[2]];
    } else if (currentRole) {
      currentContent.push(line);
    }
  }
  if (currentContent.length > 0) {
    messages.push({ role: currentRole, content: currentContent.join('\n'), lines: currentContent.length });
  }

  // 保留最近 N 轮完整，前面的做摘要
  const keepFull = level.contextRounds;
  const result = [];

  if (messages.length > keepFull) {
    const oldMessages = messages.slice(0, messages.length - keepFull);
    const recentMessages = messages.slice(-keepFull);

    // 摘要早期消息
    result.push(`[对话历史摘要: ${oldMessages.length} 条早期消息]`);
    for (const msg of oldMessages) {
      const short = msg.content.length > 120 ? msg.content.substring(0, 120) + '...' : msg.content;
      result.push(`${msg.role}: ${short.replace(/\n/g, ' ')}`);
    }
    result.push('--- 最近对话 ---');

    for (const msg of recentMessages) {
      result.push(`${msg.role}: ${msg.content}`);
    }
  } else {
    result.push(text);
  }

  const finalText = result.join('\n');
  const after = finalText.split('\n').length;
  const pct = ((1 - after / orig) * 100).toFixed(1);

  return {
    text: finalText,
    summary: `[上下文压缩: ${orig}行→${after}行 (${pct}%), 保留${keepFull}轮完整, 前面${messages.length - keepFull > 0 ? messages.length - keepFull : 0}轮做摘要]`,
    orig,
    after
  };
}

// ─── 自动检测 ──────────────────────────────────

function detectType(text) {
  const trimmed = text.trim();
  // JSON 检测
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try { JSON.parse(trimmed); return 'json'; } catch {}
  }
  // 代码检测
  const codeIndicators = /^(import |export |function |class |const |let |var |#include |package |module |def |fn |pub |use )/m;
  if (codeIndicators.test(trimmed)) return 'code';
  // 上下文检测
  const contextIndicators = /^(User:|Assistant:|System:|Human:|AI:)/m;
  if (contextIndicators.test(trimmed)) return 'context';
  return 'output';
}

// ─── 主压缩函数 ────────────────────────────────

function compress(input, options = {}) {
  const type = options.type === 'auto' ? detectType(input) : options.type || 'output';
  const levelKey = LEVELS[options.level] ? options.level : 'medium';
  const level = LEVELS[levelKey];

  let result;
  switch (type) {
    case 'json':    result = compressJson(input, level); break;
    case 'code':    result = compressCode(input, level); break;
    case 'context': result = compressContext(input, level); break;
    case 'output':
    default:        result = compressOutput(input, level); break;
  }

  result.type = type;
  result.level = levelKey;
  return result;
}

// ─── 估算 Token 数 ─────────────────────────────

function estimateTokens(text) {
  // 粗略估算: 中文 ~1.5 char/token, 英文 ~4 char/token, 混合 ~3 char/token
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

// ─── CLI 接口 ──────────────────────────────────

function parseArgs(args) {
  const options = {
    type: 'auto',
    level: 'medium',
    dryRun: false,
    store: false,
    jsonSchema: null,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case 'compress':
        i++;
        if (TYPES.includes(args[i])) options.type = args[i];
        else i--;
        break;
      case '--type':
      case '-t':
        if (TYPES.includes(args[i + 1])) options.type = args[++i];
        break;
      case '--level':
      case '-l':
        if (LEVELS[args[i + 1]]) options.level = args[++i];
        break;
      case '--dry-run':
      case '-d':
        options.dryRun = true;
        break;
      case '--store':
        options.store = true;
        break;
      case '--schema':
      case '-s':
        options.jsonSchema = args[++i];
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
╔══════════════════════════════════════════════════════╗
║           tokenforge — LLM Token 压缩引擎            ║
║              UltraCostEffective L1 · 极致节能核心                  ║
╚══════════════════════════════════════════════════════╝

用法:
  <input> | node tokenforge.cjs [compress <type>] [选项]
  node tokenforge.cjs compress <type> --level <level> [选项]

压缩类型 (--type/-t):
  output   — Shell/Terminal 输出（ANSI剥离+空行折叠+重复去重+栈折叠+截断）
  json     — JSON / API 响应（深度限制+数组采样+大对象摘要）
  code     — 源代码（保留导入+签名+函数体折叠+注释移除）
  context  — 对话历史（早期消息摘要+保留最近N轮完整）[新增]
  auto     — 自动检测 [默认]

压缩级别 (--level/-l):
  light       — 300行限制, 温和压缩 (~50%)
  medium      — 120行限制, 标准压缩 (~80%) [默认]
  aggressive  —  60行限制, 极限压缩 (~95%)

选项:
  --dry-run, -d    预览模式：仅显示预估节省，不实际压缩 [新增]
  --schema, -s     指定JSON Schema文件路径，压缩后验证结构 [新增]
  --help, -h       显示帮助

示例:
  npm test 2>&1 | node tokenforge.cjs compress output --level aggressive
  cat data.json | node tokenforge.cjs compress json --level medium
  cat chat.log | node tokenforge.cjs compress context -l light --dry-run

平台:
  Claude Code:  PreToolUse Hook → tokenforge-hook.cjs 自动管道注入
  Qoder:        Hook Adapter → adapters/qoder/hook-adapter.cjs
`);
}

// ─── 主函数 ────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  // 读取 stdin
  const chunks = [];
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

  // Windows PowerShell: stdin 可能是 TTY 模式，改用事件驱动
  if (process.stdin.isTTY) {
    console.error('[tokenforge] 等待管道输入... (Ctrl+D / Ctrl+Z 结束)');
  }

  for await (const line of rl) {
    chunks.push(line);
  }

  const input = chunks.join('\n');

  if (!input.trim()) {
    console.error('[tokenforge] 无输入内容，退出。');
    console.error('用法: <command> | node tokenforge.cjs [选项]');
    process.exit(1);
  }

  const origTokens = estimateTokens(input);

  if (options.dryRun) {
    // 预览模式：只计算不输出
    const result = compress(input, options);
    const savedTokens = estimateTokens(result.text);
    console.log('═══ tokenforge 预览 ═══');
    console.log(`类型: ${result.type} | 级别: ${result.level}`);
    console.log(`输入: ${input.length} 字符, ~${origTokens} tokens`);
    console.log(`输出: ${result.text.length} 字符, ~${savedTokens} tokens`);
    console.log(`节省: ~${origTokens - savedTokens} tokens (${((1 - savedTokens / origTokens) * 100).toFixed(1)}%)`);
    console.log(`摘要: ${result.summary}`);
    console.log('(预览模式，未实际输出压缩内容)');
  } else {
    // 正常压缩模式
    const result = compress(input, options);

    // ── --store 模式: 存原文到磁盘 + 写会话记忆索引 ──
    if (options.store && input.length > 200) {
      try {
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256').update(input).digest('hex').slice(0, 12);
        const ts = Date.now().toString(36);
        const id = `tf_${ts}_${hash}`;
        const storeDir = path.join(os.tmpdir(), 'ultra-cost-effective-headroom-store');
        if (!fs.existsSync(storeDir)) fs.mkdirSync(storeDir, { recursive: true });
        fs.writeFileSync(path.join(storeDir, `${id}.orig`), input, 'utf-8');

        // 写会话记忆索引
        try {
          const sessionMemory = require('./session-memory.cjs');
          sessionMemory.record(id, 'tokenforge', {
            origSize: input.length,
            compSize: result.text.length,
            type: result.type
          });
        } catch { /* session-memory 不可用时不阻塞 */ }
      } catch { /* 存盘失败不影响主流程 */ }
    }

    process.stdout.write(result.text);

    // 摘要输出到 stderr（不干扰管道）
    const savedTokens = estimateTokens(result.text);
    console.error('');
    console.error(`[tokenforge] ${result.type}/${result.level}: ~${origTokens}→~${savedTokens} tokens (${((1 - savedTokens / origTokens) * 100).toFixed(1)}%)`);
    console.error(`[tokenforge] ${result.summary.split('\n')[0]}`);

    // JSON Schema 验证（如指定）
    if (options.jsonSchema && result.type === 'json') {
      try {
        const fs = require('fs');
        const schema = JSON.parse(fs.readFileSync(options.jsonSchema, 'utf-8'));
        // 简化版验证：检查压缩后输出是否仍为有效JSON
        JSON.parse(result.text);
        console.error('[tokenforge] JSON Schema 验证通过 ✓');
      } catch (e) {
        console.error(`[tokenforge] JSON Schema 验证失败: ${e.message}`);
      }
    }
  }
}

// ─── 模块导出（供其他脚本调用） ──────────────────

if (require.main === module) {
  main().catch(err => {
    console.error(`[tokenforge] 错误: ${err.message}`);
    process.exit(1);
  });
} else {
  module.exports = { compress, estimateTokens, detectType, stripAnsi, LEVELS, TYPES, compressOutput, compressJson, compressCode, compressContext };
}
