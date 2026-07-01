#!/usr/bin/env node
/**
 * prefix-validator.cjs — 共享前缀一致性校验器 (UltraCostEffective L2)
 *
 * 扫描所有技能/规则文件，验证 SHARED PREFIX START 到 SHARED PREFIX END
 * 之间的内容是否在所有文件中逐字一致。
 *
 * 用法:
 *   node prefix-validator.cjs --check-all   # 扫描并校验
 *   node prefix-validator.cjs --fix         # 自动修复不一致
 *   node prefix-validator.cjs --report      # 生成校验报告
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PREFIX_START = '### SHARED PREFIX START [ultra-cost-effective-l2-cache-v1]';
const PREFIX_END   = '### SHARED PREFIX END';

// ─── 扫描文件 ──────────────────────────────────

function findMdFiles(dir, recursive = true) {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(fullPath);
      } else if (recursive && entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        results.push(...findMdFiles(fullPath, true));
      }
    }
  } catch {}
  return results;
}

// ─── 提取前缀 ──────────────────────────────────

function extractPrefix(content) {
  const startIdx = content.indexOf(PREFIX_START);
  if (startIdx === -1) return null;

  const endIdx = content.indexOf(PREFIX_END, startIdx);
  if (endIdx === -1) return null;

  return content.substring(startIdx, endIdx + PREFIX_END.length);
}

// ─── 主逻辑 ────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const root = path.resolve(__dirname, '..');

  console.log('═══ UltraCostEffective 前缀一致性校验 ═══\n');
  console.log(`扫描目录: ${root}\n`);

  // 扫描文件
  const mdFiles = findMdFiles(root);
  const filesWithPrefix = [];
  const filesWithoutPrefix = [];

  for (const file of mdFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const prefix = extractPrefix(content);
      if (prefix) {
        filesWithPrefix.push({ path: file, prefix });
      } else {
        filesWithoutPrefix.push(file);
      }
    } catch (e) {
      console.error(`  读取失败: ${file} — ${e.message}`);
    }
  }

  // 分析
  console.log(`包含前缀的文件: ${filesWithPrefix.length}`);
  console.log(`不含前缀的文件: ${filesWithoutPrefix.length}\n`);

  if (filesWithPrefix.length === 0) {
    console.log('⚠️  未找到任何包含 SHARED PREFIX 的文件。');
    console.log('   请确保在技能文件中添加共享前缀模板。');
    console.log('   参考: rules/shared-prefix.md');
    return;
  }

  // 以第一个文件的前缀为基准
  const baseline = filesWithPrefix[0].prefix;
  const baselineLen = baseline.length;
  let allConsistent = true;

  console.log(`基准前缀文件: ${path.relative(root, filesWithPrefix[0].path)}`);
  console.log(`基准前缀长度: ${baselineLen} 字符 (~${Math.ceil(baselineLen / 3.5)} tokens)\n`);

  const inconsistencies = [];

  for (let i = 1; i < filesWithPrefix.length; i++) {
    const file = filesWithPrefix[i];
    if (file.prefix !== baseline) {
      allConsistent = false;
      const relPath = path.relative(root, file.path);

      // 找出差异位置
      let diffPos = 0;
      while (diffPos < file.prefix.length && diffPos < baseline.length &&
             file.prefix[diffPos] === baseline[diffPos]) {
        diffPos++;
      }

      inconsistencies.push({
        file: relPath,
        diffPos,
        expected: baseline.substring(Math.max(0, diffPos - 20), diffPos + 20),
        actual: file.prefix.substring(Math.max(0, diffPos - 20), Math.min(file.prefix.length, diffPos + 20))
      });
    }
  }

  // 输出结果
  if (allConsistent) {
    console.log('✅ 所有文件前缀一致！KV Cache 就绪。');
    console.log(`   ${filesWithPrefix.length} 个文件共享相同前缀`);
    console.log(`   预计缓存命中率: > 90%`);
    console.log(`   预计成本节省: ¥3.0 → ¥0.025 / M tokens (DeepSeek Pro)`);

    // 建议
    if (baselineLen < 200) {
      console.log('\n💡 建议: 前缀长度 < 200 字符，可考虑扩展以获得更高缓存收益。');
    } else if (baselineLen > 500) {
      console.log('\n💡 建议: 前缀长度 > 500 字符，可能影响灵活性。');
    }

    if (filesWithoutPrefix.length > 0) {
      console.log(`\n📋 以下 ${filesWithoutPrefix.length} 个文件没有前缀，建议添加:\n`);
      for (const f of filesWithoutPrefix) {
        console.log(`  - ${path.relative(root, f)}`);
      }
    }
  } else {
    console.log('❌ 前缀不一致！KV Cache 收益将大打折扣。\n');
    console.log(`发现 ${inconsistencies.length} 个不一致:\n`);

    for (const inc of inconsistencies) {
      console.log(`📄 ${inc.file}`);
      console.log(`   差异位置: 第 ${inc.diffPos} 字符`);
      console.log(`   基准: ...${inc.expected.substring(0, 40)}...`);
      console.log(`   当前: ...${inc.actual.substring(0, 40)}...\n`);
    }

    console.log('修复建议:');
    console.log('  1. 以 rules/shared-prefix.md 为基准');
    console.log('  2. 手动对齐不一致的文件');
    console.log('  3. 重新运行 node prefix-validator.cjs --check-all');

    if (args.includes('--fix')) {
      console.log('\n🔧 自动修复中...');
      for (const file of filesWithPrefix) {
        try {
          let content = fs.readFileSync(file.path, 'utf-8');
          const oldPrefix = extractPrefix(content);
          if (oldPrefix && oldPrefix !== baseline) {
            content = content.replace(oldPrefix, baseline);
            fs.writeFileSync(file.path, content, 'utf-8');
            console.log(`  ✓ 修复: ${path.relative(root, file.path)}`);
          }
        } catch (e) {
          console.error(`  ✗ 失败: ${path.relative(root, file.path)} — ${e.message}`);
        }
      }
    }
  }

  // 生成报告
  if (args.includes('--report')) {
    const reportPath = path.join(root, 'prefix-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      baselineLength: baselineLen,
      baselineTokens: Math.ceil(baselineLen / 3.5),
      filesWithPrefix: filesWithPrefix.map(f => path.relative(root, f.path)),
      filesWithoutPrefix: filesWithoutPrefix.map(f => path.relative(root, f)),
      consistent: allConsistent,
      inconsistencies: inconsistencies.map(i => ({ ...i, expected: undefined, actual: undefined }))
    };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📊 报告已保存: ${reportPath}`);
  }
}

// ─── 运行 ──────────────────────────────────────

if (require.main === module) {
  main();
}

module.exports = { findMdFiles, extractPrefix };
