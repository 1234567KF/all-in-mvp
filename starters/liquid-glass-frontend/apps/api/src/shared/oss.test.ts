/**
 * oss.ts 单元测试
 *
 * 覆盖：
 * - 双模判定（三项凭证齐全才启用 OSS）、路径前缀与上传大小上限派生；
 * - mock 模式凭证/下载 URL（含自定义本地回退路由）；
 * - OSS 模式凭证/签名 URL（通过 mock ali-oss SDK，不发真实网络请求）；
 * - 对象上传 / 分页列举 / 批量删除（含超过 1000 个 key 的分批与单批失败降级）。
 *
 * 环境配置通过 _setOssConfigForTesting 注入，不 mock env 模块：
 * mock.module 会泄漏到同进程其它测试文件，污染全局 env 快照。
 *
 * 已知限制：ali-oss 必须 mock.module 替换（SDK 无依赖注入点），而 Bun 的
 * mock.module 是进程级且无法用 mock.restore 撤销。当前仅本文件直接 import
 * `ali-oss`，因此泄漏无害；若未来其它测试需要真实 SDK，应改为工厂注入或独立进程。
 */
import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test"

/* ── mock ali-oss SDK（宿主无云环境，所有 OSS 调用走假实现）──────────────── */
const mockPut = mock(async (_key: string, _localPath: string) => ({ res: {} }))
const mockHead = mock(async (key: string) => ({ name: key }))
const mockCalculatePostSignature = mock((policy: string) => ({
  Signature: `mock-sig-${Buffer.from(policy).toString("base64").slice(0, 8)}`,
}))
const mockSignatureUrl = mock(
  (key: string, options?: Record<string, unknown>) =>
    `https://test-bucket.oss-cn-hangzhou.aliyuncs.com/${key}?Expires=${
      options?.expires ?? 0
    }&Signature=abc`
)
const mockList = mock(async (_query: Record<string, unknown>) => ({
  objects: [] as Array<{ name: string }>,
  isTruncated: false,
  nextMarker: "",
}))
const mockDeleteMulti = mock(
  async (names: string[], _options?: Record<string, unknown>) => ({
    deleted: names.map((Key) => ({ Key })),
    res: {},
  })
)

let lastClientOptions: Record<string, unknown> | null = null

mock.module("ali-oss", () => ({
  default: class MockOSS {
    constructor(options: Record<string, unknown>) {
      lastClientOptions = options
    }
    put = mockPut
    head = mockHead
    list = mockList
    deleteMulti = mockDeleteMulti
    calculatePostSignature = mockCalculatePostSignature
    signatureUrl = mockSignatureUrl
  },
}))

import {
  _resetOssClientForTesting,
  _setOssConfigForTesting,
  assertOssObjectExists,
  DEFAULT_MOCK_OSS_ROUTES,
  deleteOssObjects,
  generateSignedUrl,
  getMaxUploadSizeBytes,
  getMockUploadCredential,
  getOssBackupPrefix,
  getOssStoragePrefix,
  getUploadCredential,
  isOssMode,
  listOssObjects,
  type OssConfig,
  uploadOssObject,
} from "./oss.js"

/** 一套「空配置」基线（mock 模式） */
const EMPTY_CONFIG: OssConfig = {
  accessKeyId: "",
  accessKeySecret: "",
  bucket: "",
  region: "oss-cn-hangzhou",
  endpoint: "",
  prefix: "",
  cdnDomain: "",
  maxUploadSizeMB: 10,
}

/** 一套「OSS 模式」基线 */
const OSS_CONFIG: OssConfig = {
  ...EMPTY_CONFIG,
  accessKeyId: "test-id",
  accessKeySecret: "test-secret",
  bucket: "test-bucket",
}

/** 设置配置（缺省字段用空配置补齐） */
function setConfig(overrides: Partial<OssConfig> = {}): void {
  _setOssConfigForTesting({ ...EMPTY_CONFIG, ...overrides })
}

beforeEach(() => {
  setConfig()
  mockPut.mockClear()
  mockHead.mockClear()
  mockCalculatePostSignature.mockClear()
  mockSignatureUrl.mockClear()
  mockList.mockClear()
  mockDeleteMulti.mockClear()
  lastClientOptions = null
})

