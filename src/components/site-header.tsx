import { Link } from "@tanstack/react-router"
import { Search } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { LanguageSwitcher } from "@/components/language-switcher"
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
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {/* Search is not implemented yet: placeholder for the layout */}
          <Button
            variant="outline"
            size="sm"
            disabled
            className="w-9 justify-start px-0 text-muted-foreground sm:w-56 sm:px-2.5"
          >
            <Search className="mx-auto sm:mx-0" />
            <span className="hidden sm:inline">{t.search.placeholder}</span>
          </Button>
          <LanguageSwitcher />
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
