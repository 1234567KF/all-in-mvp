# 可复跑脚本与跨平台复现性验证

> 来源：《手动驾驶体验军团白皮书》§7.4、§7.6

## 一键脚本的硬性要求

根目录下必须存在以下脚本，任何一个 Agent 执行后都能得到一致结果：

| 脚本 | 用途 | 通过条件 | 预计耗时 |
|------|------|---------|---------|
| `scripts/setup.sh` | 新环境一键就绪 | `npm install && npm run db:push && npm run db:seed` 全部成功 | 2-5min |
| `scripts/run-all-tests.sh` | 运行全部测试 | 所有 `*.test.ts` 全部通过 | 视规模 |
| `scripts/run-smoke.sh` | 运行 MSVP 冒烟 | 启动应用 + Playwright 菜单检查 + 核心旅程全通过 | 15-30min |
| `scripts/verify-delivery.sh` | 交付前全量门禁 | setup + all-tests + smoke + lint + 复现性检查 全部通过 | 全量 |

**每个脚本必须**：
1. 在文件头注释写清楚：做什么、依赖什么、退出码含义
2. 使用绝对路径或 `__dirname` 相对路径（不依赖 `pwd` 在哪个目录）
3. 失败时输出具体错误（不允许静默失败）
4. 幂等——跑两次不会因为数据已存在而失败

---

## 脚本模板示例

### scripts/run-smoke.sh

```bash
#!/bin/bash
# scripts/run-smoke.sh
# ========================================
# 用途：执行 MSVP 冒烟验证（Standard 等级）
# 依赖：Node.js >=18, npm >=9, Chrome（Playwright 自动安装）
# 退出码：
#   0 — 冒烟通过，A1-A8 全部清零
#   1 — 有 A 类阻塞 Bug（见 MSVP 报告）
#   2 — 环境准备失败（依赖缺失、端口占用等）
# ========================================
set -e

echo "🔥 MSVP 冒烟验证开始..."
echo ""

# Step 1: 环境检查
node --version || { echo "❌ Node.js 未安装"; exit 2; }

# Step 2: 冷启动
npm install --frozen-lockfile
npm run db:push
npm run dev &
DEV_PID=$!
sleep 3  # 等待服务器就绪

# Step 3: 执行冒烟
npx playwright test tests/smoke/ --reporter=html

# Step 4: 清理
kill $DEV_PID

echo ""
echo "✅ MSVP 冒烟完成。报告：tests/smoke/smoke-report.html"
```

### scripts/seed-db.ts

```typescript
// scripts/seed-db.ts
// 用途：为开发和测试环境提供一致的初始数据
// 约束：幂等。多次执行不会重复插入。

import { db } from '../src/db';
import { users, products, categories } from '../src/db/schema';

export async function seed() {
  // 使用 ON CONFLICT DO NOTHING 保证幂等
  await db.insert(users).values([
    { email: 'admin@test.com', name: '管理员', role: 'admin' },
    { email: 'operator@test.com', name: '操作员', role: 'operator' },
  ]).onConflictDoNothing();

  await db.insert(categories).values([
    { name: '电子产品' },
    { name: '食品饮料' },
  ]).onConflictDoNothing();

  console.log('✅ 种子数据就绪（已跳过重复数据）');
}

// 直接运行
seed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
```

### scripts/setup.sh

```bash
#!/bin/bash
# scripts/setup.sh
# ========================================
# 用途：新环境一键就绪（安装依赖 + 初始化数据库 + 种子数据）
# 依赖：Node.js >=18, npm >=9
# 退出码：
#   0 — 环境就绪
#   1 — 安装或初始化失败
# ========================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "📦 环境初始化开始..."
echo "项目目录：$PROJECT_ROOT"
echo ""

cd "$PROJECT_ROOT"

# Step 1: 安装依赖
echo "→ npm install..."
npm install --frozen-lockfile || { echo "❌ 依赖安装失败"; exit 1; }

# Step 2: 初始化数据库
echo "→ 数据库初始化..."
npm run db:push || { echo "❌ 数据库初始化失败"; exit 1; }

# Step 3: 种子数据
echo "→ 种子数据..."
npm run db:seed || { echo "❌ 种子数据失败"; exit 1; }

echo ""
echo "✅ 环境就绪。可以运行 npm run dev 启动开发服务器。"
```

