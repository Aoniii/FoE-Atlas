import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Flag } from "@/components/flag"
import { LOCALES, messages, useI18n } from "@/lib/i18n"

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label={t.language.label} />}
      >
        <Flag locale={locale} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto">
        <DropdownMenuRadioGroup value={locale} onValueChange={(value: string) => setLocale(value)}>
          {LOCALES.map((l) => (
            <DropdownMenuRadioItem key={l} value={l}>
              <Flag locale={l} />
              {messages[l].language.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
