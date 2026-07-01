#!/usr/bin/env node
/**
 * model-router.cjs — DeepSeek 双模型智能路由 (UltraCostEffective L7)
 *
 * 分析用户提示，推荐 deepseek-v4-pro 或 deepseek-v4-flash。
 * 提供成本预估、任务分类、预算追踪。
 *
 * Claude Code 集成:
 *   UserPromptSubmit Hook → 分析提示并注入路由建议到 additionalContext
 *
 * 用法:
 *   node model-router.cjs analyze "<prompt>"              # 分析并推荐
 *   node model-router.cjs hook                            # Hook 模式 (stdin)
 *   node model-router.cjs status                          # 查看当前会话路由统计
 *   node model-router.cjs --test                          # 测试路由矩阵
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const TRACKER_FILE = path.join(os.tmpdir(), 'ultra-cost-effective-perf-tracker.json');

// ─── 模型定价 ──────────────────────────────────

const PRICING = {
  'deepseek-v4-pro':   { input: 3.0, output: 15.0, cacheHit: 0.025, label: 'Pro' },
  'deepseek-v4-flash': { input: 1.0, output: 5.0,  cacheHit: 0.02,  label: 'Flash' }
};

// ─── 任务分类规则 ──────────────────────────────

const PRO_INDICATORS = [
  // 高复杂度 — 需要深度推理
  { pattern: /架构|architecture/i, weight: 0.9, label: '架构设计' },
  { pattern: /(设计|design)\s*(方案|系统|模式|原则|规范)/i, weight: 0.9, label: '设计' },
  { pattern: /方案|技术选型|技术方案/i, weight: 0.9, label: '技术方案' },
  { pattern: /系统设计|system\s*design/i, weight: 0.9, label: '系统设计' },
  { pattern: /规划|plan|roadmap|路线图|迭代规划/i, weight: 0.8, label: '规划' },
  { pattern: /(分析|安全)\s*(报告|审计|漏洞|威胁|风险|源码|深度)/i, weight: 0.8, label: '深度分析' },
  { pattern: /\b(audit|安全审计|渗透测试|威胁建模)\b/i, weight: 0.8, label: '安全审计' },
  { pattern: /重构方案|迁移方案|升级方案/i, weight: 0.8, label: '重构方案' },
  { pattern: /性能优化|performance\s*(optimiz|tun|profil)/i, weight: 0.7, label: '性能优化' },
  { pattern: /评审|review\s*(architecture|design|方案)/i, weight: 0.7, label: '架构评审' },
  { pattern: /(调研|研究报告|技术调研|可行性)/i, weight: 0.7, label: '调研分析' },
];

const FLASH_INDICATORS = [
  // 中低复杂度 — 代码生成、测试、文档
  { pattern: /写代码|编写|实现|implement|coding/i, weight: 0.8, label: '编码实现' },
  { pattern: /修复|fix|bug|debug|调试|hotfix|solve/i, weight: 0.9, label: 'Bug修复' },
  { pattern: /(测试|test|unittest|e2e|集成测试|单元测试|pytest|jest|vitest)/i, weight: 0.9, label: '测试' },
  { pattern: /构建|build|compile|编译|打包/i, weight: 0.9, label: '构建' },
  { pattern: /\b(lint|format|格式化|eslint|prettier|代码风格)\b/i, weight: 0.9, label: '代码检查' },
  { pattern: /文档|document|注释|comment|readme|写.*文档/i, weight: 0.9, label: '文档' },
  { pattern: /解释|explain|什么是|怎么用|什么意思|how\s+(to|does|do|is)/i, weight: 0.8, label: '问答' },
  { pattern: /(cr|code\s*review|代码审查|review.*(pr|代码|code|这个))/i, weight: 0.7, label: 'Code Review' },
  { pattern: /(重构|refactor)(?!.*(方案|plan|proposal))/i, weight: 0.7, label: '小重构' },
  { pattern: /commit|提交|git\s*(add|status|diff|log|commit|push)/i, weight: 0.9, label: 'Git操作' },
];

// 上下文相关降级规则
const CONTEXT_DOWNGRADE_THRESHOLD = 0.5;  // 上下文 >50% 开始降级倾向
const CONTEXT_FORCE_FLASH = 0.8;          // 上下文 >80% 强制 Flash

// ─── 分析引擎 ──────────────────────────────────

function analyzePrompt(prompt, contextTokens = 0) {
  if (!prompt) return { model: 'deepseek-v4-flash', reason: '空输入', confidence: 1.0, scores: { pro: 0, flash: 1 } };

  let proScore = 0;
  let flashScore = 0;
  const matchedPro = [];
  const matchedFlash = [];

  // 任务类型匹配
  for (const rule of PRO_INDICATORS) {
    if (rule.pattern.test(prompt)) {
      proScore = Math.max(proScore, rule.weight);
      matchedPro.push(rule.label);
    }
  }

  for (const rule of FLASH_INDICATORS) {
    if (rule.pattern.test(prompt)) {
      flashScore = Math.max(flashScore, rule.weight);
      matchedFlash.push(rule.label);
    }
  }

  // 无匹配 → 默认 Flash（安全保守）
  if (matchedPro.length === 0 && matchedFlash.length === 0) {
    return {
      model: 'deepseek-v4-flash',
      reason: '未匹配特定任务类型，默认 Flash',
      confidence: 0.6,
      scores: { pro: 0.3, flash: 0.7 },
      matched: []
    };
  }

  // 上下文降级
  const contextWindow = 128000;
  const contextRatio = contextTokens / contextWindow;

  if (contextRatio > CONTEXT_FORCE_FLASH) {
    return {
      model: 'deepseek-v4-flash',
      reason: `上下文 ${(contextRatio*100).toFixed(0)}% > 80%，强制 Flash`,
      confidence: 0.95,
      scores: { pro: proScore, flash: 1.0 },
      matched: [...matchedPro, ...matchedFlash],
      contextDowngrade: true
    };
  }

  if (contextRatio > CONTEXT_DOWNGRADE_THRESHOLD && proScore > flashScore) {
    const adjustedPro = proScore * (1 - contextRatio);
    if (adjustedPro <= flashScore) {
      return {
        model: 'deepseek-v4-flash',
        reason: `上下文 ${(contextRatio*100).toFixed(0)}% → Pro倾向降级为Flash`,
        confidence: 0.7,
        scores: { pro: adjustedPro, flash: flashScore },
        matched: [...matchedPro, ...matchedFlash],
        contextDowngrade: true
      };
    }
  }

  // 决策
  if (proScore > flashScore) {
    return {
      model: 'deepseek-v4-pro',
      reason: `匹配到Pro任务: ${matchedPro.join(', ')}`,
      confidence: proScore,
      scores: { pro: proScore, flash: flashScore },
      matched: matchedPro
    };
  }

  return {
    model: 'deepseek-v4-flash',
    reason: `匹配到Flash任务: ${matchedFlash.join(', ')}`,
    confidence: flashScore,
    scores: { pro: proScore, flash: flashScore },
    matched: matchedFlash
  };
}

// ─── 成本预估 ──────────────────────────────────

function estimateCost(promptTokens, model, estimatedOutputTokens = 0) {
  const pricing = PRICING[model];
  if (!pricing) return { inputCost: 0, outputCost: 0, totalCost: 0 };

  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (estimatedOutputTokens / 1_000_000) * pricing.output;

  return {
    inputCost,
    outputCost: outputCost || inputCost * 0.5, // 估算输出 ~50% 输入
    totalCost: inputCost + (outputCost || inputCost * 0.5),
    model: pricing.label
  };
}

function compareCost(promptTokens, estimatedOutput) {
  const proCost = estimateCost(promptTokens, 'deepseek-v4-pro', estimatedOutput);
  const flashCost = estimateCost(promptTokens, 'deepseek-v4-flash', estimatedOutput);

  return {
    pro: proCost,
    flash: flashCost,
    savings: proCost.totalCost - flashCost.totalCost,
    savingsPercent: proCost.totalCost > 0 ? ((1 - flashCost.totalCost / proCost.totalCost) * 100).toFixed(1) : 0
  };
}

// ─── 估算输入 token 数 ─────────────────────────

function estimatePromptTokens(text) {
  // 中文 ~1.5 char/token, 英文 ~4 char/token, 保守用 3
  return Math.ceil(text.length / 3);
}

// ─── Claude Code UserPromptSubmit Hook ──────────

function handleUserPromptSubmit(input) {
  try {
    const data = typeof input === 'string' ? JSON.parse(input) : input;
    const prompt = data.prompt || data.user_prompt || '';

    if (!prompt || prompt.length < 10) {
      return JSON.stringify({});
    }

    // 估算当前上下文
    let contextTokens = 0;
    try {
      const tracker = JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf-8'));
      const calls = tracker.totalCalls || 0;
      contextTokens = 4000 + calls * 2000; // 粗略估算
    } catch {}

    const analysis = analyzePrompt(prompt, contextTokens);
    const promptTokens = estimatePromptTokens(prompt);
    const costCompare = compareCost(promptTokens, Math.round(promptTokens * 0.5));

    let additionalContext = '';

    // 模型建议
    const modelLabel = analysis.model.includes('pro') ? 'DeepSeek Pro' : 'DeepSeek Flash';
    additionalContext += `[UltraCostEffective Router] 推荐: ${modelLabel} (置信度: ${(analysis.confidence*100).toFixed(0)}%)`;
    additionalContext += ` — ${analysis.reason}`;
    if (analysis.contextDowngrade) {
      additionalContext += ` [上下文降级]`;
    }
    additionalContext += '\n';

    // 成本预估
    additionalContext += `[成本预估] Pro: ¥${costCompare.pro.totalCost.toFixed(4)} | Flash: ¥${costCompare.flash.totalCost.toFixed(4)}`;
    additionalContext += ` | 用Flash省: ¥${costCompare.savings.toFixed(4)} (${costCompare.savingsPercent}%)`;
    additionalContext += ` | 输入: ~${(promptTokens/1000).toFixed(1)}K tokens`;

    // 匹配标签
    if (analysis.matched && analysis.matched.length > 0) {
      additionalContext += `\n[任务分类] ${analysis.matched.join(', ')}`;
    }

    return JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext
      }
    });
  } catch (e) {
    return JSON.stringify({});
  }
}

// ─── 会话路由统计 ──────────────────────────────

function sessionStatus() {
  let tracker = null;
  try {
    if (fs.existsSync(TRACKER_FILE)) {
      tracker = JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf-8'));
    }
  } catch {}

  console.log('═══════════════════════════════════');
  console.log('  UltraCostEffective Model Router');
  console.log('═══════════════════════════════════');
  console.log('');

  if (tracker && tracker.modelStats) {
    console.log('── 模型使用统计 ──');
    for (const [model, stats] of Object.entries(tracker.modelStats)) {
      const pricing = PRICING[model] || { input: 0, output: 0 };
      const cost = (stats.inputTokens / 1_000_000) * pricing.input +
                   (stats.outputTokens / 1_000_000) * pricing.output;
      console.log(`  ${model}: ${stats.calls}次 | ${(stats.inputTokens/1000).toFixed(1)}K in / ${(stats.outputTokens/1000).toFixed(1)}K out | 约¥${cost.toFixed(4)}`);
    }
    console.log('');

    if (tracker.layerSavings?.L7_router) {
      const l7 = tracker.layerSavings.L7_router;
      console.log(`  Flash降级: ${l7.flashDowngrades || 0}次`);
      console.log(`  路由节省: ¥${(l7.estimatedSaving || 0).toFixed(4)}`);
    }
  } else {
    console.log('  暂无路由数据。perf-tracker 激活后自动记录。');
  }

  console.log('');
  console.log('── 路由规则 ──');
  console.log('  Pro   ← 架构/设计/方案/规划/安全审计/性能优化');
  console.log('  Flash ← 编码/测试/Bug修复/文档/问答/CR');
  console.log('  上下文 >50% → Pro倾向降级');
  console.log('  上下文 >80% → 强制 Flash');
  console.log('');
  console.log('  手动: /model deepseek-v4-pro|flash');
  console.log('═══════════════════════════════════');
}

// ─── 测试矩阵 ──────────────────────────────────

function testMatrix() {
  const testCases = [
    '帮我设计一个微服务架构的用户认证系统',
    '修复 src/auth.ts 中的 token 过期 bug',
    '写一个单元测试覆盖 login 函数',
    '分析整个项目的安全漏洞并输出报告',
    'npm test 失败了，帮我看看',
    '这段代码是什么意思？解释一下',
    '重构这个模块的数据库访问层',
    '制定下个版本的迭代规划和技术方案',
    '帮我写个 README 文档',
    'review 一下这个 PR 的代码质量',
    'ultracode: audit every API endpoint for security issues',
    'git commit 现在的工作',
  ];

  console.log('══════════════════════════════════════════════════');
  console.log('  Model Router 决策矩阵');
  console.log('══════════════════════════════════════════════════\n');

  let proCount = 0, flashCount = 0;

  for (const tc of testCases) {
    const result = analyzePrompt(tc);
    const label = result.model.includes('pro') ? '🧠 Pro' : '⚡ Flash';
    const downgrade = result.contextDowngrade ? ' [降级]' : '';
    if (result.model.includes('pro')) proCount++; else flashCount++;

    console.log(`${label}${downgrade} | ${result.reason}`);
    console.log(`        "${tc.slice(0, 60)}${tc.length > 60 ? '...' : ''}"`);
  }

  console.log(`\n── 汇总 ──`);
  console.log(`  Pro: ${proCount} | Flash: ${flashCount}`);
  console.log(`  Flash 占比: ${(flashCount/testCases.length*100).toFixed(0)}%`);
}

// ─── 主函数 ────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--test') || args.includes('-t')) {
    testMatrix();
    return;
  }

  if (args[0] === 'analyze') {
    const prompt = args.slice(1).join(' ');
    const result = analyzePrompt(prompt);
    const costCompare = compareCost(estimatePromptTokens(prompt));
    console.log(JSON.stringify({
      ...result,
      costEstimate: costCompare
    }, null, 2));
    return;
  }

  if (args[0] === 'status') {
    sessionStatus();
    return;
  }

  if (args[0] === 'hook') {
    // Hook 模式：从 stdin 读取
    const chunks = [];
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', chunk => chunks.push(chunk));
    process.stdin.on('end', () => {
      const input = chunks.join('').trim();
      if (!input) {
        console.log(JSON.stringify({}));
        return;
      }
      process.stdout.write(handleUserPromptSubmit(input));
    });
    return;
  }

  // 默认: 分析命令行参数
  const prompt = args.join(' ');
  if (prompt) {
    const result = analyzePrompt(prompt);
    const costCompare = compareCost(estimatePromptTokens(prompt));
    const label = result.model.includes('pro') ? '🧠 Pro' : '⚡ Flash';
    console.log(`${label} ${result.reason}`);
    console.log(`Pro: ¥${costCompare.pro.totalCost.toFixed(4)} | Flash: ¥${costCompare.flash.totalCost.toFixed(4)} | 省: ¥${costCompare.savings.toFixed(4)}`);
  } else {
    sessionStatus();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  analyzePrompt,
  estimateCost,
  compareCost,
  handleUserPromptSubmit,
  PRICING,
  PRO_INDICATORS,
  FLASH_INDICATORS
};
