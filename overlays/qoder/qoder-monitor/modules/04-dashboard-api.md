# M04: dashboard-api — 看板数据 API

## 模块职责

- **做什么**: 实现 F-005（实时看板展示），整合 Token 统计、成本估算、优化节省、模型分布和最近轮次数据，一次 API 调用返回完整看板数据
- **不做什么**: 不独立实现统计计算（复用 M03），不生成 HTML 页面（归 M05）

## 依赖

| 模块ID | 依赖关系 | 说明 |
|--------|---------|------|
| M02 | 必须 | turns-api 提供轮次数据查询 |
| M03 | 必须 | stats-api 提供统计计算 |

## 领域标注

- **领域**: 业务核心
- **类型**: 后端 (API)

## 核心文件

| 文件路径 | 职责 |
|---------|------|
| `backend/src/api/dashboard/index.ts` | 路由注册 |
| `backend/src/api/dashboard/handlers.ts` | 请求处理器（getDashboardSummary） |

## 接口清单

### GET /api/dashboard/summary — 实时看板汇总

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| session_id | string | 否 | 按会话筛选 |

**响应数据结构**:
```json
{
  "ok": true,
  "data": {
    "summary_cards": {
      "total_calls": 150,
      "total_input_tokens": 2500000,
      "cache_hit_rate": 35.5,
      "total_output_tokens": 800000,
      "model_switch_count": 3,
      "model_count": 4,
      "estimated_cost": 4.395,
      "total_savings": 15000,
      "currency": "¥"
    },
    "model_distribution": [
      { "model": "deepseek-v4-pro", "call_count": 80, "percentage": 53.3 }
    ],
    "cost_breakdown": [
      { "model": "deepseek-v4-pro", "call_count": 80, "input_cost": 3.143, "output_cost": 1.252, "total_cost": 4.395 }
    ],
    "savings_breakdown": {
      "mechanisms": { "lean_ctx": 10000, "l1_cache": 5000 },
      "total_savings": 15000
    },
    "recent_turns": [ /* 最近 50 条 Turn */ ],
    "sessions": [ /* 会话列表 */ ]
  }
}
```

## 业务规则

| 编号 | 规则 | 处理方式 |
|------|------|---------|
| BR-010 | IF 数据库无记录 THEN 空态提示"暂无数据" | 不报错，友好提示 |
| BR-011 | IF 模型无定价 THEN 成本列显示"无定价" | 不影响其他模型 |
| BR-012 | IF 缓存率 > 50% THEN 卡片绿色样式 | 视觉提示高缓存率 |

## 验收标准

### Happy Path
- AC-005: GET /api/dashboard/summary 返回完整看板数据
  - summary_cards 包含全部 8 个统计字段
  - model_distribution 按模型分组正确
  - cost_breakdown 成本计算准确
  - savings_breakdown 优化节省正确
  - recent_turns 返回最近 50 条
  - sessions 返回会话列表

### Exception Path
- 数据库无数据时返回空态数据（各字段为 0 或空数组）
- 无定价模型的成本数据正确标记
- 指定不存在的 session_id 时返回空数据

---

**【锁定版】** 已通过 Grill 审查
