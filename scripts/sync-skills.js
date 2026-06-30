#!/usr/bin/env node

/**
 * all-in-mvp 技能双向同步脚本（v2 增强版）
 *
 * 解决用户真实工作流：
 *   1. 用户在实际项目中修改 .claude/skills/ 的技能 → 回粘到 all-in-mvp 的 .claude/skills/
 *   2. 用户也可能直接修改 skills/（源码仓库）
 *   3. 需要自动检测哪边更新，双向合并
 *
 * 支持模式：
 *   --mode push     : skills/ → .claude/ + .qoder/ （默认，发布用）
 *   --mode pull     : .claude/ → skills/            （回同步用）
 *   --mode merge    : 自动检测两边谁更新，以新的为准双向合并
 *   --mode interactive : 逐文件询问用户选择
 *
 * 平台适配（Overlay 机制）：
 *   skills/<skill>/.overlay/claude/  → Claude Code 专用覆盖
 *   skills/<skill>/.overlay/qoder/   → Qoder 专用覆盖
 *   推送时：基础层 + overlay 层融合后写入目标平台
 *
 * 使用方法：
 *   node scripts/sync-skills.js                  # 默认 push 模式
 *   node scripts/sync-skills.js --mode pull      # 拉回实际项目中的改动
 *   node scripts/sync-skills.js --mode merge     # 自动双向合并
 *   node scripts/sync-skills.js --mode interactive  # 逐文件确认
 *   node scripts/sync-skills.js --dry-run        # 预览
 *   node scripts/sync-skills.js --backup         # 备份后同步
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

const CONFIG = {
  sourceDir: path.join(__dirname, '..', 'skills'),
  targets: {
    claude: path.join(__dirname, '..', '.claude', 'skills'),
    qoder:  path.join(__dirname, '..', '.qoder', 'skills'),
  },
  backupDir: path.join(__dirname, '..', '.backups', 'skills'),
  ignore: ['.git', '.DS_Store', 'node_modules', '*.tmp', '*.bak', '.overlay'],
};

const colors = { reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m', magenta: '\x1b[35m' };
function c(msg, color) { return `${colors[color] || ''}${msg}${colors.reset}`; }

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { mode: 'push', dryRun: false, backup: false, verbose: false, force: false, target: null };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--mode':       opts.mode = args[++i]; break;
      case '--target':     opts.target = args[++i]; break;
      case '--dry-run':    opts.dryRun = true; break;
      case '--backup':     opts.backup = true; break;
      case '--verbose':    opts.verbose = true; break;
      case '--force':      opts.force = true; break;
      case '--help':       showHelp(); process.exit(0);
    }
  }
  return opts;
}

function showHelp() {
  console.log(`
${c('all-in-mvp 技能双向同步脚本 v2', 'cyan')}

${c('模式', 'yellow')}：
  --mode push         skills/ → .claude/ + .qoder/ （默认）
  --mode pull         .claude/ → skills/ （回同步）
  --mode merge        自动双向合并（以新的为准）
  --mode interactive  逐文件询问用户

${c('选项', 'yellow')}：
  --target <name>     只操作指定平台（claude/qoder）
  --dry-run           预览模式，不实际修改
  --backup            同步前自动备份
  --verbose           详细日志
  --force             跳过确认
  --help              帮助

${c('Overlay 平台适配', 'yellow')}：
  skills/<skill>/.overlay/claude/  → Claude Code 专用覆盖文件
  skills/<skill>/.overlay/qoder/   → Qoder 专用覆盖文件
  推送时自动叠加：基础层 + overlay → 目标平台
`);
}

// === 文件操作 ===
function hashFile(fp) { try { return crypto.createHash('md5').update(fs.readFileSync(fp)).digest('hex'); } catch { return null; } }

function walkDir(dir, ignoreOverlay = true) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  function r(d, base = '') {
    const items = fs.readdirSync(d);
    for (const item of items) {
      if (CONFIG.ignore.some(ig => { if (ig.includes('*')) return new RegExp('^' + ig.replace(/\*/g, '.*') + '$').test(item); return item === ig; })) continue;
      if (ignoreOverlay && item === '.overlay') continue; // 推送时排除 overlay 目录本身
      const full = path.join(d, item), rp = base ? path.join(base, item) : item;
      if (fs.statSync(full).isDirectory()) r(full, rp);
      else files.push({ rp, fp: full, size: fs.statSync(full).size, mtime: fs.statSync(full).mtimeMs, hash: hashFile(full) });
    }
  }
  r(dir);
  return files;
}