afterAll(() => {
  _setOssConfigForTesting(null)
  _resetOssClientForTesting()
})

// ─── 双模判定 / 配置派生 ────────────────────────────────────────────────────

describe("isOssMode()", () => {
  it("三项凭证全空 → false（降级本地 mock）", () => {
    expect(isOssMode()).toBe(false)
  })

  it("只配置部分凭证 → false（避免半启用状态运行时崩溃）", () => {
    setConfig({ accessKeyId: "id" })
    expect(isOssMode()).toBe(false)
    setConfig({ accessKeyId: "id", accessKeySecret: "secret" })
    expect(isOssMode()).toBe(false)
    setConfig({ accessKeyId: "id", bucket: "bucket" })
    expect(isOssMode()).toBe(false)
  })

  it("三项齐全 → true", () => {
    setConfig(OSS_CONFIG)
    expect(isOssMode()).toBe(true)
  })
})

describe("getMaxUploadSizeBytes()", () => {
  it("默认 10 MB", () => {
    expect(getMaxUploadSizeBytes()).toBe(10 * 1024 * 1024)
  })

  it("跟随 UPLOAD_MAX_SIZE_MB 配置（向下取整到字节）", () => {
    setConfig({ maxUploadSizeMB: 5 })
    expect(getMaxUploadSizeBytes()).toBe(5 * 1024 * 1024)
    setConfig({ maxUploadSizeMB: 0.5 })
    expect(getMaxUploadSizeBytes()).toBe(512 * 1024)
  })
})

describe("getOssStoragePrefix()", () => {
  it("默认分类为 uploads/", () => {
    expect(getOssStoragePrefix()).toBe("uploads/")
  })

  it("支持自定义分类并归一化多余斜杠", () => {
    setConfig({ prefix: "/my-app/dev/" })
    expect(getOssStoragePrefix("avatars")).toBe("my-app/dev/avatars/")
    expect(getOssStoragePrefix("/avatars/")).toBe("my-app/dev/avatars/")
    expect(getOssStoragePrefix("")).toBe("my-app/dev/uploads/")
  })
})

describe("getOssBackupPrefix()", () => {
  it("未配置 OSS_PREFIX → backups/", () => {
    expect(getOssBackupPrefix()).toBe("backups/")
  })

  it("配置 OSS_PREFIX → 前缀内 backups/", () => {
    setConfig({ prefix: "my-app/dev" })
    expect(getOssBackupPrefix()).toBe("my-app/dev/backups/")
  })
})

// ─── mock 模式 ──────────────────────────────────────────────────────────────

describe("getMockUploadCredential()", () => {
  it("默认回退路由指向 {origin}/uploads/direct", () => {
    const cred = getMockUploadCredential(
      "uploads/1234.pdf",
      "http://localhost:3000"
    )
    expect(cred.host).toBe("http://localhost:3000/uploads/direct")
    expect(cred.key).toBe("uploads/1234.pdf")
    expect(cred.OSSAccessKeyId).toBe("mock-oss-access-key-id")
    expect(cred.securityToken).toBe("mock-oss-security-token")
    // 与 OSS 模式保持同一凭证契约：前端表单需原样提交该字段
    expect(cred.success_action_status).toBe("200")
  })

  it("requestOrigin 末尾斜杠不会拼出双斜杠", () => {
    const cred = getMockUploadCredential("a.pdf", "http://localhost:3000/")
    expect(cred.host).toBe("http://localhost:3000/uploads/direct")
  })

  it("支持自定义本地回退路由（业务方自实现）", () => {
    const cred = getMockUploadCredential("avatars/a.png", "http://host", {
      uploadDirect: "attachments/upload/direct",
      downloadPrefix: "/attachments/download",
    })
    expect(cred.host).toBe("http://host/attachments/upload/direct")
  })

  it("policy 是合法 Base64 JSON", () => {
    const cred = getMockUploadCredential("a.pdf", "http://host")
    const policy = JSON.parse(
      Buffer.from(cred.policy, "base64").toString("utf8")
    )
    expect(typeof policy.expiration).toBe("string")
  })
})

