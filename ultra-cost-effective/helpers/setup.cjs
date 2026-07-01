#!/usr/bin/env node
/**
 * setup.cjs — UltraCostEffective 一键项目集成器
 *
 * 自动完成目标项目的全部集成步骤：
 *   1. 检测项目类型和已有配置
 *   2. 在 CLAUDE.md 中注入 @ultra-cost-effective/rules/main.md
 *   3. 合并 settings.json 模板
 *   4. 验证集成完整性
 *
 * 用法:
 *   node setup.cjs [--target <path>] [--force] [--dry-run]
 *
 * 默认 target 为当前工作目录。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const RULE_IMPORT = '@ultra-cost-effective/rules/main.md';
const RULE_IMPORT_MARKER = 'ultra-cost-effective/rules/main.md';

// ─── 工具函数 ──────────────────────────────────

function findClaudeMd(targetDir) {
  const candidates = [
    path.join(targetDir, 'CLAUDE.md'),
    path.join(targetDir, 'claude.md'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function hasRuleImport(claudeMdPath) {
  try {
    const content = fs.readFileSync(claudeMdPath, 'utf-8');
    return content.includes(RULE_IMPORT_MARKER);
  } catch {
    return false;
  }
}

function injectRuleImport(claudeMdPath, dryRun = false) {
  const content = fs.readFileSync(claudeMdPath, 'utf-8');

  if (content.includes(RULE_IMPORT_MARKER)) {
    return { changed: false, reason: '已存在引用' };
  }

  // 在文件开头插入（确保前缀在最前面）
  const newContent = `${RULE_IMPORT}\n${content}`;

  if (!dryRun) {
    fs.writeFileSync(claudeMdPath, newContent, 'utf-8');
  }

  return { changed: true, reason: `已在文件开头插入 "${RULE_IMPORT}"` };
}

function createClaudeMd(targetDir, dryRun = false) {
  const claudeMdPath = path.join(targetDir, 'CLAUDE.md');

  const content = `${RULE_IMPORT}

# ${path.basename(targetDir)}

> 项目自动生成，由 UltraCostEffective setup.cjs 创建。
`;

  if (!dryRun) {
    fs.writeFileSync(claudeMdPath, content, 'utf-8');
  }

  return { created: true, path: claudeMdPath };
}

function checkSettingsJson(targetDir) {
  const settingsPath = path.join(targetDir, '.claude', 'settings.json');
  const localPath = path.join(targetDir, '.claude', 'settings.local.json');

  if (fs.existsSync(settingsPath)) return { exists: true, path: settingsPath, type: 'project' };
  if (fs.existsSync(localPath)) return { exists: true, path: localPath, type: 'local' };

  return { exists: false, path: settingsPath, type: 'none' };
}

function hasUltraCostEffectiveInSettings(settingsPath) {
  try {
    const content = fs.readFileSync(settingsPath, 'utf-8');
    return content.includes('ultra-cost-effective') || content.includes('ULTRA_COST_EFFECTIVE');
  } catch {
    return false;
  }
}

function mergeSettingsTemplate(targetDir, dryRun = false) {
  const settingsDir = path.join(targetDir, '.claude');
  const settingsPath = path.join(settingsDir, 'settings.json');
  const templatePath = path.join(__dirname, '..', 'adapters', 'claude', 'settings.template.json');

  if (!fs.existsSync(templatePath)) {
    return { merged: false, reason: '模板文件不存在' };
  }

  // 确保 .claude 目录存在
  if (!dryRun && !fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }

  if (fs.existsSync(settingsPath)) {
    if (hasUltraCostEffectiveInSettings(settingsPath)) {
      return { merged: false, reason: 'settings.json 已包含 UltraCostEffective 配置' };
    }

    // 已有 settings.json — 智能合并
    if (!dryRun) {
      try {
        const existing = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        const template = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));

        // 合并 env
        if (!existing.env) existing.env = {};
        Object.assign(existing.env, template.env);

        // 合并 hooks
        if (!existing.hooks) existing.hooks = {};
        for (const [hookType, hookEntries] of Object.entries(template.hooks || {})) {
          if (!existing.hooks[hookType]) existing.hooks[hookType] = [];
          for (const entry of hookEntries) {
            // 检查是否已有相同 matcher 的 hook
            const exists = existing.hooks[hookType].some(e => e.matcher === entry.matcher);
            if (!exists) {
              existing.hooks[hookType].push(entry);
            }
          }
        }

        // 合并 mcpServers
        if (!existing.mcpServers) existing.mcpServers = {};
        Object.assign(existing.mcpServers, template.mcpServers || {});

        // 合并 permissions
        if (!existing.permissions) existing.permissions = { allow: [] };
        if (!existing.permissions.allow) existing.permissions.allow = [];
        for (const perm of (template.permissions?.allow || [])) {
          if (!existing.permissions.allow.includes(perm)) {
            existing.permissions.allow.push(perm);
          }
        }

        fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2), 'utf-8');
        return { merged: true, reason: '已智能合并到现有 settings.json' };
      } catch (e) {
        return { merged: false, reason: `合并失败: ${e.message}` };
      }
    }
    return { merged: true, reason: '(dry-run) 将合并到现有 settings.json' };
  }

  // 无 settings.json — 直接复制模板
  if (!dryRun) {
    fs.copyFileSync(templatePath, settingsPath);
  }
  return { merged: true, reason: '已从模板创建 .claude/settings.json' };
}

function validateIntegration(targetDir) {
  const results = [];

  // 1. CLAUDE.md 引用
  const claudeMd = findClaudeMd(targetDir);
  if (claudeMd && hasRuleImport(claudeMd)) {
    results.push({ ok: true, item: 'CLAUDE.md 规则引用', detail: RULE_IMPORT });
  } else if (claudeMd) {
    results.push({ ok: false, item: 'CLAUDE.md 规则引用', detail: '未找到引用，请手动添加: ' + RULE_IMPORT });
  } else {
    results.push({ ok: false, item: 'CLAUDE.md', detail: '文件不存在，请创建并添加: ' + RULE_IMPORT });
  }

  // 2. settings.json
  const settingsCheck = checkSettingsJson(targetDir);
  if (settingsCheck.exists && hasUltraCostEffectiveInSettings(settingsCheck.path)) {
    results.push({ ok: true, item: 'settings.json', detail: settingsCheck.path });
  } else if (settingsCheck.exists) {
    results.push({ ok: false, item: 'settings.json', detail: '未合并 UltraCostEffective 配置' });
  } else {
    results.push({ ok: false, item: 'settings.json', detail: '不存在，请从模板创建' });
  }

  // 3. 核心文件
  const engineDir = path.join(targetDir, 'ultra-cost-effective');
  const coreFiles = [
    'helpers/tokenforge.cjs',
    'helpers/tokenforge-hook.cjs',
    'helpers/context-interceptor.cjs',
    'rules/main.md',
  ];
  for (const f of coreFiles) {
    const fullPath = path.join(engineDir, f);
    if (fs.existsSync(fullPath)) {
      results.push({ ok: true, item: `引擎文件: ${f}`, detail: '存在' });
    } else {
      results.push({ ok: false, item: `引擎文件: ${f}`, detail: '缺失' });
    }
  }

  // 4. lean-ctx
  try {
    require('child_process').execSync('lean-ctx --version', { timeout: 5000, stdio: 'pipe' });
    results.push({ ok: true, item: 'lean-ctx MCP', detail: '已安装' });
  } catch {
    results.push({ ok: false, item: 'lean-ctx MCP', detail: '未安装（可选）' });
  }

  return results;
}

// ─── 主函数 ────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  let targetDir = process.cwd();
  let dryRun = false;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target' || args[i] === '-t') {
      targetDir = path.resolve(args[++i] || '.');
    } else if (args[i] === '--dry-run' || args[i] === '-n') {
      dryRun = true;
    } else if (args[i] === '--force' || args[i] === '-f') {
      force = true;
    }
  }

  console.log('═══════════════════════════════════');
  console.log('  UltraCostEffective 项目集成器');
  console.log('═══════════════════════════════════');
  console.log('');
  console.log(`  目标项目: ${targetDir}`);
  if (dryRun) console.log('  模式: DRY-RUN (预览，不实际修改)');
  if (force) console.log('  模式: FORCE (强制覆盖)');
  console.log('');

  const steps = [];

  // Step 1: CLAUDE.md 规则注入
  console.log('── [1/3] CLAUDE.md 规则注入 ──');
  const claudeMd = findClaudeMd(targetDir);

  if (claudeMd && hasRuleImport(claudeMd)) {
    console.log(`  ✅ 已引用: ${RULE_IMPORT}`);
    steps.push({ step: 'CLAUDE.md', status: 'already' });
  } else if (claudeMd) {
    const result = injectRuleImport(claudeMd, dryRun);
    console.log(`  ${result.changed ? '✅' : '⚠️'} ${result.reason}`);
    steps.push({ step: 'CLAUDE.md', status: result.changed ? 'injected' : 'skipped' });
  } else {
    const result = createClaudeMd(targetDir, dryRun);
    console.log(`  ✅ 已创建 CLAUDE.md 并注入规则引用`);
    steps.push({ step: 'CLAUDE.md', status: 'created' });
  }

  // Step 2: settings.json 合并
  console.log('');
  console.log('── [2/3] settings.json 合并 ──');
  const settingsCheck = checkSettingsJson(targetDir);

  if (settingsCheck.exists && hasUltraCostEffectiveInSettings(settingsCheck.path)) {
    console.log(`  ✅ 已配置`);
    steps.push({ step: 'settings.json', status: 'already' });
  } else {
    const result = mergeSettingsTemplate(targetDir, dryRun);
    console.log(`  ${result.merged ? '✅' : '❌'} ${result.reason}`);
    steps.push({ step: 'settings.json', status: result.merged ? 'merged' : 'failed' });
  }

  // Step 3: 验证
  console.log('');
  console.log('── [3/3] 集成验证 ──');
  const results = validateIntegration(targetDir);
  let allOk = true;
  for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    console.log(`  ${icon} ${r.item}: ${r.detail}`);
    if (!r.ok) allOk = false;
  }

  // 总结
  console.log('');
  console.log('═══════════════════════════════════');
  if (allOk) {
    console.log('  ✅ 集成完成！重启 Claude Code 后生效。');
  } else {
    console.log('  ⚠️ 部分项目需手动处理（见上方 ❌ 标记）。');
  }
  console.log('');
  console.log('  验证命令:');
  console.log('    node ultra-cost-effective/helpers/prefix-validator.cjs --check-all');
  console.log('    node ultra-cost-effective/helpers/tokenforge-hook.cjs --test');
  console.log('═══════════════════════════════════');
}

if (require.main === module) {
  main();
}

module.exports = {
  findClaudeMd,
  hasRuleImport,
  injectRuleImport,
  createClaudeMd,
  checkSettingsJson,
  hasUltraCostEffectiveInSettings,
  mergeSettingsTemplate,
  validateIntegration
};