function walkOverlay(skillDir, platform) {
  const overlayDir = path.join(skillDir, '.overlay', platform);
  if (!fs.existsSync(overlayDir)) return [];
  const files = [];
  function r(d, base = '') {
    for (const item of fs.readdirSync(d)) {
      const full = path.join(d, item), rp = base ? path.join(base, item) : item;
      if (fs.statSync(full).isDirectory()) r(full, rp);
      else files.push({ rp, fp: full, size: fs.statSync(full).size, mtime: fs.statSync(full).mtimeMs, hash: hashFile(full) });
    }
  }
  r(overlayDir);
  return files;
}

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }

function copyFile(src, dst) {
  ensureDir(path.dirname(dst));
  try { fs.copyFileSync(src, dst); return true; } catch(e) { console.error(c(`  ✗ 复制失败: ${dst}`, 'red')); return false; }
}

function backup(dir, name) {
  if (!fs.existsSync(dir)) return null;
  const bp = path.join(CONFIG.backupDir, name, Date.now().toString());
  ensureDir(bp);
  for (const f of walkDir(dir, false)) copyFile(f.fp, path.join(bp, f.rp));
  console.log(c(`  ℹ 已备份到: ${bp}`, 'blue'));
  return bp;
}

// === 比较 ===
function compareDirs(sourceFiles, targetFiles) {
  const srcMap = new Map(sourceFiles.map(f => [f.rp, f]));
  const tgtMap = new Map(targetFiles.map(f => [f.rp, f]));
  const result = { onlySource: [], onlyTarget: [], newer: [], older: [], same: [], conflict: [] };

  for (const [rp, sf] of srcMap) {
    const tf = tgtMap.get(rp);
    if (!tf) { result.onlySource.push(sf); continue; }
    if (sf.hash === tf.hash) { result.same.push(sf); continue; }
    // 两边不同：比较 mtime
    if (sf.mtime > tf.mtime) result.newer.push({ rp, source: sf, target: tf, direction: 'source→target' });
    else if (tf.mtime > sf.mtime) result.newer.push({ rp, source: sf, target: tf, direction: 'target→source' });
    else result.conflict.push({ rp, source: sf, target: tf, direction: 'conflict' });
  }
  for (const [rp, tf] of tgtMap) { if (!srcMap.has(rp)) result.onlyTarget.push(tf); }
  return result;
}

// === 同步操作 ===
function syncFiles(files, fromDir, toDir, opts, label = '') {
  let count = 0;
  for (const f of files) {
    const dst = path.join(toDir, f.rp);
    if (opts.dryRun) { console.log(c(`  [DRY RUN] ${label}: ${f.rp}`, 'yellow')); count++; continue; }
    if (copyFile(f.fp, dst)) { count++; if (opts.verbose) console.log(c(`  ✓ ${label}: ${f.rp}`, 'green')); }
  }
  return count;
}

function deleteFiles(files, targetDir, opts) {
  let count = 0;
  for (const f of files) {
    const fp = path.join(targetDir, f.rp);
    if (!fs.existsSync(fp)) continue;
    if (opts.dryRun) { console.log(c(`  [DRY RUN] 删除: ${f.rp}`, 'yellow')); count++; continue; }
    try { fs.unlinkSync(fp); count++; if (opts.verbose) console.log(c(`  ✗ 删除: ${f.rp}`, 'red')); } catch(e) {}
  }
  return count;
}

// === 显示比较结果 ===
function printComparison(result, sourceLabel, targetLabel) {
  const total = result.onlySource.length + result.onlyTarget.length + result.newer.length + result.conflict.length;
  console.log(c(`\n  ${sourceLabel}: ${result.same.length + result.onlySource.length + result.newer.length + result.conflict.length} 个`, 'reset'));
  console.log(c(`  ${targetLabel}: ${result.same.length + result.onlyTarget.length + result.newer.length + result.conflict.length} 个`, 'reset'));
  console.log(c(`  相同: ${result.same.length}`, 'reset'));
  if (result.newer.length > 0) {
    console.log(c(`  内容不同: ${result.newer.length}`, 'yellow'));
    for (const d of result.newer) {
      const dir = d.direction === 'source→target' ? `${sourceLabel}→${targetLabel}` : `${targetLabel}→${sourceLabel}`;
      console.log(c(`    ${d.rp} (${dir}, 大 ${Math.abs(d.source.size - d.target.size)}b)`, 'yellow'));
    }
  }
  if (result.onlySource.length > 0) console.log(c(`  仅 ${sourceLabel}: ${result.onlySource.length}`, 'cyan'));
  if (result.onlyTarget.length > 0) console.log(c(`  仅 ${targetLabel}: ${result.onlyTarget.length}`, 'cyan'));
  if (result.conflict.length > 0) {
    console.log(c(`  ⚠ 冲突（两边同时修改）: ${result.conflict.length}`, 'red'));
    for (const d of result.conflict) console.log(c(`    ${d.rp}`, 'red'));
  }
  return total;
}

