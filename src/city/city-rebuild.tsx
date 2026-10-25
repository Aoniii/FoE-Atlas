import { useEffect, useRef, useState } from "react"
import { Hammer, Square } from "lucide-react"
import type { City } from "@/core/city"
import {
  REBUILD_SECONDS,
  rebuildInput,
  rebuiltCity,
  tileCounts,
  type RebuildResult,
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

const fill = (text: string, values: Record<string, number | string>) =>
  Object.entries(values).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), text)

// "Rebuild the city": the search runs in a worker with its progress, then a window sums up
// what changed
export function CityRebuild({
  city,
  groups,
  result,
  onResult,
  onShowRebuilt,
}: {
  city: City
  groups: number[][]
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
  const worker = useRef<Worker>(undefined)
  useEffect(() => () => worker.current?.terminate(), [])
  const input = rebuildInput(city, groups)

  const start = () => {
    if (!input) return
    worker.current?.terminate()
    const next = new Worker(new URL("./rebuild.worker.ts", import.meta.url), { type: "module" })
    worker.current = next
    setProgress(0)
    next.onmessage = (event: MessageEvent<RebuildMessage>) => {
      if ("done" in event.data) {
        setProgress(event.data.done)
        return
      }
      onResult(event.data.result)
      setFinished(event.data.result)
      setProgress(undefined)
      next.terminate()
    }
    next.postMessage({ input, seconds } satisfies RebuildRequest)
  }
  const stop = () => {
    worker.current?.terminate()
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
                {tileCounts(rebuiltCity(city, finished)).roads < tileCounts(city).roads
                  ? t.city.rebuildDoneText
                  : t.city.rebuildNotBetter}
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
      {unplaced.length > 0 && (
        <li className="text-destructive">
          {fill(t.city.rebuildUnplaced, { names: unplaced.join(", ") })}
        </li>
      )}
    </ul>
  )
}