### scripts/verify-delivery.sh

```bash
#!/bin/bash
# scripts/verify-delivery.sh
# ========================================
# 用途：交付前全量门禁（环境+测试+冒烟+复现性）
# 依赖：Node.js >=18, npm >=9, Chrome, Git
# 退出码：
#   0 — 全部通过，可以交付
#   1 — 有测试或冒烟失败
#   2 — 环境准备失败
#   3 — 复现性检查失败
# ========================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🏁 交付前全量验证开始..."
echo ""

# 1. 环境初始化
echo "=== Step 1/5: 环境初始化 ==="
bash scripts/setup.sh || { echo "❌ 环境初始化失败"; exit 2; }

# 2. 全量测试
echo "=== Step 2/5: 全量测试 ==="
bash scripts/run-all-tests.sh || { echo "❌ 测试失败"; exit 1; }

# 3. MSVP 冒烟
echo "=== Step 3/5: MSVP 冒烟验证 ==="
bash scripts/run-smoke.sh || { echo "❌ 冒烟验证失败"; exit 1; }

# 4. 复现性检查
echo "=== Step 4/5: 复现性检查 ==="
echo "4.1 测试数据独立性验证..."
rm -f *.db *.db-journal
npm run test -- --no-cache || { echo "❌ 测试数据不独立"; exit 3; }

echo "4.2 脚本幂等性验证..."
bash scripts/setup.sh || { echo "❌ setup.sh 幂等性失败"; exit 3; }
bash scripts/setup.sh || { echo "❌ setup.sh 二次执行失败"; exit 3; }

# 5. 冷启动验证（全新 clone）
echo "=== Step 5/5: 冷启动验证 ==="
TEMP_DIR=$(mktemp -d)
git clone . "$TEMP_DIR/verify-delivery"
cd "$TEMP_DIR/verify-delivery"
bash scripts/setup.sh || { echo "❌ 冷启动 setup 失败"; exit 3; }
bash scripts/run-all-tests.sh || { echo "❌ 冷启动测试失败"; exit 3; }
bash scripts/run-smoke.sh || { echo "❌ 冷启动冒烟失败"; exit 3; }
cd "$PROJECT_ROOT"
rm -rf "$TEMP_DIR"

echo ""
echo "✅ 交付前全量验证通过。可以交付。"
```

---

## 跨平台复现性验证（§7.6）

交付前（Stage4 末尾，MSVP-4 之前），必须通过以下复现性检查：

### 检查项目

| 检查 | 方法 | 通过条件 |
|------|------|---------|
| **冷启动验证** | 全新 clone → setup → all-tests → smoke | 全部通过 |
| **测试数据独立性** | 删除所有本地数据库 → 重新运行测试 | 全部通过（不依赖预置数据） |
| **脚本幂等性** | setup.sh 连续执行两次 | 两次都成功（不因数据已存在而失败） |

### 复现性门禁

以上任何一步失败 → 禁止交付。标记为 `BLOCKED(reproducibility)` → 对应 Agent 修复导致不可复现的产物 → 重新执行全量复现性检查。

---

## 测试产物的三位一体规范

每个测试场景必须是三件套齐全的，不允许只有代码没有数据：

```
每一个测试文件 <name>.test.ts 必须配套：

  <name>.test.ts          ← 测试代码（怎么测）
  <name>-fixtures.ts      ← 测试数据（用什么数据测）
  <name>-README.md        ← 测试说明（测了什么、为什么测、覆盖了哪些验收标准）
```

| 缺失项 | 后果 | 门禁 |
|--------|------|------|
| 缺 fixtures | 测试数据硬编码，换环境跑不起来 | ❌ 测试文件不被视为完整 |
| 缺 README | 其他 Agent 不知道这个测试在测什么 | ⚠️ 警告，交付前补齐 |
| fixtures 与代码分离 | 测试不可独立复现 | ❌ 视为未完成 |

### fixtures 的硬约束

- 不允许 `@depends_on: other_test`
- 每个 fixture 文件必须完全独立
- 通过工厂函数 + 自增 ID 避免数据冲突
- Agent 写测试时如果发现自己的 fixture 依赖了别人的数据 → 视为设计错误
