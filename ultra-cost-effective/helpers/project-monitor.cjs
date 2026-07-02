#!/usr/bin/env node
/**
 * project-monitor.cjs — UltraCostEffective 项目级全链路 Token 监控
 *
 * 监控维度：
 *   1. 会话级：主会话 LLM 调用 Token 统计
 *   2. A2A：Agent 工具调用次数 + Prompt 长度估算
 *   3. 子Agent穿透：扫描子 Agent JSONL 会话，汇总 Token 消耗
 *   4. 理论节约：按七层架构计算如果全开可节省多少
 *   5. 成本计算：基于 pricing.json 动态定价
 *
 * 用法:
 *   node project-monitor.cjs                        # 扫描并输出报告
 *   node project-monitor.cjs --hook                  # Qoder Hook 模式（stdin）
 *   node project-monitor.cjs --watch                 # 持续监视（30s 间隔）
 *   node project-monitor.cjs --report                # 仅输出报告
 *   node project-monitor.cjs --json                  # JSON 格式输出
 *   node project-monitor.cjs --reset                 # 重置统计
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── 配置 ──────────────────────────────────────

const PROJECT_ROOT = process.env.ULTRA_COST_EFFECTIVE_PROJECT_ROOT || resolveProjectRoot();
const TRACKER_FILE = path.join(PROJECT_ROOT, '.ultra-cost-effective-tracker.json');
const HOME = os.homedir();

// 上下文窗口（DeepSeek V4）
const CONTEXT_WINDOW = 131072;

// 七层理论节省率（保守估计）
const THEORETICAL_SAVINGS = {
  L1_tokenforge:    { rate: 0.60, desc: '输出压缩 (tokenforge)',       target: 'output' },
  L1_leanCtx:       { rate: 0.85, desc: '上下文复用 (lean-ctx)',        target: 'input'  },
  L2_kvCache:       { rate: 0.90, desc: 'KV Cache 共享前缀命中',        target: 'input'  },
  L3_warmup:        { rate: 0.30, desc: '长上下文预热降低重读',          target: 'input'  },
  L4_skillLoader:   { rate: 0.05, desc: '技能按需加载（存根替代全文）',  target: 'input'  },
  L5_stageSkip:     { rate: 0.15, desc: '阶段智能跳过',                  target: 'both'   },
  L6_a2aCompress:   { rate: 0.40, desc: 'A2A 通信压缩（会话记忆注入）',   target: 'input'  },
  L7_router:        { rate: 0.67, desc: '模型路由 Pro→Flash 降级',       target: 'cost'   },
};

// ─── 项目根定位 ────────────────────────────────

function resolveProjectRoot() {
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    dir = path.dirname(dir);
    if (fs.existsSync(path.join(dir, 'ultra-cost-effective'))) return dir;
  }
  return process.cwd();
}

// ─── IDE / 平台检测 ────────────────────────────

function detectPlatform() {
  if (process.env.ULTRA_COST_EFFECTIVE_PLATFORM === 'qoder') return 'qoder';
  if (process.env.QODER_SESSION_ID || process.env.QODER_WORKSPACE) return 'qoder';
  if (fs.existsSync(path.join(HOME, '.qoder', 'cache', 'projects'))) return 'qoder';
  if (fs.existsSync(path.join(HOME, '.claude', 'projects'))) return 'claude';
  return 'qoder'; // ★ 默认 Qoder
}

// ─── 会话定位（复用 token-watcher 逻辑）─────────

function findProjectSessions(platform) {
  if (platform === 'qoder') return findQoderSessions();
  return findClaudeSessions();
}

function findQoderSessions() {
  const projectsDir = path.join(HOME, '.qoder', 'cache', 'projects');
  if (!fs.existsSync(projectsDir)) return [];

  const projectName = path.basename(PROJECT_ROOT);
  const dirs = fs.readdirSync(projectsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith(projectName + '-'));

  const sessions = [];
  for (const dir of dirs) {
    const convDir = path.join(projectsDir, dir.name, 'conversation-history');
    if (!fs.existsSync(convDir)) continue;
    try {
      const sessionDirs = fs.readdirSync(convDir, { withFileTypes: true })
        .filter(d => d.isDirectory());
      for (const sd of sessionDirs) {
        const jsonl = path.join(convDir, sd.name, sd.name + '.jsonl');
        if (fs.existsSync(jsonl)) {
          sessions.push({
            path: jsonl,
            sessionId: sd.name,
            projectHash: dir.name,
            mtime: fs.statSync(jsonl).mtimeMs,
            platform: 'qoder',
            isMain: true,
          });
        }
      }
    } catch {}
  }
  return sessions.sort((a, b) => b.mtime - a.mtime);
}

function findClaudeSessions() {
  const projectsDir = path.join(HOME, '.claude', 'projects');
  if (!fs.existsSync(projectsDir)) return [];

  const projectName = path.basename(PROJECT_ROOT).toLowerCase();
  const dirs = fs.readdirSync(projectsDir, { withFileTypes: true })
    .filter(d => d.isDirectory());

  const sessions = [];
  for (const dir of dirs) {
    const lower = dir.name.toLowerCase();
    if (!lower.includes(projectName)) continue;
    try {
      const files = fs.readdirSync(path.join(projectsDir, dir.name))
        .filter(f => f.endsWith('.jsonl'));
      for (const f of files) {
        const fp = path.join(projectsDir, dir.name, f);
        sessions.push({
          path: fp, sessionId: f.replace('.jsonl', ''),
          projectHash: dir.name, mtime: fs.statSync(fp).mtimeMs,
          platform: 'claude', isMain: true,
        });
      }
    } catch {}
  }
  return sessions.sort((a, b) => b.mtime - a.mtime);
}

// ─── JSONL 解析 ────────────────────────────────

function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  const chineseChars = (text.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 1.8 + otherChars / 3.5);
}

function extractTextContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map(c => (typeof c === 'string' ? c : (c?.text || ''))).join('');
}

function parseQoderJsonl(filePath) {
  if (!fs.existsSync(filePath)) return { entries: [], totalInput: 0, totalOutput: 0, agentCalls: 0 };

  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());
  const entries = [];
  let totalInput = 0, totalOutput = 0, agentCalls = 0;

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (!entry.message?.content) continue;

      const text = extractTextContent(entry.message.content);
      if (!text.trim()) continue;

      const tokens = estimateTokens(text);

      if (entry.role === 'user') totalInput += tokens;
      else if (entry.role === 'assistant') totalOutput += tokens;

      // 检测 Agent 工具调用（assistant 消息中提到 subagent/Agent）
      if (entry.role === 'assistant') {
        if (text.includes('subagent_type') || text.includes('"Agent"') ||
            text.includes('Launch a new agent') || text.includes('启动一个新的代理')) {
          agentCalls++;
        }
      }

      entries.push({ role: entry.role, tokens, textLen: text.length });
    } catch {}
  }

  return { entries, totalInput, totalOutput, agentCalls };
}

function parseClaudeJsonl(filePath) {
  if (!fs.existsSync(filePath)) return { entries: [], totalInput: 0, totalOutput: 0, agentCalls: 0, cacheHit: 0, cacheMiss: 0 };

  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());
  const entries = [];
  let totalInput = 0, totalOutput = 0, agentCalls = 0, cacheHit = 0, cacheMiss = 0;

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (!entry.message?.usage) continue;

      const usage = entry.message.usage;
      totalInput += usage.input_tokens || 0;
      totalOutput += usage.output_tokens || 0;
      cacheHit += usage.cache_read_input_tokens || 0;
      cacheMiss += Math.max(0, (usage.input_tokens || 0) - (usage.cache_read_input_tokens || 0));

      // 检测 Agent 调用
      const content = extractTextContent(entry.message.content || '');
      if (content.includes('subagent_type') || content.includes('"Agent"')) agentCalls++;

      entries.push({
        role: entry.role || 'assistant',
        tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
        model: entry.message.model || 'unknown',
      });
    } catch {}
  }

  return { entries, totalInput, totalOutput, agentCalls, cacheHit, cacheMiss };
}

// ─── 子Agent会话扫描 ───────────────────────────

function findSubAgentSessions(platform, mainSessionId) {
  if (platform !== 'qoder') return [];

  const projectsDir = path.join(HOME, '.qoder', 'cache', 'projects');
  if (!fs.existsSync(projectsDir)) return [];

  const projectName = path.basename(PROJECT_ROOT);
  const dirs = fs.readdirSync(projectsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith(projectName + '-'));

  const subSessions = [];
  for (const dir of dirs) {
    const convDir = path.join(projectsDir, dir.name, 'conversation-history');
    if (!fs.existsSync(convDir)) continue;
    try {
      const sessionDirs = fs.readdirSync(convDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name !== mainSessionId);
      for (const sd of sessionDirs) {
        const jsonl = path.join(convDir, sd.name, sd.name + '.jsonl');
        if (fs.existsSync(jsonl)) {
          subSessions.push({ path: jsonl, sessionId: sd.name, mtime: fs.statSync(jsonl).mtimeMs });
        }
      }
    } catch {}
  }

  // 只取最近 2h 内的子会话（可能是子 Agent）
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  return subSessions.filter(s => s.mtime > cutoff);
}

// ─── Token 统计数据结构 ─────────────────────────

function createStats() {
  return {
    timestamp: Date.now(),
    projectRoot: PROJECT_ROOT,
    platform: detectPlatform(),
    // 主会话
    mainSession: { path: null, sessionId: null, totalInput: 0, totalOutput: 0, agentCalls: 0, totalCalls: 0 },
    // A2A
    a2a: { agentSpawns: 0, estimatedPromptTokens: 0, estimatedResponseTokens: 0 },
    // 子Agent穿透
    subAgents: { count: 0, sessions: [], totalInput: 0, totalOutput: 0 },
    // 理论节约
    theoreticalSavings: {},
    // 成本
    cost: { estimatedActualCNY: 0, theoreticalFullCNY: 0, savedCNY: 0 },
  };
}

// ─── 理论节约计算 ──────────────────────────────

function calculateTheoreticalSavings(stats) {
  const totalInput = stats.mainSession.totalInput + stats.subAgents.totalInput;
  const totalOutput = stats.mainSession.totalOutput + stats.subAgents.totalOutput;
  const total = totalInput + totalOutput;

  if (total === 0) return {};

  const savings = {};

  for (const [layer, config] of Object.entries(THEORETICAL_SAVINGS)) {
    let baseTokens = 0;
    if (config.target === 'input') baseTokens = totalInput;
    else if (config.target === 'output') baseTokens = totalOutput;
    else if (config.target === 'both') baseTokens = total;
    else if (config.target === 'cost') baseTokens = 0;

    if (baseTokens > 0) {
      savings[layer] = {
        desc: config.desc,
        savedTokens: Math.round(baseTokens * config.rate),
        rate: config.rate,
        target: config.target,
      };
    }
  }

  // L7 路由节省（成本层面）
  const proCost = (total / 1_000_000) * 3.0; // Pro 输入价
  const flashCost = (total / 1_000_000) * 1.0; // Flash 输入价
  savings.L7_router = {
    desc: THEORETICAL_SAVINGS.L7_router.desc,
    savedTokens: total, // 等价于全部用 Flash
    rate: THEORETICAL_SAVINGS.L7_router.rate,
    target: 'cost',
    costSavingCNY: Math.max(0, proCost - flashCost),
  };

  return savings;
}

// ─── 成本估算 ──────────────────────────────────

function loadPricing() {
  try {
    const pricingPath = path.join(__dirname, 'perf', 'pricing.json');
    if (fs.existsSync(pricingPath)) return JSON.parse(fs.readFileSync(pricingPath, 'utf-8'));
  } catch {}
  return null;
}

function estimateCost(stats) {
  const pricing = loadPricing();
  if (!pricing) return { estimatedActualCNY: 0, theoreticalFullCNY: 0, savedCNY: 0 };

  const totalInput = stats.mainSession.totalInput + stats.subAgents.totalInput;
  const totalOutput = stats.mainSession.totalOutput + stats.subAgents.totalOutput;

  // 默认 Flash 定价
  const flashInput = pricing.models?.['deepseek-v4-flash']?.inputPrice || 1.0;
  const flashOutput = pricing.models?.['deepseek-v4-flash']?.outputPrice || 5.0;
  const proInput = pricing.models?.['deepseek-v4-pro']?.inputPrice || 3.0;
  const proOutput = pricing.models?.['deepseek-v4-pro']?.outputPrice || 15.0;

  const actualInputCost = (totalInput / 1_000_000) * flashInput;
  const actualOutputCost = (totalOutput / 1_000_000) * flashOutput;
  const actualCost = actualInputCost + actualOutputCost;

  // 理论全价（全部 Pro，无任何优化）
  const fullInputCost = (totalInput / 1_000_000) * proInput;
  const fullOutputCost = (totalOutput / 1_000_000) * proOutput;
  const fullCost = fullInputCost + fullOutputCost;

  return {
    estimatedActualCNY: actualCost,
    theoreticalFullCNY: fullCost,
    savedCNY: fullCost - actualCost,
    savingPercent: fullCost > 0 ? ((fullCost - actualCost) / fullCost * 100).toFixed(1) : '0.0',
  };
}

// ─── 数据持久化 ────────────────────────────────

function loadTracker() {
  try {
    if (fs.existsSync(TRACKER_FILE)) return JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf-8'));
  } catch {}
  return null;
}

function saveTracker(stats) {
  // 合并历史数据
  let tracker = loadTracker() || { sessions: [], cumulative: createStats() };

  // 累积统计
  const cum = tracker.cumulative;
  cum.mainSession.totalInput += stats.mainSession.totalInput;
  cum.mainSession.totalOutput += stats.mainSession.totalOutput;
  cum.mainSession.agentCalls += stats.mainSession.agentCalls;
  cum.mainSession.totalCalls += stats.mainSession.totalCalls;
  cum.a2a.agentSpawns += stats.a2a.agentSpawns;
  cum.subAgents.count += stats.subAgents.count;
  cum.subAgents.totalInput += stats.subAgents.totalInput;
  cum.subAgents.totalOutput += stats.subAgents.totalOutput;
  cum.timestamp = Date.now();

  // 只保留最近 50 个会话快照
  tracker.sessions.push({
    sessionId: stats.mainSession.sessionId,
    timestamp: stats.timestamp,
    input: stats.mainSession.totalInput,
    output: stats.mainSession.totalOutput,
    agentCalls: stats.mainSession.agentCalls,
    subAgentTokens: stats.subAgents.totalInput + stats.subAgents.totalOutput,
  });
  if (tracker.sessions.length > 50) tracker.sessions.shift();

  fs.writeFileSync(TRACKER_FILE, JSON.stringify(tracker, null, 2));
  return tracker;
}

// ─── 报告生成 ──────────────────────────────────

function generateReport(stats, tracker) {
  const elapsed = tracker ? Math.floor((Date.now() - (tracker.sessions[0]?.timestamp || Date.now())) / 1000) : 0;
  const h = Math.floor(elapsed / 3600), m = Math.floor((elapsed % 3600) / 60);

  const main = stats.mainSession;
  const sub = stats.subAgents;
  const a2a = stats.a2a;
  const totalInput = main.totalInput + sub.totalInput;
  const totalOutput = main.totalOutput + sub.totalOutput;
  const total = totalInput + totalOutput;

  const cost = stats.cost;
  const savings = stats.theoreticalSavings;

  const lines = [
    '═══════════════════════════════════════════════════════',
    '     UltraCostEffective 项目级全链路 Token 报告',
    `     平台: ${stats.platform.toUpperCase()}  |  项目: ${path.basename(PROJECT_ROOT)}`,
    '═══════════════════════════════════════════════════════',
    '',
    '─── 主会话 ───',
    `  会话ID:     ${main.sessionId || 'N/A'}`,
    `  LLM 调用:   ${main.totalCalls} 次`,
    `  输入 Token: ${(main.totalInput / 1000).toFixed(1)}K`,
    `  输出 Token: ${(main.totalOutput / 1000).toFixed(1)}K`,
    `  合计:       ${((main.totalInput + main.totalOutput) / 1000).toFixed(1)}K`,
    '',
    '─── A2A 通信 ───',
    `  Agent 调用: ${a2a.agentSpawns} 次`,
    `  估算消耗:   ${((a2a.estimatedPromptTokens + a2a.estimatedResponseTokens) / 1000).toFixed(1)}K tokens`,
    '',
    '─── 子Agent穿透 ───',
    `  子会话数:   ${sub.count}`,
    `  子Agent输入: ${(sub.totalInput / 1000).toFixed(1)}K`,
    `  子Agent输出: ${(sub.totalOutput / 1000).toFixed(1)}K`,
    `  穿透合计:   ${((sub.totalInput + sub.totalOutput) / 1000).toFixed(1)}K`,
    '',
    '─── 汇总 ───',
    `  总会话Token: ${(total / 1000).toFixed(1)}K (主:${(main.totalInput + main.totalOutput) / 1000 > 0 ? ((main.totalInput + main.totalOutput) / total * 100).toFixed(0) : 0}% / 子:${(sub.totalInput + sub.totalOutput) / 1000 > 0 ? ((sub.totalInput + sub.totalOutput) / total * 100).toFixed(0) : 0}%)`,
    '',
    '─── 七层理论节约（若全开）───',
  ];

  for (const [layer, s] of Object.entries(savings)) {
    if (s.savedTokens > 0 || s.costSavingCNY > 0) {
      if (s.target === 'cost') {
        lines.push(`  ${layer}: ${s.desc} — 约 ¥${(s.costSavingCNY || 0).toFixed(3)}`);
      } else {
        lines.push(`  ${layer}: ${s.desc} — 约 ${(s.savedTokens / 1000).toFixed(1)}K tokens (${(s.rate * 100).toFixed(0)}%)`);
      }
    }
  }

  const totalTheoreticalSaved = Object.values(savings)
    .filter(s => s.target !== 'cost')
    .reduce((sum, s) => sum + (s.savedTokens || 0), 0);
  const totalCostSaved = Object.values(savings)
    .filter(s => s.target === 'cost')
    .reduce((sum, s) => sum + (s.costSavingCNY || 0), 0);

  lines.push('');
  lines.push(`  理论Token节省: ${(totalTheoreticalSaved / 1000).toFixed(1)}K (${total > 0 ? (totalTheoreticalSaved / total * 100).toFixed(0) : 0}%)`);
  lines.push(`  理论成本节省: ¥${totalCostSaved.toFixed(3)}`);

  lines.push('');
  lines.push('─── 成本估算 ───');
  lines.push(`  估算实际成本: ¥${cost.estimatedActualCNY.toFixed(4)} (Flash定价)`);
  lines.push(`  无优化全价:   ¥${cost.theoreticalFullCNY.toFixed(4)} (Pro定价)`);
  lines.push(`  当前节省:     ¥${cost.savedCNY.toFixed(4)} (${cost.savingPercent}%)`);

  if (tracker && tracker.sessions.length > 1) {
    lines.push('');
    lines.push('─── 历史会话 ───');
    const recent = tracker.sessions.slice(-5);
    for (const s of recent) {
      const totalT = s.input + s.output + (s.subAgentTokens || 0);
      lines.push(`  ${new Date(s.timestamp).toISOString().slice(0,19).replace('T',' ')} | ${(totalT/1000).toFixed(1)}K | ${s.agentCalls}A2A`);
    }
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════');
  return lines.join('\n');
}

// ─── Qoder Hook 处理 ────────────────────────────

function handleHook() {
  const chunks = [];
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', chunk => chunks.push(chunk));
  process.stdin.on('end', () => {
    const input = chunks.join('').trim();
    if (!input) { console.log(JSON.stringify({ continue: true })); return; }

    try {
      const data = JSON.parse(input);
      const transcriptPath = data.transcript_path;

      if (transcriptPath && fs.existsSync(transcriptPath)) {
        console.error(`[project-monitor] 检测到 transcript: ${transcriptPath}`);
        // 异步触发扫描，不阻塞 hook
        setImmediate(() => runScan(transcriptPath));
      }
    } catch {}
    console.log(JSON.stringify({ continue: true }));
  });
}

// ─── 主扫描逻辑 ────────────────────────────────

function runScan(specificSessionPath) {
  const platform = detectPlatform();

  let mainSession;
  if (specificSessionPath) {
    mainSession = {
      path: specificSessionPath,
      sessionId: path.basename(specificSessionPath, '.jsonl'),
      mtime: Date.now(),
      platform,
      isMain: true,
    };
  } else {
    const sessions = findProjectSessions(platform);
    mainSession = sessions[0]; // 最新会话
  }

  if (!mainSession || !mainSession.path) {
    console.error('[project-monitor] 未找到活跃会话');
    return null;
  }

  // 解析主会话
  const parse = platform === 'qoder' ? parseQoderJsonl : parseClaudeJsonl;
  const { entries, totalInput, totalOutput, agentCalls, cacheHit, cacheMiss } = parse(mainSession.path);

  const stats = createStats();
  stats.mainSession = {
    path: mainSession.path,
    sessionId: mainSession.sessionId,
    totalInput,
    totalOutput,
    agentCalls,
    totalCalls: entries.length,
  };

  // 检测 A2A 调用（通过检查 assistant 消息中的 Agent 工具调用）
  stats.a2a.agentSpawns = agentCalls;
  // A2A Prompt 估算：每次 Agent 调用约 2000 tokens 的系统提示 + 用户 Prompt
  stats.a2a.estimatedPromptTokens = agentCalls * 2000;
  stats.a2a.estimatedResponseTokens = agentCalls * 1500;

  // 扫描子Agent会话
  const subSessions = findSubAgentSessions(platform, mainSession.sessionId);
  stats.subAgents.count = subSessions.length;
  for (const ss of subSessions) {
    const sub = parse(ss.path);
    stats.subAgents.totalInput += sub.totalInput;
    stats.subAgents.totalOutput += sub.totalOutput;
    stats.subAgents.sessions.push({
      sessionId: ss.sessionId,
      input: sub.totalInput,
      output: sub.totalOutput,
    });
  }

  // 计算理论节约
  stats.theoreticalSavings = calculateTheoreticalSavings(stats);

  // 计算成本
  stats.cost = estimateCost(stats);

  // 持久化
  const tracker = saveTracker(stats);

  return { stats, tracker };
}

// ─── 模块导入模式（复用 token-watcher + perf-tracker） ───

function runExternalReport() {
  try {
    const watcherPath = path.join(__dirname, 'token-watcher.cjs');
    if (fs.existsSync(watcherPath)) {
      const { execSync } = require('child_process');
      execSync(`node "${watcherPath}"`, { stdio: 'inherit', timeout: 10000 });
    }
  } catch (e) {
    console.error('[project-monitor] token-watcher 调用失败:', e.message);
  }
}

// ─── 主函数 ────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  // Hook 模式
  if (args.includes('--hook')) {
    handleHook();
    return;
  }

  // 重置
  if (args.includes('--reset')) {
    try { fs.unlinkSync(TRACKER_FILE); console.log('✅ 追踪数据已重置'); }
    catch { console.log('ℹ 无追踪数据'); }
    return;
  }

  // 仅导出 token-watcher 报告
  if (args.includes('--legacy')) {
    runExternalReport();
    return;
  }

  // 执行扫描
  const result = runScan();

  if (!result) {
    console.log('未找到活跃会话。');
    if (args.includes('--json')) console.log(JSON.stringify({ error: 'no_session' }));
    process.exit(1);
  }

  const { stats, tracker } = result;

  // JSON 输出
  if (args.includes('--json')) {
    console.log(JSON.stringify({ stats, tracker: tracker?.sessions?.length || 0 }, null, 2));
    return;
  }

  // 报告输出
  console.log(generateReport(stats, tracker));

  // Watch 模式
  if (args.includes('--watch') || args.includes('-w')) {
    console.log('👁 持续监视中（每 30s）...\n');
    setInterval(() => {
      const r = runScan();
      if (r) {
        process.stdout.write('\x1b[2J\x1b[H');
        console.log(generateReport(r.stats, r.tracker));
      }
    }, 30000);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  runScan, generateReport, calculateTheoreticalSavings, estimateCost,
  findProjectSessions, findSubAgentSessions, detectPlatform, PROJECT_ROOT,
};
