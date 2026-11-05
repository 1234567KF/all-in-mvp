/**
 * logs service 单测（mock @/lib/api）
 * 覆盖：GET /logs 路径、查询参数透传、响应解包。
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { logsService } from "@/services/logs"

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
  },
}))

const mockedGet = vi.mocked(api.get)

describe("logsService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("list 调用 GET /logs 并透传筛选/分页参数", async () => {
    const page = {
      items: [],
      total: 0,
      page: 2,
      pageSize: 20,
      totalPages: 0,
    }
    mockedGet.mockResolvedValueOnce({ data: { data: page } })

    const params = {
      page: 2,
      pageSize: 20,
      module: "user",
      result: "success" as const,
    }
    const result = await logsService.list(params)

    expect(mockedGet).toHaveBeenCalledWith("/logs", { params })
    expect(result).toEqual(page)
  })

  it("缺省参数调用时不传业务筛选", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { data: { items: [], total: 0 } },
    })

    await logsService.list()

    expect(mockedGet).toHaveBeenCalledWith("/logs", { params: {} })
  })
})
