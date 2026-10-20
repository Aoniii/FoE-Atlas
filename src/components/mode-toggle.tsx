import { useState } from "react"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import { getTheme, setTheme, type Theme } from "@/lib/theme"

export function ModeToggle() {
  const { t } = useI18n()
  const [theme, setThemeState] = useState<Theme>(getTheme)

  function toggle() {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
    setThemeState(next)
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={t.theme.toggle}>
      {theme === "dark" ? <Sun /> : <Moon />}
    </Button>
  )
}
