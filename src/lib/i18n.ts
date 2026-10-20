import { createContext, useContext } from "react"
import type fr from "@/locales/fr.json"

// fr.json is the reference shape: every locale must match it
export type Messages = typeof fr

export type Locale = string

export const DEFAULT_LOCALE: Locale = "fr"

const STORAGE_KEY = "locale"

const localeFiles = import.meta.glob<Messages>(
  ["../locales/*.json", "!../locales/_template.json"],
  {
    eager: true,
    import: "default",
  },
)

const flagFiles = import.meta.glob<string>("../locales/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
})

// "../locales/fr.json" -> "fr"
function localeCode(path: string): Locale {
  return path.slice(path.lastIndexOf("/") + 1, path.lastIndexOf("."))
}

export const messages: Record<Locale, Messages> = Object.fromEntries(
  Object.entries(localeFiles).map(([path, data]) => [localeCode(path), data]),
)

export const flags: Record<Locale, string> = Object.fromEntries(
  Object.entries(flagFiles).map(([path, url]) => [localeCode(path), url]),
)

export const LOCALES: Locale[] = Object.keys(messages)

export function getInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && stored in messages) return stored
  } catch {
    // Storage unavailable: fall back to default
  }
  return DEFAULT_LOCALE
}

export function persistLocale(locale: Locale) {
  document.documentElement.lang = locale
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Storage unavailable: locale still applies for this visit
  }
}

type LocaleContextValue = { locale: Locale; setLocale: (locale: Locale) => void }

export const LocaleContext = createContext<LocaleContextValue | null>(null)

export function useI18n() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error("useI18n must be used inside <LocaleProvider>")
  return { ...ctx, t: messages[ctx.locale] }
}
