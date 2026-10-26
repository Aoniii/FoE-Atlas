import { Link, getRouteApi } from "@tanstack/react-router"
import { ArrowLeft, ExternalLink } from "lucide-react"
import {
  ALLY_MAX_LEVEL,
  ALLY_RARITIES,
  atLevel,
  type AllyAbility,
  type AllyBoost,
  type AllyProduction,
  type AllyRarity,
} from "@/core/ally"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { localized, useI18n, type Locale, type Messages } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { formatNumber } from "./format"

const route = getRouteApi("/allies/$id")

const backClass =
  "inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"

const RARITY_CLASS: Record<AllyRarity, string> = {
  common: "bg-zinc-500/80 text-white",
  uncommon: "bg-green-600/80 text-white",
  rare: "bg-blue-600/80 text-white",
  epic: "bg-purple-600/80 text-white",
  legendary: "bg-amber-500 text-amber-950",
}

const fill = (text: string, values: Record<string, string>) =>
  Object.entries(values).reduce((s, [k, v]) => s.replace(`{${k}}`, v), text)

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

// "Attaque de l'armée offensive – Champs de bataille de guilde"
function boostLabel(t: Messages, boost: AllyBoost) {
  const type = t.ally.boosts[boost.type as keyof Messages["ally"]["boosts"]] ?? boost.type
  if (boost.feature === "all") return type
  const place = t.ally.places[boost.feature as keyof Messages["ally"]["places"]]
  return place ? `${type} – ${place}` : type
}

// "Points Forge", "Unités lourdes de l'âge suivant"
function productionLabel(t: Messages, made: AllyProduction) {
  if (made.kind !== "unit") return t.ally.productions[made.kind]
  const units = t.ally.units[made.unitClass as keyof Messages["ally"]["units"]] ?? made.unitClass
  return capitalize(
    fill(made.nextEra ? t.ally.productions.unitNext : t.ally.productions.unit, {
      units: units ?? "",
    }),
  )
}

// "17 % de chances d'octroyer Frénésie à 200 unités légères en Champs de bataille de guilde"
function abilityText(t: Messages, ability: AllyAbility, level: number, locale: Locale) {
  return fill(t.ally.ability, {
    chance: formatNumber(atLevel(ability.chances, level), locale),
    name: localized(ability.name, locale),
    charges: formatNumber(atLevel(ability.charges, level), locale),
    units: t.ally.units[ability.unitClass as keyof Messages["ally"]["units"]] ?? ability.unitClass,
    place: t.ally.inPlace[ability.feature as keyof Messages["ally"]["inPlace"]] ?? "",
  })
}

export function RarityChip({ rarity, className }: { rarity: AllyRarity; className?: string }) {
  const { t } = useI18n()
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[0.7rem] font-medium",
        RARITY_CLASS[rarity],
        className,
      )}
    >
      {t.ally.rarities[rarity]}
    </span>
  )
}

