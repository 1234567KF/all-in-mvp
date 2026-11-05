import { describe, expect, it } from "vitest"

import { extractErrorMessage, extractFieldErrors } from "@/lib/errors"

describe("extractErrorMessage", () => {
  it("returns Error.message for Error instance", () => {
    expect(extractErrorMessage(new Error("网络超时"))).toBe("网络超时")
  })

  it("returns response.data.message for axios-like error", () => {
    const axiosError = {
      response: {
        data: {
          message: "未授权访问",
        },
      },
    }
    expect(extractErrorMessage(axiosError)).toBe("未授权访问")
  })

  it("returns fallback for plain string", () => {
    expect(extractErrorMessage("some string")).toBe("操作失败，请重试")
  })

  it("returns fallback for null", () => {
    expect(extractErrorMessage(null)).toBe("操作失败，请重试")
  })

  it("returns fallback for undefined", () => {
    expect(extractErrorMessage(undefined)).toBe("操作失败，请重试")
  })

  it("returns fallback when response.data.message is not a string", () => {
    const err = { response: { data: { message: 123 } } }
    expect(extractErrorMessage(err)).toBe("操作失败，请重试")
  })

  it("returns fallback for empty object", () => {
    expect(extractErrorMessage({})).toBe("操作失败，请重试")
  })

  it("优先返回 axios 响应体消息而非 Error.message", () => {
    const err = Object.assign(
      new Error("Request failed with status code 409"),
      {
        response: { data: { message: "该名称已被使用，请更换名称后重试" } },
      }
    )
    expect(extractErrorMessage(err)).toBe("该名称已被使用，请更换名称后重试")
  })

  it("axios 无响应体消息时回退到 Error.message", () => {
    const err = Object.assign(new Error("网络超时"), {
      response: { data: {} },
    })
    expect(extractErrorMessage(err)).toBe("网络超时")
  })

  it("axios 网络错误（无 response）统一转中文兜底，不展示英文原生 message", () => {
    expect(extractErrorMessage(new Error("Network Error"))).toBe(
      "网络连接失败，请检查网络后重试"
    )
    expect(extractErrorMessage(new Error("timeout of 10000ms exceeded"))).toBe(
      "网络连接失败，请检查网络后重试"
    )
    expect(extractErrorMessage(new Error("Failed to fetch"))).toBe(
      "网络连接失败，请检查网络后重试"
    )
  })

  it("axios HTTP 状态错误（响应体没带 message）转中文兜底而非英文状态文案", () => {
    expect(
      extractErrorMessage(new Error("Request failed with status code 500"))
    ).toBe("操作失败，请重试")
  })
})

describe("extractFieldErrors", () => {
  it("returns errors from axios-like response", () => {
    const err = {
      response: {
        data: {
          success: false,
          message: "校验失败",
          errors: { name: "名称不能为空", type: "类型不存在" },
        },
      },
    }
    expect(extractFieldErrors(err)).toEqual({
      name: "名称不能为空",
      type: "类型不存在",
    })
  })

  it("returns undefined when errors field is absent", () => {
    const err = { response: { data: { message: "服务器错误" } } }
    expect(extractFieldErrors(err)).toBeUndefined()
  })

  it("returns undefined when errors is not a Record<string, string>", () => {
    const err = { response: { data: { errors: ["not a record"] } } }
    expect(extractFieldErrors(err)).toBeUndefined()
  })

  it("returns undefined for null/undefined/primitive", () => {
    expect(extractFieldErrors(null)).toBeUndefined()
    expect(extractFieldErrors(undefined)).toBeUndefined()
    expect(extractFieldErrors("string")).toBeUndefined()
    expect(extractFieldErrors(42)).toBeUndefined()
  })

  it("returns undefined when errors contains non-string values", () => {
    const err = { response: { data: { errors: { name: 123 } } } }
    expect(extractFieldErrors(err)).toBeUndefined()
  })

  it("returns empty object when errors is an empty Record", () => {
    const err = { response: { data: { errors: {} } } }
    // empty object has no non-string values, so it passes the check but is falsy-ish
    // Actually {} is truthy and all zero values pass the every() check
    expect(extractFieldErrors(err)).toEqual({})
  })
})
