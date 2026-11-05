/**
 * Log 域 Query hooks — 审计日志只读列表（服务端分页 + 多维筛选）
 *
 * 查询参数直接作为 query key 的一部分：筛选或翻页即新 key，由 TanStack Query
 * 负责缓存与去重；placeholderData 保留上一页数据，翻页时表格不闪空。
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { logKeys } from "@/lib/query-keys"
import { type LogListParams, logsService } from "@/services/logs"

export interface UseLogsOptions {
  /** 是否发起请求；无 audit:view 权限时前端可关闭避免无意义 403 */
  enabled?: boolean
}

export function useLogs(
  params: LogListParams = {},
  options: UseLogsOptions = {}
) {
  const { enabled = true } = options

  return useQuery({
    queryKey: logKeys.list(params),
    queryFn: () => logsService.list(params),
    enabled,
    placeholderData: keepPreviousData,
    meta: { errorMessage: "加载审计日志失败" },
  })
}