// One page per ally: /allies/<id>?rarity=<rarity>&level=<n>
export function AllyPage() {
  const { t, locale } = useI18n()
  const { ally } = route.useLoaderData()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const rarity = search.rarity ?? "common"
  const level = Math.min(Math.max(search.level ?? 1, 1), ALLY_MAX_LEVEL)
  const rank = ALLY_RARITIES.indexOf(rarity)
  const name = localized(ally.name, locale)
  const otherName = locale === "en" ? ally.name.fr : ally.name.en
  const cost = atLevel(ally.levelCosts, level)
  const total = ally.levelCosts.slice(0, level).reduce((sum, c) => sum + c, 0)
  const setSearch = (next: { rarity?: AllyRarity; level?: number }) =>
    navigate({
      search: { rarity, level, ...next },
      replace: true,
      resetScroll: false,
    })

  return (
    <div className="flex flex-col gap-6">
      <Link to="/wiki" search={{ type: "ally" }} className={backClass}>
        <ArrowLeft className="size-4" />
        {t.ally.back}
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {ally.image && <img src={ally.image} alt="" className="size-48 shrink-0 object-contain" />}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{name}</h1>
          {otherName !== name && <p className="text-muted-foreground">{otherName}</p>}
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{t.types.ally}</Badge>
            <Badge variant="secondary">{t.ally.types[ally.type]}</Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {localized(ally.description, locale)}
          </p>
          {ally.sourceUrl && (
            <a
              href={ally.sourceUrl}
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

      {/* What each rarity adds */}
      <section className="flex flex-col gap-2">
        <h2 className="font-medium">{t.ally.perRarity}</h2>
        <ul className="flex flex-col gap-3">
          {ally.rarities.map((info) => {
            const empty = !info.boosts.length && !info.production.length && !info.abilities.length
            return (
              <li key={info.rarity} className="flex flex-col gap-1 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <RarityChip rarity={info.rarity} />
                  {info.evolution.valor !== undefined && info.evolution.scrolls !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {fill(t.ally.evolution, {
                        valor: formatNumber(info.evolution.valor, locale),
                        scrolls: formatNumber(info.evolution.scrolls, locale),
                      })}
                      {info.disband !== undefined &&
                        ` · ${fill(t.ally.disband, { valor: formatNumber(info.disband, locale) })}`}
                    </span>
                  )}
                </div>
                <ul className="flex flex-col gap-1 pl-1">
                  {info.boosts.map((boost, k) => (
                    <Line key={`b${k}`} icon={boost.icon}>
                      {boostLabel(t, boost)}
                    </Line>
                  ))}
                  {info.production.map((made, k) => (
                    <Line key={`p${k}`} icon={made.icon}>
                      {fill(t.ally.production, { what: productionLabel(t, made) })}
                    </Line>
                  ))}
                  {info.abilities.map((ability, k) => (
                    <Line key={`a${k}`} icon={ability.icon}>
                      {abilityText(t, ability, 1, locale)}
                    </Line>
                  ))}
                  {empty && <li className="text-muted-foreground">{t.ally.nothing}</li>}
                </ul>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Rarity and level, mirrored in the URL (?rarity=&level=) */}
      <section className="flex flex-col gap-4 rounded-lg border p-4">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="font-medium">
            {fill(t.ally.atLevel, { rarity: t.ally.rarities[rarity], level: String(level) })}
          </h2>
          <div className="flex flex-wrap gap-1" role="group" aria-label={t.ally.rarity}>
            {ALLY_RARITIES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSearch({ rarity: value })}
                aria-pressed={value === rarity}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs transition-colors",
                  value === rarity
                    ? "border-primary bg-primary/10 font-medium"
                    : "hover:bg-muted/50",
                )}
              >
                {t.ally.rarities[value]}
              </button>
            ))}
          </div>
          <Input
            type="number"
            min={1}
            max={ALLY_MAX_LEVEL}
            value={level}
            onChange={(event) => {
              const value = Number(event.target.value)
              if (value >= 1 && value <= ALLY_MAX_LEVEL) setSearch({ level: value })
            }}
            className="w-24"
            aria-label={t.ally.level}
          />
          <Slider
            min={1}
            max={ALLY_MAX_LEVEL}
            value={level}
            onValueChange={(value) => setSearch({ level: Array.isArray(value) ? value[0] : value })}
            className="min-w-48 flex-1"
            aria-label={t.ally.level}
          />
        </div>
        <p className="text-xs text-muted-foreground">{t.ally.note}</p>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label={t.ally.levelCost} value={formatNumber(cost, locale)} />
          <Stat label={t.ally.totalCost} value={formatNumber(total, locale)} />
          {ally.rarities.flatMap((info) => {
            // Rarities above the chosen one: what they would add, dimmed
            const locked = ALLY_RARITIES.indexOf(info.rarity) > rank
            const hint = locked
              ? fill(t.ally.unlockedAt, { rarity: t.ally.rarities[info.rarity] })
              : undefined
            return [
              ...info.boosts.map((boost, k) => (
                <Stat
                  key={`${info.rarity}b${k}`}
                  rarity={info.rarity}
                  icon={boost.icon}
                  label={boostLabel(t, boost)}
                  value={locked ? "–" : `${formatNumber(atLevel(boost.values, level), locale)} %`}
                  hint={hint}
                />
              )),
              ...info.production.map((made, k) => (
                <Stat
                  key={`${info.rarity}p${k}`}
                  rarity={info.rarity}
                  icon={made.icon}
                  label={productionLabel(t, made)}
                  value={locked ? "–" : formatNumber(atLevel(made.amounts, level), locale)}
                  hint={hint}
                />
              )),
              ...info.abilities.map((ability, k) => (
                <Stat
                  key={`${info.rarity}a${k}`}
                  rarity={info.rarity}
                  icon={ability.icon}
                  label={localized(ability.name, locale)}
                  value={locked ? "–" : abilityText(t, ability, level, locale)}
                  small
                  hint={hint}
                />
              )),
            ]
          })}
        </dl>
      </section>
    </div>
  )
}

function Line({ icon, children }: { icon?: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      {icon ? (
        <img src={icon} alt="" loading="lazy" className="size-5 shrink-0 object-contain" />
      ) : (
        <span className="size-5 shrink-0" />
      )}
      <span>{children}</span>
    </li>
  )
}

function Stat({
  label,
  value,
  icon,
  rarity,
  hint,
  small,
}: {
  label: string
  value: string
  icon?: string
  rarity?: AllyRarity
  hint?: string
  small?: boolean
}) {
  return (
    <div className={cn("rounded-md bg-muted/40 p-3", hint && "opacity-60")}>
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {rarity && <RarityChip rarity={rarity} className="px-1 text-[0.65rem]" />}
        {icon && <img src={icon} alt="" className="size-4 object-contain" />}
        {label}
      </dt>
      <dd className={cn("font-semibold", small ? "text-sm" : "text-lg")}>{value}</dd>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
