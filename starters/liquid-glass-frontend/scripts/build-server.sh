#!/bin/sh
set -eu

# 一站式容器/本地构建入口
#
# 单一入口的好处：
#   ▸ Dockerfile builder 层只需一行 `RUN sh scripts/build-server.sh` 触发；
#     避免 inline `RUN a && b && c \` 多步续行带来的 shell 转义 / 报错定位
#     困难 / 单步改动 invalidate 整层缓存等经典坑点。
#   ▸ 本地无 Docker 环境时可直接 `sh scripts/build-server.sh` 复现容器内产物，
#     便于排查构建报错（`set -eu` + 行号错误定位远比 Dockerfile RUN 友好）。
#
# 产物：
#   dist/server              api 单文件二进制（bun --compile，自带 runtime）
#   apps/web/dist/           前端静态资源（Vite build）
# 二者均由 Dockerfile runner 阶段 `COPY --from=builder` 分别拷入镜像。

echo '[build-server] 1/3 build shared package'
bun run build:shared

echo '[build-server] 2/3 compile api server binary (bun --compile)'
# 输出到根级 dist/server，与 Dockerfile 的 COPY --from=builder /app/dist/server 对齐
bun build apps/api/src/index.ts --compile --outfile dist/server

echo '[build-server] 3/3 build web static assets (apps/web/dist)'
bun run build:web

echo '[build-server] done -> dist/server, apps/web/dist'