// === 交互式选择 ===
function askUser(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim().toLowerCase()); }));
}

// === 获取 overlay 文件 map ===
function getOverlayMap(skillDir, platform) {
  const ovFiles = walkOverlay(skillDir, platform);
  return new Map(ovFiles.map(f => [f.rp, f]));
}

// === 推送单个技能到目标平台 ===
function pushSkillToPlatform(skillDir, skillName, targetDir, platform, opts) {
  // 1. 收集基础层文件
  const baseFiles = walkDir(skillDir, true);  // 排除 .overlay/
  // 2. 收集 overlay 层文件
  const overlayMap = getOverlayMap(skillDir, platform);
  // 3. 融合：基础层 + overlay 覆盖
  const merged = new Map();
  for (const f of baseFiles) merged.set(f.rp, f);
  for (const [rp, f] of overlayMap) merged.set(rp, f); // overlay 覆盖同名文件

  const skillTargetDir = path.join(targetDir, skillName);

  // 4. 写入目标
  let written = 0;
  for (const [rp, f] of merged) {
    const dst = path.join(skillTargetDir, rp);
    if (opts.dryRun) {
      if (opts.verbose) console.log(c(`  [DRY RUN] overlay融合: ${skillName}/${rp}`, 'yellow'));
      written++; continue;
    }
    if (copyFile(f.fp, dst)) { written++; if (opts.verbose) console.log(c(`  ✓ overlay: ${skillName}/${rp}`, 'green')); }
  }

  // 5. 清理目标中多余文件
  const existingTarget = walkDir(skillTargetDir, false);
  for (const f of existingTarget) {
    if (!merged.has(f.rp)) {
      if (opts.dryRun) { console.log(c(`  [DRY RUN] 清理孤立: ${skillName}/${f.rp}`, 'yellow')); continue; }
      try { fs.unlinkSync(f.fp); if (opts.verbose) console.log(c(`  ✗ 清理: ${skillName}/${f.rp}`, 'red')); } catch(e) {}
    }
  }
  return written;
}

// === 主推送逻辑（支持 overlay） ===
function pushMode(opts) {
  console.log(c(`\n📤 推送模式: skills/ → 目标平台`, 'cyan'));

  const skillNames = fs.readdirSync(CONFIG.sourceDir).filter(n => {
    const fp = path.join(CONFIG.sourceDir, n);
    return fs.statSync(fp).isDirectory() && !n.startsWith('.');
  });

  const platforms = opts.target ? [opts.target] : Object.keys(CONFIG.targets);
  for (const platform of platforms) {
    const targetDir = CONFIG.targets[platform];
    if (!targetDir) { console.log(c(`  ✗ 未知平台: ${platform}`, 'red')); continue; }
    if (opts.backup && fs.existsSync(targetDir)) backup(targetDir, platform);

    console.log(c(`\n→ 推送到 ${platform} (${targetDir})`, 'cyan'));
    let total = 0;
    for (const skillName of skillNames) {
      const skillDir = path.join(CONFIG.sourceDir, skillName);
      // 检查是否有 overlay
      const overlayDir = path.join(skillDir, '.overlay', platform);
      const hasOverlay = fs.existsSync(overlayDir);
      const label = hasOverlay ? c('overlay融合', 'magenta') : '直接复制';
      if (opts.verbose || hasOverlay) console.log(c(`  ${label}: ${skillName}`, hasOverlay ? 'magenta' : 'reset'));
      total += pushSkillToPlatform(skillDir, skillName, targetDir, platform, opts);
    }
    console.log(c(`  ✓ ${platform}: 已写入 ${total} 个文件`, 'green'));
  }
  console.log(c(`\n✓ 推送完成`, 'green'));
}

