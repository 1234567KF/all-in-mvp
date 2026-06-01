---
name: kf-mvp-onboarding
description: >-
  Load when user asks for onboarding guide, project setup, or development
  environment configuration. Triggers: 新人 onboarding, 项目初始�? 开发环�?
  setup, 环境配置, onboarding guide, 开发环境配�? Also load when new
  team members join or setting up new machines.
metadata:
  pattern: generator
  domain: mvp-stage4
recommended_model: mino-v2.5-pro
graph:
  dependencies:
    - target: kf-mvp-arch-expert
      type: semantic
    - target: all-in-mvp
      type: semantic
---

**Default Tech Stack Context**: 
- Backend: Node.js + Hono + Drizzle ORM + SQLite
- Frontend: Vue 3 + Vite + Pinia + Vue Router + Axios
- Testing: Vitest + Playwright
- Third-party: ALL Mock

Load `references/mvp-tech-stack-default.md` for full specification.


# MVP Onboarding �?项目入门技�?

> **Core Belief**: New developer experience sets the tone for everything. If it takes more than 30 minutes to run the app, something is wrong. First impressions matter.

**Division of Labor**: This Skill focuses on **developer onboarding** using Generator pattern. Creates step-by-step guides, environment setup scripts, and quick-start documentation.

---

# Core Philosophy

1. **30-minute rule** �?Developer should run the app in 30 minutes
2. **Zero ambiguity** �?Every step should work, no guessing
3. **Verify as you go** �?Confirm each step works
4. **Help is available** �?Point to who to ask for help

---

# Quick Start Guide (README.md Excerpt)

```markdown
# 快速开�?

## 前置要求

- Node.js 18+
- Git
- SQLite (可选，用于本地数据�?

## 步骤 1: 克隆代码

```bash
git clone https://github.com/your-org/project.git
cd project
```

## 步骤 2: 安装依赖

```bash
npm install
```

## 步骤 3: 配置环境

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置必要变量：

```env
DATABASE_URL=file:./data/mvp.db
JWT_SECRET=your-secret-key-at-least-32-chars
```

## 步骤 4: 初始化数据库

```bash
npm run db:push
npm run db:seed
```

## 步骤 5: 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 测试登录

```
Email: admin@example.com
Password: admin123
```

## 验证安装成功

```bash
npm test
```

如果所有测试通过，恭喜你，环境配置成功！

## 常见问题

### Q: 数据库错�?
A: 删除 `data/mvp.db` 然后重新运行 `npm run db:push`

### Q: 端口被占�?
A: 修改 `.env` 中的 `PORT=3001`
```

---

# Environment Setup Script

```bash
#!/bin/bash
# scripts/setup.sh

set -e

echo "🚀 Setting up development environment..."

# Check Node version
if ! command -v node &> /dev/null; then
    echo "�?Node.js is not installed"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "�?Node.js 18+ required, found v$NODE_VERSION"
    exit 1
fi

echo "�?Node.js version OK"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy environment file
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please update .env with your configuration"
else
    echo "�?.env already exists"
fi

# Initialize database
echo "🗄�? Initializing database..."
npm run db:push

echo "�?Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Update .env if needed"
echo "  2. Run: npm run dev"
echo "  3. Visit: http://localhost:3000"
```

---

# Architecture Overview

```markdown
# 项目架构

## 技术栈

| 层级 | 技�?| 说明 |
|------|------|------|
| 前端 | Vue 3 + Vite | 组件化开�?|
| 后端 | Hono + Drizzle | 轻量高性能 |
| 数据�?| SQLite/Turso | 嵌入式数据库 |
| 认证 | JWT | 无状态认�?|

## 目录结构

```
project/
├── src/
�?  ├── modules/          # 业务模块
�?  �?  ├── auth/         # 认证
�?  �?  ├── users/        # 用户
�?  �?  └── products/     # 产品
�?  ├── schema.ts         # 数据库Schema
�?  └── index.ts          # 入口文件
├── integration-tests/    # 集成测试
├── mocks/               # Mock服务
└── docs/                # 文档
```

## 数据�?

```
浏览�?�?Hono路由 �?Service �?Drizzle �?SQLite
         �?
      Middleware
      (认证/日志/错误处理)
```

## 关键文件

| 文件 | 作用 |
|------|------|
| `src/schema.ts` | 数据库Schema定义 |
| `src/index.ts` | 应用入口 |
| `src/modules/*/routes.ts` | 路由定义 |
| `src/modules/*/service.ts` | 业务逻辑 |
| `integration-tests/*.test.ts` | 测试用例 |
```

---

# Development Workflow

```markdown
# 开发流�?

## 1. 创建功能分支

```bash
git checkout -b feature/your-feature-name
```

## 2. 开发步�?

1. 写测�?(TDD)
2. 实现功能
3. 重构代码
4. 确保测试通过

## 3. 提交代码

```bash
git add .
git commit -m "feat: add new feature"
```

Commit类型:
- feat: 新功�?
- fix: 修复bug
- docs: 文档更新
- refactor: 重构
- test: 测试
- chore: 杂项

## 4. 推送并创建PR

```bash
git push origin feature/your-feature-name
```

在GitHub创建Pull Request，等待Review�?

## 5. 合并到main

代码Review通过后，合并到main分支�?
```

---

# Help Resources

```markdown
# 帮助资源

## 文档
- [项目Wiki](../wiki/Home)
- [API文档](../docs/api.md)

## 团队
- 技术负责人: @tech-lead
- 产品经理: @pm
- 值班: #daily-standup

## 遇到问题�?
1. 查阅文档
2. 搜索内部Slack
3. 问同�?
4. 创建Issue
```

---

# Onboarding Checklist

## Day 1
- [ ] Git repo access
- [ ] Development environment setup
- [ ] Run the app locally
- [ ] Understand project structure
- [ ] Meet the team

## Week 1
- [ ] Complete first small task
- [ ] Run full test suite
- [ ] Submit first PR
- [ ] Understand architecture
- [ ] Know where to find help

## First Month
- [ ] Complete one feature end-to-end
- [ ] Participated in code review
- [ ] Understand testing strategy
- [ ] Contributing to documentation
- [ ] Comfortable with the codebase

---

# Constraints

**MUST DO:**
- Keep setup under 30 minutes
- Provide verification steps
- Include troubleshooting
- Point to help resources

**MUST NOT DO:**
- Assume prior knowledge
- Skip verification steps
- Leave troubleshooting gaps
- Forget Windows/Linux differences

---

# Gotchas

- **Node version** �?Use nvm for version management
- **Database path** �?Use relative paths for portability
- **Port conflicts** �?Document common ports and alternatives
- **VPN** �?Some environments need VPN for internal services
- **Time zones** �?Always use UTC in code, localize in UI