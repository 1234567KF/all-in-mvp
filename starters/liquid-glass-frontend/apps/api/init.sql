-- 模板数据库初始化脚本（DO NOT EDIT）
-- 由 apps/api/src/db/schema.ts 自动生成；修改 schema 后运行：
--   bun --filter api db:init:generate
-- 模板部署级别无记忆：空库时直接执行本脚本（不维护迁移链）。
-- scaffold 生成的项目会删除本文件并改用 drizzle 迁移。
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`operator` text,
	`operatorId` text,
	`operatorAccount` text,
	`operatorRole` text,
	`eventType` text,
	`module` text,
	`target` text,
	`targetId` text,
	`ipAddress` text,
	`result` text,
	`severity` text,
	`detail` text,
	`userAgent` text,
	`requestId` text,
	`changes` text,
	`createTime` text NOT NULL,
	CONSTRAINT "audit_logs_severity_check" CHECK("audit_logs"."severity" IN ('info', 'warning', 'error', 'critical')),
	CONSTRAINT "audit_logs_result_check" CHECK("audit_logs"."result" IN ('success', 'failure'))
);
--> statement-breakpoint
CREATE INDEX `idx_audit_create_time` ON `audit_logs` (`createTime`);--> statement-breakpoint
CREATE INDEX `idx_audit_module` ON `audit_logs` (`module`);--> statement-breakpoint
CREATE INDEX `idx_audit_operator` ON `audit_logs` (`operator`);--> statement-breakpoint
CREATE INDEX `idx_audit_operator_id` ON `audit_logs` (`operatorId`);--> statement-breakpoint
CREATE INDEX `idx_audit_event_type` ON `audit_logs` (`eventType`);--> statement-breakpoint
CREATE INDEX `idx_audit_module_target` ON `audit_logs` (`module`,`targetId`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`recipientId` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`payload` text,
	`isRead` integer DEFAULT 0 NOT NULL,
	`readTime` text,
	`createTime` text NOT NULL,
	`dedupeKey` text
);
--> statement-breakpoint
CREATE INDEX `idx_notification_recipient_create` ON `notifications` (`recipientId`,`createTime`,`id`);--> statement-breakpoint
CREATE INDEX `idx_notification_recipient_read` ON `notifications` (`recipientId`,`isRead`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_notification_recipient_dedupe` ON `notifications` (`recipientId`,`dedupeKey`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`role` text DEFAULT 'user',
	`password` text,
	`created_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
