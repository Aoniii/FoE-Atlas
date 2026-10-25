import { describe, expect, it } from "vitest"
import { fileName, harEntries, redact } from "../scripts/har-extract"

describe("HAR extraction", () => {
  it("removes every secret-looking field, at any depth", () => {
    const json = [
      {
        requestClass: "StartupService",
        responseData: { user_data: { player_id: 1, sessionToken: "x" } },
      },
      { socket: { authToken: "y", ticket: "z" }, city: { name: "Paris" } },
    ]
    expect(redact(json)).toEqual([
      {
        requestClass: "StartupService",
        responseData: { user_data: { player_id: 1, sessionToken: "[removed]" } },
      },
      { socket: { authToken: "[removed]", ticket: "[removed]" }, city: { name: "Paris" } },
    ])
  })

  it("names files without the query string", () => {
    expect(
      fileName("https://foezz.innogamescdn.com/start/metadata/city_entities-ab12.json?h=secret", 7),
    ).toBe("0007_foezz.innogamescdn.com_start_metadata_city_entities-ab12.json")
  })
})

describe("HAR entries", () => {
  it("reads every entry, braces and quotes inside strings included", () => {
    const entry = (url: string, text: string) => ({
      request: { method: "GET", url },
      response: { status: 200, content: { text } },
    })
    const entries = [entry("https://a/x", '{"a":"}]\\""}'), entry("https://a/y", "[1]")]
    const har = Buffer.from(JSON.stringify({ log: { version: "1.2", entries } }))
    expect([...harEntries(har)]).toEqual(entries)
  })
})
