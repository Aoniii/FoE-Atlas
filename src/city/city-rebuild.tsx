import { useEffect, useRef, useState } from "react"
import { Hammer, Square } from "lucide-react"
import type { City, RatedCity } from "@/core/city"
import {
  REBUILD_SECONDS,
  rebuildInput,
  rebuiltCity,
  tileCounts,
  type RebuildResult,
  type RebuildShare,
} from "@/core/rebuild"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useI18n } from "@/lib/i18n"
import { usePersistentState } from "@/lib/use-persistent-state"
import type { RebuildMessage, RebuildRequest } from "./rebuild.worker"

// A result's worth: every building placed, then the biggest free block (roads and free tiles
// cut off weigh the same), then the fewest roads
const score = (r: RebuildResult) =>
  r.unplaced.length * 1000000 + (r.roadTiles + r.isolatedTiles) * 100 + r.roadTiles

const fill = (text: string, values: Record<string, number | string>) =>
  Object.entries(values).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), text)

// "Rebuild the city": the search runs in a worker with its progress, then a window sums up
// what changed
export function CityRebuild({
  city,
  groups,
  traits,
  result,
  onResult,
  onShowRebuilt,
}: {
  city: City
  groups: number[][]
  traits: RatedCity["traits"]
  result?: RebuildResult
  onResult: (result: RebuildResult) => void
  onShowRebuilt: () => void
}) {
  const { t } = useI18n()
  // Minutes to give the search, the player's last choice
  const [minutes, setMinutes] = usePersistentState("city.rebuildMinutes", REBUILD_SECONDS / 60)
  const seconds = Math.min(30, Math.max(1, minutes || 1)) * 60
  const [progress, setProgress] = useState<number>()
  const [finished, setFinished] = useState<RebuildResult>()
  const workers = useRef<Worker[]>([])
  const stopAll = () => {
    for (const w of workers.current) w.terminate()
    workers.current = []
  }
  useEffect(() => stopAll, [])
  const input = rebuildInput(city, groups, traits)

  // One search per core but one (the page stays smooth), at most 8: islands sharing their
  // best plans, the best result kept
  const start = () => {
    if (!input) return
    stopAll()
    const islands = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 2) - 1))
    const done = new Array<number>(islands).fill(0)
    const results: RebuildResult[] = []
    // The best plan of each phase so far, given to every island
    const shared: RebuildShare[] = []
    setProgress(0)
    for (let island = 0; island < islands; island++) {
      const worker = new Worker(new URL("./rebuild.worker.ts", import.meta.url), {
        type: "module",
      })
      workers.current.push(worker)
      worker.onmessage = (event: MessageEvent<RebuildMessage>) => {
        const data = event.data
        if ("done" in data) {
          done[island] = data.done
          setProgress(Math.min(...done))
        } else if ("share" in data) {
          const known = shared[data.share.phase]
          if (known && known.cost <= data.share.cost) return
          shared[data.share.phase] = data.share
          for (const other of workers.current) {
            if (other !== worker) other.postMessage({ adopt: data.share } satisfies RebuildRequest)
          }
        } else {
          results.push(data.result)
          worker.terminate()
          if (results.length < islands) return
          const best = results.reduce((a, b) => (score(b) < score(a) ? b : a))
          workers.current = []
          onResult(best)
          setFinished(best)
          setProgress(undefined)
        }
      }
      worker.postMessage({ input, seconds, island, islands } satisfies RebuildRequest)
    }
  }
  const stop = () => {
    stopAll()
    setProgress(undefined)
  }
  // Minutes left, from the share done (the search runs for a set time)
  const left = progress === undefined ? 0 : Math.ceil(((1 - progress) * seconds) / 60)

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <h3 className="flex items-center gap-2 font-medium">
        <Hammer className="size-4" />
        {t.city.rebuildTitle}
      </h3>
      <p className="text-sm text-muted-foreground">
        {fill(t.city.rebuildText, { minutes: REBUILD_SECONDS / 60 })}
      </p>
      {!input ? (
        <p className="text-sm">{t.city.rebuildNeedsUpdate}</p>
      ) : progress === undefined ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            {t.city.rebuildDuration}
            <Input
              type="number"
              min={1}
              max={30}
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
              className="h-8 w-20"
            />
          </label>
          <Button size="sm" onClick={start}>
            <Hammer />
            {result ? t.city.rebuildAgain : t.city.rebuildRun}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              {fill(t.city.rebuildRunning, { percent: Math.round(progress * 100), minutes: left })}
            </span>
            <Button size="sm" variant="outline" onClick={stop}>
              <Square />
              {t.city.rebuildStop}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!finished} onOpenChange={(open) => !open && setFinished(undefined)}>
        {finished && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.city.rebuildDoneTitle}</DialogTitle>
              <DialogDescription>
                {improves(city, finished) ? t.city.rebuildDoneText : t.city.rebuildNotBetter}
              </DialogDescription>
            </DialogHeader>
            <RebuildFigures city={city} result={finished} />
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>{t.city.rebuildClose}</DialogClose>
              <Button
                onClick={() => {
                  onShowRebuilt()
                  setFinished(undefined)
                }}
              >
                {t.city.rebuildShow}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </section>
  )
}

// Fewer roads, or as many with a free block for a new building
function improves(city: City, result: RebuildResult) {
  const before = tileCounts(city).roads
  const after = tileCounts(rebuiltCity(city, result)).roads
  return !result.unplaced.length && (after < before || (after === before && !!result.freeRect))
}

// Roads and free tiles before and after, buildings left out
function RebuildFigures({ city, result }: { city: City; result: RebuildResult }) {
  const { t } = useI18n()
  const before = tileCounts(city)
  const after = tileCounts(rebuiltCity(city, result))
  const unplaced = result.unplaced.map((i) => city.entities[i].name ?? city.entities[i].id)
  return (
    <ul className="flex flex-col gap-1 text-sm">
      <li>
        {fill(t.city.rebuildRoads, {
          before: before.roads,
          after: after.roads,
          diff: after.roads - before.roads,
        })}
      </li>
      <li>{fill(t.city.rebuildFree, { before: before.free, after: after.free })}</li>
      <li>
        {result.freeRect
          ? fill(t.city.rebuildFreeRect, { w: result.freeRect.w, h: result.freeRect.h })
          : t.city.rebuildNoFreeRect}
      </li>
      <li>{fill(t.city.rebuildIsolated, { count: result.isolatedTiles })}</li>
      {unplaced.length > 0 && (
        <li className="text-destructive">
          {fill(t.city.rebuildUnplaced, { names: unplaced.join(", ") })}
        </li>
      )}
    </ul>
  )
}
