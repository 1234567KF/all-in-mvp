import { describe, expect, it } from "vitest"

import { parseUserAgent } from "@/lib/user-agent"

describe("parseUserAgent", () => {
  it("解析 Chrome on macOS", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    const parsed = parseUserAgent(ua)
    expect(parsed.browser).toBe("Chrome 126")
    expect(parsed.os).toBe("macOS")
    expect(parsed.deviceType).toBe("desktop")
    expect(parsed.title).toBe("Chrome 126 · macOS")
  })

  it("解析 Safari on iPhone", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/605.1.15"
    const parsed = parseUserAgent(ua)
    expect(parsed.browser).toBe("Safari 17")
    expect(parsed.os).toBe("iOS")
    expect(parsed.deviceType).toBe("mobile")
    expect(parsed.title).toBe("Safari 17 · iOS")
  })

  it("解析 Edge on Windows", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0"
    const parsed = parseUserAgent(ua)
    expect(parsed.browser).toBe("Edge 125")
    expect(parsed.os).toBe("Windows")
    expect(parsed.deviceType).toBe("desktop")
    expect(parsed.title).toBe("Edge 125 · Windows")
  })

  it("处理空 User-Agent", () => {
    const parsed = parseUserAgent("")
    expect(parsed.title).toBe("未知设备")
    expect(parsed.deviceType).toBe("unknown")
  })

  it("处理未知简短 UA", () => {
    const parsed = parseUserAgent("CustomApp/1.0")
    expect(parsed.browser).toBe("CustomApp/1.0")
    expect(parsed.title).toBe("CustomApp/1.0")
  })

  it("解析 Firefox on Linux", () => {
    const ua =
      "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0"
    const parsed = parseUserAgent(ua)
    expect(parsed.browser).toBe("Firefox 127")
    expect(parsed.os).toBe("Linux")
    expect(parsed.deviceType).toBe("desktop")
    expect(parsed.title).toBe("Firefox 127 · Linux")
  })

  it("解析 Opera on Windows", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 OPR/111.0.0.0"
    const parsed = parseUserAgent(ua)
    expect(parsed.browser).toBe("Opera 111")
    expect(parsed.os).toBe("Windows")
    expect(parsed.title).toBe("Opera 111 · Windows")
  })

  it("解析微信内置浏览器 on Android", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0.50"
    const parsed = parseUserAgent(ua)
    expect(parsed.browser).toBe("微信内置浏览器")
    expect(parsed.os).toBe("Android")
    expect(parsed.deviceType).toBe("mobile")
  })

  it("解析 iPad Safari", () => {
    const ua =
      "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/605.1.15"
    const parsed = parseUserAgent(ua)
    expect(parsed.os).toBe("iPadOS")
    expect(parsed.deviceType).toBe("tablet")
    expect(parsed.browser).toBe("Safari 17")
  })

  it("解析 Android 平板（无 Mobile 关键字）", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; SM-X910) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    const parsed = parseUserAgent(ua)
    expect(parsed.os).toBe("Android")
    expect(parsed.deviceType).toBe("tablet")
  })

  it("解析 curl CLI", () => {
    const ua = "curl/8.7.1"
    const parsed = parseUserAgent(ua)
    expect(parsed.browser).toBe("curl 8.7.1")
    expect(parsed.os).toBe("API 客户端")
    expect(parsed.deviceType).toBe("cli")
  })

  it("解析 Postman", () => {
    const ua = "PostmanRuntime/7.39.0"
    const parsed = parseUserAgent(ua)
    expect(parsed.browser).toBe("Postman")
    expect(parsed.os).toBe("API 客户端")
    expect(parsed.deviceType).toBe("cli")
  })

  it("处理未知长 UA 截断显示", () => {
    const ua =
      "SomeVeryLongUnknownUserAgentStringThatExceedsFortyCharacters/1.0"
    const parsed = parseUserAgent(ua)
    expect(parsed.browser).toBe("Web 浏览器")
    expect(parsed.title.length).toBeLessThanOrEqual(43) // 40 + "..."
  })

  it("处理 undefined 输入", () => {
    const parsed = parseUserAgent(undefined)
    expect(parsed.deviceType).toBe("unknown")
    expect(parsed.title).toBe("未知设备")
  })
})
