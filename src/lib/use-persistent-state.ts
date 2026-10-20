import { useEffect, useState } from "react"

// useState mirrored in localStorage (per-viewer convenience: falls back silently)
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored === null ? initial : (JSON.parse(stored) as T)
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage unavailable: keep the in-memory value
    }
  }, [key, value])

  return [value, setValue] as const
}
