import { Link, getRouteApi } from "@tanstack/react-router"
import { ArrowLeft, ArrowRight } from "lucide-react"
import type { ItemBuilding, ItemCard } from "@/core/game-item"
import { Badge } from "@/components/ui/badge"
import { localized, useI18n } from "@/lib/i18n"
import { BackToEvent } from "@/events/back-to-event"
import { ItemRarity } from "./item-grid"

const route = getRouteApi("/items/$id")

const backClass =
  "inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
const linkClass = "font-medium underline decoration-dotted underline-offset-4 hover:text-primary"

// One page for every inventory item: /items/<id>, with the buildings it places or upgrades
export function ItemPage() {
  const { t, locale } = useI18n()
  const { item } = route.useLoaderData()
  const { event } = route.useSearch()
  const name = localized(item.name, locale)
  const otherName = locale === "en" ? item.name.fr : item.name.en

  return (
    <div className="flex flex-col gap-6">
      {event ? (
        <BackToEvent event={event} />
      ) : (
        <Link to="/wiki" search={{ type: "item" }} className={backClass}>
          <ArrowLeft className="size-4" />
          {t.item.back}
        </Link>
      )}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {item.image && <img src={item.image} alt="" className="size-32 shrink-0 object-contain" />}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{name}</h1>
          {otherName !== name && <p className="text-muted-foreground">{otherName}</p>}
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{t.item.kinds[item.kind]}</Badge>
            <ItemRarity rarity={item.rarity} />
          </div>
          <p className="max-w-prose text-sm">{localized(item.description, locale)}</p>
          {item.name.fr === item.name.en && (
            <p className="text-xs text-muted-foreground">{t.item.englishOnly}</p>
          )}
        </div>
      </header>

      {item.upgrades && item.upgrades.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">{t.item.upgrades}</h2>
          <ul className="flex flex-col gap-2">
            {item.upgrades.map(({ from, to }) => (
              <li
                key={`${from.id ?? from.name.en}-${to.id ?? to.name.en}`}
                className="flex flex-wrap items-center gap-3 rounded-md border p-2 text-sm"
              >
                <BuildingRef building={from} />
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                <BuildingRef building={to} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {item.options && item.options.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">{t.item.options}</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {item.options.map((option, index) => (
              <li key={index} className="flex items-center gap-3 rounded-md border p-2 text-sm">
                {option.building ? (
                  <BuildingRef building={option.building} level={option.building.level} />
                ) : option.item ? (
                  <ItemRef item={option.item} />
                ) : (
                  localized(option.name, locale)
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function BuildingRef({ building, level }: { building: ItemBuilding; level?: number }) {
  const { t, locale } = useI18n()
  const { event } = route.useSearch()
  return (
    <span className="flex min-w-0 items-center gap-3">
      {building.image && (
        <img src={building.image} alt="" className="size-10 shrink-0 object-contain" />
      )}
      <span className="flex min-w-0 flex-col gap-0.5">
        {building.id ? (
          <Link
            to="/buildings/$id"
            params={{ id: building.id }}
            search={{ event }}
            className={linkClass}
          >
            {localized(building.name, locale)}
          </Link>
        ) : (
          <span className="font-medium">{localized(building.name, locale)}</span>
        )}
        {level && level > 1 && (
          <span className="text-xs text-muted-foreground">
            {t.wiki.level} {level}
          </span>
        )}
      </span>
    </span>
  )
}

export function ItemRef({ item, note, event }: { item: ItemCard; note?: string; event?: string }) {
  const { locale } = useI18n()
  return (
    <span className="flex min-w-0 items-center gap-3">
      {item.image && <img src={item.image} alt="" className="size-10 shrink-0 object-contain" />}
      <span className="flex min-w-0 flex-col gap-0.5">
        <Link to="/items/$id" params={{ id: item.id }} search={{ event }} className={linkClass}>
          {localized(item.name, locale)}
        </Link>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </span>
    </span>
  )
}
