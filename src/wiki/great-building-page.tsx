import { Link, getRouteApi } from "@tanstack/react-router"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { AGES } from "@/core/ages"
import { roadShare, tileCount } from "@/core/efficiency"
import {
  betaCostAt,
  betaDescription,
  betaGoldEffects,
  betaInLiveOrder,
  betaLabel,
  betaValueAt,
  GOLD_FIRST_LEVEL,
  type BetaGreatBuilding,
  type BetaTier,
  type BetaValue,
} from "@/core/gb-beta"
import { MANUAL_GB_MODELS } from "@/core/gb-models"
import { GB_MAX_LEVEL } from "@/core/great-building"
import { levelCost } from "@/core/rush"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { localized, useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { CompareButton } from "@/compare/compare-button"
import { formatNumber, formatValue } from "./format"
import { RushCalculator } from "./rush-calculator"

const route = getRouteApi("/great-buildings/$id")

const backClass =
  "inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"

// One page for every Great Building: /great-buildings/<id>?level=<n>
export function GreatBuildingPage() {
  const { t, locale } = useI18n()
  const { greatBuilding: gb, rewards } = route.useLoaderData()
  const search = route.useSearch()
  const navigate = route.useNavigate()

  const rows = gb.levels.rows
  // Bonuses come from the wiki (80 levels), costs from the game formula (any level)
  const knownLevel = rows.filter((r) => !r.computed).at(-1)?.level ?? 1
  // The beta caps every Great Building (200 with copper bonuses only)
  const maxLevel = gb.beta?.maxLevel ?? GB_MAX_LEVEL
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
  const betaEffects = gb.beta ? betaGoldEffects(gb.beta) : []
  // Past the wiki, every value is computed, not checked in game
  const approx = (text: string) => (row?.computed && text !== "–" ? `≈ ${text}` : text)
  const setLevel = (value: number) =>
    navigate({ search: { level: value, from: search.from }, replace: true, resetScroll: false })

  return (
    <div className="flex flex-col gap-6">
      {search.from === "city" ? (
        <Link to="/city" className={backClass}>
          <ArrowLeft className="size-4" />
          {t.building.backToCity}
        </Link>
      ) : (
        <Link to="/wiki" search={{ type: "great_building" }} className={backClass}>
          <ArrowLeft className="size-4" />
          {t.building.back}
        </Link>
      )}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <img src={gb.image} alt="" className="size-48 shrink-0 object-contain" />
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{name}</h1>
            <CompareButton
              item={{ kind: "great_building", id: gb.id, name: gb.name, image: gb.image }}
            />
          </div>
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

      {(gb.boosts.length > 0 || betaEffects.length > 0) && (
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
            {/* New Gold effects of the beta, in orange like the beta block */}
            {betaEffects.map((column) => (
              <li
                key={`${column.bonus}/${column.context}`}
                className="flex items-start gap-2 text-sm"
              >
                <BetaIcon icon={column.icon} className="size-6" />
                <div>
                  <p className="flex flex-wrap items-center gap-1.5 font-medium text-orange-600 dark:text-orange-400">
                    <TierChip tier="gold" />
                    {betaLabel(column, locale)}
                  </p>
                  <p className="text-muted-foreground">{betaDescription(column, locale)}</p>
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
            {/* Legend of the ≈ prefix: every level past the wiki and every beta value */}
            <Badge variant="outline">{t.greatBuilding.computed}</Badge>
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
        {gb.readingsUpTo && (
          <p className="text-xs text-muted-foreground">
            {t.greatBuilding.readingsNote.replace("{level}", String(gb.readingsUpTo))}
          </p>
        )}
        {MANUAL_GB_MODELS[gb.id] && (
          <p className="text-xs text-muted-foreground">{t.greatBuilding.manualNote}</p>
        )}
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label={t.greatBuilding.cost} value={approx(formatNumber(cost, locale))} />
          <Stat label={t.greatBuilding.totalCost} value={approx(formatNumber(total, locale))} />
          {pairedColumns(gb.levels.columns).map(({ icon, label, count, value }) => {
            const shown = formatValue(row?.values[value], locale)
            const times = count === undefined ? undefined : formatValue(row?.values[count], locale)
            return (
              <Stat
                key={value}
                icon={icon}
                label={localized(label, locale)}
                value={approx(
                  times && times !== "–" && shown !== "–" ? `${times} × ${shown}` : shown,
                )}
              />
            )
          })}
        </dl>
        {gb.beta && (
          <BetaStats
            beta={gb.beta}
            level={level}
            liveIcons={gb.levels.columns.map((column) => column.icon ?? "")}
          />
        )}
      </section>
      {rewards && <RushCalculator gb={gb} tables={rewards} />}
    </div>
  )
}

type LiveColumn = { icon?: string; label: { fr: string; en: string } }

// Live columns as shown: a count and its percent ("Supply Boost (#)" and "(%)") in one, "40 ×
// 60 %", as the beta shows them
function pairedColumns(columns: LiveColumn[]) {
  const base = (column: LiveColumn, mark: string) =>
    column.label.en.endsWith(` (${mark})`) ? column.label.en.slice(0, -mark.length - 3) : undefined
  const paired = new Set<number>()
  const shown: { icon?: string; label: LiveColumn["label"]; count?: number; value: number }[] = []
  columns.forEach((column, index) => {
    if (paired.has(index)) return
    const name = base(column, "#")
    const percent = name ? columns.findIndex((c) => base(c, "%") === name) : -1
    if (percent < 0) return shown.push({ icon: column.icon, label: column.label, value: index })
    paired.add(percent)
    const strip = (text: string) => text.replace(/\s*\(#\)$/, "")
    shown.push({
      icon: column.icon,
      label: { fr: strip(column.label.fr), en: strip(column.label.en) },
      count: index,
      value: percent,
    })
  })
  return shown
}

const TIER_STYLES: Record<BetaTier, string> = {
  copper: "bg-orange-700/80 text-white",
  gold: "bg-yellow-400 text-yellow-950",
}

// Copper / Gold tier of a beta bonus
function TierChip({ tier }: { tier: BetaTier }) {
  const { t } = useI18n()
  return (
    <span className={cn("rounded px-1 text-[0.65rem] font-medium", TIER_STYLES[tier])}>
      {t.greatBuilding.tiers[tier]}
    </span>
  )
}

// Same level on the beta server (prestige rework), in orange below the live values
function BetaStats({
  beta,
  level,
  liveIcons,
}: {
  beta: BetaGreatBuilding
  level: number
  liveIcons: string[]
}) {
  const { t, locale } = useI18n()
  // Every beta value is computed from the game's milestones
  const cost = betaCostAt(beta, level)
  let total = 0
  for (let l = 1; l <= level; l++) total += betaCostAt(beta, l)
  const fp = (value: number) => `≈ ${formatNumber(value, locale)}`
  const format = (value: BetaValue | null, percent: boolean) => {
    if (!value) return "–"
    const text = `${formatNumber(value.value, locale, 2)}${percent ? " %" : ""}`
    return `≈ ${value.count === undefined ? text : `${formatNumber(value.count, locale)} × ${text}`}`
  }
  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-medium text-orange-600 dark:text-orange-400">{t.greatBuilding.beta}</h3>
        <p className="text-xs text-muted-foreground">
          {t.greatBuilding.betaNote.replace("{level}", String(beta.maxLevel))}
        </p>
        <p className="text-xs font-medium text-orange-600 dark:text-orange-400">
          {t.greatBuilding.betaWarning}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <BetaStat label={t.greatBuilding.cost} value={fp(cost)} />
        <BetaStat label={t.greatBuilding.totalCost} value={fp(total)} />
        {betaInLiveOrder(beta.columns, liveIcons).map((column, index) => {
          const value = betaValueAt(column, level)
          // Locked Gold tier: level where it unlocks
          const unlock = value ? undefined : GOLD_FIRST_LEVEL
          return (
            <BetaStat
              key={index}
              label={betaLabel(column, locale)}
              icon={column.icon}
              tier={column.tier}
              value={format(value, column.percent)}
              hint={
                unlock === undefined
                  ? undefined
                  : t.greatBuilding.betaUnlock.replace("{level}", String(unlock))
              }
            />
          )
        })}
      </dl>
    </div>
  )
}

// Bonus icon cut from the game's sheet (public/beta-icons)
function BetaIcon({ icon, className }: { icon?: string; className?: string }) {
  if (!icon) return null
  return (
    <img
      src={`${import.meta.env.BASE_URL}beta-icons/${icon}`}
      alt=""
      className={cn("object-contain", className)}
    />
  )
}

function BetaStat({
  label,
  value,
  icon,
  tier,
  hint,
}: {
  label: string
  value: string
  icon?: string
  tier?: BetaTier
  hint?: string
}) {
  return (
    <div className="rounded-md border border-orange-500/40 bg-orange-500/10 p-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {tier && <TierChip tier={tier} />}
        <BetaIcon icon={icon} className="size-4" />
        {label}
      </dt>
      <dd className="text-lg font-semibold">{value}</dd>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
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
