import bcryptjs from "bcryptjs"

/** 测试环境可通过环境变量降低 cost（加速测试），生产固定 10 */
const HASH_ROUNDS = Number(process.env.BUN_TEST_BCRYPT_ROUNDS) || 10

/** 同步 hash（用于种子数据初始化等同步场景） */
export function hashPasswordSync(plaintext: string): string {
  return bcryptjs.hashSync(plaintext, HASH_ROUNDS)
}

/** 异步 hash（用于 API 请求场景） */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcryptjs.hash(plaintext, HASH_ROUNDS)
}

/**
 * 密码验证（仅支持 bcrypt hash，库内密码均为 hash 写入）
 */
export async function verifyPassword(
  plaintext: string,
  stored: string
): Promise<boolean> {
  return bcryptjs.compare(plaintext, stored)
}
