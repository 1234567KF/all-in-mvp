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

echo '[build-server] 0/4 prepare db bootstrap (init.sql or drizzle)'
# 结构来源守卫：init.sql（模板）与 drizzle/（生成项目）只能存在一份。
# 两者并存时无法判断部署该用哪份，直接失败而不是静默选 init.sql。
has_init_sql=0
has_drizzle=0
if [ -f apps/api/init.sql ]; then
  has_init_sql=1
fi
if [ -f apps/api/drizzle/meta/_journal.json ]; then
  has_drizzle=1
fi
if [ "$has_init_sql" -eq 1 ] && [ "$has_drizzle" -eq 1 ]; then
  echo 'ERROR: apps/api/init.sql 与 apps/api/drizzle/ 迁移并存；只保留一份结构来源（模板留 init.sql，生成项目留 drizzle/）' >&2
  exit 1
fi
if [ "$has_init_sql" -eq 0 ] && [ "$has_drizzle" -eq 0 ]; then
  echo 'ERROR: neither apps/api/init.sql nor apps/api/drizzle exists' >&2
  exit 1
fi

rm -rf db-bootstrap
mkdir -p db-bootstrap
if [ "$has_init_sql" -eq 1 ]; then
  # 模板仓库：部署级别无记忆，用单份 init.sql 空库初始化
  cp apps/api/init.sql db-bootstrap/init.sql
  echo '  -> template mode: init.sql'
else
  # scaffold 生成项目：保留 drizzle 迁移链
  cp -R apps/api/drizzle db-bootstrap/drizzle
  echo '  -> project mode: drizzle migrations'
fi

echo '[build-server] 1/4 build shared package'
bun run build:shared

echo '[build-server] 2/4 compile api server binary (bun --compile)'
# 输出到根级 dist/server，与 Dockerfile 的 COPY --from=builder /app/dist/server 对齐
bun build apps/api/src/index.ts --compile --outfile dist/server

echo '[build-server] 3/4 build web static assets (apps/web/dist)'
bun run build:web

echo '[build-server] done -> dist/server, apps/web/dist'
