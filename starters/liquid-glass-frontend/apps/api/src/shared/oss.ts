/**
 * 对象存储双模工具（阿里云 OSS / 本地 mock）
 *
 * 设计目标：业务模块只依赖本文件，不直接 import `ali-oss`；无云环境时自动降级。
 * - **OSS 模式**：三项环境变量（OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET / OSS_BUCKET）
 *   同时配置才启用。上传走 Post Policy 直传（前端拿凭证直连 OSS），下载走签名 URL。
 * - **mock 模式**：任一缺失即降级。上传凭证指向本地回退路由（由业务后端实现），
 *   下载 URL 指向本地代理路由——无需 OSS 账号即可开发上传下载链路。
 *
 * 使用方约定：
 * - 对象 key 一律通过 `getOssStoragePrefix(category)` 拼前缀，避免硬编码业务目录；
 * - mock 模式的本地回退路由由业务方传入（`MockOssRoutes`），本文件不假设路由存在；
 * - 上传大小上限只从 `env.UPLOAD_MAX_SIZE_MB` 读取，并同时写进 OSS Post Policy，
 *   防止客户端绕过业务校验传大文件。
 *
 * 安全注意：
 * - `content-disposition` 由原始文件名生成，会剥离 CR/LF/双引号避免响应头注入；
 * - 签名 URL 有效期默认 1 小时，业务方不要对外暴露永久 URL；
 * - 生产环境 env.ts 禁止 OSS 半启用（缺项会静默降级 mock，上传链路实际不可用）。
 */
import { isIP } from "node:net"

import OSS from "ali-oss"

import { env } from "../env.js"
import { reqLog } from "./logger.js"

/** 进程内缓存的 OSS client；配置变更由 _setOssConfigForTesting 重置 */
let cachedClient: OSS | null = null

// ─── 配置 ────────────────────────────────────────────────────────────────────

/** OSS 运行时配置（默认由 env 派生；测试用 _setOssConfigForTesting 覆盖） */
export interface OssConfig {
  accessKeyId: string
  accessKeySecret: string
  bucket: string
  region: string
  endpoint: string
  prefix: string
  cdnDomain: string
  maxUploadSizeMB: number
}

/** OSS 运行时配置快照（env 在进程启动时定型，这里按需读取） */
function configFromEnv(): OssConfig {
  return {
    accessKeyId: env.OSS_ACCESS_KEY_ID,
    accessKeySecret: env.OSS_ACCESS_KEY_SECRET,
    bucket: env.OSS_BUCKET,
    region: env.OSS_REGION,
    endpoint: env.OSS_ENDPOINT,
    prefix: env.OSS_PREFIX,
    cdnDomain: env.OSS_CDN_DOMAIN,
    maxUploadSizeMB: env.UPLOAD_MAX_SIZE_MB,
  }
}

let configOverride: Partial<OssConfig> | null = null

/**
 * @internal 测试专用：覆盖 OSS 配置并重置 client 单例。
 * 生产代码禁止调用；测试比 mock 整个 env 模块更安全（mock.module 会泄漏到同进程其它测试文件）。
 */
export function _setOssConfigForTesting(
  override: Partial<OssConfig> | null
): void {
  configOverride = override
  cachedClient = null
}

function getConfig(): OssConfig {
  return { ...configFromEnv(), ...configOverride }
}

/**
 * 是否启用 OSS 模式。
 * 三项必要凭证必须同时存在：半配置状态下 SDK 会在运行时才报错，
 * 这里提前判定为 mock 模式，保证服务可启动。
 */
export function isOssMode(): boolean {
  const { accessKeyId, accessKeySecret, bucket } = getConfig()
  return !!(accessKeyId && accessKeySecret && bucket)
}

/** 上传大小上限（字节），由 `env.UPLOAD_MAX_SIZE_MB` 派生（默认 10 MB） */
export function getMaxUploadSizeBytes(): number {
  return Math.floor(getConfig().maxUploadSizeMB * 1024 * 1024)
}

/** 归一化对象 key 路径片段：去掉首尾多余的 `/`，避免拼出 `//` */
function normalizeSegment(segment: string): string {
  return segment.replace(/^\/+|\/+$/g, "")
}

