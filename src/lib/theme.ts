export type Theme = "light" | "dark"

const STORAGE_KEY = "theme"

export function getTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

export function setTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle("dark", theme === "dark")
  root.style.colorScheme = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage unavailable (private mode): theme still applies for this visit
  }
}
