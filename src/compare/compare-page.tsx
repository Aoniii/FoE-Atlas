import { useState } from "react"
import { Link, getRouteApi } from "@tanstack/react-router"
import { X } from "lucide-react"
import { AGES, LATEST_AGE, type AgeId } from "@/core/ages"
import type { BuildingPage } from "@/core/building"
import { aggregateStats, score, tileCount } from "@/core/efficiency"
import { GB_MAX_LEVEL, type GreatBuilding } from "@/core/great-building"
import { levelCost } from "@/core/rush"
import { STAT_GROUPS, STAT_KEYS, STATS, type StatGroup } from "@/core/stats"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getPreferredAge, setPreferredAge } from "@/lib/age-preference"
import { localized, useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { formatNumber, formatStat, formatValue, fullStatLabel, longStatLabel } from "@/wiki/format"
import { ScorePill } from "@/wiki/score-pill"
import { useScoreKeys } from "@/wiki/score-settings"
import { StatIcon } from "@/wiki/stat-icon"
import { StatIconsContext } from "@/wiki/stat-icons-context"
import { removeCompare, type CompareKind } from "./selection"

const route = getRouteApi("/compare")

// Colors of the score breakdown bar, one per stat group
const GROUP_COLORS: Record<StatGroup, string> = {
  fp: "#7F77DD",
  goods: "#1D9E75",
  attacking_army: "#D85A30",
  defending_army: "#378ADD",
  quantum_incursions: "#BA7517",
  other: "#888780",
}

export function CompareView() {
  const { t } = useI18n()
  const { index, buildings, greatBuildings } = route.useLoaderData()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const kind: CompareKind = search.kind ?? "building"

  // Removing a column updates the URL (shareable) and the saved selection
  const remove = (id: string) => {
    removeCompare(kind, id)
    const ids = (search.ids ?? "").split(",").filter((i) => i && i !== id)
    navigate({ search: (s) => ({ ...s, ids: ids.join(",") || undefined }) })
  }

  const empty = kind === "great_building" ? !greatBuildings.length : !buildings.length
  return (
    <StatIconsContext value={index.icons ?? {}}>
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">{t.compare.title}</h1>
        {empty ? (
          <p className="py-10 text-center text-muted-foreground">{t.compare.empty}</p>
        ) : kind === "great_building" ? (
          <GreatBuildingsCompare items={greatBuildings} onRemove={remove} />
        ) : (
          <BuildingsCompare items={buildings} onRemove={remove} />
        )}
      </div>
    </StatIconsContext>
  )
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n()
  return (
    <Button variant="ghost" size="icon-xs" aria-label={t.compare.remove} onClick={onClick}>
      <X />
    </Button>
  )
}

function BuildingsCompare({
  items,
  onRemove,
}: {
  items: BuildingPage[]
  onRemove: (id: string) => void
}) {
  const { t, locale } = useI18n()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const [scoreKeys] = useScoreKeys()
  const [perTile, setPerTile] = useState(false)

  const ages = AGES.filter((age) => items.some((b) => b.ages[age.id]))
  const preferred = search.age ?? getPreferredAge() ?? LATEST_AGE
  const age: AgeId = ages.some((a) => a.id === preferred)
    ? preferred
    : (ages.at(-1)?.id ?? LATEST_AGE)

  const columns = items.map((building) => {
    const data = building.ages[age]
    const stats = data ? aggregateStats(data) : undefined
    const tiles = tileCount(building.size, building.road)
    const total = stats ? score(stats, tiles, scoreKeys) : 0
    // What each stat group brings to the score
    const parts = STAT_GROUPS.map((group) => ({
      group,
      value: stats
        ? score(
            stats,
            tiles,
            scoreKeys.filter((key) => STATS[key].group === group),
          )
        : 0,
    }))
    return { building, stats, tiles, total, parts }
  })
  const keys = STAT_KEYS.filter((key) => columns.some((c) => c.stats?.[key]))
  const ageItems = ages.map((a) => ({ value: a.id, label: localized(a.name, locale) }))

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Select
          items={ageItems}
          value={age}
          onValueChange={(value) => {
            if (!value) return
            setPreferredAge(value as AgeId)
            navigate({ search: (s) => ({ ...s, age: value as AgeId }), replace: true })
          }}
        >
          <SelectTrigger className="min-w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} className="w-auto min-w-(--anchor-width)">
            {ageItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setPerTile((v) => !v)}>
          {perTile ? t.compare.showTotal : t.compare.showPerTile}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-48" />
            {columns.map((c) => (
              <col key={c.building.id} className="w-56" />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="border-b p-3" />
              {columns.map(({ building, tiles, total, parts, stats }) => (
                <th key={building.id} className="border-b p-3 align-top font-normal">
                  <div className="flex justify-end">
                    <RemoveButton onClick={() => onRemove(building.id)} />
                  </div>
                  <Link
                    to="/buildings/$id"
                    params={{ id: building.id }}
                    search={{ age }}
                    className="flex flex-col items-center gap-1 text-center hover:text-primary"
                  >
                    <img src={building.image} alt="" className="size-20 object-contain" />
                    <span className="font-medium">{localized(building.name, locale)}</span>
                  </Link>
                  <p className="text-center text-xs text-muted-foreground">
                    {formatNumber(tiles, locale, 1)} {t.wiki.tiles.toLowerCase()}
                  </p>
                  {stats ? (
                    <div className="mt-2 flex flex-col items-center gap-2">
                      {scoreKeys.length > 0 && <ScorePill score={total} />}
                      {total > 0 && (
                        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                          {parts.map(({ group, value }) => (
                            <span
                              key={group}
                              title={`${t.statGroups[group]} : ${formatNumber(value, locale, 2)}`}
                              style={{
                                width: `${(value / total) * 100}%`,
                                backgroundColor: GROUP_COLORS[group],
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-center text-xs text-muted-foreground">
                      {t.compare.unavailable}
                    </p>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => {
              const values = columns.map((c) => {
                const value = c.stats?.[key]
                return value ? (perTile ? value / c.tiles : value) : undefined
              })
              const best = Math.max(...values.map((v) => v ?? -Infinity))
              return (
                <tr key={key} className="border-b last:border-0">
                  <td className="px-3 py-2 text-muted-foreground" title={fullStatLabel(t, key)}>
                    <span className="inline-flex items-center gap-1.5">
                      <StatIcon stat={key} />
                      <span className="truncate">{longStatLabel(t, key)}</span>
                    </span>
                  </td>
                  {values.map((value, i) => (
                    <td
                      key={columns[i].building.id}
                      className={cn(
                        "px-3 py-2 text-center",
                        value !== undefined &&
                          value === best &&
                          values.length > 1 &&
                          "font-semibold text-green-600 dark:text-green-400",
                      )}
                    >
                      {value === undefined ? (
                        <span className="text-muted-foreground">–</span>
                      ) : (
                        <>
                          {formatStat(key, value, locale, perTile ? 2 : 1)}
                          {i > 0 && values[0] && (
                            <span className="block text-xs font-normal text-muted-foreground">
                              {delta(value, values[0])}
                            </span>
                          )}
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {STAT_GROUPS.map((group) => (
          <span key={group} className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm"
              style={{ backgroundColor: GROUP_COLORS[group] }}
            />
            {t.statGroups[group]}
          </span>
        ))}
      </div>
    </>
  )
}

// "+12 %" / "-24 %" against the first column
function delta(value: number, reference: number): string {
  const percent = Math.round((value / reference - 1) * 100)
  return `${percent > 0 ? "+" : ""}${percent} %`
}

// Great Buildings: compared at the same level, one row per bonus name
function GreatBuildingsCompare({
  items,
  onRemove,
}: {
  items: GreatBuilding[]
  onRemove: (id: string) => void
}) {
  const { t, locale } = useI18n()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const level = Math.min(search.level ?? 10, GB_MAX_LEVEL)

  const columns = items.map((gb) => {
    const firstTen = gb.levels.rows.filter((r) => r.level <= 10).map((r) => r.cost ?? 0)
    let total = 0
    for (let l = 1; l <= level; l++) total += levelCost(firstTen, l)
    const row = gb.levels.rows.find((r) => r.level === level)
    return { gb, cost: levelCost(firstTen, level), total, row }
  })
  // Every bonus of every Great Building, by English label
  const bonuses = [
    ...new Map(
      items.flatMap((gb) => gb.levels.columns.map((c) => [c.label.en, c] as const)),
    ).values(),
  ]
  const cell = (gb: GreatBuilding, values: string[] | undefined, label: string) => {
    const index = gb.levels.columns.findIndex((c) => c.label.en === label)
    return index === -1 ? undefined : values?.[index] || undefined
  }

  return (
    <>
      <label className="flex w-fit items-center gap-2 text-sm">
        {t.greatBuilding.level}
        <Input
          type="number"
          min={1}
          max={GB_MAX_LEVEL}
          value={level}
          onChange={(event) => {
            const value = Number(event.target.value)
            if (value >= 1 && value <= GB_MAX_LEVEL) {
              navigate({ search: (s) => ({ ...s, level: value }), replace: true })
            }
          }}
          className="w-24"
        />
      </label>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-48" />
            {columns.map((c) => (
              <col key={c.gb.id} className="w-56" />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="border-b p-3" />
              {columns.map(({ gb }) => {
                const age = AGES.find((a) => a.id === gb.age)
                return (
                  <th key={gb.id} className="border-b p-3 align-top font-normal">
                    <div className="flex justify-end">
                      <RemoveButton onClick={() => onRemove(gb.id)} />
                    </div>
                    <Link
                      to="/great-buildings/$id"
                      params={{ id: gb.id }}
                      search={{ level }}
                      className="flex flex-col items-center gap-1 text-center hover:text-primary"
                    >
                      <img src={gb.image} alt="" className="size-20 object-contain" />
                      <span className="font-medium">{localized(gb.name, locale)}</span>
                    </Link>
                    <p className="text-center text-xs text-muted-foreground">
                      {age ? localized(age.name, locale) : t.greatBuilding.allAges}
                    </p>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            <CostRow label={t.greatBuilding.cost} values={columns.map((c) => c.cost)} />
            <CostRow label={t.greatBuilding.totalCost} values={columns.map((c) => c.total)} />
            {bonuses.map((bonus) => (
              <tr key={bonus.label.en} className="border-b last:border-0">
                <td className="px-3 py-2 text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    {bonus.icon && (
                      <img src={bonus.icon} alt="" className="size-4 object-contain" />
                    )}
                    <span className="truncate">{localized(bonus.label, locale)}</span>
                  </span>
                </td>
                {columns.map(({ gb, row }) => (
                  <td key={gb.id} className="px-3 py-2 text-center">
                    {formatValue(cell(gb, row?.values, bonus.label.en), locale)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )

  function CostRow({ label, values }: { label: string; values: number[] }) {
    const best = Math.min(...values)
    return (
      <tr className="border-b">
        <td className="px-3 py-2 text-muted-foreground">{label}</td>
        {values.map((value, i) => (
          <td
            key={columns[i].gb.id}
            className={cn(
              "px-3 py-2 text-center",
              value === best &&
                values.length > 1 &&
                "font-semibold text-green-600 dark:text-green-400",
            )}
          >
            {formatNumber(value, locale)}
          </td>
        ))}
      </tr>
    )
  }
}
