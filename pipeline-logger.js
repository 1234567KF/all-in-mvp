#!/usr/bin/env node
/**
 * Pipeline Execution Logger
 * 用于 all-in-mvp skill 执行时记录 Agent 执行日志
 * 输出格式与 pipeline-execution-log.md 兼容
 */

const fs = require('fs');
const path = require('path');

const LOG_FILE = path.resolve('d:\\all-in-mvp\\pipeline-execution-log.md');

function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function appendLog(entry) {
  const block = `\n## [${entry.timestamp}] ${entry.stage} — ${entry.agentRole}\n\n- **模型**: ${entry.model || 'unknown'}\n- **加载的 Skill**: ${entry.skills || ''}\n- **状态**: ${entry.status || 'SPAWNED'}\n- **输入摘要**: ${entry.inputSummary || ''}\n- **输出摘要**: ${entry.outputSummary || ''}\n- **Token 消耗**: input=${entry.inputTokens || 0}, output=${entry.outputTokens || 0}, cache=${entry.cacheTokens || 0}\n- **花费**: $${entry.cost || 0}\n`;

  // 确保文件存在
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, '# Pipeline Execution Log\n\n> 自动生成，请勿手动编辑\n\n---\n', 'utf-8');
  }

  fs.appendFileSync(LOG_FILE, block, 'utf-8');
  console.log(`[PipelineLogger] 已记录: ${entry.stage} — ${entry.agentRole}`);
}

// CLI 用法
if (require.main === module) {
  const args = process.argv.slice(2);
  const entry = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    entry[key] = args[i + 1];
  }

  entry.timestamp = entry.timestamp || getTimestamp();
  appendLog(entry);
}

module.exports = { appendLog, getTimestamp };
