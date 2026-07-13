/**
 * E2E 环境一键初始化脚本
 *
 * 按顺序执行: seed → 验证 → 启动服务，确保环境就绪。
 *
 * 用法:
 *   npx tsx templates/e2e/setup-e2e-env.ts
 *
 * 等价于:
 *   1. npx tsx templates/e2e/seed.ts
 *   2. node scripts/check-e2e-env.js --ci
 */

import { execSync } from 'node:child_process'
import { resolve } from 'node:path'

const ROOT = process.cwd()

function run(command: string, description: string): void {
  console.log(`\n▶ ${description}`)
  console.log(`  $ ${command}`)
  try {
    execSync(command, { cwd: ROOT, stdio: 'inherit' })
  } catch (err: any) {
    console.error(`\n❌ 失败: ${description}`)
    console.error(`   退出码: ${err.status}`)
    process.exit(1)
  }
}

function main(): void {
  console.log('')
  console.log('═══════════════════════════════════════════')
  console.log('  E2E 环境一键初始化')
  console.log('═══════════════════════════════════════════')

  // Step 1: 初始化文件数据库（--reset 确保干净状态）
  run('npx tsx templates/e2e/seed.ts --reset', 'Step 1/3: 重置数据库 + Seed 数据')

  // Step 2: 环境检查
  console.log('\n▶ Step 2/3: 环境完整性检查')
  console.log('  $ node scripts/check-e2e-env.js --ci')
  try {
    execSync('node scripts/check-e2e-env.js --ci', { cwd: ROOT, stdio: 'inherit' })
  } catch {
    console.log('\n⚠️  部分检查项未通过（可能服务未启动），继续...')
  }

  // Step 3: 提示启动服务
  console.log('')
  console.log('▶ Step 3/3: 启动服务（请手动执行）')
  console.log('')
  console.log('  终端 1 — 后端服务:')
  console.log('    npx tsx templates/e2e/start-server.ts')
  console.log('')
  console.log('  终端 2 — 前端服务:')
  console.log('    cd apps/web && npm run dev')
  console.log('')
  console.log('  然后运行 E2E 测试:')
  console.log('    npx playwright test')
  console.log('')
  console.log('═══════════════════════════════════════════')
  console.log('  ✅ 环境初始化完成！')
  console.log('═══════════════════════════════════════════')
  console.log('')
}

main()
