# M06: system-api — 系统管理

## 模块职责

- **做什么**: 实现 F-012（数据重置）、F-013（健康检查）的 API 端点，提供系统管理功能
- **不做什么**: 不处理业务数据（归 M02/M03），不包含前端页面

## 依赖

| 模块ID | 依赖关系 | 说明 |
|--------|---------|------|
| M01 | 必须 | db-core 提供数据库操作 |

## 领域标注

- **领域**: 工具与配置
- **类型**: 后端 (API)

## 核心文件

| 文件路径 | 职责 |
|---------|------|
| `backend/src/api/system/index.ts` | 路由注册 |
| `backend/src/api/system/handlers.ts` | 请求处理器（clearAllData, healthCheck） |
| `backend/src/services/daemon.ts` | 守护进程管理（start/stop/status） |

## 接口清单

### DELETE /api/data — 清空所有数据 (F-012)

**操作**: 清空 turns、optimizations、sessions、timers 表，删除 JSONL 备份文件

**响应**:
```json
{
  "ok": true,
  "data": {
    "message": "所有数据已清空",
    "cleared_tables": ["turns", "optimizations", "sessions", "timers"]
  }
}
```

### GET /api/health — 健康检查 (F-013)

**响应**:
```json
{
  "ok": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-05-22T10:00:00.000Z",
    "db_connected": true,
    "db_size": 245760,
    "turn_count": 150
  }
}
```

### 守护进程命令 (F-013, CLI 工具，非 API)
| 命令 | 功能 |
|------|------|
| `perf-daemon start` | 后台启动 perf-server，PID 写入 .perf-server.pid |
| `perf-daemon stop` | 终止进程，删除 PID 文件（Windows 用 taskkill 强制） |
| `perf-daemon status` | 检查进程存活，输出 "running (pid X) -> http://localhost:3456" |
| `perf-daemon restart` | stop + start 组合 |

## 业务规则

| 编号 | 规则 | 处理方式 |
|------|------|---------|
| BR-022 | IF 文件不存在 THEN 静默跳过 | 继续处理其他文件 |
| BR-023 | IF start 时已有运行实例 THEN 提示已运行 | 不重复启动，输出 "already running" |
| BR-024 | IF stop 时 SIGTERM 失败 THEN 使用 taskkill | Windows 环境强制终止 |

## 验收标准

### Happy Path
- AC-012: DELETE /api/data 成功清空所有数据，返回确认信息
- AC-013: GET /api/health 返回健康状态，包含数据库连接和统计信息

### Exception Path
- 数据库文件已被删除时，清空操作静默跳过不存在的文件
- 数据库连接失败时，健康检查返回 db_connected=false（不抛 500）

---

**【锁定版】** 已通过 Grill 审查
