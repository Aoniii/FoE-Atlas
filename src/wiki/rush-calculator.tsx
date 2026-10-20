import { useMemo, useState } from "react"
import type { GreatBuilding } from "@/core/great-building"
import { rushPlan, type RewardTables } from "@/core/rush"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { useI18n } from "@/lib/i18n"
import { usePersistentState } from "@/lib/use-persistent-state"
import { cn } from "@/lib/utils"
import { formatNumber } from "./format"

type Place = { open: boolean; arc: number }

// The player's arc bonus rarely changes: remembered for every Great Building
const DEFAULT_PLACES: Place[] = Array.from({ length: 5 }, () => ({ open: true, arc: 90 }))

// Rush calculator: levels from..to, the five places given away at their arc bonus
export function RushCalculator({ gb, tables }: { gb: GreatBuilding; tables: RewardTables }) {
  const { t, locale } = useI18n()
  const [places, setPlaces] = usePersistentState("rush.places", DEFAULT_PLACES)
  const [from, setFrom] = useState(0)
  const [to, setTo] = useState(10)

  const firstTenCosts = useMemo(
    () => gb.levels.rows.filter((row) => row.level <= 10).map((row) => row.cost ?? 0),
    [gb],
  )
  const plan = useMemo(
    () =>
      rushPlan({
        firstTenCosts,
        tables,
        age: gb.age,
        from,
        to,
        arcs: places.map((place) => (place.open ? place.arc : null)),
      }),
    [firstTenCosts, tables, gb.age, from, to, places],
  )
  const setPlace = (index: number, change: Partial<Place>) =>
    setPlaces((list) => list.map((place, i) => (i === index ? { ...place, ...change } : place)))
  const level = (value: string, fallback: number) => {
    const number = Math.trunc(Number(value))
    return Number.isFinite(number) ? Math.min(Math.max(number, 0), plan.maxLevel) : fallback
  }
  const fp = (value: number) => formatNumber(value, locale)

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div>
        <h2 className="font-medium">{t.rush.title}</h2>
        <p className="text-sm text-muted-foreground">{t.rush.intro}</p>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t.rush.from}
          <Input
            type="number"
            min={0}
            max={plan.maxLevel}
            value={from}
            onChange={(event) => setFrom(level(event.target.value, from))}
            className="w-28"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t.rush.to}
          <Input
            type="number"
            min={1}
            max={plan.maxLevel}
            value={to}
            onChange={(event) => setTo(level(event.target.value, to))}
            className="w-28"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {places.map((place, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-md bg-muted/40 p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={place.open}
                onCheckedChange={(checked) => setPlace(index, { open: checked })}
              />
              {t.rush.place.replace("{n}", String(index + 1))}
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t.rush.arc}
              <Input
                type="number"
                min={0}
                step={0.1}
                value={place.arc}
                disabled={!place.open}
                onChange={(event) => setPlace(index, { arc: Number(event.target.value) || 0 })}
              />
            </label>
          </div>
        ))}
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Total label={t.rush.levelsCost} value={fp(plan.cost)} />
        <Total label={t.rush.patrons} value={fp(plan.patrons)} />
        <Total label={t.rush.own} value={fp(plan.own)} highlight />
      </dl>

      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        {plan.levels.some((l) => l.estimated) && <p>{t.rush.estimated}</p>}
        <p>{t.rush.maxLevel.replace("{level}", String(plan.maxLevel))}</p>
        <p>{t.rush.source}</p>
      </div>

      {plan.levels.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium">{t.rush.detail}</summary>
          <div className="mt-2 max-h-96 overflow-auto rounded-md border">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="bg-muted/40 text-muted-foreground">
                  <Th>{t.rush.level}</Th>
                  <Th>{t.rush.cost}</Th>
                  {places.map((_, i) => (
                    <Th key={i}>{t.rush.place.replace("{n}", String(i + 1))}</Th>
                  ))}
                  <Th>{t.rush.own}</Th>
                </tr>
              </thead>
              <tbody>
                {plan.levels.map((l) => (
                  <tr key={l.level} className="border-b last:border-0">
                    <Td>
                      {l.estimated && <span title={t.rush.estimated}>≈ </span>}
                      {l.level}
                    </Td>
                    <Td>{fp(l.cost)}</Td>
                    {l.places.map((value, i) => (
                      <Td key={i} muted={!value}>
                        {value ? fp(value) : "–"}
                      </Td>
                    ))}
                    <Td>
                      <span className="font-medium">{fp(l.own)}</span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  )
}

function Total({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-md bg-muted/40 p-3", highlight && "ring-1 ring-primary")}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-lg font-semibold", highlight && "text-primary")}>{value}</dd>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="border-b px-3 py-2 text-right font-medium whitespace-nowrap">{children}</th>
}

function Td({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <td
      className={cn("px-3 py-1.5 text-right whitespace-nowrap", muted && "text-muted-foreground")}
    >
      {children}
    </td>
  )
}