describe("getUploadCredential() — mock 模式", () => {
  it("未配置 OSS 时返回 mock 凭证（默认路由）", async () => {
    const cred = await getUploadCredential("uploads/a.pdf", {
      requestOrigin: "http://localhost:3000",
    })
    expect(cred.host).toBe("http://localhost:3000/uploads/direct")
    expect(cred.securityToken).toBe("mock-oss-security-token")
    expect(mockCalculatePostSignature).not.toHaveBeenCalled()
  })

  it("未配置 OSS 时使用业务方自定义回退路由", async () => {
    const cred = await getUploadCredential("uploads/a.pdf", {
      requestOrigin: "http://localhost:3000",
      mockRoutes: {
        uploadDirect: "/api/files/direct",
        downloadPrefix: "/api/files",
      },
    })
    expect(cred.host).toBe("http://localhost:3000/api/files/direct")
  })
})

describe("generateSignedUrl() — mock 模式", () => {
  it("返回本地下载代理相对路径（storageKey 整体编码）", async () => {
    const url = await generateSignedUrl("uploads/report.pdf", "报告.pdf")
    expect(url).toBe(`/uploads/${encodeURIComponent("uploads/report.pdf")}`)
  })

  it("支持业务方自定义下载代理前缀", async () => {
    const url = await generateSignedUrl("uploads/report.pdf", "报告.pdf", {
      mockRoutes: { ...DEFAULT_MOCK_OSS_ROUTES, downloadPrefix: "/api/files" },
    })
    expect(url).toBe(`/api/files/${encodeURIComponent("uploads/report.pdf")}`)
  })
})

// ─── OSS 模式（mock ali-oss SDK）────────────────────────────────────────────

describe("getUploadCredential() — OSS 模式", () => {
  beforeEach(() => {
    setConfig(OSS_CONFIG)
  })

  it("返回 OSS Post Policy 凭证与默认 host", async () => {
    const cred = await getUploadCredential("uploads/a.pdf", {
      requestOrigin: "http://localhost:3000",
    })
    expect(cred.host).toBe("https://test-bucket.oss-cn-hangzhou.aliyuncs.com")
    expect(cred.OSSAccessKeyId).toBe("test-id")
    expect(cred.securityToken).toBeUndefined()
    expect(cred.success_action_status).toBe("200")
    expect(lastClientOptions).toMatchObject({ secure: true })
    expect(mockCalculatePostSignature).toHaveBeenCalledTimes(1)
  })

  it("policy 内置 bucket / key / 大小上限，客户端无法篡改", async () => {
    setConfig({ ...OSS_CONFIG, maxUploadSizeMB: 5 })
    const cred = await getUploadCredential("uploads/a.pdf", {
      requestOrigin: "http://localhost:3000",
    })
    const policy = JSON.parse(
      Buffer.from(cred.policy, "base64").toString("utf8")
    )
    expect(policy.conditions).toContainEqual({ bucket: "test-bucket" })
    expect(policy.conditions).toContainEqual(["eq", "$key", "uploads/a.pdf"])
    expect(policy.conditions).toContainEqual([
      "content-length-range",
      0,
      5 * 1024 * 1024,
    ])
  })

  it("自定义 endpoint：凭证 host 与 ali-oss SDK 域名语义一致（拼 bucket）", async () => {
    // ali-oss 默认 cname=false，会请求 `${bucket}.${endpoint}`；凭证 host 必须一致，
    // 否则前端按凭证直传会打到 SDK 未使用的域名。
    setConfig({ ...OSS_CONFIG, endpoint: "https://oss.internal.example.com" })
    const cred = await getUploadCredential("uploads/a.pdf", {
      requestOrigin: "http://localhost:3000",
    })
    expect(cred.host).toBe("https://test-bucket.oss.internal.example.com")
    expect(lastClientOptions).toMatchObject({
      endpoint: "https://oss.internal.example.com",
      region: "oss-cn-hangzhou",
      secure: true,
    })
    expect(lastClientOptions).not.toHaveProperty("bucket", undefined)
  })

  it("自定义 endpoint 为 IP（内网代理）时不拼 bucket，且 secure 跟随 http 协议", async () => {
    setConfig({ ...OSS_CONFIG, endpoint: "http://192.168.1.10:9000" })
    const cred = await getUploadCredential("uploads/a.pdf", {
      requestOrigin: "http://localhost:3000",
    })
    expect(cred.host).toBe("http://192.168.1.10:9000")
    expect(lastClientOptions).toMatchObject({ secure: false })
  })

  it("自定义 endpoint 带端口：保留端口并拼 bucket", async () => {
    setConfig({
      ...OSS_CONFIG,
      endpoint: "https://oss.internal.example.com:8443",
    })
    const cred = await getUploadCredential("uploads/a.pdf", {
      requestOrigin: "http://localhost:3000",
    })
    expect(cred.host).toBe("https://test-bucket.oss.internal.example.com:8443")
  })

  it("client 是进程内单例（二次调用不重复实例化）", async () => {
    await getUploadCredential("a.pdf", { requestOrigin: "http://host" })
    const first = lastClientOptions
    await getUploadCredential("b.pdf", { requestOrigin: "http://host" })
    // 单例只创建一次，lastClientOptions 应保持同一引用
    expect(lastClientOptions).toBe(first)
  })
})

