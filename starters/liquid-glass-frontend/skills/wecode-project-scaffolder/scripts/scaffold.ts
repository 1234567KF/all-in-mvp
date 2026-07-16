import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { allocatePort } from './lib/port-allocator';

// Helper function to read templates and substitute placeholders
function readTemplate(relativePath: string, replacements?: Record<string, string>): string {
  const templatesDir = path.resolve(import.meta.dir, '..', 'templates');
  const fullPath = path.join(templatesDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`Template not found: ${fullPath}`);
    process.exit(1);
  }
  let content = fs.readFileSync(fullPath, 'utf8');
  if (replacements) {
    for (const [key, val] of Object.entries(replacements)) {
      content = content.replaceAll(`{{${key}}}`, val);
    }
  }
  return content;
}

// Simple argument parser
const args = Bun.argv.slice(2);
const params: Record<string, string> = {};
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--')) {
    const next = args[i + 1];
    if (next && !next.startsWith('--')) {
      params[arg.slice(2)] = next;
      i++;
    } else {
      params[arg.slice(2)] = 'true';
    }
  }
}

const name = params['name'];
const target = params['target'];
const type = params['type'] || 'monorepo';
const cleanDemo = params['clean-demo'] === 'true';
const db = params['db'] || 'none';
const updateOnly = params['update-only'] === 'true';
const mode = params['mode'] || 'init';
const includeCi = params['include-ci'] === 'true';
const force = params['force'] === 'true';
// 手动指定测试端口（跳过自动分配，仅走 registry 冲突检查）
const manualPortRaw = params['port'];
const manualPort = manualPortRaw ? parseInt(manualPortRaw, 10) : undefined;
if (manualPortRaw && (Number.isNaN(manualPort) || manualPort! < 1 || manualPort! > 65535)) {
  console.error(`Invalid --port: ${manualPortRaw}`);
  process.exit(1);
}
// 完全跳过端口分配（保留模板默认 11070占位符）
const skipPortAlloc = params['skip-port-alloc'] === 'true';

if (!['init', 'add-ci'].includes(mode)) {
  console.error(`Invalid --mode: ${mode}. Allowed: init, add-ci`);
  process.exit(1);
}

if (mode === 'add-ci') {
  if (!target) {
    console.error('Missing required argument for add-ci mode: --target');
    process.exit(1);
  }
} else if (!updateOnly && (!name || !target)) {
  console.error('Missing required arguments: --name, --target (or use --update-only to refresh template cache)');
  process.exit(1);
}

const homeDir = os.homedir();

// Configure Cache Directory & Git Repo
const cacheDir = path.join(homeDir, 'wecode');
const templateCachePath = path.join(cacheDir, 'liquid-glass-starter');
const gitRepoUrl = 'git@192.168.110.2:starters/liquid-glass-starter.git';

// 1. Manage Template Cache (Clone or Pull)
const isGitRepo = fs.existsSync(path.join(templateCachePath, '.git'));
if (!fs.existsSync(templateCachePath) || !isGitRepo) {
  if (fs.existsSync(templateCachePath)) {
    console.log('🗑️ Cleaning up invalid/corrupted template cache...');
    fs.rmSync(templateCachePath, { recursive: true, force: true });
  }
  console.log(`📥 Local template cache not found. Cloning from GitLab (${gitRepoUrl})...`);
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    execSync(`git clone ${gitRepoUrl} "${templateCachePath}"`, { stdio: 'inherit' });
    console.log('✅ Template cloned successfully.');
  } catch (error) {
    console.error(`❌ Failed to clone template from GitLab. Please verify your connection to ${gitRepoUrl}.`);
    process.exit(1);
  }
} else {
  console.log('🔄 Checking for template updates on GitLab...');
  try {
    // Run git pull with a 15-second timeout to handle offline gracefully
    execSync('git pull', { cwd: templateCachePath, stdio: 'ignore', timeout: 15000 });
    console.log('✅ Template updated to the latest version.');
  } catch (error) {
    console.warn('⚠️ Could not connect to GitLab (offline or off-network). Falling back to cached local template.');
  }
}

// Exit early if only updating template cache
if (updateOnly) {
  console.log('\n🎉 Template cache updated successfully!');
  process.exit(0);
}

const targetPath = path.resolve(target!);

