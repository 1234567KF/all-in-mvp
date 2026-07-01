# 压缩默认开启规则 (UltraCostEffective L1)

> **always-on: true** | **scope: global** | **priority: medium**

## 规则说明

UltraCostEffective L1 层压缩（tokenforge + lean-ctx）默认**全自动开启**，无需用户手动触发。

## 自动压缩覆盖范围

### 输出压缩（tokenforge）

| 命令类型 | 压缩模式 | 触发条件 |
|----------|----------|----------|
| 测试运行 | aggressive | npm test / cargo test / pytest / jest |
| 构建输出 | aggressive | npm run build / cargo build / make |
| 代码检查 | medium | eslint / tsc / cargo clippy / go vet |
| 搜索输出 | medium | grep / rg / find |
| 目录列表 | light | ls / dir / tree |
| API 响应 | auto | curl / wget (含 json/api) |
| JSON 数据 | json | 自动检测 JSON 格式 |

### 上下文压缩（lean-ctx）

| 操作 | 模式 | 说明 |
|------|------|------|
| 文件读取 | signatures → full | 优先签名，按需深入 |
| 重复读取 | cache | ~13 tokens 命中缓存 |
| 目录浏览 | tree(2) | 深度2的紧凑目录映射 |
| 搜索 | ctx_search | 紧凑Token高效结果 |

## 排除规则

以下命令**不会**被自动压缩（tokenforge-hook.cjs 自动跳过）：

- 交互式命令: git push/commit, npm install, vim, ssh, docker run -it
- 密码/认证: sudo, passwd, login
- 数据库 CLI: mysql, psql, sqlite3
- 编辑器: vim, nano, code, emacs

## 手动控制

### 环境变量

```bash
# 临时关闭所有压缩
export ULTRA_COST_EFFECTIVE_OFF=1

# 设置压缩级别
export ULTRA_COST_EFFECTIVE_LEVEL=light       # 温和压缩
export ULTRA_COST_EFFECTIVE_LEVEL=medium      # 标准压缩（默认）
export ULTRA_COST_EFFECTIVE_LEVEL=aggressive  # 极限压缩

# 恢复默认
unset ULTRA_COST_EFFECTIVE_OFF ULTRA_COST_EFFECTIVE_LEVEL
```

### 命令行标志

```bash
# 预览压缩效果（不实际压缩）
npm test -- --ultra-cost-effective-dry-run

# 手动指定压缩
npm test 2>&1 | node helpers/tokenforge.cjs compress output --level aggressive
```

## 恢复出厂设置

```bash
# 恢复到 standard 预设
node helpers/preset-switch.cjs standard
```
