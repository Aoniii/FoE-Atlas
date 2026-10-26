import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Search } from "lucide-react"
import { AGES } from "@/core/ages"
import { searchBuildings, type SearchEntry } from "@/core/search"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { localized, useI18n } from "@/lib/i18n"
import { eventName } from "@/wiki/format"

const ageName = (age: string, locale: string) => {
  const found = AGES.find((a) => a.id === age)
  return found ? localized(found.name, locale) : age
}

// Loaded once, on the first opening only
let indexPromise: Promise<SearchEntry[]> | undefined
function loadIndex(): Promise<SearchEntry[]> {
  indexPromise ??= fetch(`${import.meta.env.BASE_URL}data/search.json`).then((response) => {
    if (!response.ok) throw new Error(`Cannot load search index (HTTP ${response.status})`)
    return response.json() as Promise<SearchEntry[]>
  })
  return indexPromise
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)

// Search bar of the header: opens a palette (click or Ctrl/Cmd+K) to jump to a building page
export function SearchCommand() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [entries, setEntries] = useState<SearchEntry[]>()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (open && !entries) loadIndex().then(setEntries, () => setEntries([]))
  }, [open, entries])

  const results = useMemo(
    () => (entries ? searchBuildings(entries, query, locale) : []),
    [entries, query, locale],
  )

  function select(entry: SearchEntry) {
    setOpen(false)
    setQuery("")
    if (entry.kind === "great_building") {
      navigate({ to: "/great-buildings/$id", params: { id: entry.id } })
    } else if (entry.kind === "item") {
      navigate({ to: "/items/$id", params: { id: entry.id } })
    } else if (entry.kind === "ally") {
      navigate({ to: "/allies/$id", params: { id: entry.id } })
    } else {
      navigate({ to: "/buildings/$id", params: { id: entry.id } })
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={t.search.title}
        className="w-9 justify-start px-0 text-muted-foreground sm:w-56 sm:px-2.5"
      >
        <Search className="mx-auto sm:mx-0" />
        <span className="hidden sm:inline">{t.search.placeholder}</span>
        <kbd className="ml-auto hidden rounded border bg-muted px-1.5 font-mono text-[0.7rem] sm:inline">
          {isMac ? "⌘" : "Ctrl"} K
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={t.search.title}
        description={t.search.inputPlaceholder}
      >
        {/* Filtering is ours (accents, French and English names): cmdk only renders */}
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={t.search.inputPlaceholder}
          />
          <CommandList>
            {query.trim() && (
              <CommandEmpty>{entries ? t.search.empty : t.search.loading}</CommandEmpty>
            )}
            {results.length > 0 && (
              <CommandGroup heading={t.search.buildings}>
                {results.map((entry) => (
                  <CommandItem key={entry.id} value={entry.id} onSelect={() => select(entry)}>
                    {entry.image ? (
                      <img src={entry.image} alt="" className="size-8 shrink-0 object-contain" />
                    ) : (
                      <span className="size-8 shrink-0" />
                    )}
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{localized(entry.name, locale)}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {locale === "en" ? entry.name.fr : entry.name.en}
                        {entry.kind === "great_building"
                          ? ` · ${t.types.great_building}${entry.age ? ` · ${ageName(entry.age, locale)}` : ""}`
                          : entry.kind === "item" || entry.kind === "ally"
                            ? ` · ${t.types[entry.kind]}`
                            : entry.event &&
                              ` · ${eventName(entry.event, locale)}${entry.eventYear ? ` ${entry.eventYear}` : ""}`}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
