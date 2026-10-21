import { Link } from "@tanstack/react-router"
import { AGES } from "@/core/ages"
import type { GreatBuildingCard } from "@/core/great-building"
import { CompareButton } from "@/compare/compare-button"
import { localized, useI18n, type Locale } from "@/lib/i18n"

const ageIndex = (card: GreatBuildingCard) =>
  card.age ? AGES.findIndex((age) => age.id === card.age) : -1

// Great Buildings sorted by age (all-age ones first), then by name
function sortCards(cards: GreatBuildingCard[], locale: Locale) {
  return [...cards].sort(
    (a, b) =>
      ageIndex(a) - ageIndex(b) ||
      localized(a.name, locale).localeCompare(localized(b.name, locale), locale),
  )
}

export function GreatBuildingGrid({ cards }: { cards: GreatBuildingCard[] }) {
  const { t, locale } = useI18n()
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {sortCards(cards, locale).map((card) => {
        const age = AGES.find((a) => a.id === card.age)
        return (
          <Link
            key={card.id}
            to="/great-buildings/$id"
            params={{ id: card.id }}
            className="relative flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:border-primary/50 hover:bg-muted/30"
          >
            <CompareButton
              iconOnly
              className="absolute top-2 right-2"
              item={{ kind: "great_building", id: card.id, name: card.name, image: card.image }}
            />
            {card.beta && (
              <span
                title={t.greatBuilding.betaBadgeTitle}
                className="absolute top-2 left-2 rounded-full border border-orange-500/40 bg-orange-500/15 px-2 py-0.5 text-[0.7rem] font-medium text-orange-600 dark:text-orange-400"
              >
                {t.greatBuilding.betaBadge}
              </span>
            )}
            <span className="font-medium">{localized(card.name, locale)}</span>
            <img src={card.image} alt="" loading="lazy" className="h-40 w-full object-contain" />
            <span className="text-sm text-muted-foreground">
              {age ? localized(age.name, locale) : t.greatBuilding.allAges}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