/**
 * 对象存储路径前缀（含末尾 `/`）。
 * @param category 业务分类目录，默认 `"uploads"`（如 `uploads/`、`avatars/`）；
 *                 配置了 OSS_PREFIX 时输出 `${OSS_PREFIX}/${category}/`，用于多环境隔离。
 */
export function getOssStoragePrefix(category = "uploads"): string {
  const prefix = normalizeSegment(getConfig().prefix)
  const categoryPath = normalizeSegment(category) || "uploads"
  return prefix ? `${prefix}/${categoryPath}/` : `${categoryPath}/`
}

/** 数据库备份等运维产物的存储前缀（含末尾 `/`） */
export function getOssBackupPrefix(): string {
  const prefix = normalizeSegment(getConfig().prefix)
  return prefix ? `${prefix}/backups/` : "backups/"
}

/** endpoint 主机是否为纯 IP（ali-oss 对 IP endpoint 有特殊语义：不拼 bucket、不支持签名 URL） */
function isIpEndpoint(endpoint: string): boolean {
  const url = new URL(endpoint)
  // URL.hostname 对 IPv6 会带方括号，isIP 需要裸地址
  return isIP(url.hostname.replace(/^\[|\]$/g, "")) > 0
}

/**
 * 直传 host 必须与 ali-oss SDK 实际请求的域名完全一致，否则 Post Policy 直传会打到
 * 错误域名。ali-oss 默认 `cname: false`：endpoint 为 OSS 服务域名（默认由 region 派生）
 * 时，请求 URL 会拼上 `${bucket}.` 前缀；仅当 endpoint 主机是 IP（内网代理）时不拼。
 * 此处镜像该行为，避免 OSS_ENDPOINT 模式出现「凭证 host 与 SDK host 不一致」。
 */
function buildOssHost(config: OssConfig): string {
  const region = config.region || "oss-cn-hangzhou"
  const endpoint = config.endpoint || `https://${region}.aliyuncs.com`
  const url = new URL(endpoint)
  const host = isIpEndpoint(endpoint)
    ? url.host
    : `${config.bucket}.${url.host}`
  return `${url.protocol}//${host}`
}

// ─── OSS client 单例 ────────────────────────────────────────────────────────

/** 获取 OSS client 单例；仅 OSS 模式调用 */
function getOssClient(): OSS {
  const config = getConfig()
  if (!cachedClient) {
    cachedClient = new OSS({
      region: config.region || "oss-cn-hangzhou",
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      bucket: config.bucket,
      // 自定义 endpoint（内网/代理）优先于 region。
      // ali-oss 仅在 endpoint 未带协议时用 secure 拼协议；env 已校验 endpoint 必须是
      // http(s) URL，这里仍按 endpoint 协议取值，避免未来放宽校验时静默走错协议。
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      secure: config.endpoint
        ? new URL(config.endpoint).protocol === "https:"
        : true,
    })
  }
  return cachedClient
}

/** @internal 测试专用：重置 client 单例，让配置变更能重新生效 */
export function _resetOssClientForTesting(): void {
  cachedClient = null
}

// ─── 上传凭证 ────────────────────────────────────────────────────────────────

/** OSS Post Policy 直传凭证（前端可直接 POST 到 OSS） */
export interface UploadCredential {
  /** 直传目标 URL */
  host: string
  /** Base64 编码的 Policy 文档 */
  policy: string
  /** Post Policy 签名 */
  signature: string
  /** AccessKey ID */
  OSSAccessKeyId: string
  /** 存储对象 key（含路径前缀） */
  key: string
  /**
   * 直传成功返回码。Post Policy 含 `success_action_status = 200` 条件时，
   * 前端**必须**把该字段作为表单域一起提交，否则 OSS 直接拒绝上传（403/400）。
   */
  success_action_status: "200"
  /** STS 临时安全令牌（mock 模式占位，OSS 模式使用长期 AK 时不返回） */
  securityToken?: string
}

/** 本地 mock 模式的上传/下载回退路由（由业务后端实现） */
export interface MockOssRoutes {
  /** 直传上传端点（前端 POST 凭证到该地址） */
  uploadDirect: string
  /** 下载代理前缀（storageKey 拼接其后并整体 URL 编码） */
  downloadPrefix: string
}

