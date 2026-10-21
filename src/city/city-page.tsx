import { useEffect, useMemo, useRef, useState } from "react"
import { Link, getRouteApi } from "@tanstack/react-router"
import { ArrowDown, ArrowUp, ClipboardPaste, FileUp, Trash2 } from "lucide-react"
import { AGES, LATEST_AGE, type AgeId } from "@/core/ages"
import type { AgeBuilding } from "@/core/building"
import { entityAge, parseFoeHelperExport, rateCity, worldLabel, type City } from "@/core/city"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { localized, useI18n } from "@/lib/i18n"
import { usePersistentState } from "@/lib/use-persistent-state"
import { fetchAgeBuildings } from "@/wiki/data"
import { formatNumber } from "@/wiki/format"
import { ScorePill } from "@/wiki/score-pill"
import { useScoreKeys } from "@/wiki/score-settings"

const route = getRouteApi("/city")

const cityKey = (city: City) => `${city.world}/${city.playerId}`

// Cities read from FoE Helper exports, kept in this browser only (one per server and player)
export function CityPage() {
  const { t, locale } = useI18n()
  const [cities, setCities] = usePersistentState<Record<string, City>>("city.cities", {})
  const [selected, setSelected] = usePersistentState("city.selected", "")
  const list = Object.values(cities).sort((a, b) =>
    (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
  )
  const city = cities[selected] ?? list[0]

  const add = (imported: City) => {
    setCities((current) => ({ ...current, [cityKey(imported)]: imported }))
    setSelected(cityKey(imported))
  }
  const remove = (key: string) =>
    setCities((current) => Object.fromEntries(Object.entries(current).filter(([k]) => k !== key)))
  const items = list.map((c) => ({
    value: cityKey(c),
    label: `${c.playerName ?? `${t.city.player} ${c.playerId || "?"}`} · ${worldLabel(c.world)}`,
  }))

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t.city.title}</h1>
      <ImportCity onImport={add} />
      {city && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Select items={items} value={cityKey(city)} onValueChange={(v) => v && setSelected(v)}>
              <SelectTrigger className="min-w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} className="w-auto min-w-(--anchor-width)">
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {city.updatedAt && (
              <span className="text-xs text-muted-foreground">
                {t.city.updated}{" "}
                {new Date(city.updatedAt).toLocaleString(locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={() => remove(cityKey(city))}>
              <Trash2 />
              {t.city.remove}
            </Button>
          </div>
          <CityRating city={city} />
        </>
      )}
    </div>
  )
}

// FoE Helper: City map > Download (a .json file) or Copy (the same JSON, to paste here)
function ImportCity({ onImport }: { onImport: (city: City) => void }) {
  const { t } = useI18n()
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string>()

  const read = (text: string, fileName?: string) => {
    try {
      onImport(parseFoeHelperExport(JSON.parse(text), fileName))
      setError(undefined)
    } catch {
      setError(t.city.invalid)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-5">
      <h2 className="font-semibold">{t.city.importTitle}</h2>
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-muted-foreground">
        <li>{t.city.step1}</li>
        <li>{t.city.step2}</li>
        <li>{t.city.step3}</li>
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => input.current?.click()}>
          <FileUp />
          {t.city.chooseFile}
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              read(await navigator.clipboard.readText())
            } catch {
              setError(t.city.clipboard)
            }
          }}
        >
          <ClipboardPaste />
          {t.city.paste}
        </Button>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0]
            if (file) read(await file.text(), file.name)
            event.target.value = ""
          }}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">{t.city.privacy}</p>
    </section>
  )
}

// Buildings of the city at the player's age, least profitable first
function CityRating({ city }: { city: City }) {
  const { t, locale } = useI18n()
  const { assets } = route.useLoaderData()
  const [scoreKeys] = useScoreKeys()
  const [buildings, setBuildings] = useState<Partial<Record<AgeId, AgeBuilding[]>>>({})
  const [ascending, setAscending] = useState(true)
  // Every age a building of the city is rated at (each building at its own age)
  const ages = useMemo(
    () => [...new Set(city.entities.map((entity) => entityAge(city, entity, LATEST_AGE)))],
    [city],
  )
  // Ages already asked for: each loads once
  const requested = useRef(new Set<AgeId>())
  const missing = ages.filter((age) => !buildings[age])

  useEffect(() => {
    for (const age of ages) {
      if (requested.current.has(age)) continue
      requested.current.add(age)
      fetchAgeBuildings(age)
        .then((list) => setBuildings((loaded) => ({ ...loaded, [age]: list })))
        // Age without buildings in the wiki: nothing to rate there
        .catch(() => setBuildings((loaded) => ({ ...loaded, [age]: [] })))
    }
  }, [ages])

  const rated = useMemo(
    () => rateCity(city, assets, buildings, LATEST_AGE, scoreKeys),
    [city, assets, buildings, scoreKeys],
  )
  if (missing.length) return <p className="text-muted-foreground">{t.city.loading}</p>
  const rows = [...rated.rows].sort((a, b) => (ascending ? a.score - b.score : b.score - a.score))
  const counted = rated.rows.reduce((sum, row) => sum + row.count, 0)
  const ageName = (age: AgeId) => localized(AGES.find((a) => a.id === age)!.name, locale)

  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {t.city.summary.replace("{count}", formatNumber(counted, locale))} {t.city.scoreSettings}
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="border-b px-3 py-2 text-left font-medium">{t.wiki.building}</th>
              <th className="border-b px-3 py-2 text-left font-medium">{t.wiki.age}</th>
              <th className="border-b px-3 py-2 text-right font-medium">{t.city.count}</th>
              <th className="border-b px-3 py-2 text-right font-medium">{t.wiki.tiles}</th>
              <th className="border-b px-3 py-2 text-left font-medium">
                <button
                  type="button"
                  onClick={() => setAscending((value) => !value)}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  {t.wiki.score}
                  {ascending ? (
                    <ArrowUp className="size-3.5" />
                  ) : (
                    <ArrowDown className="size-3.5" />
                  )}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.building.id}@${row.age}`}
                className="border-b last:border-0 hover:bg-muted/30"
              >
                <td className="px-3 py-2">
                  <Link
                    to="/buildings/$id"
                    params={{ id: row.building.id }}
                    search={{ age: row.age }}
                    className="font-medium underline decoration-dotted underline-offset-4 hover:text-primary"
                  >
                    {localized(row.building.name, locale)}
                  </Link>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                  {ageName(row.age)}
                </td>
                <td className="px-3 py-2 text-right">×{row.count}</td>
                <td className="px-3 py-2 text-right">{formatNumber(row.tiles, locale, 1)}</td>
                <td className="px-3 py-2">
                  <ScorePill score={row.score} className="min-w-14" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rated.unknown.length > 0 && (
        <details className="text-sm text-muted-foreground">
          <summary className="cursor-pointer">
            {t.city.unknown.replace(
              "{count}",
              formatNumber(
                rated.unknown.reduce((sum, item) => sum + item.count, 0),
                locale,
              ),
            )}
          </summary>
          <ul className="mt-2 columns-2 gap-6 sm:columns-3">
            {rated.unknown.map((item) => (
              <li key={item.name}>
                {item.name} {item.count > 1 && `×${item.count}`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
