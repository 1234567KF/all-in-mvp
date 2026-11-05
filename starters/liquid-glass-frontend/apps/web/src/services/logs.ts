/**
 * Logs service — 封装 /logs 审计日志只读查询
 *
 * 契约（wire 类型唯一事实源：packages/shared/src/audit.ts）：
 * - GET /logs?page&pageSize&keyword&module&eventType&result&severity&startTime&endTime
 *   → { items, total, page, pageSize, totalPages }
 *
 * 后端响应信封统一为 { success, message, data }，故业务数据取 `res.data.data`。
 * 只读接口：不提供写审计的方法（审计只能由服务端 writeLog 产生）。
 */
import type { AuditLog, AuditLogQuery, PagedResult } from "shared"

import { api } from "@/lib/api"

/** 列表查询参数：复用 shared 的 query 契约（缺省由后端按 page=1 / pageSize=20 处理） */
export type LogListParams = Partial<AuditLogQuery>

export const logsService = {
  list: async (params: LogListParams = {}): Promise<PagedResult<AuditLog>> => {
    const res = await api.get("/logs", { params })
    return res.data.data
  },
}
