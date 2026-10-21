// Extracts the JSON the game downloaded from a browser network capture (.har), without
// anything that could log in the player: request and response headers, cookies and query
// strings are dropped (but the metadata file name, ?id=), and every JSON field whose name looks
// like a secret (token, session, password...) is replaced by "[removed]". Posted JSON (the game
// requests, which say which building was opened) is kept the same way in <file>.request.json.
// The addresses of the game's icon sheets (public images) are listed in icon-sheets.json.
//   pnpm har-extract <capture.har> [name]
// Output: scripts/.cache/har/<name>/ (git-ignored), one file per JSON response and an index.
// The .har itself holds the player's session: keep it out of the repository and delete it after.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { basename } from "node:path"

type HarEntry = {
  request: { method: string; url: string; postData?: { text?: string } }
  response: {
    status: number
    content: { mimeType?: string; text?: string; encoding?: string }
  }
}

const SECRET =
  /token|session|password|passwd|secret|auth|cookie|ticket|apikey|^sid$|^key$|^e?mail$/i

// Same JSON with every secret-looking field removed
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, field]) => [
        key,
        SECRET.test(key) ? "[removed]" : redact(field),
      ]),
    )
  }
  return value
}

// "https://host/path/file-1a2b.json?h=..." -> "host_path_file-1a2b.json" (no query string)
export function fileName(url: string, index: number): string {
  const { host, pathname } = new URL(url)
  const name = `${host}${pathname}`.replace(/[^a-zA-Z0-9.-]+/g, "_").slice(-120)
  return `${String(index).padStart(4, "0")}_${name.endsWith(".json") ? name : `${name}.json`}`
}

function parseJson(text: string | undefined): unknown {
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function main() {
  const [file, name = basename(process.argv[2] ?? "", ".har")] = process.argv.slice(2)
  if (!file) throw new Error("Usage: pnpm har-extract <capture.har> [name]")
  const har = JSON.parse(readFileSync(file, "utf8")) as { log: { entries: HarEntry[] } }
  const output = `scripts/.cache/har/${name}`
  rmSync(output, { recursive: true, force: true })
  mkdirSync(output, { recursive: true })

  const index: { file: string; method: string; url: string; status: number; bytes: number }[] = []
  const sheets: string[] = []
  har.log.entries.forEach((entry, i) => {
    const { content } = entry.response
    // Icon sheets of the game: only their public address (images in a capture can be cut)
    const { origin, pathname } = new URL(entry.request.url)
    if (/\/icons\/[^/]+\.png$/.test(pathname)) {
      sheets.push(`${origin}${pathname}`)
      return
    }
    if (!content.text) return
    const text =
      content.encoding === "base64"
        ? Buffer.from(content.text, "base64").toString("utf8")
        : content.text
    const json = parseJson(text)
    if (json === undefined) return
    const out = fileName(entry.request.url, i)
    const body = JSON.stringify(redact(json))
    writeFileSync(`${output}/${out}`, body)
    const posted = parseJson(entry.request.postData?.text)
    if (posted !== undefined) {
      writeFileSync(
        `${output}/${out.replace(/\.json$/, ".request.json")}`,
        JSON.stringify(redact(posted)),
      )
    }
    const url = new URL(entry.request.url)
    const id = url.searchParams.get("id")
    index.push({
      file: out,
      method: entry.request.method,
      url: `${url.origin}${url.pathname}${id ? `?id=${id}` : ""}`,
      status: entry.response.status,
      bytes: body.length,
    })
  })
  writeFileSync(`${output}/index.json`, JSON.stringify(index, null, 2) + "\n")
  writeFileSync(`${output}/icon-sheets.json`, JSON.stringify([...new Set(sheets)], null, 2) + "\n")
  console.log(`${index.length} JSON responses in ${output} (largest first):`)
  for (const item of [...index].sort((a, b) => b.bytes - a.bytes).slice(0, 15)) {
    console.log(`  ${(item.bytes / 1024).toFixed(0).padStart(6)} KB  ${item.method} ${item.url}`)
  }
  console.log("You can now delete the .har file: it holds your session.")
}

if (process.argv[1]?.endsWith("har-extract.ts")) main()
