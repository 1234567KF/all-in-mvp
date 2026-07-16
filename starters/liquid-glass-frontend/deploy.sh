#!/usr/bin/sh
set -e

# ── 部署脚本（生产 / 测试通用）──
#
# 用法:
#   ./deploy.sh [镜像标签] [tar包路径]
#
# 模式:
#   1. Registry 模式（默认，生产用）
#      ./deploy.sh                         # latest
#      ./deploy.sh test-latest             # 从阿里云 pull
#
#   2. 本地 tar 加载模式（测试环境用，绕过 Registry 拉取）
#      ./deploy.sh test-latest image.tar.gz
#      → docker load 后启动，不再 pull
#
# 部署目录 = 脚本所在目录（放在哪跑在哪）
#
# 目录结构:
#   ${DEPLOY_DIR}/
#     ├── compose.yml
#     ├── .env          ← 密钥和配置（不入库）
#     ├── deploy.sh
#     └── data/         ← SQLite 数据库持久化卷

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
IMAGE_REGISTRY="registry.cn-beijing.aliyuncs.com/wecode-cloud"
IMAGE_NAME="liquid-glass-starter"
TAG="${1:-latest}"
FROM_TAR="${2:-}"
IMAGE="${IMAGE_REGISTRY}/${IMAGE_NAME}:${TAG}"

echo "=== ${IMAGE_NAME} deploy ==="
echo "Image: ${IMAGE}"
echo "Deploy dir: ${DEPLOY_DIR}"
if [ -n "${FROM_TAR}" ]; then
  echo "Source: local tar (${FROM_TAR})"
fi

# 1. 确保部署目录存在
mkdir -p "${DEPLOY_DIR}/data"

# 2. bootstrap .env（首次部署兜底：仅用于模板 self-deploy）
#    真实项目应通过 GitLab CI/CD 变量或手工写入真实密钥，
#    本段只保证 fresh 测试机上能直接拉起来验证 CI 链路。
if [ ! -f "${DEPLOY_DIR}/.env" ]; then
  echo "⚠  .env 不存在，生成默认配置（仅用于首次 self-deploy，请按需修改）"
  JWT_RAND=$(head -c 32 /dev/urandom | base64 | tr -d '\n=+/' | cut -c1-40)
  cat > "${DEPLOY_DIR}/.env" <<ENVEOF
NODE_ENV=production
PORT=3000
WEB_PORT=11070
FRONTEND_URL=http://localhost:11070
JWT_SECRET=${JWT_RAND}
SEED_ADMIN_PASSWORD=admin123
ENVEOF
  echo "✓ .env 已生成，JWT_SECRET 已随机化"
fi

# 3. 修正 data 目录权限与容器内 appuser (uid=1001) 一致
#    非 root 用户环境（如测试机 wecode）无权限时静默跳过
chown -R 1001:1001 "${DEPLOY_DIR}/data" 2>/dev/null || true

# 4. 加载镜像（tar 模式 or Registry 模式）
if [ -n "${FROM_TAR}" ]; then
  TAR_PATH="${DEPLOY_DIR}/${FROM_TAR}"
  if [ ! -f "${TAR_PATH}" ]; then
    echo "ERROR: tar 包不存在: ${TAR_PATH}"
    exit 1
  fi
  echo "Loading image from tar..."
  docker load -i "${TAR_PATH}"
  # tar 包一次性使用，加载后立即删除释放磁盘
  rm -f "${TAR_PATH}"
else
  # 可选登录
  if [ -n "${REGISTRY_USER}" ] && [ -n "${REGISTRY_PASS}" ]; then
    echo "Logging in to registry..."
    echo "${REGISTRY_PASS}" | docker login "${IMAGE_REGISTRY}" \
      --username "${REGISTRY_USER}" --password-stdin
  fi
  echo "Pulling image..."
  docker pull "${IMAGE}"
fi

# 5. 重新部署
echo "Starting service..."
cd "${DEPLOY_DIR}"
if [ -n "${FROM_TAR}" ]; then
  # tar 模式：镜像已本地加载，不再拉取
  docker compose up -d
else
  docker compose up -d --pull always
fi

# 6. 等待健康检查
echo "Waiting for health check..."
timeout=60
elapsed=0
until docker compose ps | grep -q "healthy" || [ ${elapsed} -ge ${timeout} ]; do
  sleep 5
  elapsed=$((elapsed + 5))
  echo "  ... ${elapsed}s"
done

if [ ${elapsed} -ge ${timeout} ]; then
  echo "ERROR: Health check timeout (${timeout}s)"
  echo "Check logs: docker compose logs"
  docker compose logs --tail=50
  exit 1
fi

# 7. 清理旧镜像（未被容器引用且超过 24h 的）
# – 回滚统一从 Registry 拉取（阿里云 Flow 内网通道，几秒完成），无需本地缓存
# – 保留 24h 仅用于兜底调试，避免频繁 build 期间误清
echo "Cleaning up old images..."
docker image prune -af --filter "until=24h" 2>/dev/null || true

echo "=== Deploy complete ==="
docker compose ps
