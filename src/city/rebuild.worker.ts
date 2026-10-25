// Runs the rebuild of a city away from the page (it takes minutes), with its progress
import { rebuildCity, type RebuildInput, type RebuildResult } from "@/core/rebuild"

export type RebuildRequest = { input: RebuildInput; seconds: number }
export type RebuildMessage = { done: number } | { result: RebuildResult }

self.onmessage = (event: MessageEvent<RebuildRequest>) => {
  const { input, seconds } = event.data
  let sent = 0
  const result = rebuildCity(input, {
    seconds,
    // A few updates per second are enough for the progress bar
    onProgress: (done) => {
      if (performance.now() - sent < 250) return
      sent = performance.now()
      self.postMessage({ done } satisfies RebuildMessage)
    },
  })
  self.postMessage({ result } satisfies RebuildMessage)
}
