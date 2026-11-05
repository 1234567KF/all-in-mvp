import { describe, expect, it } from "vitest"

import {
  AUDIT_EVENT_TYPE_LABELS,
  AUDIT_EVENT_TYPES,
  AUDIT_MODULE_LABELS,
  AUDIT_MODULES,
  AUDIT_RESULT,
  AUDIT_RESULT_LABELS,
} from "./audit.js"

// ─── 事件类型与 label 一致性 ──────────────────────────────────────────────────

describe("AUDIT_EVENT_TYPE_LABELS 一致性", () => {
  it("每个事件类型都有非空 label", () => {
    for (const eventType of Object.values(AUDIT_EVENT_TYPES)) {
      expect(
        AUDIT_EVENT_TYPE_LABELS[eventType],
        `事件类型 ${eventType} 缺少 label`
      ).toBeTruthy()
    }
  })

  it("label 无冗余键（键集合与事件类型集合完全一致）", () => {
    expect(Object.keys(AUDIT_EVENT_TYPE_LABELS).sort()).toEqual(
      Object.values(AUDIT_EVENT_TYPES).sort()
    )
  })

  it("事件类型值无重复", () => {
    const values = Object.values(AUDIT_EVENT_TYPES)
    expect(new Set(values).size).toBe(values.length)
  })
})

// ─── 模块与 label 一致性 ──────────────────────────────────────────────────────

describe("AUDIT_MODULE_LABELS 一致性", () => {
  it("每个模块都有非空 label 且无冗余键", () => {
    expect(Object.keys(AUDIT_MODULE_LABELS).sort()).toEqual(
      Object.values(AUDIT_MODULES).sort()
    )
    for (const label of Object.values(AUDIT_MODULE_LABELS)) {
      expect(label).toBeTruthy()
    }
  })
})

// ─── 审计结果 ─────────────────────────────────────────────────────────────────

describe("AUDIT_RESULT 一致性", () => {
  it("result 值为 success / failure 且 label 完整", () => {
    expect(Object.values(AUDIT_RESULT).sort()).toEqual(["failure", "success"])
    expect(Object.keys(AUDIT_RESULT_LABELS).sort()).toEqual(
      Object.values(AUDIT_RESULT).sort()
    )
  })
})
