# ── CI 部署工具镜像（GitLab CI deploy-test 使用）──
#
# 用途：为 GitLab CI 提供预装 SSH 客户端的 Alpine 环境，
#      避免每次 job 都执行 apk add openssh-client 的耗时步骤。
#
# 基础：wecode-cloud/alpine:3.20（内部私有 registry mirror）
# 组件：openssh-client + ca-certificates + bash（严格最小化）
# 平台：linux/amd64（GitLab Runner 架构约束）
#
# 构建 & 推送:
#   cd ci-tools
#   docker login registry.cn-beijing.aliyuncs.com
#   docker buildx build \
#     --platform linux/amd64 \
#     -t registry.cn-beijing.aliyuncs.com/wecode-cloud/ci-tools:alpine-3.20 \
#     -t registry.cn-beijing.aliyuncs.com/wecode-cloud/ci-tools:latest \
#     --push .

FROM registry.cn-beijing.aliyuncs.com/wecode-cloud/alpine:3.20

RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories \
 && apk add --no-cache \
      openssh-client \
      ca-certificates \
      bash \
 && rm -rf /var/cache/apk/*
