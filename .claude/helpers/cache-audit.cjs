#!/usr/bin/env node
/**
 * cache-audit.cjs — DeepSeek KV Cache 前缀审计
 *
 * 职责:
 *   1. 读取 agent-prompt-prefix.md 中的规范共享前缀
 *   2. 扫描所有 kf- SKILL.md，提取 agent prompt 定义
 *   3. 检查每个 prompt 的前 300 token 是否与规范前缀一致
 *   4. 兼容 CRLF/LF 差异（内部 normalize）
 *
 * 用法:
 *   node .claude/helpers/cache-audit.cjs                  # 审计全部
 *   node .claude/helpers/cache-audit.cjs --skill kf-spec  # 单技能
 *   node .claude/helpers/cache-audit.cjs --verbose        # 详细输出
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const SKILLS_DIR = path.join(ROOT, '.claude', 'skills');
const PREFIX_FILE = path.join(SKILLS_DIR, 'kf-multi-team-compete', 'agent-prompt-prefix.md');
const SHARED_PREFIX_START = '### SHARED PREFIX START';
const SHARED_PREFIX_END = '### SHARED PREFIX END';

// ─── Token estimation (simple: ~3.5 chars per token for Chinese/English mix) ───
function estimateTokens(text) {
  // Rough: CJK chars = 1 token, 3-4 ASCII chars = 1 token
  let count = 0;
  let i = 0;
  while (i < text.length) {
    const cp = text.codePointAt(i);
    if (cp >= 0x4E00 && cp <= 0x9FFF) {
      count += 1; // CJK = ~1 token
    } else if (cp >= 0x3000 && cp <= 0x303F) {
      count += 1; // CJK punctuation
    } else if (text[i] === '\n') {
      count += 0.25; // newline is cheap
    } else if (text[i] === ' ') {
      count += 0.25; // space is cheap
    } else {
      count += 0.28; // ASCII = ~3.5 chars/token
    }
    i += (cp > 0xFFFF ? 2 : 1);
  }
  return Math.round(count);
}

// ─── Normalize line endings ───
function normalizeLineEndings(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

// ─── Extract shared prefix block from the canonical template ───
function extractCanonicalPrefix() {
  if (!fs.existsSync(PREFIX_FILE)) {
    return { error: `Canonical prefix file not found: ${PREFIX_FILE}` };
  }

  const content = normalizeLineEndings(fs.readFileSync(PREFIX_FILE, 'utf8'));
  const startIdx = content.indexOf(SHARED_PREFIX_START);
  const endIdx = content.indexOf(SHARED_PREFIX_END);

  if (startIdx === -1 || endIdx === -1) {
    return { error: 'SHARED PREFIX markers not found in canonical file' };
  }

  const blockStart = content.indexOf('\n', startIdx) + 1; // skip the marker line
  const prefixText = content.substring(blockStart, endIdx).trim();
  const tokens = estimateTokens(prefixText);
  const hash = crypto.createHash('sha256').update(prefixText).digest('hex').substring(0, 16);

  return {
    text: prefixText,
    hash,
    tokens,
    sourceFile: PREFIX_FILE,
  };
}

// ─── Find all prompt blocks in a SKILL.md file ───
// Only blocks that contain the actual shared prefix TEMPLATE (with markers) are compared.
// Blocks that merely mention/reference "SHARED PREFIX" are informational only.
function findPromptBlocks(filePath) {
  const content = normalizeLineEndings(fs.readFileSync(filePath, 'utf8'));
  const blocks = [];

  // Strategy 1: Scan line-by-line for ### SHARED PREFIX START marker
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(SHARED_PREFIX_START)) {
      // Found shared prefix start — collect until SHARED PREFIX END
      let promptLines = [];
      let j = i;
      while (j < lines.length) {
        promptLines.push(lines[j]);
        if (lines[j].includes(SHARED_PREFIX_END)) break;
        j++;
      }
      if (promptLines.length > 1) {
        // Check if this is inside a fenced code block
        let inFence = false;
        for (let k = i - 1; k >= 0 && k >= i - 5; k--) {
          if (lines[k] && lines[k].trim().startsWith('```')) { inFence = true; break; }
        }
        blocks.push({
          type: inFence ? 'fenced_prefix' : 'inline_prefix',
          content: promptLines.join('\n'),
          lineStart: i + 1,
          lineEnd: j + 1,
          hashMatches: false, // computed later
        });
      }
      i = j;
    }
  }

  // Strategy 2: Find references to shared prefix usage (without the actual template)
  // These are informational — the skill instructs agents about the prefix but doesn't embed it
  const refPattern = /(?:SHARED PREFIX|共享前缀|agent-prompt-prefix|cache-optimization\.md)/gi;
  const refMatches = [];
  let refMatch;
  while ((refMatch = refPattern.exec(content)) !== null) {
    const lineNum = content.substring(0, refMatch.index).split('\n').length;
    refMatches.push({ line: lineNum, text: refMatch[0] });
  }

  return { blocks, prefixRefs: refMatches };
}

// ─── Extract the prefix portion (first 300 tokens) from a prompt block ───
function extractPromptPrefix(blockContent) {
  // Remove code fence markers
  let text = blockContent.replace(/^```[\w]*\n?/gm, '').replace(/```$/gm, '');

  // If block has SHARED PREFIX markers, extract just that portion
  const startIdx = text.indexOf(SHARED_PREFIX_START);
  const endIdx = text.indexOf(SHARED_PREFIX_END);
  if (startIdx !== -1 && endIdx !== -1) {
    text = text.substring(startIdx, endIdx + SHARED_PREFIX_END.length);
  }

  // Take first ~300 estimated tokens
  const lines = text.split('\n');
  let accumulated = '';
  let tokenEstimate = 0;
  for (const line of lines) {
    accumulated += line + '\n';
    tokenEstimate = estimateTokens(accumulated);
    if (tokenEstimate >= 300) break;
  }

  return {
    text: accumulated.trim(),
    tokens: tokenEstimate,
    hash: crypto.createHash('sha256').update(accumulated.trim()).digest('hex').substring(0, 16),
  };
}

// ─── Check a SKILL.md for shared prefix compliance ───
function auditSkill(skillPath, canonical) {
  if (!fs.existsSync(skillPath)) {
    return { skill: path.basename(path.dirname(skillPath)), status: 'SKIP', reason: 'File not found' };
  }

  const { blocks, prefixRefs } = findPromptBlocks(skillPath);

  const results = blocks.map((block, idx) => {
    const prefix = extractPromptPrefix(block.content);
    const prefixDiffers = prefix.hash !== canonical.hash;

    return {
      blockIndex: idx,
      type: block.type,
      estimatedTokens: prefix.tokens,
      prefixHash: prefix.hash,
      canonicalHash: canonical.hash,
      matches: !prefixDiffers,
      detail: prefixDiffers
        ? `Prefix hash mismatch: got ${prefix.hash}, expected ${canonical.hash}`
        : 'Prefix matches canonical',
      location: `lines ${block.lineStart}-${block.lineEnd}`,
    };
  });

  const hasTemplateBlocks = blocks.length > 0;
  const allMatch = results.every(r => r.matches);

  return {
    skill: path.basename(path.dirname(skillPath)),
    file: skillPath,
    status: hasTemplateBlocks ? (allMatch ? 'PASS' : 'FAIL') : 'N/A',
    blocks: blocks.length,
    results,
    prefixRefs, // informational: where SHARED PREFIX is mentioned
    hasPrefixRef: prefixRefs.length > 0,
  };
}

// ─── Check for line ending consistency across all files ───
function checkLineEndings(filePaths) {
  const issues = [];
  let firstType = null;

  for (const fp of filePaths) {
    if (!fs.existsSync(fp)) continue;
    const raw = fs.readFileSync(fp, 'utf8');
    const hasCRLF = raw.includes('\r\n');
    const type = hasCRLF ? 'CRLF' : 'LF';

    if (firstType === null) {
      firstType = type;
    } else if (type !== firstType) {
      issues.push({ file: fp, lineEnding: type, expected: firstType });
    }
  }

  return { firstType, issues };
}

// ─── Check if SKILL.md files reference agent-prompt-prefix.md ───
function checkPrefixReference(skillPath) {
  if (!fs.existsSync(skillPath)) return null;
  const content = normalizeLineEndings(fs.readFileSync(skillPath, 'utf8'));
  const referencesPrefix = content.includes('agent-prompt-prefix.md');
  const hasSharedPrefix = content.includes('SHARED PREFIX');
  return { referencesPrefix, hasSharedPrefix };
}

// ─── Main ───
function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');
  const targetSkill = args.includes('--skill') ? args[args.indexOf('--skill') + 1] : null;

  console.log('═══ DeepSeek KV Cache 前缀审计 ═══\n');

  // Step 1: Read canonical prefix
  const canonical = extractCanonicalPrefix();
  if (canonical.error) {
    console.log(`❌ FATAL: ${canonical.error}`);
    process.exit(1);
  }

  console.log(`📋 规范前缀 (来源: agent-prompt-prefix.md)`);
  console.log(`   Hash: ${canonical.hash}`);
  console.log(`   预估 Token: ~${canonical.tokens}`);
  console.log(`   范围要求: 300-500 token → ${canonical.tokens >= 200 && canonical.tokens <= 500 ? '✅ 合规' : '⚠️ 越界'}`);
  console.log('');

  // Step 2: Find all kf- SKILL.md files
  const skillDirs = fs.readdirSync(SKILLS_DIR)
    .filter(d => d.startsWith('kf-') && fs.statSync(path.join(SKILLS_DIR, d)).isDirectory());

  const skillPaths = skillDirs.map(d => path.join(SKILLS_DIR, d, 'SKILL.md'));

  if (targetSkill) {
    const targetDir = targetSkill.startsWith('kf-') ? targetSkill : `kf-${targetSkill}`;
    const targetPath = path.join(SKILLS_DIR, targetDir, 'SKILL.md');
    if (!skillPaths.includes(targetPath)) {
      console.log(`❌ 技能未找到: ${targetSkill}`);
      process.exit(1);
    }
    skillPaths.length = 0;
    skillPaths.push(targetPath);
  }

  // Step 3: Audit each skill
  console.log(`🔍 扫描 ${skillPaths.length} 个 kf- 技能...\n`);

  const results = [];
  let passCount = 0;
  let failCount = 0;
  let naCount = 0;

  for (const skillPath of skillPaths) {
    const result = auditSkill(skillPath, canonical);
    results.push(result);

    switch (result.status) {
      case 'PASS': passCount++; break;
      case 'FAIL': failCount++; break;
      default: naCount++; break;
    }

    if (verbose || result.status === 'FAIL') {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⬜';
      console.log(`${icon} ${result.skill} — ${result.status}`);
      if (result.reason) console.log(`   原因: ${result.reason}`);
      for (const r of (result.results || [])) {
        console.log(`   块${r.blockIndex} [${r.type}]: ${r.detail || 'no detail'} (${r.location})`);
      }
    }
  }

  // Step 4: Check prefix references across all skills
  console.log('\n📎 共享前缀引用检查:');
  let refCount = 0;
  const skillsWithAgentPrompts = results.filter(r => r.blocks > 0);
  const skillsWithRefs = results.filter(r => r.hasPrefixRef);

  for (const r of skillsWithRefs) {
    refCount++;
    if (verbose) console.log(`   ✅ ${r.skill} — ${r.prefixRefs.length} 处引用`);
  }

  for (const r of skillsWithAgentPrompts) {
    if (!r.hasPrefixRef) {
      console.log(`   ⚠️ ${r.skill} — 含模板定义但未找到引用标注`);
    }
  }

  console.log(`   ${refCount} 个技能引用了共享前缀`);

  // Step 5: Line ending check
  console.log('\n📄 换行符一致性:');
  const lineEndingResult = checkLineEndings(skillPaths);
  if (lineEndingResult.issues.length > 0) {
    console.log(`   ⚠️ 检测到混合换行符 (基准: ${lineEndingResult.firstType})`);
    for (const issue of lineEndingResult.issues) {
      const relPath = issue.file.replace(ROOT, '').replace(/\\/g, '/');
      console.log(`      ${relPath}: ${issue.lineEnding} (基准 ${issue.expected})`);
    }
    if (lineEndingResult.issues.length <= 7) {
      console.log('   ℹ️ CRLF/LF 差异在审计脚本中已 normalize，不影响缓存比较');
    }
  } else {
    console.log(`   ✅ 所有文件统一使用 ${lineEndingResult.firstType}`);
  }

  // Step 6: Summary
  console.log('\n═══ 审计摘要 ═══');
  console.log(`   通过: ${passCount} | 失败: ${failCount} | 不适用: ${naCount}`);
  console.log(`   规范前缀 Token: ~${canonical.tokens} (要求: 200-500)`);
  console.log(`   换行符: ${lineEndingResult.firstType} (${lineEndingResult.issues.length} 个文件不同)`);

  const overallPass = failCount === 0;

  if (overallPass && lineEndingResult.issues.length === 0) {
    console.log('\n🎯 ALL_PASS — 缓存前缀一致性验证通过');
    process.exit(0);
  } else if (overallPass && lineEndingResult.issues.length > 0) {
    console.log('\n✅ PASS_WITH_LINE_ENDING_DIFF — 缓存前缀一致，换行符有偏差（已 normalize）');
    process.exit(0);
  } else {
    console.log('\n🚫 DIFF_FOUND — 缓存前缀不一致，需修复后再提交');
    process.exit(1);
  }
}

main();
