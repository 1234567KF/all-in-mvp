#!/usr/bin/env bash
# 重置测试环境数据库（停止容器 → 删除外挂 SQLite 文件，不重启）
#
# 测试机坐标不写死在仓库里：与 .gitlab-ci.yml 共用同一组变量名，由环境注入
# （CI 里是 CI/CD Variables，本地是 export）。缺失即以显式错误退出，
# 不允许退化成"连到仓库里那个默认地址"。IMAGE 是公开 registry 产物，保留默认值。
set -euo pipefail

SSH_HOST="${TEST_HOST:?未设置 TEST_HOST（测试机地址），请 export TEST_HOST=... 后重试}"
SSH_PORT="${TEST_PORT:-22}"
SSH_USER="${TEST_USER:?未设置 TEST_USER（测试机登录用户）}"
REMOTE_DIR="${TEST_PATH:?未设置 TEST_PATH（测试机上的部署目录）}"
IMAGE="${IMAGE:-registry.cn-beijing.aliyuncs.com/wecode-cloud/liquid-glass-starter:test-latest}"

echo "==> 停止容器..."
ssh -o StrictHostKeyChecking=no -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" \
  "cd $REMOTE_DIR && docker compose down"

echo "==> 删除数据库文件..."
ssh -o StrictHostKeyChecking=no -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" \
  "docker run --rm --entrypoint='' -v $REMOTE_DIR/data:/data $IMAGE sh -c 'rm -f /data/sqlite.db /data/sqlite.db-shm /data/sqlite.db-wal'"

echo "==> 完成。数据库已重置，容器未重启。"
echo "    如需启动: ssh -p $SSH_PORT $SSH_USER@$SSH_HOST 'cd $REMOTE_DIR && docker compose up -d'"
