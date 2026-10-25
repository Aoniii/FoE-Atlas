// One search of the city's rebuild away from the page (it takes minutes): several run side
// by side as islands, each with its own start and heat, sharing their best plans (see
// city-rebuild.tsx)
import {
  createSearch,
  type RebuildInput,
  type RebuildResult,
  type RebuildShare,
} from "@/core/rebuild"

export type RebuildRequest =
  | { input: RebuildInput; seconds: number; island: number; islands: number }
  | { adopt: RebuildShare }
export type RebuildMessage = { done: number } | { share: RebuildShare } | { result: RebuildResult }

let adopt: ((plan: RebuildShare) => void) | undefined

self.onmessage = (event: MessageEvent<RebuildRequest>) => {
  const data = event.data
  if ("adopt" in data) {
    adopt?.(data.adopt)
    return
  }
  let sent = 0
  const search = createSearch(data.input, {
    seconds: data.seconds,
    island: data.island,
    islands: data.islands,
    // A few updates per second are enough for the progress bar
    onProgress: (done) => {
      if (performance.now() - sent < 250) return
      sent = performance.now()
      self.postMessage({ done } satisfies RebuildMessage)
    },
  })
  adopt = search.adopt
  // Slices of search, the best plan shared after each, the page's messages read between
  const slice = () => {
    const over = search.run(200)
    self.postMessage({ share: search.best() } satisfies RebuildMessage)
    if (over) self.postMessage({ result: search.finish() } satisfies RebuildMessage)
    else setTimeout(slice)
  }
  slice()
}
