import { useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import type { Ally, AllyCard } from "@/core/ally"
import { normalize } from "@/core/search"
import { Input } from "@/components/ui/input"
import { localized, useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const TYPES: Ally["type"][] = ["military", "science"]

// Historical allies: a name filter and the type, then every match by name
export function AllyGrid({ cards }: { cards: AllyCard[] }) {
  const { t, locale } = useI18n()
  const [query, setQuery] = useState("")
  const [type, setType] = useState<Ally["type"]>()
  const shown = useMemo(() => {
    const words = normalize(query).split(" ").filter(Boolean)
    return cards
      .filter((card) => !type || card.type === type)
      .filter((card) => {
        const text = normalize(`${card.name.fr} ${card.name.en}`)
        return words.every((word) => text.includes(word))
      })
      .sort((a, b) => localized(a.name, locale).localeCompare(localized(b.name, locale), locale))
  }, [cards, query, type, locale])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.ally.filter}
          className="max-w-xs"
        />
        {[undefined, ...TYPES].map((value) => (
          <button
            key={value ?? "all"}
            type="button"
            onClick={() => setType(value)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-sm transition-colors",
              type === value ? "border-primary bg-primary/10" : "hover:bg-muted/50",
            )}
          >
            {value ? t.ally.types[value] : t.ally.allTypes}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {shown.map((card) => (
          <Link
            key={card.id}
            to="/allies/$id"
            params={{ id: card.id }}
            className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:border-primary/50 hover:bg-muted/30"
          >
            <span className="font-medium">{localized(card.name, locale)}</span>
            {card.image ? (
              <img src={card.image} alt="" loading="lazy" className="h-40 w-full object-contain" />
            ) : (
              <span className="h-40" />
            )}
            <span className="text-sm text-muted-foreground">{t.ally.types[card.type]}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
