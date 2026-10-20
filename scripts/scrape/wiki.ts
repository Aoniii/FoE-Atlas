import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

export const USER_AGENT =
  process.env.SCRAPER_USER_AGENT ?? "FoE-Atlas-scraper/0.1 (+https://github.com/Aoniii/FoE-Atlas)"

// The wiki firewall blocked the IP after ~21 quick requests, whatever their size:
// few heavy requests (50 pages each), well spaced
const DELAY_MS = 10_000
const TIMEOUT_MS = 120_000
// If blocked anyway, wait minutes (not seconds) before trying again
const BACKOFF_S = [60, 120, 300, 600, 900]
const BATCH_SIZE = 50

export type CachedPage = { revid: number; content: string }
type Cache = Record<string, CachedPage>

class ApiError extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Polite MediaWiki API client: sequential, one request every 10s, long pauses
// then retry on overload or network errors
export class WikiClient {
  private lastRequest = 0
  requests = 0

  readonly base: string

  constructor(base: string) {
    this.base = base
  }

  async api(params: Record<string, string>): Promise<any> {
    const url = `${this.base}/api.php?${new URLSearchParams({
      format: "json",
      formatversion: "2",
      maxlag: "5",
      ...params,
    })}`
    for (let attempt = 1; ; attempt++) {
      const wait = this.lastRequest + DELAY_MS - Date.now()
      if (wait > 0) await sleep(wait)
      this.lastRequest = Date.now()
      this.requests++

      let failure: string
      let retryAfter = 0
      try {
        const response = await fetch(url, {
          headers: { "User-Agent": USER_AGENT },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
        retryAfter = Number(response.headers.get("retry-after") ?? 0)
        const body: any = response.ok ? await response.json() : undefined
        if (response.ok && body?.error?.code !== "maxlag") {
          if (body?.error) throw new ApiError(`${this.base}: ${body.error.code} ${body.error.info}`)
          return body
        }
        failure = response.ok ? "maxlag" : `HTTP ${response.status}`
      } catch (error) {
        // Network errors (timeout, reset...) are retried; API errors are not
        if (error instanceof ApiError) throw error
        const cause = error instanceof Error ? (error.cause as Error | undefined) : undefined
        failure = cause?.message ?? (error instanceof Error ? error.message : String(error))
      }

      if (attempt > BACKOFF_S.length) {
        throw new Error(`${this.base}: ${failure} after ${attempt} attempts`)
      }
      const backoff = Math.max(retryAfter, BACKOFF_S[attempt - 1])
      console.warn(`\n  ${failure}, retry ${attempt}/${BACKOFF_S.length} in ${backoff / 60} min`)
      await sleep(backoff * 1000)
    }
  }

  // Every article (namespace 0, no redirects) with its latest revision id
  async listPages(): Promise<Map<string, number>> {
    const pages = new Map<string, number>()
    let cont: Record<string, string> = {}
    do {
      const body = await this.api({
        action: "query",
        generator: "allpages",
        gapnamespace: "0",
        gapfilterredir: "nonredirects",
        gaplimit: "500",
        prop: "info",
        ...cont,
      })
      for (const page of body.query?.pages ?? []) pages.set(page.title, page.lastrevid)
      process.stdout.write(`\r  Listing pages: ${pages.size}`)
      cont = body.continue ?? {}
    } while (Object.keys(cont).length)
    process.stdout.write("\n")
    return pages
  }

  async fetchContents(titles: string[]): Promise<Map<string, CachedPage>> {
    const result = new Map<string, CachedPage>()
    for (let i = 0; i < titles.length; i += BATCH_SIZE) {
      const body = await this.api({
        action: "query",
        prop: "revisions",
        rvprop: "content|ids",
        rvslots: "main",
        titles: titles.slice(i, i + BATCH_SIZE).join("|"),
      })
      for (const page of body.query?.pages ?? []) {
        const revision = page.revisions?.[0]
        if (revision) {
          result.set(page.title, { revid: revision.revid, content: revision.slots.main.content })
        }
      }
    }
    return result
  }
}

export function loadCache(path: string): Cache {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {}
}

export function saveCache(path: string, cache: Cache) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(cache))
}

// Brings the cache up to date, downloading only pages whose revision changed.
// `stop` lets a sample run end early once it has what it needs.
export async function syncPages(
  client: WikiClient,
  cachePath: string,
  options: { offline: boolean; stop?: (cache: Cache) => boolean },
): Promise<Cache> {
  const cache = loadCache(cachePath)
  if (options.offline) return cache

  const pages = await client.listPages()
  for (const title of Object.keys(cache)) if (!pages.has(title)) delete cache[title]
  const stale = [...pages]
    .filter(([title, revid]) => cache[title]?.revid !== revid)
    .map(([title]) => title)
  const minutes = Math.ceil((Math.ceil(stale.length / BATCH_SIZE) * DELAY_MS) / 60_000)
  console.log(
    `  ${client.base}: ${pages.size} pages, ${stale.length} to download (~${minutes} min)`,
  )

  for (let i = 0; i < stale.length; i += BATCH_SIZE) {
    if (options.stop?.(cache)) break
    for (const [title, page] of await client.fetchContents(stale.slice(i, i + BATCH_SIZE))) {
      cache[title] = page
    }
    saveCache(cachePath, cache)
    process.stdout.write(`\r  ${Math.min(i + BATCH_SIZE, stale.length)}/${stale.length}`)
  }
  if (stale.length) process.stdout.write("\n")
  return cache
}
