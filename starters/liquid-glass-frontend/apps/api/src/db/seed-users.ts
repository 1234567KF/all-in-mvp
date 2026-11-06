/**
 * 种子账号唯一真源（R010）
 *
 * 为什么单独成文件：此前 admin 账号在 `src/db.ts`（启动兜底）与
 * `scripts/seed-dev.ts`（本地手动播种）各写一遍，两处字段会漂移——
 * 引入 password 后一旦只改一处，就会出现「本地能登、干净部署登不上」的坏状态。
 * 现在账号定义只有这里一份，两个入口都调用 seedUsers()。
 *
 * 密码约定：
 * - 口令取 `process.env.SEED_ADMIN_PASSWORD || DEV_SEED_PASSWORD`，
 *   生产环境由 env.ts 的启动守卫强制要求显式设置（缺失即拒绝启动）；
 * - 落库的是 bcrypt 哈希，明文只存在于环境变量/进程内，不进仓库；
 * - 演示账号（demo / viewer）与 admin 共用同一口令：starter 不引入「每账号
 *   一条 env」的复杂度，真实项目按需在此改成 per-account 密码来源。
 *
 * 幂等：按 email 唯一键跳过已存在账号，因此已改过密码的存量库不会被重置。
 */
import { env } from "../env.js"
import { hashPasswordSync } from "../utils/password.js"
import type { DrizzleDB } from "./index.js"
import { users } from "./schema.js"

/** 未配置 SEED_ADMIN_PASSWORD 时的本地开发口令（仅限 dev/演示，非生产凭据） */
export const DEV_SEED_PASSWORD = "admin123"

/** 当前生效的种子口令（生产环境由 env.ts 守卫强制显式配置） */
export function seedPassword(): string {
  return env.SEED_ADMIN_PASSWORD || DEV_SEED_PASSWORD
}

/**
 * 种子账号定义（明文口令在此只为播种时哈希，绝不写入 DB）。
 * email 允许非邮箱格式（"admin"），与 packages/shared/src/user.ts 的契约边界一致。
 *
 * devOnly 区分「启动兜底」与「本地演示造数」：
 * admin 是登录可用的下限，任何环境都要有；demo / viewer 只服务本地演示，
 * 生产启动**不会**自动创建它们（否则等于往线上库塞两个可登录账号）。
 */
export const SEED_USER_ACCOUNTS: readonly {
  email: string
  name: string
  role: string
  devOnly?: boolean
}[] = [
  { email: "admin", name: "Admin", role: "admin" },
  {
    email: "demo@example.com",
    name: "Demo User",
    role: "user",
    devOnly: true,
  },
  {
    email: "viewer@example.com",
    name: "Demo Viewer",
    role: "user",
    devOnly: true,
  },
]

/**
 * 补齐缺失的种子账号，返回实际插入条数（0 表示未插入）。
 * 启动兜底（src/db.ts）与本地手动播种（scripts/seed-dev.ts）共用同一份定义，
 * 但两种语义必须分开，否则会悄悄改变启动行为：
 *
 * - `onlyIfEmpty: true`（启动兜底，保持 src/db.ts 自举的原有语义）：
 *   仅在 users 表**完全没有行**时播种。库里已有任何账号就不再补——
 *   否则运维删掉/改名默认 admin 之后，一次容器重启会静默复活一个
 *   能用 SEED_ADMIN_PASSWORD 登录后门的管理员。
 * - `onlyIfEmpty` 缺省（seed-dev 的原有语义）：按 email 幂等补齐缺失账号，
 *   `includeDevOnly: true` 时连演示账号一起补齐。
 *
 * 两种模式都不会覆盖已存在账号的 password，因此改过口令的存量库不会被重置。
 */
export function seedUsers(
  d: DrizzleDB,
  opts: { includeDevOnly?: boolean; onlyIfEmpty?: boolean } = {}
): number {
  const existing = new Set(
    d.select({ email: users.email }).from(users).all().map((row) => row.email)
  )
  if (opts.onlyIfEmpty && existing.size > 0) return 0

  const accounts = SEED_USER_ACCOUNTS.filter(
    (account) => opts.includeDevOnly || !account.devOnly
  )
  const missing = accounts
    .filter((account) => !existing.has(account.email))
    .map(({ devOnly: _devOnly, ...account }) => ({ ...account }))
  if (missing.length === 0) return 0

  const password = hashPasswordSync(seedPassword())
  d.insert(users)
    .values(missing.map((account) => ({ ...account, password })))
    .onConflictDoNothing()
    .run()
  return missing.length
}

/**
 * 启动兜底入口（`src/db.ts` 结构自举后的唯一调用点）。
 *
 * 单独成函数而不是让 db.ts 直接写 `onlyIfEmpty: true`：那个开关就是语义本体，
 * 留在调用方字面量里等于「没有任何测试能因它被删掉而变红」。现在它在这里，
 * 由 src/db/seed-users.test.ts 的「启动兜底」用例直接覆盖。
 */
export function seedUsersOnStartup(d: DrizzleDB): number {
  return seedUsers(d, { onlyIfEmpty: true })
}
