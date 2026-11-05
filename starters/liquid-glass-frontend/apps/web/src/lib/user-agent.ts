/**
 * User-Agent 解析工具
 * 用于将原始 User-Agent 字符串转化为易读的浏览器、操作系统和设备类型
 */

export interface ParsedUserAgent {
  /** 浏览器名称及主版本号，例如 "Chrome 126" */
  browser: string
  /** 操作系统名称，例如 "macOS", "Windows", "iOS", "Android" */
  os: string
  /** 设备类型 */
  deviceType: "desktop" | "mobile" | "tablet" | "cli" | "unknown"
  /** 格式化后的简短标题，例如 "Chrome 126 · macOS" */
  title: string
}

export function parseUserAgent(ua?: string): ParsedUserAgent {
  if (!ua || !ua.trim()) {
    return {
      browser: "未知浏览器",
      os: "未知系统",
      deviceType: "unknown",
      title: "未知设备",
    }
  }

  const str = ua.trim()

  // 1. 操作系统识别
  let os = "未知系统"
  let deviceType: ParsedUserAgent["deviceType"] = "desktop"

  if (/iPad/i.test(str)) {
    os = "iPadOS"
    deviceType = "tablet"
  } else if (/iPhone|iPod/i.test(str)) {
    os = "iOS"
    deviceType = "mobile"
  } else if (/Android/i.test(str)) {
    os = "Android"
    deviceType = /Mobile/i.test(str) ? "mobile" : "tablet"
  } else if (/Macintosh|Mac OS X/i.test(str)) {
    os = "macOS"
    deviceType = "desktop"
  } else if (/Windows NT 10\.0|Windows NT 11\.0/i.test(str)) {
    os = "Windows"
    deviceType = "desktop"
  } else if (/Windows/i.test(str)) {
    os = "Windows"
    deviceType = "desktop"
  } else if (/Linux/i.test(str)) {
    os = "Linux"
    deviceType = "desktop"
  } else if (/curl|Postman|Insomnia|HTTPClient/i.test(str)) {
    os = "API 客户端"
    deviceType = "cli"
  }

  // 2. 浏览器识别
  let browser = ""
  if (/MicroMessenger/i.test(str)) {
    browser = "微信内置浏览器"
  } else if (/Edg\//i.test(str)) {
    const match = str.match(/Edg\/([\d.]+)/)
    browser = match ? `Edge ${match[1].split(".")[0]}` : "Edge"
  } else if (/OPR\/|Opera/i.test(str)) {
    const match = str.match(/(?:OPR|Opera)\/([\d.]+)/)
    browser = match ? `Opera ${match[1].split(".")[0]}` : "Opera"
  } else if (/Chrome\//i.test(str) && !/Edg\/|OPR\//i.test(str)) {
    const match = str.match(/Chrome\/([\d.]+)/)
    browser = match ? `Chrome ${match[1].split(".")[0]}` : "Chrome"
  } else if (/Firefox\//i.test(str)) {
    const match = str.match(/Firefox\/([\d.]+)/)
    browser = match ? `Firefox ${match[1].split(".")[0]}` : "Firefox"
  } else if (/Safari\//i.test(str) && !/Chrome\//i.test(str)) {
    const match = str.match(/Version\/([\d.]+)/)
    browser = match ? `Safari ${match[1].split(".")[0]}` : "Safari"
  } else if (/curl\/([\d.]+)/i.test(str)) {
    const match = str.match(/curl\/([\d.]+)/i)
    browser = match ? `curl ${match[1]}` : "curl"
  } else if (/PostmanRuntime/i.test(str)) {
    browser = "Postman"
  }

  // 如果无法正常提取常见浏览器，保留原短文本或默认兜底
  if (!browser) {
    if (str.length < 30) {
      browser = str
    } else {
      browser = "Web 浏览器"
    }
  }

  let title: string
  if (browser && os !== "未知系统") {
    title = `${browser} · ${os}`
  } else if (browser) {
    title = browser
  } else if (os !== "未知系统") {
    title = os
  } else {
    title = str.length > 40 ? `${str.slice(0, 40)}...` : str
  }

  return {
    browser,
    os,
    deviceType,
    title,
  }
}
