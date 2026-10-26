import { useMemo } from "react"
import { getRouteApi } from "@tanstack/react-router"
import { LATEST_AGE } from "@/core/ages"
import { DEFAULT_BOOST_BASES } from "@/core/efficiency"
import type { BuildingType } from "@/core/building"
import type { StatKey } from "@/core/stats"
import { getPreferredAge, setPreferredAge } from "@/lib/age-preference"
import { useI18n } from "@/lib/i18n"
import { usePersistentState } from "@/lib/use-persistent-state"
import { BuildingsTable } from "./buildings-table"
import { DEFAULT_SCORE, setBoostBases, useBoostBases, useScoreKeys } from "./score-settings"
import { GreatBuildingGrid } from "./great-building-grid"
import { AllyGrid } from "./ally-grid"
import { ItemGrid } from "./item-grid"
import { toRows } from "./data"
import { eventName, formatNumber } from "./format"
import { StatIconsContext } from "./stat-icons-context"
import { ScoreActions, ScorePanel, WikiFilters } from "./wiki-filters"

const route = getRouteApi("/wiki")

const DEFAULT_VISIBLE: StatKey[] = [
  "fp",
  "goods",
  "atk_army_att_classic",
  "atk_army_def_classic",
  "def_army_att_classic",
  "def_army_def_classic",
]
export function WikiPage() {
  const { t, locale } = useI18n()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const { index, buildings, greatBuildings, items, allies } = route.useLoaderData()

  const type: BuildingType = search.type ?? "special"
  const age = search.age ?? getPreferredAge() ?? LATEST_AGE
  const [visibleStats, setVisibleStats] = usePersistentState("wiki.columns.v2", DEFAULT_VISIBLE)
  const [scoreKeys, setScoreKeys] = useScoreKeys()
  const bases = useBoostBases()

  const types = useMemo(
    () => index.types ?? [...new Set(buildings.map((b) => b.type))].sort(),
    [index.types, buildings],
  )
  const isGreatBuildings = type === "great_building"
  const isItems = type === "item"
  const isAllies = type === "ally"
  // Great Buildings, items and allies have their own grid, without the stat table
  const hasTable = !isGreatBuildings && !isItems && !isAllies
  const ofType = useMemo(() => buildings.filter((b) => b.type === type), [buildings, type])
  // Event families present, with their number of buildings, sorted by name
  const events = useMemo(() => {
    const counts = new Map<string, number>()
    for (const b of ofType) if (b.event) counts.set(b.event, (counts.get(b.event) ?? 0) + 1)
    return [...counts]
      .map(([id, count]) => ({ value: id, label: `${eventName(id, locale)} (${count})` }))
      .sort((a, b) => a.label.localeCompare(b.label, locale))
  }, [ofType, locale])
  // Every type is scored but Great Buildings (their own grid)
  const showScore = hasTable && scoreKeys.length > 0
  const rows = useMemo(() => {
    const shown = search.event ? ofType.filter((b) => b.event === search.event) : ofType
    return toRows(shown, scoreKeys, bases)
  }, [ofType, search.event, scoreKeys, bases])

  const toggle = (list: StatKey[], key: StatKey, on: boolean) =>
    on ? [...new Set([...list, key])] : list.filter((k) => k !== key)

  return (
    <StatIconsContext value={index.icons ?? {}}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold">{t.nav.wiki}</h1>
          <p className="text-xs text-muted-foreground">
            {formatNumber(
              isGreatBuildings
                ? greatBuildings.length
                : isItems
                  ? items.length
                  : isAllies
                    ? allies.length
                    : rows.length,
              locale,
            )}{" "}
            {isItems ? t.item.count : isAllies ? t.ally.count : t.wiki.buildings}
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
          onAgeChange={(value) => {
            setPreferredAge(value)
            navigate({ search: (s) => ({ ...s, age: value }) })
          }}
          events={events}
          event={search.event}
          onEventChange={(value) => navigate({ search: (s) => ({ ...s, event: value }) })}
          visibleStats={visibleStats}
          onToggleStat={(key, on) => setVisibleStats((list) => toggle(list, key, on))}
        />

        {isGreatBuildings && <GreatBuildingGrid cards={greatBuildings} />}
        {isItems && <ItemGrid cards={items} />}
        {isAllies && <AllyGrid cards={allies} />}

        {hasTable && (
          <div className="flex flex-col gap-2">
            <ScorePanel
              scoreKeys={scoreKeys}
              onToggle={(key, on) => setScoreKeys((list) => toggle(list, key, on))}
            />
            <ScoreActions
              scoreCount={scoreKeys.length}
              onUncheckAll={() => setScoreKeys([])}
              onReset={() => {
                setVisibleStats(DEFAULT_VISIBLE)
                setScoreKeys(DEFAULT_SCORE)
                setBoostBases(DEFAULT_BOOST_BASES)
              }}
            />
          </div>
        )}

        {hasTable && (
          <BuildingsTable rows={rows} visibleStats={visibleStats} showScore={showScore} />
        )}
      </div>
    </StatIconsContext>
  )
}
