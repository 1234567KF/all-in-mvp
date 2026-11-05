/**
 * env.ts 纯函数与启动期校验单测
 *
 * env.ts 在模块加载时就用这些纯函数校验真实 env，因此单独导出后可直接覆盖边界值：
 * - UPLOAD_MAX_SIZE_MB 非法值 / 0 / 负数 / 小数回落与取整；
 * - 生产环境 OSS 三要素「半启用」fail-fast，且可选变量（REGION/PREFIX/CDN/ENDPOINT）不计入；
 * - OSS_ENDPOINT 格式校验（scheme / host / path 限制）。
 */
import { describe, expect, it } from "bun:test"

import {
  assertOssConfiguration,
  assertOssEndpoint,
  env,
  parsePositiveNumber,
} from "./env.js"

describe("parsePositiveNumber()", () => {
  it("缺省 / 空串回落默认值", () => {
    expect(parsePositiveNumber(undefined, 10)).toBe(10)
    expect(parsePositiveNumber("", 10)).toBe(10)
  })

  it("非法值回落默认值（避免 NaN 传播）", () => {
    expect(parsePositiveNumber("abc", 10)).toBe(10)
    expect(parsePositiveNumber("10MB", 10)).toBe(10)
    expect(parsePositiveNumber("Infinity", 10)).toBe(10)
  })

  it("0 / 负数回落默认值（上传上限必须为正）", () => {
    expect(parsePositiveNumber("0", 10)).toBe(10)
    expect(parsePositiveNumber("-5", 10)).toBe(10)
  })

  it("正数原样返回，小数保留（MB 允许 0.5 这类配置）", () => {
    expect(parsePositiveNumber("15", 10)).toBe(15)
    expect(parsePositiveNumber("0.5", 10)).toBe(0.5)
  })
})

describe("assertOssConfiguration()", () => {
  const none = { accessKeyId: "", accessKeySecret: "", bucket: "" }
  const full = {
    accessKeyId: "id",
    accessKeySecret: "secret",
    bucket: "bucket",
  }

  it("开发 / 测试环境：全空（mock 模式）合法", () => {
    expect(() => assertOssConfiguration("development", none)).not.toThrow()
    expect(() => assertOssConfiguration("test", none)).not.toThrow()
  })

  it("开发 / 测试环境：半配置也合法（静默降级 mock，便于本地调试）", () => {
    expect(() =>
      assertOssConfiguration("development", { ...none, accessKeyId: "id" })
    ).not.toThrow()
  })

  it("生产环境：全空合法（不使用 OSS，纯本地存储）", () => {
    expect(() => assertOssConfiguration("production", none)).not.toThrow()
  })

  it("生产环境：三项齐全合法", () => {
    expect(() => assertOssConfiguration("production", full)).not.toThrow()
  })

  it("生产环境：只配 1~2 项 → 启动失败（避免静默降级不可用链路）", () => {
    expect(() =>
      assertOssConfiguration("production", { ...none, accessKeyId: "id" })
    ).toThrow("must be configured together")
    expect(() =>
      assertOssConfiguration("production", {
        accessKeyId: "id",
        accessKeySecret: "secret",
        bucket: "",
      })
    ).toThrow("must be configured together")
    expect(() =>
      assertOssConfiguration("production", { ...none, bucket: "bucket" })
    ).toThrow("must be configured together")
  })
})

describe("assertOssEndpoint()", () => {
  it("留空合法（走 bucket + region 默认域名）", () => {
    expect(() => assertOssEndpoint("")).not.toThrow()
  })

  it("合法 http(s) endpoint 通过（含内网域名 / IP / 端口）", () => {
    expect(() =>
      assertOssEndpoint("https://oss-cn-hangzhou-internal.aliyuncs.com")
    ).not.toThrow()
    expect(() => assertOssEndpoint("http://192.168.1.10:9000")).not.toThrow()
    expect(() =>
      assertOssEndpoint("https://oss.internal.example.com:8443")
    ).not.toThrow()
  })

  it("非 URL / 非 http(s) / 空 hostname 拒绝", () => {
    expect(() => assertOssEndpoint("oss.internal.example.com")).toThrow(
      "must be a valid http(s) URL"
    )
    expect(() => assertOssEndpoint("ftp://oss.internal.example.com")).toThrow(
      "must use http:// or https://"
    )
    expect(() => assertOssEndpoint("https://")).toThrow(
      "must be a valid http(s) URL"
    )
  })

  it("带 path / query / hash 拒绝（ali-oss endpoint 只接受 scheme://host[:port]）", () => {
    expect(() => assertOssEndpoint("https://oss.example.com/path")).toThrow(
      "must not contain path"
    )
    expect(() => assertOssEndpoint("https://oss.example.com?a=1")).toThrow(
      "must not contain path"
    )
    expect(() => assertOssEndpoint("https://oss.example.com#x")).toThrow(
      "must not contain path"
    )
  })
})

describe("env 快照", () => {
  // 不断言具体取值：测试可能继承宿主机环境变量（如 CI 注入 OSS_*），只做量纲保护
  it("UPLOAD_MAX_SIZE_MB 为正数，OSS 区域非空", () => {
    expect(env.UPLOAD_MAX_SIZE_MB).toBeGreaterThan(0)
    expect(env.OSS_REGION.length).toBeGreaterThan(0)
  })
})
