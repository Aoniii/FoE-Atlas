import { useMemo } from "react"
import { getRouteApi } from "@tanstack/react-router"
import { LATEST_AGE } from "@/core/ages"
import type { BuildingType } from "@/core/building"
import type { StatKey } from "@/core/stats"
import { useI18n } from "@/lib/i18n"
import { usePersistentState } from "@/lib/use-persistent-state"
import { BuildingsTable, statsOfGroup } from "./buildings-table"
import { toRows } from "./data"
import { formatNumber } from "./format"
import { ScorePanel, WikiFilters } from "./wiki-filters"

const route = getRouteApi("/wiki")

const DEFAULT_VISIBLE: StatKey[] = [
  "fp",
  "goods",
  "atk_army_att_classic",
  "atk_army_def_classic",
  "def_army_att_classic",
  "def_army_def_classic",
]
// FP, goods of the 3 ages and every army boost (both armies, all contexts)
const DEFAULT_SCORE: StatKey[] = [
  "fp",
  "goods_prev",
  "goods",
  "goods_next",
  ...statsOfGroup("attacking_army"),
  ...statsOfGroup("defending_army"),
]

export function WikiPage() {
  const { t, locale } = useI18n()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const { index, buildings } = route.useLoaderData()

  const type: BuildingType = search.type ?? "special"
  const age = search.age ?? LATEST_AGE
  const [visibleStats, setVisibleStats] = usePersistentState("wiki.columns.v2", DEFAULT_VISIBLE)
  const [scoreKeys, setScoreKeys] = usePersistentState("wiki.score.v2", DEFAULT_SCORE)

  const types = useMemo(() => [...new Set(buildings.map((b) => b.type))].sort(), [buildings])
  const ofType = useMemo(() => buildings.filter((b) => b.type === type), [buildings, type])
  const events = useMemo(
    () => [...new Set(ofType.flatMap((b) => (b.event ? [b.event] : [])))].sort(),
    [ofType],
  )
  const showScore = type === "special" && scoreKeys.length > 0
  const rows = useMemo(() => {
    const shown = search.event ? ofType.filter((b) => b.event === search.event) : ofType
    return toRows(shown, type === "special" ? scoreKeys : [])
  }, [ofType, search.event, scoreKeys, type])

  const toggle = (list: StatKey[], key: StatKey, on: boolean) =>
    on ? [...new Set([...list, key])] : list.filter((k) => k !== key)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t.nav.wiki}</h1>
        <p className="text-xs text-muted-foreground">
          {formatNumber(rows.length, locale)} {t.wiki.buildings}
          {index.gameVersion && ` · ${t.wiki.gameVersion} ${index.gameVersion}`} · {t.wiki.updated}{" "}
          {new Date(index.scrapedAt).toLocaleDateString(locale)}
        </p>
      </div>

      <WikiFilters
        types={types}
        type={type}
        onTypeChange={(value) =>
          navigate({ search: (s) => ({ ...s, type: value, event: undefined }) })
        }
        ages={index.ages.map((a) => a.id)}
        age={age}
        onAgeChange={(value) => navigate({ search: (s) => ({ ...s, age: value }) })}
        events={events}
        event={search.event}
        onEventChange={(value) => navigate({ search: (s) => ({ ...s, event: value }) })}
        visibleStats={visibleStats}
        onToggleStat={(key, on) => setVisibleStats((list) => toggle(list, key, on))}
      />

      {type === "special" && (
        <ScorePanel
          scoreKeys={scoreKeys}
          onToggle={(key, on) => {
            setScoreKeys((list) => toggle(list, key, on))
            if (on) setVisibleStats((list) => toggle(list, key, true))
          }}
        />
      )}

      <BuildingsTable rows={rows} visibleStats={visibleStats} showScore={showScore} />
    </div>
  )
}
