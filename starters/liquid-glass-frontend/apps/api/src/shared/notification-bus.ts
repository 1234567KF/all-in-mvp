/**
 * 消息通知总线 — 进程内实时推送通道（notify → SSE）
 *
 * 设计：
 * - `publish` 只负责把已落库的 Notification 广播给该收件人的在线订阅者；
 *   落库与推送的先后顺序由 shared/notification.ts 的 notify 保证（先落库后 publish）。
 * - `subscribe` 返回幂等的取消订阅函数；SSE 连接断开时必须调用，否则监听器泄漏。
 * - 订阅 handler 的异常在本层吞掉并写日志：一个坏订阅者不能影响其他连接，
 *   更不能把异常冒泡回 notify 的调用方（通知已落库，推送失败不应回滚/抛错）。
 *
 * ⚠️ 多实例部署：本实现基于 node:events 的进程内 EventEmitter，只有「处理
 * notify 的进程」能收到事件。水平扩容（多 pod / 多进程）后必须替换为 Redis
 * Pub/Sub（或同类消息中间件）实现 —— 只需另写一个 NotificationBus 实现替换
 * 下方单例，调用方（notify / SSE 路由）零改动。
 */
import { EventEmitter } from "node:events"

import type { Notification } from "shared"

import { reqLog } from "./logger.js"

/** 通知总线接口（进程内实现 / 未来 Redis 实现共用） */
export interface NotificationBus {
  /** 发布一条已落库的通知（按 recipientId 路由） */
  publish(notification: Notification): void
  /** 订阅某收件人的通知；返回取消订阅函数（幂等） */
  subscribe(
    recipientId: string,
    handler: (notification: Notification) => void
  ): () => void
}

/** 事件名：按收件人隔离，避免订阅者 A 收到 B 的消息 */
function eventName(recipientId: string): string {
  return `notification:${recipientId}`
}

/** 进程内 EventEmitter 实现（dev / 单实例生产可用） */
export class InMemoryNotificationBus implements NotificationBus {
  private readonly emitter = new EventEmitter()

  constructor() {
    // 同一收件人可同时开多个标签页/多端 SSE；放宽默认 10 个监听器的上限，
    // 但保留数值（0 = 不限制会掩盖真实泄漏）。
    this.emitter.setMaxListeners(100)
  }

  publish(notification: Notification): void {
    this.emitter.emit(eventName(notification.recipientId), notification)
  }

  subscribe(
    recipientId: string,
    handler: (notification: Notification) => void
  ): () => void {
    const wrapped = (notification: Notification) => {
      try {
        handler(notification)
      } catch (err) {
        reqLog().error(
          { err, recipientId: notification.recipientId },
          "notification.bus.listener.failed"
        )
      }
    }
    this.emitter.on(eventName(recipientId), wrapped)
    let subscribed = true
    return () => {
      if (!subscribed) return
      subscribed = false
      this.emitter.off(eventName(recipientId), wrapped)
    }
  }

  /** 当前某收件人的在线订阅数（SSE 连接数）——测试/诊断用 */
  listenerCount(recipientId: string): number {
    return this.emitter.listenerCount(eventName(recipientId))
  }
}

/** 全局单例：SSE 路由与 notify 共用（多实例部署时替换为 Redis 实现） */
export const notificationBus = new InMemoryNotificationBus()