// ── CI Stamping ─────────────────────────────────────────────────────────────
// Copies CI files from the template cache to the target project, replacing
// the token `liquid-glass-starter` with the actual project name inside a
// small whitelist of files. Used by both init (--include-ci) and add-ci mode.
const CI_FILES_ALL = [
  '.gitlab-ci.yml',
  'Dockerfile',
  'ci-tools/Dockerfile',
  'deploy.sh',
  'compose.yml',
  'compose.test.yml',
  '.dockerignore',
  // CI 引用的“质量门禁”脚本（跨项目通用，无需项目名替换）
  // ─ scripts/arch-check.ts             UI 层约束 + 页面 lazy 守护
  // ─ scripts/check-migration-staged.ts pre-commit 迁移拦截（要求 husky/pre-commit 启用）
  // ─ apps/api/scripts/migrate-check.ts drizzle journal/snapshot/drift 三方一致预检
  'scripts/arch-check.ts',
  'scripts/check-migration-staged.ts',
  'apps/api/scripts/migrate-check.ts',
  // Dockerfile builder 层单一构建入口（shared / api compile / web 三合一），
  // 避免 Dockerfile inline RUN 多步续行的转义 / 报错定位 / 层缓存失效坑。
  'scripts/build-server.sh',
];
const CI_FILES_REPLACE = new Set([
  '.gitlab-ci.yml',
  'Dockerfile',
  'deploy.sh',
  'compose.yml',
  'compose.test.yml',
]);

function stampCi(destRoot: string, projectName: string, opts: { force?: boolean } = {}): void {
  const missingInTemplate: string[] = [];
  for (const rel of CI_FILES_ALL) {
    if (!fs.existsSync(path.join(templateCachePath, rel))) missingInTemplate.push(rel);
  }
  if (missingInTemplate.length > 0) {
    console.error(`❌ Template cache is missing CI files: ${missingInTemplate.join(', ')}`);
    console.error('   Run `bun run scaffold.ts --update-only` to refresh the template cache.');
    process.exit(1);
  }

  for (const rel of CI_FILES_ALL) {
    const src = path.join(templateCachePath, rel);
    const dest = path.join(destRoot, rel);
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    if (CI_FILES_REPLACE.has(rel)) {
      const content = fs.readFileSync(src, 'utf8').replaceAll('liquid-glass-starter', projectName);
      fs.writeFileSync(dest, content);
    } else {
      fs.copyFileSync(src, dest);
    }
    // Preserve executable bit for shell scripts
    if (rel.endsWith('.sh')) {
      try { fs.chmodSync(dest, 0o755); } catch { /* best-effort */ }
    }
    console.log(`   ✓ ${rel}`);
  }
  console.log(`✅ CI files stamped for project: ${projectName}`);
  void opts; // reserved for future flags
}

// ── Port Stamping ───────────────────────────────────────────────────────────
// After stampCi(), replace the template-default port `11070` in the generated
// compose files and .gitlab-ci.yml with the project's allocated port. Called
// from both init(--include-ci) and add-ci flows unless --skip-port-alloc.
const PORT_STAMP_FILES = ['compose.yml', 'compose.test.yml', '.gitlab-ci.yml'];

function stampPort(destRoot: string, port: number): void {
  for (const rel of PORT_STAMP_FILES) {
    const p = path.join(destRoot, rel);
    if (!fs.existsSync(p)) continue;
    let content = fs.readFileSync(p, 'utf8');
    // compose 里的 fallback：${WEB_PORT:-11070}
    content = content.replaceAll('${WEB_PORT:-11070}', `\${WEB_PORT:-${port}}`);
    // .gitlab-ci.yml 里的 echo/environment.url：":11070"
    content = content.replaceAll(':11070', `:${port}`);
    fs.writeFileSync(p, content);
  }
}

