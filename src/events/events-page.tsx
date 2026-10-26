import { Link, getRouteApi } from "@tanstack/react-router"
import { useI18n } from "@/lib/i18n"
import { eventDate, eventTitle } from "./format"

const route = getRouteApi("/events/")

// Events, the latest first, as the Great Buildings grid
export function EventsPage() {
  const { t, locale } = useI18n()
  const events = route.useLoaderData()
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t.events.title}</h1>
      <p className="max-w-prose text-sm text-muted-foreground">{t.events.intro}</p>
      {events.length === 0 && <p className="text-muted-foreground">{t.events.none}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {events.map((event) => (
          <Link
            key={event.id}
            to="/events/$id"
            params={{ id: event.id }}
            className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:border-primary/50 hover:bg-muted/30"
          >
            <span className="font-medium">{eventTitle(event, locale)}</span>
            {event.image ? (
              <img src={event.image} alt="" loading="lazy" className="h-40 w-full object-contain" />
            ) : (
              <span className="h-40" />
            )}
            {event.beta && (
              <span className="text-sm text-muted-foreground">
                {t.events.beta
                  .replace("{start}", eventDate(event.beta.start, locale))
                  .replace("{end}", eventDate(event.beta.end, locale))}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
