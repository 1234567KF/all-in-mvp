/**
 * demo-seed 单元测试（DEMO_MODE 演示数据）
 *
 * 覆盖：初始种 7 条（4 未读/3 已读）、幂等重复调用、reset 恢复初始态。
 */
import { beforeEach, describe, expect, it } from "bun:test"
import { eq } from "drizzle-orm"

import { getDrizzle } from "../db.js"
import { setupTestDb } from "../test-helpers.js"
import { resetDemoNotifications, seedDemoNotifications } from "./demo-seed.js"
import { notifications } from "./schema.js"

beforeEach(() => {
  setupTestDb()
  getDrizzle().delete(notifications).run()
})

function allRows() {
  return getDrizzle().select().from(notifications).all()
}

describe("seedDemoNotifications", () => {
  it("首次播种 7 条：4 未读 / 3 已读，收件人为 admin", () => {
    const inserted = seedDemoNotifications(getDrizzle())

    expect(inserted).toBe(7)
    const rows = allRows()
    expect(rows).toHaveLength(7)
    expect(rows.filter((row) => row.isRead === 0)).toHaveLength(4)
    expect(rows.filter((row) => row.isRead === 1)).toHaveLength(3)
    expect(rows.every((row) => row.recipientId === "admin")).toBe(true)
    expect(rows[0].id).toMatch(/^seed-notification-/)
    // payload 是 JSON 对象（前端 adapter 取 href）
    expect(rows[0].payload).toEqual(
      expect.objectContaining({ href: expect.any(String) })
    )
  })

  it("重复调用幂等：第二次插入 0 条，总数不变", () => {
    seedDemoNotifications(getDrizzle())

    const insertedAgain = seedDemoNotifications(getDrizzle())

    expect(insertedAgain).toBe(0)
    expect(allRows()).toHaveLength(7)
  })
})

describe("resetDemoNotifications", () => {
  it("把已读/删除后的收件箱恢复为 7 条、4 未读", () => {
    seedDemoNotifications(getDrizzle())
    // 模拟演示被点完 + 删掉一条
    getDrizzle()
      .update(notifications)
      .set({ isRead: 1, readTime: new Date().toISOString() })
      .run()
    getDrizzle()
      .delete(notifications)
      .where(eq(notifications.id, "seed-notification-1"))
      .run()

    const inserted = resetDemoNotifications(getDrizzle())

    expect(inserted).toBe(7)
    const rows = allRows()
    expect(rows).toHaveLength(7)
    expect(rows.filter((row) => row.isRead === 0)).toHaveLength(4)
  })
})