// ── Mode Dispatch: add-ci ───────────────────────────────────────────────────
// Adds CI to an existing project without touching source code. Infers the
// project name from apps/web/package.json (monorepo) or frontend/package.json
// (flat). Performs structure sanity check and conflict detection.
if (mode === 'add-ci') {
  console.log(`🔧 Adding CI to existing project:`);
  console.log(`   Target Path: ${targetPath}`);

  if (!fs.existsSync(targetPath)) {
    console.error(`❌ Target directory does not exist: ${targetPath}`);
    process.exit(1);
  }

  // Detect layout (monorepo vs flat) and infer project name.
  const monorepoWebPkg = path.join(targetPath, 'apps', 'web', 'package.json');
  const flatFrontendPkg = path.join(targetPath, 'frontend', 'package.json');
  const rootPkg = path.join(targetPath, 'package.json');

  let inferredName = params['name'];
  let layout: 'monorepo' | 'flat' | null = null;
  if (fs.existsSync(monorepoWebPkg)) {
    layout = 'monorepo';
    if (!inferredName && fs.existsSync(rootPkg)) {
      try { inferredName = JSON.parse(fs.readFileSync(rootPkg, 'utf8')).name; } catch { /* ignore */ }
    }
    if (!inferredName) {
      try { inferredName = JSON.parse(fs.readFileSync(monorepoWebPkg, 'utf8')).name; } catch { /* ignore */ }
    }
  } else if (fs.existsSync(flatFrontendPkg)) {
    layout = 'flat';
    if (!inferredName) {
      try {
        const pkgName: string = JSON.parse(fs.readFileSync(flatFrontendPkg, 'utf8')).name || '';
        inferredName = pkgName.replace(/-frontend$/, '');
      } catch { /* ignore */ }
    }
  } else {
    console.error('❌ Could not detect project layout.');
    console.error('   Expected either apps/web/package.json (monorepo) or frontend/package.json (flat).');
    process.exit(1);
  }

  if (!inferredName) {
    console.error('❌ Could not infer project name. Pass --name explicitly.');
    process.exit(1);
  }

  // Structure sanity check (monorepo only — flat CI is not sedimented in this iteration).
  if (layout === 'monorepo') {
    const requiredPaths = [
      'apps/api/src/index.ts',
      'apps/web/package.json',
      'packages/shared/package.json',
    ];
    const missing = requiredPaths.filter(p => !fs.existsSync(path.join(targetPath, p)));
    if (missing.length > 0) {
      console.error('❌ Project structure does not match monorepo CI expectations.');
      console.error('   Missing files:');
      for (const m of missing) console.error(`     - ${m}`);
      console.error('   Fix the layout or use --force is not supported for structure mismatch.');
      process.exit(1);
    }
  } else {
    console.error('❌ Flat layout CI is not sedimented yet. Only monorepo is supported in this iteration.');
    process.exit(1);
  }

  // Conflict detection
  const conflicts = CI_FILES_ALL.filter(rel => fs.existsSync(path.join(targetPath, rel)));
  if (conflicts.length > 0 && !force) {
    console.error('❌ CI files already exist:');
    for (const c of conflicts) console.error(`     - ${c}`);
    console.error('   Re-run with --force to overwrite.');
    process.exit(1);
  }

  console.log(`   Project Name: ${inferredName}`);
  console.log(`   Layout:       ${layout}`);
  if (conflicts.length > 0) console.log(`   Overwriting ${conflicts.length} existing CI file(s) (--force)`);

  stampCi(targetPath, inferredName, { force });

  // ── Port allocation ───────────────────────────────────────────────────────
  if (skipPortAlloc) {
    console.log('\n⚠️  --skip-port-alloc: 保留模板默认端口 11070，请人工修改 compose*.yml 与 .gitlab-ci.yml 中的端口。');
  } else {
    try {
      const alloc = allocatePort(inferredName, manualPort != null ? { manualPort, source: 'skill' } : {});
      stampPort(targetPath, alloc.port);
      const label = alloc.reused ? '复用已分配' : (manualPort != null ? '手动指定' : '自动分配');
      console.log(`\n✓ 已为 ${inferredName} ${label}测试端口 ${alloc.port}，测试 URL: http://192.168.110.214:${alloc.port}`);
      console.log(`   registry: ${alloc.registryPath}`);
    } catch (err) {
      console.error(`\n❌ 端口分配失败：${(err as Error).message}`);
      console.error('   CI 文件已产出但保留模板默认 11070；可用 --skip-port-alloc 跳过，或修正 SSH 后重跑 --mode add-ci --force。');
      process.exit(1);
    }
  }

  console.log('\n🎉 CI added successfully!');
  console.log('\nNext steps:');
  console.log('  1. Review the generated .gitlab-ci.yml and adjust deployment variables.');
  console.log('  2. Configure GitLab CI/CD Variables (see references/ci-guide.md).');
  console.log('  3. Commit and push to trigger the first pipeline.');
  process.exit(0);
}

// ── Init Mode below ─────────────────────────────────────────────────────────

// Coerce db choice if it doesn't match the architecture
let dbChoice = db;
const validDbs = ['none', 'drizzle', 'gorm', 'jpa'];
if (!validDbs.includes(dbChoice)) {
  console.warn(`⚠️ Warning: Unknown database option: --db ${dbChoice}. Defaulting to 'none'.`);
  dbChoice = 'none';
}
if (type === 'monorepo' && dbChoice !== 'none' && dbChoice !== 'drizzle') {
  console.warn(`⚠️ Warning: Selected --db ${dbChoice} is not supported for TS Monorepo. Falling back to 'drizzle'.`);
  dbChoice = 'drizzle';
} else if (type === 'flat-go' && dbChoice !== 'none' && dbChoice !== 'gorm') {
  console.warn(`⚠️ Warning: Selected --db ${dbChoice} is not supported for Go. Falling back to 'gorm'.`);
  dbChoice = 'gorm';
} else if (type === 'flat-java' && dbChoice !== 'none' && dbChoice !== 'jpa') {
  console.warn(`⚠️ Warning: Selected --db ${dbChoice} is not supported for Kotlin. Falling back to 'jpa'.`);
  dbChoice = 'jpa';
}

