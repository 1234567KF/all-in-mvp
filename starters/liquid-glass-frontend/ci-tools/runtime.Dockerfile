# ── 应用运行时基础镜像（bun compiled binary 通用运行环境）──
#
# 用途：为所有 Bun 单文件编译（bun build --compile）的服务提供
#      Alpine 运行时基础，避免每次 Dockerfile stage-2 都 apk add。
#
# 组件：libstdc++（Bun compiled binary 必需）
#      ca-certificates（HTTPS 出站，如 LLM/OSS/webhook）
#      tzdata（本地时区 Asia/Shanghai，date 展示正确）
# 平台：linux/amd64（GitLab Runner 架构约束）
#
# 构建 & 推送:
#   cd ci-tools
#   docker login registry.cn-beijing.aliyuncs.com
#   docker buildx build \
#     --platform linux/amd64 \
#     -f runtime.Dockerfile \
#     -t registry.cn-beijing.aliyuncs.com/wecode-cloud/bun-runtime:alpine-3.20 \
#     -t registry.cn-beijing.aliyuncs.com/wecode-cloud/bun-runtime:latest \
#     --push .

FROM registry.cn-beijing.aliyuncs.com/wecode-cloud/alpine:3.20

ENV TZ=Asia/Shanghai

RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories \
 && apk add --no-cache \
      libstdc++ \
      ca-certificates \
      tzdata \
 && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
 && echo "Asia/Shanghai" > /etc/timezone \
 && rm -rf /var/cache/apk/*
