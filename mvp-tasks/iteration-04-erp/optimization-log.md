# 迭代4：ERP系统 — 数据权限测试优化

## 需求描述

ERP系统有复杂的数据权限模型（行级/列级权限），不同角色、部门、组织只能看到部分数据。之前数据权限bug只在人工测试时发现（如：普通用户看到了其他部门的数据）。

## 系统类型
ERP系统 (Enterprise Resource Planning)

## 核心问题

1. **行级权限未测试**：user能否看到其他组织的数据？未测试
2. **列级脱敏缺失**：salary、ssn等敏感字段是否对低权限角色隐藏？未测试
3. **跨组织隔离缺失**：通过ID直接访问其他组织资源是否被阻断？未测试
4. **绕过尝试未测试**：通过query param注入orgId能否绕过过滤？未测试
5. **API权限矩阵缺失**：每个端点 × 每个角色的完整矩阵未验证

## 优化产出

### 1. kf-mvp-auth-implementation/SKILL.md — 新增数据权限测试章节

- 新增行级过滤测试（user/manager/admin三级数据范围）
- 新增列级脱敏测试（salary/ssn等敏感字段）
- 新增跨组织隔离测试（MUST阻断）
- 新增绕过尝试测试（query param注入）
- 新增API权限矩阵测试（it.each批量验证）
- 新增数据权限实现模板（DataPermissionConfig + rowFilter + columnMask）
- 新增数据权限测试覆盖率要求表

### 关键代码

```typescript
// 数据权限测试覆盖5个维度
- 行级过滤：每个角色 × 每个表
- 列级脱敏：每个敏感字段 × 每个角色
- 跨组织隔离：每个API端点
- 绕过尝试：每个过滤点
- API权限矩阵：每个端点 × 每个角色
```

### 2. 技能文件变更

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| skills/kf-mvp-auth-implementation/SKILL.md | 新增数据权限测试 | 行级+列级+隔离+绕过+矩阵 |
| .qoder/kf-mvp-auth-implementation/SKILL.md | 同步 | 与skills保持一致 |

## 验证方式

- 有头测试：运行数据权限测试，观察不同角色的数据范围
- 无头测试：CI中运行 `npx vitest run`，确保权限测试全部通过

## 迭代时间
2026-05-20
