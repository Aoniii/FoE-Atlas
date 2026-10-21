import { Link } from "@tanstack/react-router"
import { buttonVariants } from "@/components/ui/button"
import { LanguageSwitcher } from "@/components/language-switcher"
import { SearchCommand } from "@/search/search-command"
import { ModeToggle } from "@/components/mode-toggle"
import { useI18n } from "@/lib/i18n"

const navLinkClass = buttonVariants({
  variant: "ghost",
  size: "sm",
  className: "text-muted-foreground data-[status=active]:text-foreground",
})

export function SiteHeader() {
  const { t } = useI18n()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center gap-2 px-4">
        <Link to="/" className="mr-2 flex items-center gap-2" aria-label="FoE Atlas">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-6" />
          <span className="hidden font-semibold sm:inline">FoE Atlas</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link to="/wiki" className={navLinkClass}>
            {t.nav.wiki}
          </Link>
          <Link to="/city" className={navLinkClass}>
            {t.nav.city}
          </Link>
          <Link to="/changelog" className={navLinkClass}>
            {t.nav.changelog}
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <SearchCommand />
          <LanguageSwitcher />
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
