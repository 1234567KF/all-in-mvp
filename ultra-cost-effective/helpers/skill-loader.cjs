#!/usr/bin/env node
/**
 * skill-loader.cjs — 技能按需加载 (UltraCostEffective L4)
 *
 * 基于 ccmvp/1234567KF 的 skill-loader 思路实现。
 * 非活跃技能压缩为 ~25 token 元数据 stub，按阶段切换加载完整内容。
 *
 * 用法:
 *   node skill-loader.cjs --stage <n> --skills <dir>     # 按阶段生成加载方案
 *   node skill-loader.cjs --list --skills <dir>           # 列出所有技能元数据
 *   node skill-loader.cjs --profile --skills <dir>        # 分析各阶段压缩率
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── 配置: 阶段 ↔ 技能映射 ──────────────────────

// Pipeline 阶段定义（参考 ccmvp 6 阶段模型）
const STAGES = {
  0: { name: 'init',      desc: '项目初始化',     alwaysSkills: ['ultra-cost-effective', 'ultra-cost-effective-router'],     activeSkills: [] },
  1: { name: 'spec',      desc: '需求分析/Spec',   alwaysSkills: ['ultra-cost-effective', 'ultra-cost-effective-router'],     activeSkills: ['ultra-cost-effective-cache'] },
  2: { name: 'design',    desc: '架构设计',         alwaysSkills: ['ultra-cost-effective', 'ultra-cost-effective-router'],     activeSkills: ['ultra-cost-effective-cache'] },
  3: { name: 'implement', desc: '编码实现',         alwaysSkills: ['ultra-cost-effective', 'ultra-cost-effective-router', 'ultra-cost-effective-output'], activeSkills: ['ultra-cost-effective-cache', 'ultra-cost-effective-monitor'] },
  4: { name: 'test',      desc: '测试验证',         alwaysSkills: ['ultra-cost-effective', 'ultra-cost-effective-router', 'ultra-cost-effective-output'], activeSkills: ['ultra-cost-effective-cache', 'ultra-cost-effective-monitor'] },
  5: { name: 'review',    desc: '代码审查/交付',   alwaysSkills: ['ultra-cost-effective', 'ultra-cost-effective-router', 'ultra-cost-effective-monitor'], activeSkills: ['ultra-cost-effective-output'] },
};

// 子技能定义
const SUB_SKILLS = {
  'ultra-cost-effective-output':  { triggers: ['output', '压缩', 'tokenforge'], desc: 'L1输出压缩引擎' },
  'ultra-cost-effective-cache':   { triggers: ['cache', '缓存', 'KV', '前缀'],  desc: 'L2+L3 KV Cache优化' },
  'ultra-cost-effective-router':  { triggers: ['router', '路由', '模型', 'Pro', 'Flash'], desc: 'L7 DeepSeek双模型智能路由' },
  'ultra-cost-effective-monitor': { triggers: ['monitor', '监控', 'token report', '成本报告'], desc: 'L0 Token追踪与成本可视化' },
};

// ─── 技能元数据解析 ─────────────────────────────

function parseSkillMetadata(skillDir) {
  const skillFile = path.join(skillDir, 'SKILL.md');
  try {
    const content = fs.readFileSync(skillFile, 'utf-8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return null;

    const fm = {};
    const lines = frontmatterMatch[1].split('\n');
    for (const line of lines) {
      const pair = line.match(/^(\w[\w-]*):\s*(.+)/);
      if (pair) fm[pair[1]] = pair[2].trim();
    }

    return {
      name: fm.name || path.basename(skillDir),
      description: fm.description || '',
      triggers: (fm.triggers || '').split(',').map(s => s.trim()).filter(Boolean),
      role: fm.role || 'utility',
      scope: fm.scope || 'project',
      alwaysOn: (fm['always-on'] || fm.always_on || 'false').toLowerCase() === 'true',
      size: content.length,
      tokenEstimate: Math.ceil(content.length / 3.5)  // 粗略token估算
    };
  } catch {
    return null;
  }
}

function generateStub(meta) {
  // 元数据 stub ≈ 25 tokens
  return `[${meta.name}] ${meta.description} (触发: ${meta.triggers.slice(0, 3).join(', ')})`;
}

// ─── 阶段加载方案 ──────────────────────────────

function generateStagePlan(stageNum, skillsDir) {
  const stage = STAGES[stageNum] || STAGES[0];
  const skillsPath = skillsDir || path.resolve(__dirname, '..', 'skills');

  // 扫描子技能
  const allSkills = {};
  try {
    const entries = fs.readdirSync(skillsPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('ultra-cost-effective-')) {
        const meta = parseSkillMetadata(path.join(skillsPath, entry.name));
        if (meta) allSkills[meta.name] = meta;
      }
    }
  } catch (e) {
    console.error(`无法读取技能目录: ${skillsPath}`);
    process.exit(1);
  }

  // 补充硬编码的子技能
  for (const [name, info] of Object.entries(SUB_SKILLS)) {
    if (!allSkills[name]) {
      allSkills[name] = { name, description: info.desc, triggers: info.triggers, role: 'utility', alwaysOn: false, size: 0, tokenEstimate: 25 };
    }
  }

  // 分类
  const alwaysOn = [];   // 始终完整加载
  const active = [];     // 当前阶段活跃
  const stubs = [];      // 压缩为 stub

  const allActiveNames = new Set([...stage.alwaysSkills, ...stage.activeSkills]);

  for (const [name, meta] of Object.entries(allSkills)) {
    if (stage.alwaysSkills.includes(name) || meta.alwaysOn) {
      alwaysOn.push(meta);
    } else if (allActiveNames.has(name)) {
      active.push(meta);
    } else {
      stubs.push(meta);
    }
  }

  // 主技能始终完整
  const mainSkill = { name: 'ultra-cost-effective', size: 3000, tokenEstimate: 850 }; // 主技能 ~3000 chars

  // 计算 token
  const alwaysTokens = alwaysOn.reduce((sum, s) => sum + s.tokenEstimate, 0) + mainSkill.tokenEstimate;
  const activeTokens = active.reduce((sum, s) => sum + s.tokenEstimate, 0);
  const stubTokens = stubs.length * 25;

  const totalFullTokens = alwaysTokens + activeTokens + stubTokens;
  const totalIfAllFull = alwaysTokens + activeTokens + stubs.reduce((sum, s) => sum + s.tokenEstimate, 0);

  const compressionRate = totalIfAllFull > 0
    ? ((1 - totalFullTokens / totalIfAllFull) * 100).toFixed(1)
    : '0.0';

  return {
    stage: { num: stageNum, ...stage },
    alwaysOn: alwaysOn.map(s => ({ name: s.name, tokens: s.tokenEstimate })),
    active: active.map(s => ({ name: s.name, tokens: s.tokenEstimate })),
    stubs: stubs.map(s => ({ name: s.name, stub: generateStub(s) })),
    stats: {
      alwaysTokens,
      activeTokens,
      stubTokens,
      totalFullTokens,
      totalIfAllFull,
      compressionRate,
      savedTokens: totalIfAllFull - totalFullTokens,
      savedPercent: compressionRate
    }
  };
}

// ─── 输出格式 ──────────────────────────────────

function formatPlan(plan) {
  const lines = [];
  lines.push('');
  lines.push(`╔══════════════════════════════════════════════════╗`);
  lines.push(`║  Stage ${plan.stage.num}: ${plan.stage.name.padEnd(32)} ║`);
  lines.push(`║  ${plan.stage.desc.padEnd(42)} ║`);
  lines.push(`╚══════════════════════════════════════════════════╝`);
  lines.push('');
  lines.push('─── 始终完整加载 ───');
  for (const s of plan.alwaysOn) {
    lines.push(`  📦 ${s.name.padEnd(20)} ~${s.tokens.toString().padStart(5)} tokens`);
  }
  lines.push('');
  lines.push('─── 当前阶段活跃 ───');
  if (plan.active.length === 0) {
    lines.push('  (无)');
  } else {
    for (const s of plan.active) {
      lines.push(`  ✅ ${s.name.padEnd(20)} ~${s.tokens.toString().padStart(5)} tokens`);
    }
  }
  lines.push('');
  lines.push('─── 压缩为 Stub ───');
  if (plan.stubs.length === 0) {
    lines.push('  (无)');
  } else {
    for (const s of plan.stubs) {
      lines.push(`  📎 ${s.stub}`);
    }
  }
  lines.push('');
  lines.push('─── 统计 ───');
  lines.push(`  Token 总计:        ${plan.stats.totalFullTokens}`);
  lines.push(`  若全量加载:        ${plan.stats.totalIfAllFull}`);
  lines.push(`  已节省:            ${plan.stats.savedTokens} tokens (${plan.stats.savedPercent}%)`);
  lines.push(`  压缩率:            ${plan.stats.compressionRate}%`);
  lines.push('');

  return lines.join('\n');
}

// ─── 全阶段分析 (--profile) ─────────────────────

function profileAllStages(skillsDir) {
  const lines = [];
  lines.push('═══ UltraCostEffective 技能加载 全阶段分析 ═══\n');
  lines.push('| 阶段 | 名称 | 完整 | 活跃 | Stub | 总计 | 全量 | 压缩率 |');
  lines.push('|------|------|------|------|------|------|------|--------|');

  for (let i = 0; i <= 5; i++) {
    const plan = generateStagePlan(i, skillsDir);
    lines.push(`| ${i} | ${plan.stage.name} | ${plan.stats.alwaysTokens} | ${plan.stats.activeTokens} | ${plan.stats.stubTokens} | ${plan.stats.totalFullTokens} | ${plan.stats.totalIfAllFull} | ${plan.stats.compressionRate}% |`);
  }

  lines.push('');
  lines.push('💡 推荐: 使用 `node skill-loader.cjs --stage <n>` 查看特定阶段的详细加载方案。');
  return lines.join('\n');
}

// ─── 技能列表 (--list) ─────────────────────────

function listSkills(skillsDir) {
  const skillsPath = skillsDir || path.resolve(__dirname, '..', 'skills');
  const lines = [];
  lines.push('═══ UltraCostEffective 技能清单 ═══\n');

  try {
    const entries = fs.readdirSync(skillsPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('ultra-cost-effective-')) {
        const meta = parseSkillMetadata(path.join(skillsPath, entry.name));
        if (meta) {
          const stub = generateStub(meta);
          lines.push(`${stub} [${meta.scope}]`);
        } else {
          const info = SUB_SKILLS[entry.name] || { triggers: [], desc: '(解析失败)' };
          lines.push(`  [${entry.name}] ${info.desc}`);
        }
      }
    }
  } catch (e) {
    lines.push(`  ❌ 无法读取: ${skillsPath}`);
  }

  return lines.join('\n');
}

// ─── 主函数 ────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  let stageNum = null;
  let skillsDir = path.resolve(__dirname, '..', 'skills');

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--stage' || args[i] === '-s') && args[i + 1]) {
      stageNum = parseInt(args[i + 1], 10);
      i++;
    } else if ((args[i] === '--skills' || args[i] === '-d') && args[i + 1]) {
      skillsDir = path.resolve(args[i + 1]);
      i++;
    }
  }

  if (args.includes('--list') || args.includes('-l')) {
    console.log(listSkills(skillsDir));
    return;
  }

  if (args.includes('--profile') || args.includes('-p')) {
    console.log(profileAllStages(skillsDir));
    return;
  }

  if (stageNum !== null && !isNaN(stageNum)) {
    const plan = generateStagePlan(stageNum, skillsDir);
    console.log(formatPlan(plan));
    return;
  }

  // 默认: 显示帮助
  console.log(`
skill-loader.cjs — 技能按需加载 (UltraCostEffective L4)

用法:
  node skill-loader.cjs --stage <0-5>     按阶段生成加载方案
  node skill-loader.cjs --profile          全阶段压缩率分析
  node skill-loader.cjs --list             列出所有技能元数据

阶段:
  0 = init      项目初始化
  1 = spec      需求分析
  2 = design    架构设计
  3 = implement 编码实现
  4 = test      测试验证
  5 = review    代码审查/交付
`);
}

// ─── 导出 ──────────────────────────────────────

if (require.main === module) {
  main();
}

module.exports = { generateStagePlan, parseSkillMetadata, generateStub, STAGES, SUB_SKILLS };
