#!/usr/bin/env node
/**
 * tokenforge-hook.cjs — PreToolUse 自动管道注入钩子
 *
 * 在 Shell 命令执行前自动注入 tokenforge 压缩管道。
 * Claude Code PreToolUse Hook + Qoder Hook Adapter 双平台兼容。
 *
 * 基于 ccmvp/1234567KF 的 tokenforge-hook.cjs，增强：
 *  1. Qoder Hook 格式兼容
 *  2. 智能命令分类（test→output, json→json, grep→output, git→skip）
 *  3. Windows PowerShell 管道兼容
 *  4. 干运行模式（--ultra-cost-effective-dry-run）
 *  5. 环境变量控制（ULTRA_COST_EFFECTIVE_LEVEL, ULTRA_COST_EFFECTIVE_OFF）
 */

'use strict';

const path = require('path');

// ─── 配置 ──────────────────────────────────────

// 受益命令：这些命令的输出通常很大，压缩收益高
const BENEFIT_COMMANDS = {
  // 测试/构建 — output 压缩
  test:    { type: 'output', level: 'aggressive', desc: '测试输出' },
  npm:     { type: 'output', level: 'aggressive', desc: 'npm 输出', subMatch: /(test|run|build|ci|lint|audit)/ },
  yarn:    { type: 'output', level: 'aggressive', desc: 'yarn 输出', subMatch: /(test|build|lint)/ },
  pnpm:    { type: 'output', level: 'aggressive', desc: 'pnpm 输出', subMatch: /(test|build|lint)/ },
  cargo:   { type: 'output', level: 'aggressive', desc: 'Cargo 输出', subMatch: /(test|build|check|clippy)/ },
  go:      { type: 'output', level: 'aggressive', desc: 'Go 输出', subMatch: /(test|build|vet|lint)/ },
  pytest:  { type: 'output', level: 'aggressive', desc: 'pytest 输出' },
  jest:    { type: 'output', level: 'aggressive', desc: 'Jest 输出' },
  vitest:  { type: 'output', level: 'aggressive', desc: 'Vitest 输出' },
  eslint:  { type: 'output', level: 'medium',    desc: 'ESLint 输出' },
  tsc:     { type: 'output', level: 'medium',    desc: 'TypeScript 编译输出' },
  make:    { type: 'output', level: 'medium',    desc: 'Make 输出' },
  cmake:   { type: 'output', level: 'medium',    desc: 'CMake 输出' },

  // 搜索 — output 压缩
  grep:    { type: 'output', level: 'medium',    desc: 'grep 输出' },
  rg:      { type: 'output', level: 'medium',    desc: 'ripgrep 输出' },
  find:    { type: 'output', level: 'medium',    desc: 'find 输出' },
  ls:      { type: 'output', level: 'light',     desc: 'ls 输出' },
  dir:     { type: 'output', level: 'light',     desc: 'dir 输出' },

  // 数据查询 — json 压缩
  curl:    { type: 'auto',   level: 'medium',    desc: 'curl 输出', subMatch: /(-s|--silent|api|json)/ },
  wget:    { type: 'auto',   level: 'medium',    desc: 'wget 输出' },

  // 文件查看 — output 压缩
  cat:     { type: 'output', level: 'light',     desc: 'cat 输出' },
  type:    { type: 'output', level: 'light',     desc: 'type 输出' },
  head:    { type: 'output', level: 'light',     desc: 'head 输出' },
  tail:    { type: 'output', level: 'light',     desc: 'tail 输出' },
};

// 跳过命令：交互式或不应压缩的命令
const SKIP_COMMANDS = [
  'git',      // git 本身不跳过，但 push/commit 特定子命令跳过
  'ssh',      // 交互式
  'vim', 'vi', 'nano', 'emacs', 'code',  // 编辑器 — 交互式
  'npm install', 'npm i', 'npm uninstall', // 交互式安装
  'pip install', 'pip uninstall',         // 交互式安装
  'docker run -it', 'docker exec -it',     // 交互式容器
  'sudo',     // 可能需要密码
  'passwd',   // 密码修改
  'login',    // 登录
  'mysql', 'psql', 'sqlite3',             // 数据库CLI — 交互式
  'node',     // 可能启动REPL
  'python', 'python3',                    // 可能启动REPL
  'irb', 'iex',                           // REPL
];