// === 拉取模式：.claude → skills ===
function pullMode(opts) {
  const platform = opts.target || 'claude';
  const targetDir = CONFIG.targets[platform];
  if (!targetDir || !fs.existsSync(targetDir)) { console.log(c(`  ✗ 平台 ${platform} 不存在`, 'red')); return; }

  console.log(c(`\n📥 拉取模式: ${platform}/ → skills/`, 'cyan'));
  if (opts.backup && fs.existsSync(CONFIG.sourceDir)) backup(CONFIG.sourceDir, 'skills');

  const skillNames = fs.readdirSync(targetDir).filter(n => {
    const fp = path.join(targetDir, n);
    return fs.statSync(fp).isDirectory() && !n.startsWith('.');
  });

  let total = 0;
  for (const skillName of skillNames) {
    const srcSkillDir = path.join(targetDir, skillName);
    const dstSkillDir = path.join(CONFIG.sourceDir, skillName);
    const srcFiles = walkDir(srcSkillDir, false);
    const dstFiles = walkDir(dstSkillDir, false);
    const result = compareDirs(srcFiles, dstFiles);

    const toSync = [...result.onlySource, ...result.newer.filter(d => d.direction === 'target→source').map(d => d.target)];
    const toDelete = result.onlyTarget; // skills 中多余的

    if (toSync.length === 0 && toDelete.length === 0) {
      if (opts.verbose) console.log(c(`  ${skillName}: 已同步`, 'reset'));
      continue;
    }

    console.log(c(`\n  ${skillName}:`, 'cyan'));
    printComparison(result, platform, 'skills');

    total += syncFiles(toSync, srcSkillDir, dstSkillDir, opts, '拉取');
    total += deleteFiles(toDelete, dstSkillDir, opts);
  }
  console.log(c(`\n✓ 拉取完成: ${total} 个文件`, 'green'));
}

// === 合并模式：自动双向 ===
function mergeMode(opts) {
  console.log(c(`\n🔀 双向合并模式`, 'cyan'));
  if (opts.backup) {
    if (fs.existsSync(CONFIG.sourceDir)) backup(CONFIG.sourceDir, 'skills');
    for (const [p, d] of Object.entries(CONFIG.targets)) { if (fs.existsSync(d)) backup(d, p); }
  }

  let total = 0;
  const allSkillNames = new Set();
  if (fs.existsSync(CONFIG.sourceDir)) fs.readdirSync(CONFIG.sourceDir).filter(n => fs.statSync(path.join(CONFIG.sourceDir, n)).isDirectory() && !n.startsWith('.')).forEach(n => allSkillNames.add(n));

  const platforms = opts.target ? [opts.target] : Object.keys(CONFIG.targets);
  for (const platform of platforms) {
    const td = CONFIG.targets[platform];
    if (td && fs.existsSync(td)) fs.readdirSync(td).filter(n => fs.statSync(path.join(td, n)).isDirectory() && !n.startsWith('.')).forEach(n => allSkillNames.add(n));
  }

  for (const skillName of [...allSkillNames].sort()) {
    const srcDir = path.join(CONFIG.sourceDir, skillName);
    const srcFiles = walkDir(srcDir, false);

    for (const platform of platforms) {
      const td = CONFIG.targets[platform];
      if (!td) continue;
      const tgtDir = path.join(td, skillName);
      const tgtFiles = walkDir(tgtDir, false);
      const result = compareDirs(srcFiles, tgtFiles);

      const changes = result.onlySource.length + result.onlyTarget.length + result.newer.length + result.conflict.length;
      if (changes === 0) continue;

      console.log(c(`\n  ${skillName} (${platform}):`, 'cyan'));
      printComparison(result, 'skills', platform);

      // 自动处理
      // 仅 source 有的 → 复制到 target
      total += syncFiles(result.onlySource, srcDir, tgtDir, opts, 'skills→' + platform);
      // 仅 target 有的 → 复制到 source
      total += syncFiles(result.onlyTarget, tgtDir, srcDir, opts, platform + '→skills');
      // newer source→target
      total += syncFiles(result.newer.filter(d => d.direction === 'source→target').map(d => d.source), srcDir, tgtDir, opts, 'skills→' + platform);
      // newer target→source
      total += syncFiles(result.newer.filter(d => d.direction === 'target→source').map(d => d.target), tgtDir, srcDir, opts, platform + '→skills');
      // 冲突：两边都修改 → 保留更新的（mtime 比较）
      for (const d of result.conflict) {
        if (d.source.mtime >= d.target.mtime) {
          console.log(c(`    ⚠ 冲突（取 skills 更新版）: ${d.rp}`, 'red'));
          total += syncFiles([d.source], srcDir, tgtDir, opts, '冲突→skills优先');
        } else {
          console.log(c(`    ⚠ 冲突（取 ${platform} 更新版）: ${d.rp}`, 'red'));
          total += syncFiles([d.target], tgtDir, srcDir, opts, '冲突→' + platform + '优先');
        }
      }
    }
  }
  console.log(c(`\n✓ 合并完成: ${total} 个文件`, 'green'));
}

