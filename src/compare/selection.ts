import { useSyncExternalStore } from "react"

// What can be compared: special buildings with each other, Great Buildings with each other
export type CompareKind = "building" | "great_building"
export type CompareItem = {
  kind: CompareKind
  id: string
  name: { fr: string; en: string }
  image?: string
}

export const MAX_COMPARE = 4
const STORAGE_KEY = "compare.selection"

// Tiny store shared by every page (buttons, floating tray, compare page), saved in the browser
let items: CompareItem[] = load()
const listeners = new Set<() => void>()

function load(): CompareItem[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as CompareItem[]
  } catch {
    return []
  }
}

function set(next: CompareItem[]) {
  items = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Storage unavailable: the selection lives for this visit only
  }
  for (const listener of listeners) listener()
}

export function isSelected(kind: CompareKind, id: string): boolean {
  return items.some((item) => item.kind === kind && item.id === id)
}

// Adds or removes an item. Another kind starts a new selection; a full one drops the oldest.
export function toggleCompare(item: CompareItem) {
  if (isSelected(item.kind, item.id)) {
    set(items.filter((i) => !(i.kind === item.kind && i.id === item.id)))
    return
  }
  const sameKind = items.filter((i) => i.kind === item.kind)
  set([...sameKind, item].slice(-MAX_COMPARE))
}

export function removeCompare(kind: CompareKind, id: string) {
  set(items.filter((i) => !(i.kind === kind && i.id === id)))
}

export function clearCompare() {
  set([])
}

export function useCompareSelection(): CompareItem[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => items,
  )
}
