/**
 * Playwright Global Setup — 每次 E2E 测试前初始化干净数据库
 *
 * 执行顺序:
 *   1. 删除旧 wecrm.db（含 WAL/SHM 文件）
 *   2. 运行 seed.ts --reset（重建表 + 插入种子数据）
 *   3. Playwright 启动 start-server.ts（连接干净的 DB）
 *
 * 这确保了每次 E2E 测试都是从完全相同的初始状态开始，
 * 不存在数据污染或状态泄漏问题。
 */

import { execSync } from 'node:child_process'

async function globalSetup(): Promise<void> {
  console.log('')
  console.log('═══════════════════════════════════════════')
  console.log('  E2E Global Setup — 重置数据库')
  console.log('═══════════════════════════════════════════')

  try {
    // 强制重置数据库（--reset 删除旧文件 + 重建）
    execSync('bun run templates/e2e/seed.ts --reset', {
      cwd: process.cwd(),
      stdio: 'inherit',
      timeout: 30_000,
    })
    console.log('  ✅ 数据库已重置为干净状态')
  } catch (err: any) {
    console.error('  ❌ 数据库重置失败:', err.message)
    throw err
  }
}

export default globalSetup
