#!/usr/bin/env node
/**
 * hook-adapter.cjs — Qoder Hook 适配器 (UltraCostEffective)
 *
 * 统一封装 Qoder 与 Claude Code 的 Hook 机制差异。
 * Qoder 的 Hook 事件名、参数格式、stdin/stdout 协议均与 Claude Code 不同，
 * 此适配器负责翻译和桥接。
 *
 * 核心差异:
 *   Claude Code:  PreToolUse/PostToolUse, JSON { tool_name, tool_input, ... }
 *   Qoder:        可能的事件名不同，参数嵌套路径不同
 *
 * 适配策略:
 *   - 自动检测运行平台 (ULTRA_COST_EFFECTIVE_PLATFORM 环境变量)
 *   - 统一内部调用 tokenforge / perf-tracker 核心逻辑
 *   - 透明转发，对上层技能无感知
 */

'use strict';

// ─── 平台检测 ──────────────────────────────────

function detectPlatform() {
  // 1. 环境变量优先
  if (process.env.ULTRA_COST_EFFECTIVE_PLATFORM === 'qoder') return 'qoder';
  if (process.env.ULTRA_COST_EFFECTIVE_PLATFORM === 'claude') return 'claude';

  // 2. 运行时特征检测
  if (process.env.QODER_SESSION_ID || process.env.QODER_WORKSPACE) return 'qoder';
  if (process.env.CLAUDE_CODE_SESSION_ID || process.env.ANTHROPIC_API_KEY) return 'claude';

  // 3. 默认 Claude Code
  return 'claude';
}

// ─── Qoder → 统一格式翻译 ──────────────────────

function qoderToUnified(qoderInput) {
  // Qoder Hook 输入格式可能因版本而异
  // 此处适配常见格式：
  // Qoder v2: { event: "pre_tool_use", data: { tool: "bash", command: "..." } }
  // Qoder v3: { hook: "PreToolUse", input: { name: "Bash", args: { command: "..." } } }

  try {
    const data = typeof qoderInput === 'string' ? JSON.parse(qoderInput) : qoderInput;

    // 多种格式兼容
    const command =
      data.data?.command ||
      data.input?.args?.command ||
      data.tool_input?.command ||
      data.command ||
      '';

    const toolName =
      data.data?.tool ||
      data.input?.name ||
      data.tool_name ||
      data.tool ||
      'Bash';

    return {
      platform: 'qoder',
      tool: toolName,
      command: command,
      raw: data
    };
  } catch (e) {
    return { platform: 'qoder', tool: 'Bash', command: '', raw: {}, error: e.message };
  }
}

function claudeToUnified(claudeInput) {
  try {
    const data = typeof claudeInput === 'string' ? JSON.parse(claudeInput) : claudeInput;
    return {
      platform: 'claude',
      tool: data.tool_name || data.tool_input?.tool || 'Bash',
      command: data.tool_input?.command || data.command || '',
      raw: data
    };
  } catch (e) {
    return { platform: 'claude', tool: 'Bash', command: '', raw: {}, error: e.message };
  }
}

// ─── 统一输出格式 ──────────────────────────────

function unifiedToQoder(result) {
  // Qoder 期望的输出格式
  return JSON.stringify({
    action: result.continue ? 'continue' : 'block',
    modified_command: result.modifiedCommand || undefined,
    reason: result.reason || 'ultra-cost-effective hook adapter'
  });
}

function unifiedToClaude(result) {
  // Claude Code 期望的输出格式
  const output = { continue: result.continue !== false };
  if (result.modifiedCommand) {
    output.hookSpecificOutput = {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      permissionDecisionReason: result.reason || 'ultra-cost-effective: auto-compress',
      updatedInput: { command: result.modifiedCommand }
    };
  }
  return JSON.stringify(output);
}

// ─── 核心适配逻辑 ──────────────────────────────

function adapt(input) {
  const platform = detectPlatform();
  let unified;

  if (platform === 'qoder') {
    unified = qoderToUnified(input);
  } else {
    unified = claudeToUnified(input);
  }

  // 如果不是 Bash/Shell 工具，直接放行
  if (unified.tool !== 'Bash' && unified.tool !== 'Shell' && unified.tool !== 'bash') {
    return platform === 'qoder' ? unifiedToQoder({ continue: true }) : unifiedToClaude({ continue: true });
  }

  // 调用共享逻辑: tokenforge-hook 的命令分类与注入
  const { shouldSkip, getCompressionConfig, injectTokenforge } = require('../../helpers/tokenforge-hook.cjs');

  if (isUltraCostEffectiveOff()) {
    return platform === 'qoder' ? unifiedToQoder({ continue: true }) : unifiedToClaude({ continue: true });
  }

  if (!unified.command || shouldSkip(unified.command)) {
    return platform === 'qoder' ? unifiedToQoder({ continue: true }) : unifiedToClaude({ continue: true });
  }

  const config = getCompressionConfig(unified.command);
  if (!config) {
    return platform === 'qoder' ? unifiedToQoder({ continue: true }) : unifiedToClaude({ continue: true });
  }

  const newCommand = injectTokenforge(unified.command, config, platform);
  if (!newCommand) {
    return platform === 'qoder' ? unifiedToQoder({ continue: true }) : unifiedToClaude({ continue: true });
  }

  const reason = `ultra-cost-effective: tokenforge ${config.type}/${config.level}`;
  const result = { continue: true, modifiedCommand: newCommand, reason };

  return platform === 'qoder' ? unifiedToQoder(result) : unifiedToClaude(result);
}

// ─── 辅助 ──────────────────────────────────────

function isUltraCostEffectiveOff() {
  return process.env.ULTRA_COST_EFFECTIVE_OFF === '1' || process.env.ULTRA_COST_EFFECTIVE_OFF === 'true';
}

// ─── 主函数 (Hook stdin 模式) ───────────────────

function main() {
  const chunks = [];
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', chunk => chunks.push(chunk));
  process.stdin.on('end', () => {
    const input = chunks.join('').trim();
    if (!input) {
      console.log(JSON.stringify({ action: 'continue' }));
      return;
    }

    try {
      const output = adapt(input);
      process.stdout.write(output);
    } catch (e) {
      console.error(`[hook-adapter] 错误: ${e.message}`);
      // 出错时安全放行
      const platform = detectPlatform();
      process.stdout.write(platform === 'qoder' ? unifiedToQoder({ continue: true }) : unifiedToClaude({ continue: true }));
    }
  });
}

// ─── 导出 ──────────────────────────────────────

if (require.main === module) {
  main();
}

module.exports = { adapt, detectPlatform, qoderToUnified, claudeToUnified, unifiedToQoder, unifiedToClaude };
