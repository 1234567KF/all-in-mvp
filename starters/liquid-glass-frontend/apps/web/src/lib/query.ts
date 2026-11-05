/**
 * TanStack Query 客户端配置
 * 服务端状态统一由 Query 管理（hooks/queries/），Zustand 仅存 auth 与 UI 状态
 */
import { QueryCache, QueryClient } from "@tanstack/react-query"

import { extractErrorMessage } from "@/lib/errors"
import { showError } from "@/lib/toast"
import { useAuthStore } from "@/stores/auth"

// 错误 toast 去重：相同 message 在窗口期内只弹一次，避免多 query 同时失败时 toast 堆叠
const recentErrors = new Map<string, number>()
const DEDUP_MS = 3000

export const queryClient = new QueryClient({
  // 查询失败统一 toast（v5 中 useQuery 无 onError，需在 QueryCache 层处理）；
  // 文案优先取 meta.errorMessage，其次服务端 message
  queryCache: new QueryCache({
    onError: (err, query) => {
      console.error("[query] failed:", query.queryKey, err)
      const fallback =
        typeof query.meta?.errorMessage === "string"
          ? query.meta.errorMessage
          : "加载数据失败，请刷新重试"
      const msg = extractErrorMessage(err) || fallback
      const now = Date.now()
      if (now - (recentErrors.get(msg) ?? 0) < DEDUP_MS) return
      recentErrors.set(msg, now)
      showError(msg)
    },
  }),
  defaultOptions: {
    queries: {
      // staleTime 0：每次页面 mount 都拉取最新；
      // 同页面多组件共享同一 query 仍去重（mount 期间缓存为 fresh）；
      // 低频数据可在对应 hook 单独设更长 staleTime
      staleTime: 0,
      retry: 1,
      refetchOnWindowFocus: false,
      throwOnError: false,
    },
    mutations: {
      // mutation 错误由调用方 try/catch 处理（字段级错误合并等），
      // 此处仅兜底未捕获场景
      onError: (err) => {
        console.error("[mutation] failed:", err)
      },
    },
  },
})

// 登出（含 refresh 失败自动登出）时清空查询缓存：
// 同一 tab 切换账号时，避免新账号先看到上一账号缓存的列表/角标数据。
useAuthStore.subscribe((state, prevState) => {
  if (prevState.accessToken && !state.accessToken) {
    queryClient.clear()
  }
})
