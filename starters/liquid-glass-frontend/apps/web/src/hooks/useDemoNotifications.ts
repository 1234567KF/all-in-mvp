/**
 * useDemoNotifications — starter 演示用的消息状态
 *
 * 仅用于 demo：内存态、无持久化、不做服务端同步。
 * `initialNotifications` 只作为挂载时快照；reset 会回到该快照。
 * 真实业务请按 AGENTS.md 约定走 `hooks/queries/` + `services/`，
 * 并把接口数据映射成 NotificationItem（read/createdAt 为 UI view model）。
 */
import { useCallback, useMemo, useRef, useState } from "react"

import {
  getUnreadCount,
  type NotificationItem,
} from "@/components/shared/notification-config"
import { DEMO_NOTIFICATIONS } from "@/lib/demo-notifications"

function cloneNotifications(
  notifications: readonly NotificationItem[]
): NotificationItem[] {
  return notifications.map((notification) => ({ ...notification }))
}

export function useDemoNotifications(
  initialNotifications: readonly NotificationItem[] = DEMO_NOTIFICATIONS
) {
  const initialRef = useRef(initialNotifications)
  const [notifications, setNotifications] = useState<NotificationItem[]>(() =>
    cloneNotifications(initialNotifications)
  )

  const unreadCount = useMemo(
    () => getUnreadCount(notifications),
    [notifications]
  )

  const markRead = useCallback((id: string) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    )
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, read: true }))
    )
  }, [])

  const remove = useCallback((id: string) => {
    setNotifications((current) =>
      current.filter((notification) => notification.id !== id)
    )
  }, [])

  const reset = useCallback(() => {
    setNotifications(cloneNotifications(initialRef.current))
  }, [])

  return {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    remove,
    reset,
  }
}