/** 本地 mock 模式默认回退路由 */
export const DEFAULT_MOCK_OSS_ROUTES: MockOssRoutes = {
  uploadDirect: "/uploads/direct",
  downloadPrefix: "/uploads",
}

/** 归一化路由：补齐前导 `/`、去掉尾部 `/` */
function normalizeRoute(route: string): string {
  const withLeading = route.startsWith("/") ? route : `/${route}`
  return withLeading.replace(/\/+$/, "")
}

/** 直传凭证有效期（秒） */
const CREDENTIAL_TTL_SECONDS = 3600

/** OSS 模式：生成 Post Policy 直传凭证 */
function getOssUploadCredential(key: string): UploadCredential {
  const config = getConfig()
  const client = getOssClient()

  // Policy 有效期与上传大小限制由服务端签发，客户端无法篡改
  const expiration = new Date(
    Date.now() + CREDENTIAL_TTL_SECONDS * 1000
  ).toISOString()
  const policy = JSON.stringify({
    expiration,
    conditions: [
      { bucket: config.bucket },
      ["eq", "$key", key],
      ["eq", "$success_action_status", "200"],
      ["content-length-range", 0, getMaxUploadSizeBytes()],
    ],
  })

  const postSignature = client.calculatePostSignature(policy)

  return {
    // 与 SDK 实际请求域名保持一致（含 OSS_ENDPOINT / bucket 前缀语义）
    host: buildOssHost(config),
    policy: Buffer.from(policy).toString("base64"),
    signature: postSignature.Signature,
    OSSAccessKeyId: config.accessKeyId,
    key,
    success_action_status: "200",
  }
}

/**
 * mock 模式：生成指向本地回退路由的假凭证。
 * `routes` 让业务后端自定义自己的直传/下载路由，不硬编码具体业务目录。
 */
export function getMockUploadCredential(
  key: string,
  requestOrigin: string,
  routes: MockOssRoutes = DEFAULT_MOCK_OSS_ROUTES
): UploadCredential {
  return {
    host: `${requestOrigin.replace(/\/$/, "")}${normalizeRoute(routes.uploadDirect)}`,
    policy: Buffer.from(
      JSON.stringify({ expiration: "2035-01-01T00:00:00.000Z" })
    ).toString("base64"),
    signature: "mock-oss-signature-for-local-testing",
    OSSAccessKeyId: "mock-oss-access-key-id",
    key,
    success_action_status: "200",
    securityToken: "mock-oss-security-token",
  }
}

/** 上传凭证参数 */
export interface UploadCredentialRequest {
  /** 请求来源（mock 模式拼 host 用，如 `http://localhost:3000`） */
  requestOrigin: string
  /** mock 模式本地回退路由（业务方自定义，默认 `/uploads/direct` + `/uploads`） */
  mockRoutes?: MockOssRoutes
}

/**
 * 获取上传凭证（按环境自动选择 OSS / mock 模式）。
 * @param key 存储对象 key（应由 `getOssStoragePrefix(category)` 拼好前缀）
 */
export async function getUploadCredential(
  key: string,
  { requestOrigin, mockRoutes }: UploadCredentialRequest
): Promise<UploadCredential> {
  if (isOssMode()) return getOssUploadCredential(key)
  return getMockUploadCredential(
    key,
    requestOrigin,
    mockRoutes ?? DEFAULT_MOCK_OSS_ROUTES
  )
}

// ─── 下载 URL ────────────────────────────────────────────────────────────────

/**
 * 生成 `content-disposition: attachment` 的 filename 部分（RFC 5987）。
 * 剥离可能造成响应头注入的 CR/LF/双引号，再 URL 编码。
 */
