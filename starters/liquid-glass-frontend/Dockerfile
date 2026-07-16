# ── Stage 1: Builder ──
FROM registry.cn-beijing.aliyuncs.com/wecode-cloud/bun:1-alpine AS builder
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile

COPY . .

ENV NODE_ENV=production
# 构建三步（shared / api compile / web）统一抽到 scripts/build-server.sh：
# 单行 RUN 保持镜像层稳定，同时脚本本地可复现容器内产物。见 ci-guide §1.6。
RUN sh scripts/build-server.sh

# ── Stage 2: Runner ──
FROM registry.cn-beijing.aliyuncs.com/wecode-cloud/alpine:3.20
WORKDIR /app

# server 二进制、前端 dist、迁移文件、数据目录
COPY --from=builder /app/dist/server ./server
COPY --from=builder /app/apps/api/drizzle ./drizzle
COPY --from=builder /app/apps/web/dist ./web

RUN apk add --no-cache libstdc++ && \
    mkdir -p /app/data

# 生产环境：Hono 直接托管 /app/web 静态文件并处理 /api 路由
ENV NODE_ENV=production
EXPOSE 3000
CMD ["./server"]
