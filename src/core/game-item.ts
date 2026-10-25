// Inventory items of the game that place or upgrade buildings (data/game-items.json, see
// scripts/game-items.ts): upgrade kits and selection kits, and the game's upgrade paths.

export type LocalizedName = { fr: string; en: string }

// One building of a selection kit, or another item it gives (an upgrade kit)
export type KitOption = {
  name: LocalizedName
  building?: { gameId: string; level: number }
  item?: string
}

export type GameItem = {
  id: string
  kind: "upgrade_kit" | "selection_kit"
  name: LocalizedName
  description: LocalizedName
  // Picture of the item on the game's image server, when the wiki shows it
  icon?: string
  rarity?: string
  // Upgrade kit: the building it turns into the next one (game ids)
  upgrades?: { from: string; to: string }[]
  // Selection kit: the choices it offers
  options?: KitOption[]
}

// Every level of an upgradable building: level 1 for the base, one more per upgrade step
export type UpgradePath = { base: string; levels: Record<string, number> }

export type GameItems = { sources: string[]; items: GameItem[]; paths: UpgradePath[] }

// Levels of a path from its steps, walking from the base (some paths branch at the end:
// the Royal and Citadel versions of the last level share its level)
export function pathLevels(
  base: string,
  steps: { from: string; to: string }[],
): Record<string, number> {
  const levels: Record<string, number> = { [base]: 1 }
  let frontier = [base]
  while (frontier.length) {
    const next: string[] = []
    for (const from of frontier) {
      for (const step of steps) {
        if (step.from !== from || levels[step.to]) continue
        levels[step.to] = levels[from] + 1
        next.push(step.to)
      }
    }
    frontier = next
  }
  return levels
}

// A building an item places or upgrades, as shipped to the item's page (id: its page, when
// the site has it)
export type ItemBuilding = { id?: string; name: LocalizedName; image?: string }

// Item grid of the wiki (public/data/items.json): its picture, or the building it gives
export type ItemCard = Pick<GameItem, "id" | "kind" | "name" | "rarity"> & { image?: string }

// One item with the buildings it places or upgrades (public/data/items/<id>.json)
export type ItemPage = ItemCard & {
  description: LocalizedName
  upgrades?: { from: ItemBuilding; to: ItemBuilding }[]
  options?: { name: LocalizedName; building?: ItemBuilding & { level: number }; item?: ItemCard }[]
}