describe("assertOssObjectExists()", () => {
  it("mock 模式恒为 false，且不触碰 SDK", async () => {
    expect(await assertOssObjectExists("a.pdf")).toBe(false)
    expect(mockHead).not.toHaveBeenCalled()
  })

  it("OSS 模式对象存在 → true", async () => {
    setConfig(OSS_CONFIG)
    expect(await assertOssObjectExists("a.pdf")).toBe(true)
    expect(mockHead).toHaveBeenCalledWith("a.pdf")
  })

  it("OSS 模式对象不存在（SDK 抛错）→ false，不向上抛", async () => {
    setConfig(OSS_CONFIG)
    mockHead.mockRejectedValueOnce(new Error("NoSuchKey"))
    expect(await assertOssObjectExists("missing.pdf")).toBe(false)
  })
})

describe("generateSignedUrl() — OSS 模式", () => {
  beforeEach(() => {
    setConfig(OSS_CONFIG)
  })

  it("返回签名 URL，并带 attachment 响应头与有效期", async () => {
    const url = await generateSignedUrl("uploads/report.pdf", "报告.pdf", {
      expiresIn: 600,
    })
    expect(url).toContain("test-bucket")
    expect(url).toContain("uploads/report.pdf")
    const [, options] = mockSignatureUrl.mock.calls[0]!
    expect(options).toMatchObject({
      expires: 600,
      response: {
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent("报告.pdf")}`,
      },
    })
  })

  it("原始文件名中的 CR/LF/双引号被剥离，避免响应头注入", async () => {
    await generateSignedUrl("uploads/a.pdf", 'evil"\r\nX-Injected: 1.pdf')
    const [, options] = mockSignatureUrl.mock.calls[0]!
    const disposition = (options as { response: Record<string, string> })
      .response["content-disposition"]!
    expect(disposition).not.toContain("\r")
    expect(disposition).not.toContain("\n")
    expect(disposition).not.toContain('"')
    expect(disposition).toContain(encodeURIComponent("evilX-Injected: 1.pdf"))
  })

  it("配置 CDN 域名后用 CDN 替换主机（保留路径与签名参数）", async () => {
    setConfig({ ...OSS_CONFIG, cdnDomain: "https://cdn.example.com/" })
    const url = await generateSignedUrl("uploads/report.pdf", "报告.pdf")
    expect(url.startsWith("https://cdn.example.com/uploads/report.pdf")).toBe(
      true
    )
    expect(url).toContain("Signature=abc")
    expect(url).not.toContain("test-bucket")
  })

  it("CDN 域名无尾部斜杠同样可用", async () => {
    setConfig({ ...OSS_CONFIG, cdnDomain: "https://cdn.example.com" })
    const url = await generateSignedUrl("uploads/report.pdf", "报告.pdf")
    expect(url.startsWith("https://cdn.example.com/")).toBe(true)
  })

  it("endpoint 为纯 IP 时提前抛可读错误（ali-oss 不支持 IP 签名 URL）", async () => {
    setConfig({ ...OSS_CONFIG, endpoint: "http://192.168.1.10:9000" })
    await expect(
      generateSignedUrl("uploads/report.pdf", "报告.pdf")
    ).rejects.toThrow("OSS_ENDPOINT 为纯 IP 时不支持生成签名下载 URL")
    expect(mockSignatureUrl).not.toHaveBeenCalled()
  })
})

describe("uploadOssObject()", () => {
  it("mock 模式拒绝调用（本地回退走业务后端）", async () => {
    await expect(uploadOssObject("a.pdf", "/tmp/a.pdf")).rejects.toThrow(
      "uploadOssObject 仅限 OSS 模式调用"
    )
  })

  it("OSS 模式调用 SDK put", async () => {
    setConfig(OSS_CONFIG)
    await uploadOssObject("backups/a.db", "/tmp/a.db")
    expect(mockPut).toHaveBeenCalledWith("backups/a.db", "/tmp/a.db")
  })
})

describe("listOssObjects()", () => {
  it("mock 模式返回空数组，且不触碰 SDK", async () => {
    expect(await listOssObjects("backups/")).toEqual([])
    expect(mockList).not.toHaveBeenCalled()
  })

  it("单页不超过 1000 时一次请求返回全部 key", async () => {
    setConfig(OSS_CONFIG)
    mockList.mockResolvedValueOnce({
      objects: [{ name: "backups/a.db" }, { name: "backups/b.db" }],
      isTruncated: false,
      nextMarker: "",
    })
    expect(await listOssObjects("backups/")).toEqual([
      "backups/a.db",
      "backups/b.db",
    ])
    expect(mockList).toHaveBeenCalledTimes(1)
    expect(mockList.mock.calls[0]![0]).toMatchObject({
      prefix: "backups/",
      "max-keys": 1000,
    })
  })

  it("isTruncated 时用 nextMarker 自动翻页", async () => {
    setConfig(OSS_CONFIG)
    mockList
      .mockResolvedValueOnce({
        objects: [{ name: "backups/a.db" }],
        isTruncated: true,
        nextMarker: "backups/a.db",
      })
      .mockResolvedValueOnce({
        objects: [{ name: "backups/b.db" }],
        isTruncated: false,
        nextMarker: "",
      })
    expect(await listOssObjects("backups/")).toEqual([
      "backups/a.db",
      "backups/b.db",
    ])
    expect(mockList).toHaveBeenCalledTimes(2)
    expect(mockList.mock.calls[1]![0]).toMatchObject({
      marker: "backups/a.db",
    })
  })
})

describe("deleteOssObjects()", () => {
  it("mock 模式返回空数组，且不触碰 SDK", async () => {
    expect(await deleteOssObjects(["backups/a.db"])).toEqual([])
    expect(mockDeleteMulti).not.toHaveBeenCalled()
  })

  it("空列表直接返回，不发请求", async () => {
    setConfig(OSS_CONFIG)
    expect(await deleteOssObjects([])).toEqual([])
    expect(mockDeleteMulti).not.toHaveBeenCalled()
  })

  it("OSS 模式按 1000 个一批删除", async () => {
    setConfig(OSS_CONFIG)
    const keys = Array.from({ length: 1001 }, (_, i) => `backups/${i}.db`)
    const deleted = await deleteOssObjects(keys)
    expect(deleted).toHaveLength(1001)
    expect(mockDeleteMulti).toHaveBeenCalledTimes(2)
    const [firstBatch, firstOptions] = mockDeleteMulti.mock.calls[0]!
    expect(firstBatch).toHaveLength(1000)
    expect(firstOptions).toEqual({ quiet: true })
    expect(mockDeleteMulti.mock.calls[1]![0]).toHaveLength(1)
  })

  it("某一批删除失败只记日志、继续后续批次", async () => {
    setConfig(OSS_CONFIG)
    mockDeleteMulti
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ deleted: [], res: {} })
    const keys = Array.from({ length: 1001 }, (_, i) => `backups/${i}.db`)
    const deleted = await deleteOssObjects(keys)
    expect(deleted).toHaveLength(1)
    expect(mockDeleteMulti).toHaveBeenCalledTimes(2)
  })
})
