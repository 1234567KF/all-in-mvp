/**
 * applyServerFieldErrors 单测：mock setError，覆盖字段名回填、根错误（_form / root）、
 * 无字段错误与空消息等边界。
 */
import type { UseFormSetError } from "react-hook-form"
import { describe, expect, it, vi } from "vitest"

import { applyServerFieldErrors } from "@/lib/form-error"

interface ProfileForm {
  name: string
  email: string
}

/** 构造 axios 风格的 400 校验失败响应体 */
function createAxiosError(errors?: unknown) {
  return {
    response: {
      data: {
        success: false,
        message: "参数校验失败",
        ...(errors === undefined ? {} : { errors }),
      },
    },
  }
}

/**
 * mock 版 setError：`apply` 用 vi.fn 断言调用，类型上伪装成 UseFormSetError<ProfileForm>。
 * （单测只关心「哪些 name/message 被挂载」，不需要真实表单实例）
 */
function createSetErrorMock() {
  const setError = vi.fn()
  return {
    setError,
    apply: (err: unknown) =>
      applyServerFieldErrors<ProfileForm>(
        err,
        setError as unknown as UseFormSetError<ProfileForm>
      ),
  }
}

describe("applyServerFieldErrors", () => {
  it("按字段名回填错误，返回 true", () => {
    const { setError, apply } = createSetErrorMock()

    const result = apply(
      createAxiosError({ name: "名称不能为空", email: "邮箱格式不正确" })
    )

    expect(result).toBe(true)
    expect(setError).toHaveBeenNthCalledWith(1, "name", {
      type: "server",
      message: "名称不能为空",
    })
    expect(setError).toHaveBeenNthCalledWith(2, "email", {
      type: "server",
      message: "邮箱格式不正确",
    })
  })

  it("_form 挂到表单根，返回 true", () => {
    const { setError, apply } = createSetErrorMock()

    const result = apply(createAxiosError({ _form: "表单已过期，请重新提交" }))

    expect(result).toBe(true)
    expect(setError).toHaveBeenCalledTimes(1)
    expect(setError).toHaveBeenCalledWith("root", {
      type: "server",
      message: "表单已过期，请重新提交",
    })
  })

  it("root 同样挂到表单根，返回 true", () => {
    const { setError, apply } = createSetErrorMock()

    const result = apply(createAxiosError({ root: "两次密码不一致" }))

    expect(result).toBe(true)
    expect(setError).toHaveBeenCalledWith("root", {
      type: "server",
      message: "两次密码不一致",
    })
  })

  it("无 response.data.errors 时返回 false 且不调用 setError", () => {
    const { setError, apply } = createSetErrorMock()

    expect(apply(createAxiosError())).toBe(false)
    expect(setError).not.toHaveBeenCalled()
  })

  it("errors 为空对象时返回 false 且不调用 setError", () => {
    const { setError, apply } = createSetErrorMock()

    expect(apply(createAxiosError({}))).toBe(false)
    expect(setError).not.toHaveBeenCalled()
  })

  it("非 axios 形态的错误（null / 普通 Error / 字符串）返回 false", () => {
    const { setError, apply } = createSetErrorMock()

    expect(apply(null)).toBe(false)
    expect(apply(undefined)).toBe(false)
    expect(apply(new Error("网络超时"))).toBe(false)
    expect(apply("oops")).toBe(false)
    expect(setError).not.toHaveBeenCalled()
  })

  it("errors 值不是字符串（extractFieldErrors 判定非法）时返回 false", () => {
    const { setError, apply } = createSetErrorMock()

    expect(apply(createAxiosError({ name: 123 }))).toBe(false)
    expect(setError).not.toHaveBeenCalled()
  })

  it("空字符串消息被跳过；只回填有效消息并返回 true", () => {
    const { setError, apply } = createSetErrorMock()

    const result = apply(createAxiosError({ name: "", email: "邮箱已存在" }))

    expect(result).toBe(true)
    expect(setError).toHaveBeenCalledTimes(1)
    expect(setError).toHaveBeenCalledWith("email", {
      type: "server",
      message: "邮箱已存在",
    })
  })

  it("纯空白消息 trim 后为空，同样被跳过并返回 false", () => {
    const { setError, apply } = createSetErrorMock()

    expect(apply(createAxiosError({ name: "   ", email: "\t" }))).toBe(false)
    expect(setError).not.toHaveBeenCalled()
  })

  it("全部消息为空字符串时不挂载任何错误，返回 false", () => {
    const { setError, apply } = createSetErrorMock()

    expect(apply(createAxiosError({ name: "", email: "" }))).toBe(false)
    expect(setError).not.toHaveBeenCalled()
  })
})
