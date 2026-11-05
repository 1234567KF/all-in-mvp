/**
 * User 域 Query hooks — 服务端状态统一由 TanStack Query 管理
 * 对应 starter 现有 users API（GET/PUT /users/me）；
 * 后续扩展列表/详情端点时按 userKeys.list()/detail() 约定补充
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { userKeys } from "@/lib/query-keys"
import { type UpdateMeInput, usersService } from "@/services/users"

export function useCurrentUser() {
  return useQuery({
    queryKey: userKeys.me(),
    queryFn: () => usersService.me(),
    meta: { errorMessage: "加载用户信息失败" },
  })
}

export function useUpdateCurrentUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateMeInput) => usersService.updateMe(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  })
}