console.log(`🚀 Starting scaffolding:`);
console.log(`   Project Name: ${name}`);
console.log(`   Target Path:  ${targetPath}`);
console.log(`   Type:         ${type}`);
console.log(`   Clean Demo:   ${cleanDemo}`);
console.log(`   Database/ORM: ${dbChoice}`);

// Ensure target exists and is empty (or force is enabled)
if (fs.existsSync(targetPath)) {
  const files = fs.readdirSync(targetPath);
  const allowedItems = ['.git', '.agents', '.gemini', '.qoder', '.DS_Store'];
  if (!force && files.length > 0 && !files.every(f => allowedItems.includes(f))) {
    console.error(`Error: Target directory is not empty. Use --force to proceed anyway: ${targetPath}`);
    process.exit(1);
  }
} else {
  fs.mkdirSync(targetPath, { recursive: true });
}

// 2. Recursive Copy Function
function copyRecursive(src: string, dest: string, excludes: string[]) {
  const base = path.basename(src);
  const relPath = path.relative(templateCachePath, src);
  if (excludes.includes(base) || relPath === 'skills') return;

  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const files = fs.readdirSync(src);
    for (const file of files) {
      copyRecursive(path.join(src, file), path.join(dest, file), excludes);
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

const excludes = ['.git', 'node_modules', '.gemini', 'dist', 'bun.lockb', '.DS_Store', 'skills.json'];
// CI files live in the template repo root so the template itself is a runnable
// project. They must NOT be copied verbatim into scaffolded projects: either
// stampCi() injects them (with project-name replacement) when --include-ci is
// set, or they stay out entirely and can be added later via --mode add-ci.
excludes.push('.gitlab-ci.yml', 'Dockerfile', 'ci-tools', 'deploy.sh', 'compose.yml', 'compose.test.yml', '.dockerignore');
console.log('📦 Copying template files from cache...');
copyRecursive(templateCachePath, targetPath, excludes);

// 3. Perform Transformations based on Type
if (type === 'flat-go' || type === 'flat-java') {
  console.log(`🔧 Reorganizing to Flat Dual-Directory Structure...`);
  
  const frontendPath = path.join(targetPath, 'frontend');
  const backendPath = path.join(targetPath, 'backend');
  
  // Move apps/web to frontend (handles cross-volume movements)
  const oldWebPath = path.join(targetPath, 'apps', 'web');
  if (fs.existsSync(oldWebPath)) {
    try {
      fs.renameSync(oldWebPath, frontendPath);
    } catch (e) {
      copyRecursive(oldWebPath, frontendPath, []);
      fs.rmSync(oldWebPath, { recursive: true, force: true });
    }
  }
  
  // Remove monorepo folders
  const appsDir = path.join(targetPath, 'apps');
  const packagesDir = path.join(targetPath, 'packages');
  if (fs.existsSync(appsDir)) fs.rmSync(appsDir, { recursive: true, force: true });
  if (fs.existsSync(packagesDir)) fs.rmSync(packagesDir, { recursive: true, force: true });
  
  // Remove root configuration files that belong to monorepo
  const rootFilesToRemove = ['package.json', 'bun.lock', 'eslint.config.js', 'init.sh'];
  for (const file of rootFilesToRemove) {
    const fPath = path.join(targetPath, file);
    if (fs.existsSync(fPath)) fs.rmSync(fPath, { force: true });
  }

  // Create backend
  fs.mkdirSync(backendPath, { recursive: true });

  if (type === 'flat-go') {
    // Generate Go Backend
    console.log('🐹 Generating Go backend template...');
    fs.writeFileSync(
      path.join(backendPath, 'go.mod'),
      readTemplate('go/go.mod.template', { PROJECT_NAME: name })
    );
    
    if (dbChoice === 'gorm') {
      fs.writeFileSync(
        path.join(backendPath, 'main.go'),
        readTemplate('go/main.go.gorm.template')
      );
    } else {
      fs.writeFileSync(
        path.join(backendPath, 'main.go'),
        readTemplate('go/main.go.template')
      );
    }
  } else if (type === 'flat-java') {
    // Generate Kotlin + Gradle Backend
    console.log('☕ Generating Spring Boot + Kotlin + Gradle backend template...');
    const packageDir = path.join(backendPath, 'src', 'main', 'kotlin', 'com', 'example');
    fs.mkdirSync(packageDir, { recursive: true });
    
    fs.writeFileSync(
      path.join(backendPath, 'settings.gradle.kts'),
      'rootProject.name = "backend"\n'
    );

    if (dbChoice === 'jpa') {
      fs.writeFileSync(
        path.join(backendPath, 'build.gradle.kts'),
        readTemplate('kotlin/build.gradle.kts.jpa.template')
      );

      fs.writeFileSync(
        path.join(packageDir, 'App.kt'),
        readTemplate('kotlin/App.kt.jpa.template')
      );
    } else {
      fs.writeFileSync(
        path.join(backendPath, 'build.gradle.kts'),
        readTemplate('kotlin/build.gradle.kts.template')
      );

      fs.writeFileSync(
        path.join(packageDir, 'App.kt'),
        readTemplate('kotlin/App.kt.template')
      );
    }
  }

  // Generate Taskfile.yml
  console.log('📝 Generating Taskfile.yml...');
  let backendDevCmd = '';
  if (type === 'flat-go') {
    backendDevCmd = 'go run main.go';
  } else {
    backendDevCmd = 'gradle bootRun';
  }
  fs.writeFileSync(
    path.join(targetPath, 'Taskfile.yml'),
    readTemplate('taskfile/Taskfile.yml.template', { BACKEND_DEV_CMD: backendDevCmd })
  );

  // Update frontend package name
  const frontPkgPath = path.join(frontendPath, 'package.json');
  if (fs.existsSync(frontPkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(frontPkgPath, 'utf8'));
    pkg.name = `${name}-frontend`;
    fs.writeFileSync(frontPkgPath, JSON.stringify(pkg, null, 2));
  }

  // Update frontend index.html title
  const frontHtmlPath = path.join(frontendPath, 'index.html');
  if (fs.existsSync(frontHtmlPath)) {
    let html = fs.readFileSync(frontHtmlPath, 'utf8');
    html = html.replace(/<title>.*<\/title>/, `<title>${name}</title>`);
    fs.writeFileSync(frontHtmlPath, html);
  }

  // Update frontend vite.config.ts proxy target to localhost:8080
  const viteConfigPath = path.join(frontendPath, 'vite.config.ts');
  if (fs.existsSync(viteConfigPath)) {
    let config = fs.readFileSync(viteConfigPath, 'utf8');
    config = config.replace(/target:\s*['"]http:\/\/localhost:3000['"]/g, `target: "http://localhost:8080"`);
    fs.writeFileSync(viteConfigPath, config);
  }
} else {
  // Monorepo case
  console.log(`🔧 Configuring Monorepo...`);
  // Update root package.json name
  const rootPkgPath = path.join(targetPath, 'package.json');
  if (fs.existsSync(rootPkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
    pkg.name = name;
    fs.writeFileSync(rootPkgPath, JSON.stringify(pkg, null, 2));
  }

  // Update apps/web/index.html title
  const webHtmlPath = path.join(targetPath, 'apps', 'web', 'index.html');
  if (fs.existsSync(webHtmlPath)) {
    let html = fs.readFileSync(webHtmlPath, 'utf8');
    html = html.replace(/<title>.*<\/title>/, `<title>${name}</title>`);
    fs.writeFileSync(webHtmlPath, html);
  }
  
  // Delete init.sh as it is already run/not needed
  const initShPath = path.join(targetPath, 'init.sh');
  if (fs.existsSync(initShPath)) fs.rmSync(initShPath, { force: true });

  // Strip database layer when --db none is selected (template ships with Drizzle built-in)
  if (dbChoice === 'none') {
    console.log('🧹 Stripping database layer (--db none)...');
    const apiPath = path.join(targetPath, 'apps', 'api');
    const apiSrcPath = path.join(apiPath, 'src');

    // Remove db directory, drizzle config, and migration output
    const dbDir = path.join(apiSrcPath, 'db');
    const drizzleConfig = path.join(apiPath, 'drizzle.config.ts');
    const drizzleDir = path.join(apiPath, 'drizzle');
    if (fs.existsSync(dbDir)) fs.rmSync(dbDir, { recursive: true, force: true });
    if (fs.existsSync(drizzleConfig)) fs.rmSync(drizzleConfig, { force: true });
    if (fs.existsSync(drizzleDir)) fs.rmSync(drizzleDir, { recursive: true, force: true });

    // Remove drizzle deps & scripts from package.json
    const apiPkgPath = path.join(apiPath, 'package.json');
    if (fs.existsSync(apiPkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(apiPkgPath, 'utf8'));
      if (pkg.dependencies) delete pkg.dependencies['drizzle-orm'];
      if (pkg.devDependencies) delete pkg.devDependencies['drizzle-kit'];
      if (pkg.scripts) {
        delete pkg.scripts['db:generate'];
        delete pkg.scripts['db:migrate'];
      }
      fs.writeFileSync(apiPkgPath, JSON.stringify(pkg, null, 2));
    }

    // Rewrite index.ts to remove all DB code
    const indexTsPath = path.join(apiSrcPath, 'index.ts');
    if (fs.existsSync(indexTsPath)) {
      let content = fs.readFileSync(indexTsPath, 'utf8');

      // Remove DB-related imports
      content = content.replace(/import \{ eq \} from 'drizzle-orm'\n/g, '');
      content = content.replace(/import \{ migrate \} from 'drizzle-orm\/bun-sqlite\/migrator'\n/g, '');
      content = content.replace(/import path from 'path'\n/g, '');
      content = content.replace(/\nimport \{ db \} from '.\/db'\n/g, '\n');
      content = content.replace(/import \{ users \} from '.\/db\/schema'\n/g, '');

      // Remove Migration & Seed block
      content = content.replace(/\/\/ ─── Database Migration & Seed[\s\S]*?\n\n(?=\/\/ ─── Routes)/, '');

      // Remove /users endpoint
      content = content.replace(/app\.get\('\/users'[\s\S]*?\}\)\n\n/, '');

      // Remove DB auth check in login, keep Fallback as primary
      content = content.replace(
        /  \/\/ 先从数据库中查找用户[\s\S]*?\/\/ Fallback: Demo 模式\n/,
        '  // Demo 模式：任意合法 email + 6位以上密码即可登录\n'
      );

      fs.writeFileSync(indexTsPath, content);
    }
    console.log('✅ Database layer stripped.');
  }
  // When --db drizzle: template already ships with Drizzle built-in, no action needed.
}

// 3.5 Rewrite README.md and adjust AGENTS.md
console.log('📝 Adjusting README.md and AGENTS.md...');

const readmePath = path.join(targetPath, 'README.md');
const agentsPath = path.join(targetPath, 'AGENTS.md');

// Archive original README.md as DESIGN_SYSTEM.md so users retain style reference
if (fs.existsSync(readmePath)) {
  fs.renameSync(readmePath, path.join(targetPath, 'DESIGN_SYSTEM.md'));
}

// Write a clean, project-specific README.md
const newReadmeContent = `# ${name}

This project was bootstrapped from Liquid Glass Starter.

## Architecture & Tech Stack
- **Frontend**: React + Vite + Tailwind CSS v4 (located in \`${type === 'monorepo' ? 'apps/web' : 'frontend'}\`)
- **Backend**: ${type === 'monorepo' ? 'Hono (Node/Bun SPA API)' : type === 'flat-go' ? 'Go (API Server)' : 'Spring Boot (Kotlin + Gradle)'} (located in \`${type === 'monorepo' ? 'apps/api' : 'backend'}\`)
${type === 'monorepo' ? '- **Workspaces**: Managed via Bun Workspaces (monorepo)' : '- **Workspaces**: Flat dual-directory project'}

## Getting Started
1. Install dependencies:
   \`\`\`bash
   ${type === 'monorepo' ? 'bun install' : 'cd frontend && bun install'}
   \`\`\`
2. Start the development servers:
   - Run: \`${type === 'monorepo' ? 'bun run dev' : 'task dev'}\`

## Design System
- Refer to [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for utility classes, tokens, and visual components overview.
`;

fs.writeFileSync(readmePath, newReadmeContent);

// Adjust AGENTS.md: adapt layout-specific sections, then rewrite paths for flat
if (fs.existsSync(agentsPath)) {
  let agentsContent = fs.readFileSync(agentsPath, 'utf8');

  if (type === 'flat-go' || type === 'flat-java') {
    const webRoot = 'frontend';

    // 1. Replace Commands section (Taskfile orchestration)
    agentsContent = agentsContent.replace(
      /<!-- region:cmds -->[\s\S]*?<!-- endregion:cmds -->/,
      `<!-- region:cmds -->\n## 🛠️ Commands\n\n\`\`\`bash\ntask dev         # dev server (Taskfile orchestrates frontend + backend)\ncd frontend && bun run test     # test\ncd frontend && bun run lint:fix # lint auto-fix\n\`\`\`\n<!-- endregion:cmds -->`
    );

    // 2. Replace API section (OpenAPI-oriented for heterogeneous stacks)
    agentsContent = agentsContent.replace(
      /<!-- region:api -->[\s\S]*?<!-- endregion:api -->/,
      `<!-- region:api -->\n## 🔌 API & Service Layer\n\n- **No direct imports** of API clients or backend SDKs in UI components. Use OpenAPI contract-driven generation (e.g. Orval / openapi-typescript) for type-safe API clients.\n- Encapsulate all network logic in \`${webRoot}/src/services/\`. UI only calls service functions returning Promises.\n<!-- endregion:api -->`
    );

    // 3. Global path rewrite: apps/web → frontend (after anchor replacements)
    agentsContent = agentsContent.replaceAll('apps/web', webRoot);
  }

  // Strip DB references from AGENTS.md when --db none is selected (monorepo)
  if (type === 'monorepo' && dbChoice === 'none') {
    agentsContent = agentsContent.replace(
      /\n- \*\*Database\*\*:.*Run `bun run db:generate` after schema changes\./g,
      ''
    );
    agentsContent = agentsContent.replace(/\n?bun run db:generate.*\n/g, '\n');
    agentsContent = agentsContent.replace(/bun run db:migrate.*\n/g, '');
  }

  fs.writeFileSync(agentsPath, agentsContent);
}


// 4. Clean Demo Pages if requested
if (cleanDemo) {
  console.log('🧹 Cleaning up demo pages...');
  const webSubdir = type === 'monorepo' ? 'apps/web/src' : 'frontend/src';
  const pagePath = path.join(targetPath, webSubdir, 'pages');
  
  const demoFiles = [
    'LoginPage.tsx',
    'ComponentsOverviewPage.tsx',
    'DashboardPage.tsx',
    'DataPage.tsx',
    'FormsPage.tsx',
    'FoundationsPage.tsx',
    'OverlaysPage.tsx',
    'sections'
  ];

  for (const file of demoFiles) {
    const fPath = path.join(pagePath, file);
    if (fs.existsSync(fPath)) {
      fs.rmSync(fPath, { recursive: true, force: true });
      console.log(`   Removed: ${file}`);
    }
  }

  // Create clean placeholder DashboardPage.tsx
  console.log('📝 Writing clean placeholder DashboardPage.tsx...');
  fs.writeFileSync(
    path.join(pagePath, 'DashboardPage.tsx'),
    `export default function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4 font-h1">Welcome to your new project!</h1>
      <p className="text-gray-500">This is a clean workspace scaffolded from Liquid Glass Starter.</p>
    </div>
  );
}
`
  );

  // Write clean App.tsx without demo page imports, but KEEPING ProfileSettingsPage
  console.log('📝 Writing clean App.tsx...');
  fs.writeFileSync(
    path.join(targetPath, webSubdir, 'App.tsx'),
    `import { Toaster } from "sonner"
import { Routes, Route, Navigate } from "react-router-dom"
import SidebarLayout from "@/layouts/SidebarLayout"
import DashboardPage from "@/pages/DashboardPage"
import ProfileSettingsPage from "@/pages/ProfileSettingsPage"
import RouteErrorBoundary from "@/components/layout/RouteErrorBoundary"
import ProtectedRoute from "@/router/ProtectedRoute"

export default function App() {
  return (
    <>
      <RouteErrorBoundary>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route element={<SidebarLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/settings" element={<ProfileSettingsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </RouteErrorBoundary>
      <Toaster richColors position="top-right" />
    </>
  )
}
`
  );

  // Write clean ProtectedRoute.tsx bypassing auth checks (since LoginPage is deleted)
  console.log('📝 Writing clean ProtectedRoute.tsx (bypassing auth)...');
  fs.writeFileSync(
    path.join(targetPath, webSubdir, 'router', 'ProtectedRoute.tsx'),
    `import { Outlet } from "react-router-dom"

export default function ProtectedRoute() {
  return <Outlet />
}
`
  );
}

// 4.5 CI Stamping (opt-in via --include-ci)
if (includeCi) {
  if (type === 'monorepo') {
    console.log('🔧 Stamping CI files (--include-ci)...');
    stampCi(targetPath, name!, { force: true });

    // Port allocation (mirrors add-ci logic)
    if (skipPortAlloc) {
      console.log('⚠️  --skip-port-alloc: 保留模板默认端口 11070，请人工修改 compose*.yml 与 .gitlab-ci.yml。');
    } else {
      try {
        const alloc = allocatePort(name!, manualPort != null ? { manualPort, source: 'skill' } : {});
        stampPort(targetPath, alloc.port);
        const label = alloc.reused ? '复用已分配' : (manualPort != null ? '手动指定' : '自动分配');
        console.log(`✓ 已为 ${name} ${label}测试端口 ${alloc.port}，测试 URL: http://192.168.110.214:${alloc.port}`);
      } catch (err) {
        console.warn(`⚠️  端口分配失败，保留模板默认 11070：${(err as Error).message}`);
        console.warn('   项目已 scaffold 完成，可在排除 SSH 问题后重跑 `--mode add-ci --force` 重新分配端口。');
      }
    }
  } else {
    console.warn(`⚠️  --include-ci is only supported for monorepo in this iteration. Skipped for type=${type}.`);
  }
}

// 4.6 Install Dependencies
console.log('📦 Installing project dependencies...');
try {
  const installCwd = type === 'monorepo' ? targetPath : path.join(targetPath, 'frontend');
  execSync('bun install', { cwd: installCwd, stdio: 'inherit' });
  console.log('✅ Dependencies installed successfully.');

  // Post-install DB migrations generation / module fetching
  if (type === 'monorepo') {
    console.log('🏗️ Building shared packages...');
    try {
      execSync('bun run build:shared', { cwd: targetPath, stdio: 'inherit' });
      console.log('✅ Shared packages built successfully.');
    } catch (e) {
      console.warn('⚠️ Failed to build shared packages automatically. Please run "bun run build:shared" manually.');
    }
  }

  if (dbChoice === 'drizzle') {
    // Template already includes migration files; just run db:generate to ensure they're fresh
    console.log('💧 Regenerating Drizzle ORM migrations from template schema...');
    try {
      execSync('bun run db:generate', { cwd: path.join(targetPath, 'apps', 'api'), stdio: 'inherit' });
      console.log('✅ Drizzle migrations generated.');
    } catch (e) {
      console.warn('⚠️ Failed to generate Drizzle migrations automatically. Please run "bun run db:generate" in apps/api manually.');
    }
  } else if (type === 'flat-go' && dbChoice === 'gorm') {
    console.log('🐹 Fetching Go GORM dependencies...');
    try {
      execSync('go get gorm.io/gorm gorm.io/driver/sqlite', { cwd: path.join(targetPath, 'backend'), stdio: 'inherit' });
      console.log('✅ Go GORM dependencies installed.');
    } catch (e) {
      console.warn('⚠️ Failed to run "go get" automatically. Go may not be installed. Please run it manually.');
    }
  }
} catch (e) {
  console.warn('⚠️ Failed to run "bun install" automatically. Please run "bun install" or "npm install" manually.');
}

// 5. Git Init
console.log('🗃️ Initializing Git repository...');
try {
  execSync('git init', { cwd: targetPath });
  execSync('git add -A', { cwd: targetPath });
  execSync('git commit -m "chore: initial commit from liquid-glass-starter" --quiet', { cwd: targetPath });
  console.log('✅ Git repository initialized.');
} catch (e) {
  console.warn('⚠️ Failed to initialize Git repository automatically. You may need to run git init manually.');
}

// 6. Environment Checks
console.log('\n🔍 Checking environment dependencies...');

function isCommandAvailable(cmd: string): boolean {
  try {
    const checkCmd = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`;
    execSync(checkCmd, { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

const missingDeps: string[] = [];

if (type.startsWith('flat-')) {
  if (!isCommandAvailable('task')) {
    missingDeps.push('task (go-task) -> Install via: brew install go-task (macOS) or choco install go-task (Windows)');
  }
}

if (type === 'flat-go') {
  if (!isCommandAvailable('go')) {
    missingDeps.push('go -> Install via: brew install go (macOS) or download from golang.org');
  }
} else if (type === 'flat-java') {
  if (!isCommandAvailable('java')) {
    missingDeps.push('java (JDK 17+) -> Install via: brew install openjdk@17 (macOS) or download from oracle.com/java');
  }
  if (!isCommandAvailable('gradle')) {
    missingDeps.push('gradle -> Install via: brew install gradle (macOS) or download from gradle.org');
  }
}

if (missingDeps.length > 0) {
  console.warn('\n⚠️ Warning: Some environment dependencies are missing. Please install them to run the project correctly:');
  for (const dep of missingDeps) {
    console.warn(`   - ${dep}`);
  }
} else {
  console.log('✅ All environment dependencies are met!');
}

console.log('\n🎉 Scaffolding completed successfully!');
process.exit(0);
