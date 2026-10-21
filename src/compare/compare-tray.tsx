import { Link, useRouterState } from "@tanstack/react-router"
import { ArrowRight, X } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { localized, useI18n } from "@/lib/i18n"
import { clearCompare, removeCompare, useCompareSelection } from "./selection"

// Pages offering the Compare button: the wiki, the City tab and the building pages
const TRAY_PAGES = /\/(wiki\/?$|city\/?$|buildings\/|great-buildings\/)/

// Floating bar at the bottom of those pages while something is selected
export function CompareTray() {
  const { t, locale } = useI18n()
  const items = useCompareSelection()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  if (!items.length || !TRAY_PAGES.test(pathname)) return null

  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="flex max-w-full flex-wrap items-center gap-2 rounded-xl border bg-popover p-2 shadow-lg">
        {items.map((item) => (
          <span
            key={item.id}
            className="inline-flex max-w-48 items-center gap-1 rounded-full border px-2 py-0.5 text-sm"
          >
            {item.image && <img src={item.image} alt="" className="size-5 object-contain" />}
            <span className="truncate">{localized(item.name, locale)}</span>
            <button
              type="button"
              aria-label={t.compare.remove}
              onClick={() => removeCompare(item.kind, item.id)}
              className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        <Button variant="ghost" size="sm" onClick={clearCompare}>
          {t.compare.clear}
        </Button>
        <Link
          to="/compare"
          search={{ kind: items[0].kind, ids: items.map((item) => item.id).join(",") }}
          className={buttonVariants({ size: "sm" })}
        >
          {t.compare.open.replace("{count}", String(items.length))}
          <ArrowRight />
        </Link>
      </div>
    </div>
  )
}
