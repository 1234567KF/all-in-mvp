# ci-tools

本目录维护两个**独立职责**的辅助基础镜像，都推送到 `registry.cn-beijing.aliyuncs.com/wecode-cloud/`。二者互不替代。

## 镜像清单

| Dockerfile                                 | 产出镜像                  | 用途                                                                                                             | 使用位置                                                          |
| ------------------------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [Dockerfile](./Dockerfile)                 | `ci-tools:alpine-3.20`    | **CI job 执行环境**：预装 `openssh-client` + `ca-certificates` + `bash`，供 GitLab CI 里需要 SSH 部署的 job 使用 | [.gitlab-ci.yml](../.gitlab-ci.yml) `deploy-test` job 的 `image:` |
| [runtime.Dockerfile](./runtime.Dockerfile) | `bun-runtime:alpine-3.20` | **应用运行时基础**：预装 `libstdc++`（Bun compiled binary 必需）+ `ca-certificates` + `tzdata`（Asia/Shanghai）  | [Dockerfile](../Dockerfile) stage-2 的 `FROM`                     |

## 为什么分成两个

- **职责不同**：一个是 CI 短生命周期的部署工具容器，一个是生产长生命周期的应用运行时。
- **不合并的原因**：合并会互相污染——把 `openssh-client` 塞进生产镜像会扩大攻击面，把 `libstdc++` 塞进 CI 部署镜像纯属浪费。

## 何时需要重建 & 推送

**低频操作**，一次构建长期复用。以下情况需要重推：

- 需要新增系统包（如 `fontconfig`、`freetype`）
- Alpine 大版本升级（如 3.20 → 3.21，同步改 tag）
- 内部私有 registry mirror 的基础镜像更新

## 构建 & 推送命令

前置：`docker login registry.cn-beijing.aliyuncs.com`

### ci-tools（CI 部署工具镜像）

```bash
cd ci-tools
docker buildx build --platform linux/amd64 \
  -t registry.cn-beijing.aliyuncs.com/wecode-cloud/ci-tools:alpine-3.20 \
  -t registry.cn-beijing.aliyuncs.com/wecode-cloud/ci-tools:latest \
  --push .
```

### bun-runtime（应用运行时基础镜像）

```bash
cd ci-tools
docker buildx build --platform linux/amd64 \
  -f runtime.Dockerfile \
  -t registry.cn-beijing.aliyuncs.com/wecode-cloud/bun-runtime:alpine-3.20 \
  -t registry.cn-beijing.aliyuncs.com/wecode-cloud/bun-runtime:latest \
  --push .
```

## 平台约束

GitLab Runner 是 `linux/amd64`，两个镜像都必须显式指定 `--platform linux/amd64`（Apple Silicon 本地构建时尤其注意）。
