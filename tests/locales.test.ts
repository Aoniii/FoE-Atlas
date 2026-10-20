import { describe, expect, it } from "vitest"
import { DEFAULT_LOCALE, LOCALES, flags, messages } from "@/lib/i18n"
import template from "@/locales/_template.json"

// Flatten nested keys: { a: { b: "" } } -> ["a.b"]
function keysOf(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === "object" && value !== null
      ? keysOf(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  )
}

const referenceKeys = keysOf(messages[DEFAULT_LOCALE]).sort()

describe("locales", () => {
  it("template has the same keys as the reference locale", () => {
    expect(keysOf(template).sort()).toEqual(referenceKeys)
  })

  it.each(LOCALES)("%s has the same keys as the reference locale", (locale) => {
    expect(keysOf(messages[locale]).sort()).toEqual(referenceKeys)
  })

  it.each(LOCALES)("%s has no empty translation", (locale) => {
    const values = keysOf(messages[locale]).map((key) =>
      key
        .split(".")
        .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], messages[locale]),
    )
    expect(values.every((value) => typeof value === "string" && value.trim() !== "")).toBe(true)
  })

  it.each(LOCALES)("%s has a flag", (locale) => {
    expect(flags[locale]).toBeDefined()
  })
})
