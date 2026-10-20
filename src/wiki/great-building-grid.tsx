import { Link } from "@tanstack/react-router"
import { AGES } from "@/core/ages"
import type { GreatBuildingCard } from "@/core/great-building"
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
            className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:border-primary/50 hover:bg-muted/30"
          >
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
