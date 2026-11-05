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
# bun-runtime 基础镜像已预装 libstdc++ / ca-certificates / tzdata（见 ci-tools/runtime.Dockerfile）
FROM registry.cn-beijing.aliyuncs.com/wecode-cloud/bun-runtime:alpine-3.20
WORKDIR /app

# server 二进制、前端 dist、数据库结构来源（init.sql 或 drizzle/）、数据目录
COPY --from=builder /app/dist/server ./server
# builder 由 scripts/build-server.sh 统一准备：模板放 init.sql，生成项目放 drizzle/
COPY --from=builder /app/db-bootstrap ./db-bootstrap
COPY --from=builder /app/apps/web/dist ./web

RUN mkdir -p /app/data
# 升级注意：若使用 Docker named volume（非 bind mount）挂载 /app/data，
# 旧容器以 root 写入的文件在切换非 root 后需手动修正权限：
#   docker run --rm -v <volume_name>:/data alpine chown -R 1001:1001 /data
# bind mount 场景由 deploy.sh 中 chown 兖底。

# 非 root 运行：appuser(1001) 与 deploy.sh 中宿主机 data 目录 chown 保持一致
RUN addgroup -g 1001 appuser && \
    adduser -D -u 1001 -G appuser appuser && \
    chown -R appuser:appuser /app
USER appuser

# 生产环境：Hono 直接托管 /app/web 静态文件并处理 /api 路由
ENV NODE_ENV=production
EXPOSE 3000
CMD ["./server"]
