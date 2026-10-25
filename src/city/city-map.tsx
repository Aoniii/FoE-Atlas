import { useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import type { City, CityRow, MapBuilding } from "@/core/city"
import { localized, useI18n } from "@/lib/i18n"
import { formatNumber, scoreColor } from "@/wiki/format"

// Colors of the buildings without a score
const GREAT_BUILDING = "#ffffff"
const UNRATED = "#8a8a8a"

const fillOf = (row?: CityRow) =>
  !row ? UNRATED : row.kind === "great_building" ? GREAT_BUILDING : scoreColor(row.score).background

// The city seen from above, one square per tile: each building in the color of its score (a
// chain link in its start's), Great Buildings white, the others grey. Hovering a building
// lights up every building of its line in the table; a click opens its page.
export function CityMap({ city, buildings }: { city: City; buildings: MapBuilding[] }) {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [hovered, setHovered] = useState<MapBuilding>()

  // The unlocked expansions, else every building (cities imported before the map)
  const bounds = useMemo(() => {
    const rects = city.areas?.length ? city.areas : buildings
    const xs = rects.flatMap((r) => [r.x, r.x + r.w])
    const ys = rects.flatMap((r) => [r.y, r.y + r.h])
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs), h: Math.max(...ys) }
  }, [city.areas, buildings])
  if (!buildings.length) return null
  const width = bounds.w - bounds.x
  const height = bounds.h - bounds.y
  const row = hovered?.row

  const open = (building: MapBuilding) => {
    const target = building.row
    if (!target || target.local) return
    if (target.kind === "great_building") {
      navigate({
        to: "/great-buildings/$id",
        params: { id: target.id },
        search: { level: target.level, from: "city" },
      })
    } else {
      navigate({
        to: "/buildings/$id",
        params: { id: target.id },
        search: { age: target.age, from: "city" },
      })
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="min-h-5 text-sm">
        {hovered ? (
          <>
            <span className="font-medium">{row ? localized(row.name, locale) : hovered.name}</span>
            <span className="text-muted-foreground">
              {row?.kind === "great_building"
                ? ` · ${t.city.gbTag} ${t.city.gbLevel} ${row.level}`
                : row
                  ? ` · ${t.wiki.score} ${formatNumber(row.score, locale, 2)} · ×${row.count}`
                  : ` · ${t.city.mapUnrated}`}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">{t.city.mapHint}</span>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          0
          <span
            className="inline-block h-2.5 w-24 rounded-sm"
            style={{
              background: `linear-gradient(to right, ${[0, 2, 4, 6, 8, 10].map((s) => scoreColor(s).background).join(", ")})`,
            }}
          />
          10
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm border border-black/40 bg-white" />
          {t.city.gbTag}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: UNRATED }} />
          {t.city.mapUnrated}
        </span>
        {!city.areas && <span>{t.city.mapUpdate}</span>}
      </div>
      <div className="overflow-hidden rounded-lg border bg-background p-2">
        <svg
          viewBox={`${bounds.x} ${bounds.y} ${width} ${height}`}
          className="mx-auto block h-auto max-h-[70vh] w-full"
          role="img"
          aria-label={t.city.mapTitle}
          onMouseLeave={() => setHovered(undefined)}
        >
          {city.areas?.map((area, i) => (
            <rect
              key={`a${i}`}
              x={area.x}
              y={area.y}
              width={area.w}
              height={area.h}
              className="fill-muted"
            />
          ))}
          {city.streets?.map((street, i) => (
            <rect
              key={`s${i}`}
              x={street.x}
              y={street.y}
              width={street.w}
              height={street.h}
              className="fill-muted-foreground/45"
            />
          ))}
          {buildings.map((building, i) => {
            const lit = row && building.row === row
            return (
              <rect
                key={`b${i}`}
                x={building.x + 0.06}
                y={building.y + 0.06}
                width={building.w - 0.12}
                height={building.h - 0.12}
                rx={0.25}
                fill={fillOf(building.row)}
                fillOpacity={row && !lit ? 0.45 : 1}
                strokeWidth={lit ? 0.18 : 0.06}
                className={lit ? "stroke-foreground" : "stroke-black/40"}
                style={{ cursor: building.row && !building.row.local ? "pointer" : undefined }}
                onMouseEnter={() => setHovered(building)}
                onClick={() => open(building)}
              />
            )
          })}
        </svg>
      </div>
    </div>
  )
}
