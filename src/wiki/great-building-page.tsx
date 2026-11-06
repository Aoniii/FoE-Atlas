import { Link, getRouteApi } from "@tanstack/react-router"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { AGES } from "@/core/ages"
import { roadShare, tileCount } from "@/core/efficiency"
import {
  bonusDescription,
  bonusLabel,
  COPPER_MAX_LEVEL,
  goldEffects,
  GOLD_FIRST_LEVEL,
  inWikiOrder,
  prestigeCostAt,
  prestigeValueAt,
  type Prestige,
  type PrestigeTier,
  type PrestigeValue,
} from "@/core/gb-prestige"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { localized, useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { CompareButton } from "@/compare/compare-button"
import { formatNumber } from "./format"
import { RushCalculator } from "./rush-calculator"

const route = getRouteApi("/great-buildings/$id")

const backClass =
  "inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"

// One page for every Great Building: /great-buildings/<id>?level=<n>
export function GreatBuildingPage() {
  const { t, locale } = useI18n()
  const { greatBuilding: gb } = route.useLoaderData()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const prestige = gb.prestige
  const maxLevel = prestige?.maxLevel ?? COPPER_MAX_LEVEL
  const level = Math.min(Math.max(search.level ?? 1, 1), maxLevel)
  const age = AGES.find((a) => a.id === gb.age)
  const name = localized(gb.name, locale)
  const otherName = locale === "en" ? gb.name.fr : gb.name.en
  const share = roadShare(gb.size, gb.road)
  const tier: PrestigeTier | undefined =
    prestige && (prestige.maxLevel > COPPER_MAX_LEVEL ? "gold" : "copper")
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
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{t.types.great_building}</Badge>
            <Badge variant="secondary">
              {age ? localized(age.name, locale) : t.greatBuilding.allAges}
            </Badge>
            <Badge variant="outline">
              {gb.size.w}x{gb.size.h} · {t.road[gb.road]}
              {share > 0 && ` (+${formatNumber(share, locale, 1)})`} ={" "}
              {formatNumber(tileCount(gb.size, gb.road), locale, 1)} {t.wiki.tiles.toLowerCase()}
            </Badge>
            {tier && <TierChip tier={tier} title={t.greatBuilding.tierTitle[tier]} />}
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

      <Effects boosts={gb.boosts} prestige={prestige} />

      {prestige ? (
        <>
          {/* Level picker: slider or number, mirrored in the URL (?level=) */}
          <section className="flex flex-col gap-4 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-4">
              <h2 className="font-medium">
                {t.greatBuilding.atLevel.replace("{level}", String(level))}
              </h2>
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
              {t.greatBuilding.available.replace("{level}", String(maxLevel))}
            </p>
            <LevelStats
              prestige={prestige}
              level={level}
              wikiIcons={gb.boosts.map((boost) => boost.icon ?? "")}
            />
          </section>
          <RushCalculator prestige={prestige} name={name} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t.greatBuilding.noData}</p>
      )}
    </div>
  )
}

// What the building does: its copper bonuses as the wiki explains them, then its Gold
// effects as the announcement does
function Effects({
  boosts,
  prestige,
}: {
  boosts: { icon?: string; name: { fr: string; en: string }; text: { fr: string; en: string } }[]
  prestige?: Prestige
}) {
  const { t, locale } = useI18n()
  const gold = prestige ? goldEffects(prestige) : []
  if (!boosts.length && !gold.length) return null
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-medium">{t.greatBuilding.boosts}</h2>
      <ul className="flex flex-col gap-2">
        {boosts.map((boost) => (
          <li key={boost.name.en} className="flex items-start gap-2 text-sm">
            {boost.icon && <img src={boost.icon} alt="" className="size-6 object-contain" />}
            <div>
              <p className="flex flex-wrap items-center gap-1.5 font-medium">
                {prestige && <TierChip tier="copper" />}
                {localized(boost.name, locale)}
              </p>
              <p className="text-muted-foreground">{localized(boost.text, locale)}</p>
            </div>
          </li>
        ))}
        {gold.map((column) => (
          <li key={`${column.bonus}/${column.context}`} className="flex items-start gap-2 text-sm">
            <BonusIcon icon={column.icon} className="size-6" />
            <div>
              <p className="flex flex-wrap items-center gap-1.5 font-medium">
                <TierChip tier="gold" />
                {bonusLabel(column, locale)}
              </p>
              <p className="text-muted-foreground">{bonusDescription(column, locale)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

const TIER_STYLES: Record<PrestigeTier, string> = {
  copper: "bg-orange-700/80 text-white",
  gold: "bg-yellow-400 text-yellow-950",
}

// Copper / Gold tier of a bonus or a building
export function TierChip({ tier, title }: { tier: PrestigeTier; title?: string }) {
  const { t } = useI18n()
  return (
    <span
      title={title}
      className={cn("rounded px-1 text-[0.65rem] font-medium", TIER_STYLES[tier])}
    >
      {t.greatBuilding.tiers[tier]}
    </span>
  )
}

// Costs and every bonus at a level, copper ones in the order of the bonus list above; Gold
// bonuses wait for level 101
function LevelStats({
  prestige,
  level,
  wikiIcons,
}: {
  prestige: Prestige
  level: number
  wikiIcons: string[]
}) {
  const { t, locale } = useI18n()
  const cost = prestigeCostAt(prestige, level)
  let total: number | undefined = 0
  for (let l = 1; l <= level && total !== undefined; l++) {
    const c = prestigeCostAt(prestige, l)
    total = c === undefined ? undefined : total + c
  }
  const fp = (value: number | undefined) =>
    value === undefined ? "–" : formatNumber(value, locale)
  const format = (value: PrestigeValue | null, percent: boolean) => {
    if (!value) return "–"
    const text = `${formatNumber(value.value, locale, 2)}${percent ? " %" : ""}`
    return value.count === undefined ? text : `${formatNumber(value.count, locale)} × ${text}`
  }
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <Stat label={t.greatBuilding.cost} value={fp(cost)} />
      <Stat label={t.greatBuilding.totalCost} value={fp(total)} />
      {inWikiOrder(prestige.columns, wikiIcons).map((column, index) => {
        const value = prestigeValueAt(column, level)
        return (
          <Stat
            key={index}
            label={bonusLabel(column, locale)}
            icon={column.icon}
            tier={column.tier}
            value={format(value, column.percent)}
            hint={
              value
                ? undefined
                : t.greatBuilding.unlock.replace("{level}", String(GOLD_FIRST_LEVEL))
            }
          />
        )
      })}
    </dl>
  )
}

// Bonus icon cut from the game's sheet (public/bonus-icons)
function BonusIcon({ icon, className }: { icon?: string; className?: string }) {
  if (!icon) return null
  return (
    <img
      src={`${import.meta.env.BASE_URL}bonus-icons/${icon}`}
      alt=""
      className={cn("object-contain", className)}
    />
  )
}

function Stat({
  label,
  value,
  icon,
  tier,
  hint,
}: {
  label: string
  value: string
  icon?: string
  tier?: PrestigeTier
  hint?: string
}) {
  return (
    <div className={cn("rounded-md bg-muted/40 p-3", hint && "opacity-60")}>
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {tier && <TierChip tier={tier} />}
        <BonusIcon icon={icon} className="size-4" />
        {label}
      </dt>
      <dd className="text-lg font-semibold">{value}</dd>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
