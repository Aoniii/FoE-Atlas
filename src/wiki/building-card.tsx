import type { AgeBuilding, AgeData, Output, Reward } from "@/core/building"
import { roadShare, tileCount } from "@/core/efficiency"
import type { StatKey } from "@/core/stats"
import { localized, useI18n } from "@/lib/i18n"
import { eventLabel, formatNumber, statText } from "./format"
import { StatIcon } from "./stat-icon"

// Everything a building gives at the selected age, shown when hovering its name
export function BuildingCard({ building }: { building: AgeBuilding }) {
  const { t, locale } = useI18n()
  const name = localized(building.name, locale)
  const otherName = locale === "en" ? building.name.fr : building.name.en
  const share = roadShare(building.size, building.road)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        {building.image && (
          <img src={building.image} alt="" className="size-28 shrink-0 object-contain" />
        )}
        <div className="min-w-0">
          <p className="leading-tight font-semibold">{name}</p>
          {otherName !== name && <p className="text-xs text-muted-foreground">{otherName}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            {t.wiki.size} {building.size.w}x{building.size.h} · {t.road[building.road]}
            {share > 0 && ` (+${formatNumber(share, locale, 1)})`} ={" "}
            {formatNumber(tileCount(building.size, building.road), locale, 1)}{" "}
            {t.wiki.tiles.toLowerCase()}
          </p>
          {building.event && (
            <p className="text-xs text-muted-foreground">{eventLabel(building, locale)}</p>
          )}
        </div>
      </div>

      <AgeDetails age={building.age} />

      {building.sourceUrl && (
        <a
          href={building.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          {t.wiki.source}
        </a>
      )}
    </div>
  )
}

// Bonuses and 24h production of one age (hover card and building page)
export function AgeDetails({ age }: { age: AgeData }) {
  const { t, locale } = useI18n()
  const passive = Object.entries(age.passive).filter(([, value]) => value) as [StatKey, number][]
  return (
    <>
      {passive.length > 0 && (
        <Section title={t.wiki.passive}>
          {passive.map(([key, value]) => (
            <li key={key} className="flex items-center gap-1.5">
              <StatIcon stat={key} />
              {statText(t, key, value, locale)}
            </li>
          ))}
        </Section>
      )}

      {age.production.length > 0 && (
        <Section title={t.wiki.production}>
          {age.production.map((output, index) => (
            <OutputLine key={index} output={output} />
          ))}
        </Section>
      )}
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="flex flex-col gap-0.5 text-sm">{children}</ul>
    </div>
  )
}

function OutputLine({ output }: { output: Output }) {
  const { t } = useI18n()
  const motivated = output.motivated && (
    <span className="text-xs text-muted-foreground"> · {t.wiki.motivated}</span>
  )
  if (output.kind === "guaranteed") {
    return output.rewards.map((reward, index) => (
      <li key={index}>
        <RewardLabel reward={reward} />
        {motivated}
      </li>
    ))
  }
  return (
    <li>
      <span className="text-xs text-muted-foreground">{t.wiki.random}</span>
      {motivated}
      <ul className="ml-3 flex flex-col gap-0.5">
        {output.options.map((option, index) => (
          <li key={index}>
            <span className="text-muted-foreground">{option.chance} % :</span>{" "}
            {option.rewards.map((reward, i) => (
              <RewardLabel key={i} reward={reward} />
            ))}
          </li>
        ))}
      </ul>
    </li>
  )
}

function RewardLabel({ reward }: { reward: Reward }) {
  const { t, locale } = useI18n()
  if (reward.type === "stat") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <StatIcon stat={reward.stat} />
        {statText(t, reward.stat, reward.amount, locale, 2)}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1">
      {formatNumber(reward.amount, locale, 2)}
      {reward.icon && <img src={reward.icon} alt="" className="size-4 object-contain" />}
      {localized(reward.name, locale)}
    </span>
  )
}
