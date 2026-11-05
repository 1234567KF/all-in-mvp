/**
 * TanStack Query 客户端配置
 * 服务端状态统一由 Query 管理（hooks/queries/），Zustand 仅存 auth 与 UI 状态
 */
import {
  type MutationFunctionContext,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query"

import { extractErrorMessage } from "@/lib/errors"
import { showError } from "@/lib/toast"
import { useAuthStore } from "@/stores/auth"

// 错误 toast 去重：相同 message 在窗口期内只弹一次，避免多 query 同时失败时 toast 堆叠
const recentErrors = new Map<string, number>()
const DEDUP_MS = 3000

/**
 * mutation 失败的全局默认处理：console 记录 + toast 提示。
 *
 * 生效范围：写在 useMutation options 里的 onError 会在 defaultMutationOptions
 * merge 时覆盖本默认处理；但 `mutate(vars, { onError })` 的调用点回调属于
 * MutationObserver 层，与底层 options.onError 是两层，二者都会执行。
 * 因此调用点若要自定义提示文案，必须同时在 mutation options 声明
 * `meta: { silentError: true }` 抑制本处 toast，否则同一错误会弹两次。
 * 文案优先服务端 message，兜底由 extractErrorMessage 提供（网络错误统一中文）。
 */
function defaultMutationErrorHandler(
  error: Error,
  _variables: unknown,
  _onMutateResult: unknown,
  context: MutationFunctionContext
): void {
  // 保留 console.error：即便 UI 已提示，排查问题仍需要完整错误对象
  console.error("[mutation] failed:", error)
  if (context.meta?.silentError === true) return
  showError(extractErrorMessage(error))
}

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
      // mutation 失败默认弹 toast，避免提交失败静默无反馈；
      // 已在调用点自行处理错误（自有 onError / 更友好文案）时用 meta.silentError 抑制
      onError: defaultMutationErrorHandler,
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
