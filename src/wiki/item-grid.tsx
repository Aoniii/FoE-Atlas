import { useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import type { GameItem, ItemCard } from "@/core/game-item"
import { normalize } from "@/core/search"
import { Input } from "@/components/ui/input"
import { localized, useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const KINDS: GameItem["kind"][] = ["selection_kit", "upgrade_kit"]

const RARITY_CLASS: Record<string, string> = {
  epic: "bg-purple-600/80 text-white",
  rare: "bg-blue-600/80 text-white",
  uncommon: "bg-green-600/80 text-white",
}

export function ItemRarity({ rarity, className }: { rarity?: string; className?: string }) {
  const { t } = useI18n()
  if (!rarity || !(rarity in t.item.rarities)) return null
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[0.7rem] font-medium",
        RARITY_CLASS[rarity],
        className,
      )}
    >
      {t.item.rarities[rarity as keyof typeof t.item.rarities]}
    </span>
  )
}

// Inventory items: a name filter and the kind, then every match by name
export function ItemGrid({ cards }: { cards: ItemCard[] }) {
  const { t, locale } = useI18n()
  const [query, setQuery] = useState("")
  const [kind, setKind] = useState<GameItem["kind"]>()
  const shown = useMemo(() => {
    const words = normalize(query).split(" ").filter(Boolean)
    return cards
      .filter((card) => !kind || card.kind === kind)
      .filter((card) => {
        const text = normalize(`${card.name.fr} ${card.name.en}`)
        return words.every((word) => text.includes(word))
      })
      .sort((a, b) => localized(a.name, locale).localeCompare(localized(b.name, locale), locale))
  }, [cards, query, kind, locale])

  // Names come from an English capture until a French one is given (scripts/game-items.ts)
  const untranslated = cards.filter((c) => c.name.fr === c.name.en).length > cards.length / 2

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.item.filter}
          className="max-w-xs"
        />
        {[undefined, ...KINDS].map((value) => (
          <button
            key={value ?? "all"}
            type="button"
            onClick={() => setKind(value)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-sm transition-colors",
              kind === value ? "border-primary bg-primary/10" : "hover:bg-muted/50",
            )}
          >
            {value ? t.item.kinds[value] : t.item.allKinds}
          </button>
        ))}
        {untranslated && (
          <span className="text-xs text-muted-foreground">{t.item.englishOnly}</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {shown.map((card) => (
          <Link
            key={card.id}
            to="/items/$id"
            params={{ id: card.id }}
            className="relative flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors hover:border-primary/50 hover:bg-muted/30"
          >
            <ItemRarity rarity={card.rarity} className="absolute top-2 left-2" />
            {card.image ? (
              <img src={card.image} alt="" loading="lazy" className="h-20 w-full object-contain" />
            ) : (
              <span className="h-20" />
            )}
            <span className="text-sm font-medium">{localized(card.name, locale)}</span>
            <span className="text-xs text-muted-foreground">{t.item.kinds[card.kind]}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
