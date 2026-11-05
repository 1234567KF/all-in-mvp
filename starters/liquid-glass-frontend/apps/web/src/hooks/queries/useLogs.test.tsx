/**
 * useLogs 单测（mock service 层）
 * 覆盖：参数透传、不同筛选参数落到不同 query key（缓存分 key）、enabled=false 不请求。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/services/logs", () => ({
  logsService: {
    list: vi.fn(),
  },
}))

import { logKeys } from "@/lib/query-keys"
import { logsService } from "@/services/logs"

import { useLogs } from "./useLogs"

const emptyPage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0,
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { queryClient, wrapper }
}

describe("useLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("成功时返回分页数据并透传筛选参数", async () => {
    vi.mocked(logsService.list).mockResolvedValue(emptyPage)

    const { wrapper } = createWrapper()
    const params = { page: 2, module: "user" }
    const { result } = renderHook(() => useLogs(params), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(logsService.list).toHaveBeenCalledWith(params)
    expect(result.current.data).toEqual(emptyPage)
  })

  it("不同筛选参数落到不同 query key（缓存分 key）", async () => {
    vi.mocked(logsService.list).mockResolvedValue(emptyPage)
    const { queryClient, wrapper } = createWrapper()

    const first = renderHook(() => useLogs({ page: 1 }), { wrapper })
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
    const second = renderHook(() => useLogs({ page: 2 }), { wrapper })
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true))

    const keys = queryClient
      .getQueryCache()
      .getAll()
      .map((query) => query.queryKey)
    expect(keys).toContainEqual(logKeys.list({ page: 1 }))
    expect(keys).toContainEqual(logKeys.list({ page: 2 }))
  })

  it("enabled=false → 不发起请求", () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useLogs({}, { enabled: false }), {
      wrapper,
    })

    expect(result.current.isPending).toBe(true)
    expect(result.current.fetchStatus).toBe("idle")
    expect(logsService.list).not.toHaveBeenCalled()
  })
})