// === 交互模式 ===
async function interactiveMode(opts) {
  console.log(c(`\n🖐 交互模式`, 'cyan'));
  if (opts.backup) {
    if (fs.existsSync(CONFIG.sourceDir)) backup(CONFIG.sourceDir, 'skills');
    for (const [p, d] of Object.entries(CONFIG.targets)) { if (fs.existsSync(d)) backup(d, p); }
  }

  const platform = opts.target || 'claude';
  const td = CONFIG.targets[platform];
  if (!td) { console.log(c(`  ✗ 未知平台: ${platform}`, 'red')); return; }

  const allSkillNames = new Set();
  if (fs.existsSync(CONFIG.sourceDir)) fs.readdirSync(CONFIG.sourceDir).filter(n => fs.statSync(path.join(CONFIG.sourceDir, n)).isDirectory() && !n.startsWith('.')).forEach(n => allSkillNames.add(n));
  if (fs.existsSync(td)) fs.readdirSync(td).filter(n => fs.statSync(path.join(td, n)).isDirectory() && !n.startsWith('.')).forEach(n => allSkillNames.add(n));

  for (const skillName of [...allSkillNames].sort()) {
    const srcDir = path.join(CONFIG.sourceDir, skillName);
    const tgtDir = path.join(td, skillName);
    const srcFiles = walkDir(srcDir, false);
    const tgtFiles = walkDir(tgtDir, false);
    const result = compareDirs(srcFiles, tgtFiles);

    const changes = result.onlySource.length + result.onlyTarget.length + result.newer.length + result.conflict.length;
    if (changes === 0) continue;

    console.log(c(`\n  ${skillName} (${platform}):`, 'cyan'));
    printComparison(result, 'skills', platform);

    if (result.conflict.length > 0) {
      for (const d of result.conflict) {
        const ans = await askUser(c(`    冲突文件 ${d.rp}：以哪边为准？ [S]kills / [C]laude / [Q]uit？ `, 'red'));
        if (ans === 's') syncFiles([d.source], srcDir, tgtDir, opts, '冲突→skills优先');
        else if (ans === 'c') syncFiles([d.target], tgtDir, srcDir, opts, '冲突→claude优先');
        else if (ans === 'q') { console.log(c('  取消', 'yellow')); return; }
      }
    }

    if (result.newer.length > 0) {
      const ans = await askUser(c(`    ${result.newer.length} 个文件不同, 自动以新版本合并？ [Y]es / [N]o / [S]kip？ `, 'yellow'));
      if (ans === 'y' || ans === '') {
        for (const d of result.newer) {
          if (d.direction === 'source→target') syncFiles([d.source], srcDir, tgtDir, opts);
          else syncFiles([d.target], tgtDir, srcDir, opts);
        }
      } else if (ans === 's') continue;
    }
  }
  console.log(c(`\n✓ 交互同步完成`, 'green'));
}

// === 主函数 ===
async function main() {
  const opts = parseArgs();

  console.log(c('all-in-mvp 技能双向同步脚本 v2', 'cyan'));
  console.log(c('========================\n', 'cyan'));

  if (!fs.existsSync(CONFIG.sourceDir)) {
    console.log(c(`✗ 源目录不存在: ${CONFIG.sourceDir}`, 'red'));
    process.exit(1);
  }

  switch (opts.mode) {
    case 'push':        pushMode(opts); break;
    case 'pull':        pullMode(opts); break;
    case 'merge':       mergeMode(opts); break;
    case 'interactive': await interactiveMode(opts); break;
    default:
      console.log(c(`✗ 未知模式: ${opts.mode}`, 'red'));
      showHelp();
      process.exit(1);
  }

  console.log(c('========================', 'cyan'));
  console.log(c('✓ 完成！', 'green'));
}

main().catch(e => { console.error(c(e.message, 'red')); process.exit(1); });

