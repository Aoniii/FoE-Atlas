import { Link, getRouteApi } from "@tanstack/react-router"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { AGES, type AgeId } from "@/core/ages"
import { aggregateStats, roadShare, score, tileCount } from "@/core/efficiency"
import { STAT_KEYS } from "@/core/stats"
import type { BuildingPage as BuildingPageData, StatBlock } from "@/core/building"
import { Badge } from "@/components/ui/badge"
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
import { CompareButton } from "@/compare/compare-button"
import { AgeDetails } from "./building-card"
import { chainStepLabels } from "./chain-labels"
import { BackToEvent } from "@/events/back-to-event"
import { ItemRef } from "./item-page"
import { ScorePill } from "./score-pill"
import { useBoostBases, useScoreKeys } from "./score-settings"
import { eventLabel, formatNumber, formatStat, fullStatLabel } from "./format"
import { StatIcon } from "./stat-icon"
import { StatIconsContext } from "./stat-icons-context"

const route = getRouteApi("/buildings/$id")

const backClass =
  "inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"

// One page for every building: /buildings/<id>?age=<AgeId>
export function BuildingPage() {
  const { t, locale } = useI18n()
  const { building, icons } = route.useLoaderData()
  const search = route.useSearch()
  const navigate = route.useNavigate()

  const ages = AGES.filter((age) => building.ages[age.id])
  // URL first, then the age chosen last time, then the latest one the building exists in
  const preferred = getPreferredAge()
  const age: AgeId =
    search.age && building.ages[search.age]
      ? search.age
      : preferred && building.ages[preferred]
        ? preferred
        : ages[ages.length - 1].id
  const stepLabels = chainStepLabels(building.chainLevels)
  const [scoreKeys] = useScoreKeys()
  const bases = useBoostBases()
  const tiles = tileCount(building.size, building.road)
  const share = roadShare(building.size, building.road)
  const name = localized(building.name, locale)
  const otherName = locale === "en" ? building.name.fr : building.name.en
  const event = eventLabel({ ...building, age: building.ages[age]! }, locale)

  // Every stat the building gives at some age, one row per age
  const perAge = ages.map((a) => ({ id: a.id, stats: aggregateStats(building.ages[a.id]!) }))
  const statKeys = STAT_KEYS.filter((key) => perAge.some((row) => row.stats[key]))
  const ageItems = ages.map((a) => ({ value: a.id, label: localized(a.name, locale) }))
  const setAge = (value: AgeId) => {
    setPreferredAge(value)
    navigate({ search: (s) => ({ ...s, age: value }), replace: true, resetScroll: false })
  }

  return (
    <StatIconsContext value={icons}>
      <div className="flex flex-col gap-6">
        {search.event ? (
          <BackToEvent event={search.event} tab={search.eventTab} />
        ) : search.from === "city" ? (
          <Link to="/city" className={backClass}>
            <ArrowLeft className="size-4" />
            {t.building.backToCity}
          </Link>
        ) : (
          <Link to="/wiki" search={{ age }} className={backClass}>
            <ArrowLeft className="size-4" />
            {t.building.back}
          </Link>
        )}

        <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {building.image && (
            <img src={building.image} alt="" className="size-40 shrink-0 object-contain" />
          )}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold">{name}</h1>
              <CompareButton
                item={{
                  kind: "building",
                  id: building.id,
                  name: building.name,
                  image: building.image,
                }}
              />
            </div>
            {otherName !== name && <p className="text-muted-foreground">{otherName}</p>}
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">{t.types[building.type]}</Badge>
              {event && <Badge variant="secondary">{event}</Badge>}
              <Badge variant="outline">
                {building.size.w}x{building.size.h} · {t.road[building.road]}
                {share > 0 && ` (+${formatNumber(share, locale, 1)})`} ={" "}
                {formatNumber(tiles, locale, 1)} {t.wiki.tiles.toLowerCase()}
              </Badge>
              {building.chain && (
                <Badge variant="outline">
                  {t.wiki.level} {building.chain.level}
                </Badge>
              )}
            </div>
            {building.sourceUrl && (
              <a
                href={building.sourceUrl}
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

        <LinkedBuildings building={building} age={age} from={search.from} event={search.event} />
        <BuildingItems building={building} event={search.event} />

        {building.chainLevels.length > 1 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">{t.building.levels}</h2>
            <div className="flex flex-wrap gap-1.5">
              {building.chainLevels.map((level) => (
                <Link
                  key={level.id}
                  title={localized(level.name, locale)}
                  to="/buildings/$id"
                  params={{ id: level.id }}
                  search={{ age, from: search.from, event: search.event }}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-sm hover:bg-muted",
                    level.id === building.id && "border-primary bg-muted font-medium",
                  )}
                >
                  {localized(stepLabels.get(level.id) ?? level.name, locale)}
                  {/* Score of this level at the selected age, with the wiki's score settings */}
                  {scoreKeys.length > 0 && level.stats[age] && (
                    <ScorePill
                      className="px-1.5 py-0 text-[0.7rem]"
                      score={score(
                        level.stats[age],
                        tileCount(level.size, level.road),
                        scoreKeys,
                        undefined,
                        bases,
                      )}
                    />
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-medium">{t.building.atAge}</h2>
            <Select
              items={ageItems}
              value={age}
              onValueChange={(value) => value && setAge(value as AgeId)}
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
          </div>
          <AgeDetails age={building.ages[age]!} />
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-medium">{t.building.byAge}</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="border-b px-3 py-2 text-left font-medium text-muted-foreground">
                    {t.wiki.age}
                  </th>
                  {statKeys.map((key) => (
                    <th
                      key={key}
                      title={fullStatLabel(t, key)}
                      className="border-b px-3 py-2 text-right font-medium whitespace-nowrap text-muted-foreground"
                    >
                      <span className="inline-flex items-center gap-1">
                        <StatIcon stat={key} />
                        {t.stats[key]}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perAge.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setAge(row.id)}
                    className={cn(
                      "cursor-pointer border-b last:border-0 hover:bg-muted/30",
                      row.id === age && "bg-muted/60",
                    )}
                  >
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {localized(AGES.find((a) => a.id === row.id)!.name, locale)}
                    </td>
                    {statKeys.map((key) => (
                      <td key={key} className="px-3 py-1.5 text-right whitespace-nowrap">
                        {row.stats[key] ? (
                          formatStat(key, row.stats[key], locale, 1)
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </StatIconsContext>
  )
}

// Stats in one line: "+6 PF · +20 % Cl. att"
function StatLine({ stats }: { stats: StatBlock }) {
  const { t, locale } = useI18n()
  const keys = STAT_KEYS.filter((key) => stats[key])
  if (!keys.length) return <span className="text-muted-foreground">–</span>
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
      {keys.map((key) => (
        <span key={key} className="inline-flex items-center gap-1" title={fullStatLabel(t, key)}>
          {/* "+10 % prov.", not "+10 % +% prov." */}
          <StatIcon stat={key} />+{formatStat(key, stats[key]!, locale, 1)}{" "}
          {t.stats[key].replace(/^\+%\s*/, "")}
        </span>
      ))}
    </span>
  )
}

// Buildings to link with this one: its chain (start and links) or its set, with what each
// adds at the selected age; for a link or a set building, what it gets itself
function LinkedBuildings({
  building,
  age,
  from,
  event,
}: {
  building: BuildingPageData
  age: AgeId
  from?: "city"
  event?: string
}) {
  const { t, locale } = useI18n()
  const chain = building.links?.chain
  const ownBonus = chain?.bonus?.[age]
  const setBonuses = building.links?.set?.bonuses?.[age]
  if (!building.linkedBuildings.length && !ownBonus && !setBonuses?.length) return null
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">{t.building.linked}</h2>
      <p className="text-xs text-muted-foreground">
        {chain ? t.building.linkedHint[chain.role] : t.building.linkedHint.set}
      </p>
      {ownBonus && (
        <p className="text-sm">
          {t.building.linkBonus} <StatLine stats={aggregateStats(ownBonus)} />
        </p>
      )}
      {setBonuses && setBonuses.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-sm">
          {setBonuses.map((bonus, index) => (
            <li key={index}>
              {t.building.setBonus.replace("{count}", String(index + 1))}{" "}
              <StatLine stats={aggregateStats(bonus)} />
            </li>
          ))}
        </ul>
      )}
      {building.linkedBuildings.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {building.linkedBuildings.map((linked) => (
            <li key={linked.id} className="flex items-center gap-3 rounded-md border p-2">
              {linked.image && (
                <img src={linked.image} alt="" className="size-10 shrink-0 object-contain" />
              )}
              <div className="flex min-w-0 flex-col gap-0.5 text-sm">
                <Link
                  to="/buildings/$id"
                  params={{ id: linked.id }}
                  search={{ age, from, event }}
                  className="font-medium underline decoration-dotted underline-offset-4 hover:text-primary"
                >
                  {localized(linked.name, locale)}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {t.building.linkRoles[linked.role]}
                </span>
                {linked.bonus?.[age] && (
                  <span className="text-xs">
                    <StatLine stats={linked.bonus[age]!} />
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// Inventory items of this building: selection kits placing it, upgrade kits turning the
// level below into it or it into the next level
function BuildingItems({ building, event }: { building: BuildingPageData; event?: string }) {
  const { t } = useI18n()
  if (!building.items?.length) return null
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">{t.building.items}</h2>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {building.items.map((item) => (
          <li
            key={`${item.id}-${item.role}`}
            className="flex items-center rounded-md border p-2 text-sm"
          >
            <ItemRef item={item} note={t.building.itemRoles[item.role]} event={event} />
          </li>
        ))}
      </ul>
    </section>
  )
}
