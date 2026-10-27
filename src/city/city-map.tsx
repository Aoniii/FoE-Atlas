import { useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Search, X } from "lucide-react"
import { rowKey, type City, type CityRow, type MapBuilding, type MapRect } from "@/core/city"
import { normalize } from "@/core/search"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { localized, useI18n } from "@/lib/i18n"
import { formatNumber, scoreColor } from "@/wiki/format"
import { CityStatsPreview } from "./city-stats-preview"

const fill = (text: string, values: Record<string, number | string>) =>
  Object.entries(values).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), text)

// Colors of the buildings without a score, of the free land and of the roads
const GREAT_BUILDING = "#ffffff"
const UNRATED = "#8a8a8a"
const LAND = "#000000"
const ROAD = "#b0743a"
const ROAD2 = "#7a4a1f"

// The game's view: x goes down to the right, y down to the left, a tile twice as wide as high
const ISOMETRIC = "matrix(1 0.5 -1 0.5 0 0)"

const fillOf = (row?: CityRow) =>
  !row ? UNRATED : row.kind === "great_building" ? GREAT_BUILDING : scoreColor(row.score).background

// The city as the game shows it, one flat tile per square: each building in the color of its
// score (a chain link in its start's), Great Buildings white, the others grey, free land black
// and roads brown. Hovering a building lights up every building of its line in the table; a
// click opens its page. The buildings found by the search, or of the line picked in the table
// (`selected`), blink, the others fade.
export function CityMap({
  city,
  buildings,
  selected,
  onClearSelected,
  freeRect,
}: {
  city: City
  buildings: MapBuilding[]
  selected?: CityRow
  onClearSelected: () => void
  // Free land kept for a new building (rebuilt city), outlined
  freeRect?: MapRect
}) {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [hovered, setHovered] = useState<MapBuilding>()
  // Cursor over the map (px in its frame) and the frame's size, to keep the preview inside
  const [pointer, setPointer] = useState<{ x: number; y: number; w: number; h: number }>()
  const [query, setQuery] = useState("")

  // Buildings to show: the search (French or English name, every word) and the picked line
  const found = useMemo(() => {
    const words = normalize(query).split(" ").filter(Boolean)
    const matches = (building: MapBuilding) => {
      const names = building.row ? `${building.row.name.fr} ${building.row.name.en}` : building.name
      const text = normalize(names)
      return words.every((word) => text.includes(word))
    }
    const picked = selected && rowKey(selected)
    return new Set(
      buildings.filter(
        (b) => (b.row && rowKey(b.row) === picked) || (words.length > 0 && matches(b)),
      ),
    )
  }, [buildings, query, selected])
  const searching = found.size > 0 || query.trim() !== ""

  // The unlocked expansions, else every building (cities imported before the map)
  const bounds = useMemo(() => {
    const rects = city.areas?.length ? city.areas : buildings
    const xs = rects.flatMap((r) => [r.x, r.x + r.w])
    const ys = rects.flatMap((r) => [r.y, r.y + r.h])
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs), h: Math.max(...ys) }
  }, [city.areas, buildings])
  if (!buildings.length) return null
  // Corners of the map once turned: left (x, h), right (w, y), top (x, y), bottom (w, h)
  const viewBox = [
    bounds.x - bounds.h,
    (bounds.x + bounds.y) / 2,
    bounds.w - bounds.y - (bounds.x - bounds.h),
    (bounds.w + bounds.h - bounds.x - bounds.y) / 2,
  ].join(" ")
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
    <div id="city-map" className="flex scroll-mt-20 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.city.mapSearch}
            className="pl-8"
          />
        </div>
        {selected && (
          <Button variant="outline" size="sm" onClick={onClearSelected}>
            <X />
            {localized(selected.name, locale)}
          </Button>
        )}
        {searching && (
          <span className="text-sm text-muted-foreground">
            {t.city.mapFound.replace("{count}", String(found.size))}
          </span>
        )}
      </div>
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
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: ROAD }} />
          {t.city.mapRoads}
        </span>
        {freeRect && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm border border-dashed border-white" />
            {fill(t.city.mapFreeRect, { w: freeRect.w, h: freeRect.h })}
          </span>
        )}
      </div>
      {!city.streets && (
        <p className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm">
          {t.city.mapUpdate}
        </p>
      )}
      <div
        className="relative overflow-hidden rounded-lg border bg-zinc-500 p-2"
        onMouseMove={(event) => {
          const frame = event.currentTarget.getBoundingClientRect()
          setPointer({
            x: event.clientX - frame.left,
            y: event.clientY - frame.top,
            w: frame.width,
            h: frame.height,
          })
        }}
        onMouseLeave={() => setPointer(undefined)}
      >
        <svg
          viewBox={viewBox}
          className="mx-auto block h-auto max-h-[70vh] w-full"
          shapeRendering="crispEdges"
          role="img"
          aria-label={t.city.mapTitle}
          onMouseLeave={() => setHovered(undefined)}
        >
          <g transform={ISOMETRIC}>
            {city.areas?.map((area, i) => (
              <rect
                key={`a${i}`}
                x={area.x}
                y={area.y}
                width={area.w}
                height={area.h}
                fill={LAND}
              />
            ))}
            {city.streets?.map((street, i) => (
              <rect
                key={`s${i}`}
                x={street.x}
                y={street.y}
                width={street.w}
                height={street.h}
                fill={street.level === 2 ? ROAD2 : ROAD}
              />
            ))}
            {/* Found buildings last: their outline above their neighbours */}
            {[...buildings]
              .sort((a, b) => Number(found.has(a)) - Number(found.has(b)))
              .map((building) => {
                const isFound = found.has(building)
                const lit = (row && building.row === row) || isFound
                const faded = row ? building.row !== row : searching && !isFound
                return (
                  <rect
                    key={`b${building.x},${building.y}`}
                    x={building.x}
                    y={building.y}
                    width={building.w}
                    height={building.h}
                    fill={fillOf(building.row)}
                    fillOpacity={faded ? 0.3 : 1}
                    stroke={lit ? "#ffffff" : "#000000"}
                    strokeWidth={lit ? 2.5 : 1}
                    vectorEffect="non-scaling-stroke"
                    style={{ cursor: building.row && !building.row.local ? "pointer" : undefined }}
                    onMouseEnter={() => setHovered(building)}
                    onMouseLeave={() => setHovered(undefined)}
                    onClick={() => open(building)}
                  >
                    {isFound && (
                      <animate
                        attributeName="stroke-opacity"
                        values="1;0.15;1"
                        dur="1.2s"
                        repeatCount="indefinite"
                      />
                    )}
                  </rect>
                )
              })}
            {freeRect && (
              <rect
                x={freeRect.x}
                y={freeRect.y}
                width={freeRect.w}
                height={freeRect.h}
                fill="#ffffff"
                fillOpacity={0.12}
                stroke="#ffffff"
                strokeWidth={2}
                strokeDasharray="6 4"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            )}
          </g>
        </svg>
        {/* The hovered building's stats by the cursor, on the side with room */}
        {hovered && pointer && (
          <div
            className="pointer-events-none absolute z-10"
            style={{
              left: pointer.x,
              top: pointer.y,
              transform: `translate(${pointer.x > pointer.w / 2 ? "calc(-100% - 12px)" : "12px"}, ${
                pointer.y > pointer.h / 2 ? "calc(-100% - 12px)" : "12px"
              })`,
            }}
          >
            <CityStatsPreview row={hovered.row} name={hovered.name} />
          </div>
        )}
      </div>
    </div>
  )
}
