#!/usr/bin/env node

/**
 * setup-hooks.js — 安装 Git hooks
 *
 * 将 scripts/pre-push 复制到 .git/hooks/pre-push
 * npm install 或 npm run prepare 时自动执行
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HOOK_SRC = path.join(ROOT, 'scripts', 'pre-push');
const HOOK_DST = path.join(ROOT, '.git', 'hooks', 'pre-push');

if (!fs.existsSync(HOOK_SRC)) {
    console.log('⚠️  pre-push hook 源文件不存在，跳过安装');
    process.exit(0);
}

if (!fs.existsSync(path.join(ROOT, '.git'))) {
    // 不是 git 仓库（如 giget 拉取的模板），跳过
    console.log('ℹ️  非 Git 仓库环境，跳过 hook 安装');
    process.exit(0);
}

try {
    fs.copyFileSync(HOOK_SRC, HOOK_DST);

    // 设置可执行权限（Unix）
    try { fs.chmodSync(HOOK_DST, 0o755); } catch {}

    console.log('✅ Git pre-push hook 已安装：推库前自动同步技能到平台目录');
} catch (e) {
    console.error('❌ 安装 pre-push hook 失败:', e.message);
    process.exit(1);
}
