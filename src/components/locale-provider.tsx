import { useEffect, useState, type ReactNode } from "react"
import { LocaleContext, getInitialLocale, persistLocale, type Locale } from "@/lib/i18n"

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(getInitialLocale)

  useEffect(() => {
    persistLocale(locale)
  }, [locale])

  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>
}