function buildContentDisposition(originalName: string): string {
  const sanitized = originalName.replace(/["\r\n]/g, "")
  return `attachment; filename*=UTF-8''${encodeURIComponent(sanitized)}`
}

/** 下载 URL 参数 */
export interface SignedUrlOptions {
  /** 有效期（秒），默认 1 小时 */
  expiresIn?: number
  /** mock 模式本地下载代理路由（业务方自定义，默认 `/uploads`） */
  mockRoutes?: MockOssRoutes
}

/**
 * 生成下载 URL。
 * - OSS 模式：带 `content-disposition` 的签名 URL（配置 OSS_CDN_DOMAIN 时换成 CDN 域名）；
 * - mock 模式：返回业务后端本地代理路由（相对路径）。
 *
 * 限制：ali-oss 在 endpoint 为纯 IP 时会抛 `can not get the object URL when endpoint is IP`，
 * 这里提前转成可读中文错误（内网 IP endpoint 仍可用于直传与服务端对象操作）。
 */
export async function generateSignedUrl(
  storageKey: string,
  originalName: string,
  options: SignedUrlOptions = {}
): Promise<string> {
  const { expiresIn = CREDENTIAL_TTL_SECONDS, mockRoutes } = options

  if (isOssMode()) {
    const endpoint = getConfig().endpoint
    if (endpoint && isIpEndpoint(endpoint)) {
      throw new Error(
        "OSS_ENDPOINT 为纯 IP 时不支持生成签名下载 URL（ali-oss 限制）：请改用域名 endpoint；直传与服务端对象操作不受影响"
      )
    }

    const client = getOssClient()
    const url: string = client.signatureUrl(storageKey, {
      expires: expiresIn,
      response: {
        "content-disposition": buildContentDisposition(originalName),
      },
    })

    // CDN 域名替换：签名参数保留，主机换成 CDN 避免暴露 OSS 默认域名
    const cdnDomain = getConfig().cdnDomain.replace(/\/$/, "")
    if (cdnDomain) {
      const urlObj = new URL(url)
      return `${cdnDomain}${urlObj.pathname}${urlObj.search}`
    }
    return url
  }

  const downloadPrefix = normalizeRoute(
    (mockRoutes ?? DEFAULT_MOCK_OSS_ROUTES).downloadPrefix
  )
  return `${downloadPrefix}/${encodeURIComponent(storageKey)}`
}

// ─── 对象操作 ────────────────────────────────────────────────────────────────

/** 校验 OSS 对象是否真实存在（OSS 模式；mock 模式恒为 false）。用于确认上传结果非伪造。 */
export async function assertOssObjectExists(
  storageKey: string
): Promise<boolean> {
  if (!isOssMode()) return false
  try {
    await getOssClient().head(storageKey)
    return true
  } catch {
    return false
  }
}

/** 上传本地文件到 OSS（仅 OSS 模式；mock 模式请走本地回退路由） */
export async function uploadOssObject(
  key: string,
  localPath: string
): Promise<void> {
  if (!isOssMode()) {
    throw new Error("uploadOssObject 仅限 OSS 模式调用")
  }
  await getOssClient().put(key, localPath)
}

/** 列出指定前缀下的全部对象 key（自动翻页，单页最多 1000 个） */
export async function listOssObjects(prefix: string): Promise<string[]> {
  if (!isOssMode()) return []
  const client = getOssClient()
  const keys: string[] = []
  let marker: string | undefined

  for (;;) {
    const result = await client.list({ prefix, marker, "max-keys": 1000 }, {})
    for (const object of result.objects ?? []) keys.push(object.name)
    if (!result.isTruncated || !result.nextMarker) break
    marker = result.nextMarker
  }
  return keys
}

/**
 * 批量删除 OSS 对象（仅 OSS 模式，尽力而为）。
 * 使用 deleteMulti quiet 模式，单次最多 1000 个 key；某批失败只记日志不中断，
 * 避免清理链路因个别对象异常而整体失败（但也因此无法感知个别对象删除失败）。
 * @returns 网络层成功提交删除的 key 列表
 */
export async function deleteOssObjects(keys: string[]): Promise<string[]> {
  if (!isOssMode() || keys.length === 0) return []
  const client = getOssClient()
  const deleted: string[] = []

  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000)
    try {
      await client.deleteMulti(batch, { quiet: true })
      deleted.push(...batch)
    } catch (err) {
      // 部分失败时继续，不中断整体清理；但必须记日志，否则孤儿对象会静默泄露存储成本
      reqLog().warn(
        { err, module: "oss", batchSize: batch.length },
        "oss.delete.batch_failed"
      )
    }
  }
  return deleted
}
