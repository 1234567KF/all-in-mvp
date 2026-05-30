---
name: kf-mvp-devops
description: >-
  Load when user asks for MVP deployment, CI/CD setup, or simple hosting
  configuration. Triggers: 部署, CI/CD, 持续集成, 自动化部�? deployment,
  cicd, github actions, docker, 环境配置. NOT for: production Kubernetes
  setup, multi-region deployment, or enterprise infrastructure.
metadata:
  pattern: tool-wrapper
  domain: mvp-stage4
recommended_model: minimax-m2.7
graph:
  dependencies:
    - target: kf-mvp-integration
      type: conditional
    - target: all-in-mvp
      type: semantic
---

# MVP DevOps �?部署与运维技�?

> **Core Belief**: Deployment should be boring. If shipping is exciting, your process needs work. Automate everything, deploy with confidence.

**Division of Labor**: This Skill focuses on **deployment automation and DevOps setup** using Tool Wrapper pattern. Provides CI/CD templates, Dockerfile, and deployment scripts.

**Default Tech Stack Context**:
- Runtime: Node.js 20+ Alpine
- Database: SQLite (single file, no external DB service needed)
- Deploy target: `npm run dev` for demo, Docker for simple hosting
- No external services: No Redis, no Postgres, no message queue

Load `references/mvp-tech-stack-default.md` for full specification.

**MVP Deployment Scope**: Simple container or `npm start` deployment only. No K8s, no multi-region, no auto-scaling.

---

# Core Philosophy

1. **Automate everything** �?Manual deployments are error-prone
2. **Reproducible builds** �?Same artifact, every time
3. **Zero-downtime deploy** �?Users shouldn't notice deployments
4. **Fast feedback** �?CI should catch issues before production

---

# Project Structure

```
.
├── Dockerfile           # Container definition
├── docker-compose.yml  # Local dev environment
├── .github/
�?  └── workflows/
�?      ├── ci.yml      # CI pipeline
�?      └── deploy.yml  # Deploy pipeline
├── .env.example        # Environment template
└── scripts/
    ├── migrate.ts      # DB migration
    └── seed.ts         # Data seeding
```

---

# Dockerfile Template

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

---

# Docker Compose Template

```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: mvp
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - db_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  api:
    build: .
    environment:
      DATABASE_URL: postgres://postgres:postgres@db:5432/mvp
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "3000:3000"
    depends_on:
      - db
    volumes:
      - ./data:/app/data

volumes:
  db_data:
```

---

# GitHub Actions CI Template

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Type check
        run: npm run typecheck
      
      - name: Run tests
        run: npm run test:ci
      
      - name: Build
        run: npm run build
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

---

# GitHub Actions Deploy Template

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Fly.io
        uses: Supercharge/flyio-actions@v1
        with:
          args: deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

---

# Fly.io Configuration

```toml
# fly.toml
app = "mvp-app"
primary_region = "nrt"

[build]

[deploy]
  release_command = "npm run migrate"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  memory = "256mb"
  cpu_kind = "shared"
  cpus = 1
```

---

# Environment Variables

```bash
# .env.example

# Database
DATABASE_URL=postgres://user:pass@localhost:5432/mvp

# Auth
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d

# API
API_BASE_URL=http://localhost:3000/api
CORS_ORIGIN=http://localhost:5173

# External Services
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=hello@example.com
SMTP_PASSWORD=password

# Optional
LOG_LEVEL=info
```

---

# Deployment Checklist

## Pre-Deploy
- [ ] All tests pass
- [ ] Build succeeds
- [ ] Environment variables configured
- [ ] Database migrations tested
- [ ] Rollback plan prepared

## Post-Deploy
- [ ] Health check passes
- [ ] Smoke tests pass
- [ ] No error rate spike
- [ ] Performance acceptable

## Monitoring
- [ ] Error tracking active (Sentry)
- [ ] Logs aggregated
- [ ] Alerts configured
- [ ] Dashboard accessible

---

# Constraints

**MUST DO:**
- Automate deployment process
- Use environment variables
- Include rollback capability
- Monitor deployment health

**MUST NOT DO:**
- Deploy manually to production
- Commit secrets to repo
- Skip health checks
- Deploy without tests passing

---

# Gotchas

- **Secrets** �?Store in GitHub Secrets or platform secrets manager
- **Migration timing** �?Run migrations before starting new app version
- **Health check** �?Implement /health endpoint returning 200 when ready
- **Graceful shutdown** �?Handle SIGTERM, drain connections
- **Rollback** �?Keep previous working image tagged for quick rollback