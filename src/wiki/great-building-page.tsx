import { Link, getRouteApi } from "@tanstack/react-router"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { AGES } from "@/core/ages"
import { roadShare, tileCount } from "@/core/efficiency"
import { GB_MAX_LEVEL } from "@/core/great-building"
import { levelCost } from "@/core/rush"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { localized, useI18n } from "@/lib/i18n"
import { formatNumber } from "./format"
import { RushCalculator } from "./rush-calculator"

const route = getRouteApi("/great-buildings/$id")

// Wiki values are English-formatted text ("1,100", "12.5%"): reformat numbers for the locale
function formatValue(value: string | undefined, locale: string): string {
  if (!value) return "–"
  const match = value.match(/^([\d,]+(?:\.\d+)?)(\s*%)?$/)
  if (!match) return value
  const number = formatNumber(Number(match[1].replace(/,/g, "")), locale, 2)
  return match[2] ? `${number} %` : number
}

// One page for every Great Building: /great-buildings/<id>?level=<n>
export function GreatBuildingPage() {
  const { t, locale } = useI18n()
  const { greatBuilding: gb, rewards } = route.useLoaderData()
  const search = route.useSearch()
  const navigate = route.useNavigate()

  const rows = gb.levels.rows
  // Bonuses come from the wiki (80 levels), costs from the game formula (any level)
  const knownLevel = rows.filter((r) => !r.computed).at(-1)?.level ?? 1
  const maxLevel = GB_MAX_LEVEL
  const level = Math.min(Math.max(search.level ?? 1, 1), maxLevel)
  const row = rows.find((r) => r.level === level)
  const firstTenCosts = rows.filter((r) => r.level <= 10).map((r) => r.cost ?? 0)
  const cost = levelCost(firstTenCosts, level)
  // Forge Points needed from level 0 to the selected level
  let total = 0
  for (let l = 1; l <= level; l++) total += levelCost(firstTenCosts, l)
  const age = AGES.find((a) => a.id === gb.age)
  const name = localized(gb.name, locale)
  const otherName = locale === "en" ? gb.name.fr : gb.name.en
  const share = roadShare(gb.size, gb.road)
  const setLevel = (value: number) =>
    navigate({ search: { level: value }, replace: true, resetScroll: false })

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/wiki"
        search={{ type: "great_building" }}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t.building.back}
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <img src={gb.image} alt="" className="size-48 shrink-0 object-contain" />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{name}</h1>
          {otherName !== name && <p className="text-muted-foreground">{otherName}</p>}
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{t.types.great_building}</Badge>
            <Badge variant="secondary">
              {age ? localized(age.name, locale) : t.greatBuilding.allAges}
            </Badge>
            <Badge variant="outline">
              {gb.size.w}x{gb.size.h} · {t.road[gb.road]}
              {share > 0 && ` (+${formatNumber(share, locale, 1)})`} ={" "}
              {formatNumber(tileCount(gb.size, gb.road), locale, 1)} {t.wiki.tiles.toLowerCase()}
            </Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {localized(gb.description, locale)}
          </p>
          {gb.sourceUrl && (
            <a
              href={gb.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              {t.wiki.source}
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      </header>

      {gb.boosts.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">{t.greatBuilding.boosts}</h2>
          <ul className="flex flex-col gap-2">
            {gb.boosts.map((boost) => (
              <li key={boost.name.en} className="flex items-start gap-2 text-sm">
                {boost.icon && <img src={boost.icon} alt="" className="size-6 object-contain" />}
                <div>
                  <p className="font-medium">{localized(boost.name, locale)}</p>
                  <p className="text-muted-foreground">{localized(boost.text, locale)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Level picker: slider or number, mirrored in the URL (?level=) */}
      <section className="flex flex-col gap-4 rounded-lg border p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col items-start gap-1">
            <h2 className="font-medium">
              {t.greatBuilding.atLevel.replace("{level}", String(level))}
            </h2>
            {row?.computed && <Badge variant="outline">{t.greatBuilding.computed}</Badge>}
          </div>
          <Input
            type="number"
            min={1}
            max={maxLevel}
            value={level}
            onChange={(event) => {
              const value = Number(event.target.value)
              if (value >= 1 && value <= maxLevel) setLevel(value)
            }}
            className="w-24"
            aria-label={t.greatBuilding.level}
          />
          <Slider
            min={1}
            max={maxLevel}
            value={level}
            onValueChange={(value) => setLevel(Array.isArray(value) ? value[0] : value)}
            className="min-w-48 flex-1"
            aria-label={t.greatBuilding.level}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {t.greatBuilding.available.replace("{count}", String(knownLevel))}
        </p>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label={t.greatBuilding.cost} value={formatNumber(cost, locale)} />
          <Stat label={t.greatBuilding.totalCost} value={formatNumber(total, locale)} />
          {gb.levels.columns.map((column, index) => (
            <Stat
              key={index}
              icon={column.icon}
              label={localized(column.label, locale)}
              value={formatValue(row?.values[index], locale)}
            />
          ))}
        </dl>
      </section>
      {rewards && <RushCalculator gb={gb} tables={rewards} />}
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon && <img src={icon} alt="" className="size-4 object-contain" />}
        {label}
      </dt>
      <dd className="text-lg font-semibold">{value}</dd>
    </div>
  )
}
