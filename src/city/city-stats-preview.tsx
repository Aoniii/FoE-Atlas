import type { CityRow } from "@/core/city"
import type { StatBlock } from "@/core/building"
import type { StatKey } from "@/core/stats"
import { localized, useI18n } from "@/lib/i18n"
import { formatNumber, formatStat } from "@/wiki/format"
import { StatIcon } from "@/wiki/stat-icon"

// What a building makes: Forge Points, goods of the previous age, its own and the next one,
// guild goods, units
const OUTPUTS: StatKey[] = ["fp", "goods_prev", "goods", "goods_next", "guild_goods", "units"]
const CONTEXTS = ["classic", "gbg", "ge", "qi"] as const
// Attacking army attack and defense, then the defending army's
const ARMY_ROWS = [
  ["atk", "att"],
  ["atk", "def"],
  ["def", "att"],
  ["def", "def"],
] as const

const armyKey = (army: string, stat: string, context: string) =>
  `${army}_army_${stat}_${context}` as StatKey

// Outputs, then attack and defense by army and place: only what is there
export function CityStats({ stats, wide }: { stats: StatBlock; wide?: boolean }) {
  const { t, locale } = useI18n()
  const outputs = OUTPUTS.filter((key) => stats[key])
  const contexts = CONTEXTS.filter((context) =>
    ARMY_ROWS.some(([army, stat]) => stats[armyKey(army, stat, context)]),
  )
  const armyRows = ARMY_ROWS.filter(([army, stat]) =>
    contexts.some((context) => stats[armyKey(army, stat, context)]),
  )
  if (!outputs.length && !armyRows.length)
    return <span className="text-muted-foreground">{t.city.preview.nothing}</span>
  return (
    <div className={wide ? "flex flex-wrap items-start gap-x-8 gap-y-3" : "flex flex-col gap-2"}>
      {outputs.length > 0 && (
        <dl
          className={
            wide
              ? "grid grid-cols-3 gap-x-6 gap-y-2 sm:grid-cols-6"
              : "grid grid-cols-3 gap-x-3 gap-y-1"
          }
        >
          {outputs.map((key) => (
            <div key={key} className="flex flex-col">
              <dt className="flex items-center gap-1 text-muted-foreground">
                <StatIcon stat={key} className="size-3.5" />
                {t.stats[key]}
              </dt>
              <dd className={wide ? "text-base font-semibold" : "font-medium"}>
                {formatStat(key, stats[key] ?? 0, locale)}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {armyRows.length > 0 && (
        <table className="border-collapse">
          <thead className="text-muted-foreground">
            <tr>
              <th />
              {contexts.map((context) => (
                <th key={context} className="px-1.5 text-right font-normal">
                  {t.city.preview.contexts[context]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {armyRows.map(([army, stat]) => (
              <tr key={`${army}${stat}`}>
                <th className="pr-2 text-left font-normal whitespace-nowrap text-muted-foreground">
                  {t.city.preview.armies[`${army}_${stat}`]}
                </th>
                {contexts.map((context) => {
                  const value = stats[armyKey(army, stat, context)]
                  return (
                    <td key={context} className="px-1.5 text-right font-medium">
                      {value ? `${formatNumber(value, locale)} %` : "–"}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// A building's stats at a glance, by the cursor on the city map (one building, its chain
// links and set bonus counted)
export function CityStatsPreview({ row, name }: { row?: CityRow; name: string }) {
  const { t, locale } = useI18n()
  return (
    <div className="flex w-max max-w-80 flex-col gap-2 rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-lg">
      <div className="flex items-center gap-2">
        {row?.image && <img src={row.image} alt="" className="size-8 shrink-0 object-contain" />}
        <div className="flex flex-col">
          <span className="text-sm font-medium">{row ? localized(row.name, locale) : name}</span>
          <span className="text-muted-foreground">
            {!row
              ? t.city.mapUnrated
              : row.kind === "great_building"
                ? `${t.city.gbTag} ${t.city.gbLevel} ${row.level}`
                : `${t.wiki.score} ${formatNumber(row.score, locale, 2)} · ×${row.count}`}
          </span>
        </div>
      </div>
      {row && <CityStats stats={row.stats} />}
    </div>
  )
}

// The whole city's stats: every building and Great Building, each line times its count
export function CityTotals({ rows }: { rows: CityRow[] }) {
  const { t } = useI18n()
  const total: StatBlock = {}
  for (const row of rows) {
    for (const [key, value] of Object.entries(row.stats) as [StatKey, number][]) {
      total[key] = (total[key] ?? 0) + value * row.count
    }
  }
  return (
    <section className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
      <h2 className="font-medium">{t.city.preview.total}</h2>
      <p className="text-xs text-muted-foreground">{t.city.preview.totalNote}</p>
      <CityStats stats={total} wide />
    </section>
  )
}