const SKIP_GIT_SUB = ['push', 'commit', 'add -p', 'rebase -i', 'branch'];

// ─── 命令解析 ──────────────────────────────────

function parseCommand(command) {
  // 提取基础命令（去除路径、环境变量前缀等）
  let cmd = command.trim()
    .replace(/^\s*(sudo|env|[A-Z_]+=\S+\s*)*\s*/, '')  // 去除 sudo/env/环境变量
    .replace(/^(["'].*?["'])\s+/, '')                      // 去除引号包裹的路径前缀
    .replace(/^\.\//, '');                                  // 去除 ./

  // Windows 命令
  if (cmd.match(/^(dir|type|findstr|where|choco|winget)/i)) {
    return { base: cmd.split(/\s+/)[0].toLowerCase(), rest: cmd, platform: 'windows' };
  }

  const parts = cmd.split(/\s+/);
  const base = parts[0] ? parts[0].toLowerCase().replace(/^.*[\\/]/, '') : '';
  return { base, rest: cmd, parts };
}

// ─── 匹配检查 ──────────────────────────────────

function shouldSkip(command) {
  const { base, rest } = parseCommand(command);

  // git 子命令检查
  if (base === 'git') {
    for (const sub of SKIP_GIT_SUB) {
      if (rest.includes(sub)) return true;
    }
    return false; // git status/diff/log/blame 等不跳过
  }

  // 完全匹配跳过列表
  for (const skip of SKIP_COMMANDS) {
    if (skip.includes(' ')) {
      if (rest.toLowerCase().includes(skip)) return true;
    } else if (base === skip) {
      return true;
    }
  }

  return false;
}

function getCompressionConfig(command) {
  const { base, rest } = parseCommand(command);

  // 检查受益命令表
  const config = BENEFIT_COMMANDS[base];
  if (config) {
    // 子命令匹配（如 npm test 才触发，npm install 不触发）
    if (config.subMatch && !config.subMatch.test(rest)) return null;
    return { type: config.type, level: config.level, desc: config.desc };
  }

  return null;
}

// ─── 环境变量覆盖 ──────────────────────────────

function getEnvLevel() {
  return process.env.ULTRA_COST_EFFECTIVE_LEVEL || null;
}

function isUltraCostEffectiveOff() {
  return process.env.ULTRA_COST_EFFECTIVE_OFF === '1' || process.env.ULTRA_COST_EFFECTIVE_OFF === 'true';
}

// ─── 管道注入 ──────────────────────────────────

function injectTokenforge(command, config, platform = 'claude') {
  const { type, level } = config;
  const envLevel = getEnvLevel();
  const finalLevel = envLevel || level;

  // 检测是否有 --ultra-cost-effective-dry-run 标志
  const dryRun = command.includes('--ultra-cost-effective-dry-run');
  let cleanCommand = command.replace(/\s*--ultra-cost-effective-dry-run\b/g, '');

  // 检测是否已有 tokenforge 或 headroom 管道（UltraCostEffective 自己的注入）
  if (cleanCommand.includes('tokenforge.cjs') || cleanCommand.includes('tokenforge') ||
      cleanCommand.includes('headroom-adapter.cjs') || cleanCommand.includes('headroom')) {
    return null; // 已注入，跳过
  }

  // ── 跨技能冲突检测：是否有其他压缩工具 ──
  const thirdPartyCompressors = [
    { pattern: /claude-token-optim/i, name: 'claude-token-optimizer' },
    { pattern: /llmlingua/i,          name: 'LLMLingua' },
    { pattern: /compressor(?!.*.(cjs|js|py))/i, name: '第三方压缩器' },
    { pattern: /\|\s*python.*compress/i, name: 'Python压缩脚本' },
  ];
  for (const comp of thirdPartyCompressors) {
    if (comp.pattern.test(cleanCommand)) {
      if (process.env.ULTRA_COST_EFFECTIVE_DEBUG) {
        process.stderr.write(`[ultra-cost-effective] ⚠ 检测到第三方压缩器 "${comp.name}"，跳过 UltraCostEffective 注入避免双重压缩\n`);
      }
      try {
        const guard = require('./ultra-cost-effective-guard.cjs');
        guard.appendGuardEntry({
          phase: 'pre',
          command: cleanCommand.slice(0, 120),
          ultraCostEffectiveApplied: false,
          engine: 'skipped',
          shouldApply: true,
          warnings: [],
          conflicts: [comp.name],
          reason: `冲突: 第三方压缩器 "${comp.name}" 已存在`
        });
      } catch {}
      return null; // 有第三方压缩器，不重复注入
    }
  }

  // ── 压缩机选择器：AI 自动选 tokenforge vs headroom ──
  let useHeadroom = false;
  let sessionContext = null;
  try {
    const selector = require('./compressor-selector.cjs');
    const decision = selector.quickDecide(cleanCommand, '', { level: finalLevel });
    useHeadroom = decision.useHeadroom;
    sessionContext = decision.sessionMemory;
    if (useHeadroom && process.env.ULTRA_COST_EFFECTIVE_DEBUG) {
      process.stderr.write(`[ultra-cost-effective] compressor-selector → headroom: ${decision.reason}\n`);
      if (decision.sessionMemory) {
        process.stderr.write(`[ultra-cost-effective] session-memory: ${decision.sessionMemory.split('\n')[0]}\n`);
      }
    }
  } catch {
    // compressor-selector 不可用，保持 tokenforge
  }

  // 检测管道链末端
  const dryFlag = dryRun ? ' --dry-run' : '';

  // ── Headroom 路径（CCR 可逆压缩）──
  if (useHeadroom) {
    const hrPath = `node "${path.resolve(__dirname, 'headroom-adapter.cjs')}"`;
    const mode = type === 'code' ? 'code' : 'auto';
    const hrCommand = `${cleanCommand.trimEnd()} | ${hrPath} compress --pipe --${mode}`;
    // 同时输出一行提示到 stderr，便于调试
    if (process.env.ULTRA_COST_EFFECTIVE_DEBUG) {
      process.stderr.write(`[ultra-cost-effective] ${hrCommand}\n`);
    }
    return hrCommand;
  }

  // ── tokenforge 路径（快速管道）──
  const tfPath = `node "${path.resolve(__dirname, 'tokenforge.cjs')}"`;

  // PowerShell 兼容：使用分号而不是 &&
  const isPS = cleanCommand.includes('powershell') || cleanCommand.includes('pwsh') || process.env.SHELL?.includes('powershell');

  if (isPS) {
    return `${cleanCommand.trimEnd()} | ${tfPath} compress ${type} --level ${finalLevel} --store${dryFlag}`;
  }

  return `${cleanCommand.trimEnd()} | ${tfPath} compress ${type} --level ${finalLevel} --store${dryFlag}`;
}

// ─── Claude Code Hook 格式 ──────────────────────

function claudeHookFormat(input) {
  // Claude Code PreToolUse Hook 输入格式
  try {
    const data = typeof input === 'string' ? JSON.parse(input) : input;
    const command = data.command || data.tool_input?.command || '';

    if (!command || shouldSkip(command) || isUltraCostEffectiveOff()) {
      return JSON.stringify({ continue: true });
    }

    const config = getCompressionConfig(command);
    if (!config) {
      return JSON.stringify({ continue: true });
    }

    const newCommand = injectTokenforge(command, config, 'claude');
    if (!newCommand) {
      return JSON.stringify({ continue: true });
    }

    return JSON.stringify({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        permissionDecisionReason: `ultra-cost-effective: 自动注入 tokenforge ${config.type}/${config.level} 压缩`,
        updatedInput: {
          command: newCommand
        }
      }
    });
  } catch (e) {
    console.error(`[tokenforge-hook] Claude Hook 解析错误: ${e.message}`);
    return JSON.stringify({ continue: true });
  }
}

// ─── Qoder Hook 格式 ────────────────────────────

function qoderHookFormat(input) {
  // Qoder Hook 输入格式（与 Claude Code 不同，适配器处理差异）
  try {
    const data = typeof input === 'string' ? JSON.parse(input) : input;
    const command = data.command || data.input?.command || '';

    if (!command || shouldSkip(command) || isUltraCostEffectiveOff()) {
      return JSON.stringify({ action: 'continue' });
    }

    const config = getCompressionConfig(command);
    if (!config) {
      return JSON.stringify({ action: 'continue' });
    }

    const newCommand = injectTokenforge(command, config, 'qoder');
    if (!newCommand) {
      return JSON.stringify({ action: 'continue' });
    }

    return JSON.stringify({
      action: 'modify',
      modified_command: newCommand,
      reason: `ultra-cost-effective: tokenforge ${config.type}/${config.level}`
    });
  } catch (e) {
    console.error(`[tokenforge-hook] Qoder Hook 解析错误: ${e.message}`);
    return JSON.stringify({ action: 'continue' });
  }
}

// ─── 命令行独立测试 ────────────────────────────

function cliTest() {
  const testCases = [
    'npm test',
    'npm run build',
    'npm install express',
    'git push origin main',
    'git status',
    'cargo test --verbose',
    'grep -r "TODO" src/',
    'curl -s https://api.example.com/data',
    'ls -la',
    'vim file.txt',
  ];

  console.log('═══ tokenforge-hook 命令分类测试 ═══\n');
  for (const cmd of testCases) {
    const skip = shouldSkip(cmd);
    const config = getCompressionConfig(cmd);
    let status;
    if (skip) status = '⏭ 跳过';
    else if (config) status = `✓ 压缩 → ${config.type}/${config.level} (${config.desc})`;
    else status = '○ 不处理';
    console.log(`  ${status.padEnd(40)} | ${cmd}`);
  }

  // 管道注入示例
  console.log('\n═══ 管道注入示例 ═══\n');
  const exampleCmd = 'npm test -- --coverage';
  const config = getCompressionConfig(exampleCmd);
  if (config) {
    const injected = injectTokenforge(exampleCmd, config);
    console.log(`  原始: ${exampleCmd}`);
    console.log(`  注入: ${injected}`);
  }

  console.log('\n═══ 环境变量 ═══');
  console.log(`  ULTRA_COST_EFFECTIVE_LEVEL=${process.env.ULTRA_COST_EFFECTIVE_LEVEL || '(未设置, 默认medium)'}`);
  console.log(`  ULTRA_COST_EFFECTIVE_OFF=${process.env.ULTRA_COST_EFFECTIVE_OFF || '(未设置)'}`);
  console.log(`  ULTRA_COST_EFFECTIVE_PLATFORM=${process.env.ULTRA_COST_EFFECTIVE_PLATFORM || '(未设置, 自动检测)'}`);
}

// ─── 主函数 ────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--test') || args.includes('-t')) {
    cliTest();
    return;
  }

  // 读取 stdin（Hook 模式）
  const chunks = [];
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', chunk => chunks.push(chunk));
  process.stdin.on('end', () => {
    const input = chunks.join('').trim();
    if (!input) {
      // 无输入，可能是直接调用；执行测试模式
      cliTest();
      return;
    }

    // 自动检测平台
    const platform = process.env.ULTRA_COST_EFFECTIVE_PLATFORM || 'claude';
    let output;
    if (platform === 'qoder') {
      output = qoderHookFormat(input);
    } else {
      output = claudeHookFormat(input);
    }
    process.stdout.write(output);
  });
}

// ─── 导出 ──────────────────────────────────────

if (require.main === module) {
  main();
}

module.exports = {
  shouldSkip,
  getCompressionConfig,
  injectTokenforge,
  claudeHookFormat,
  qoderHookFormat,
  BENEFIT_COMMANDS,
  SKIP_COMMANDS,
  SKIP_GIT_SUB
};
