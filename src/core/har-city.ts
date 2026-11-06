// Cities from a browser network capture (.har) of the game, in the format of FoE Helper's
// city map export (see parseFoeHelperExport): the player's own city (StartupService.getData)
// and every city visited (OtherPlayerService.visitPlayer), with the game's definition of each
// of their buildings, taken from the metadata the game downloaded in the same capture. For
// players without FoE Helper (mobile only): visit their city in a browser, save the capture.
// Only the game's data is read; the capture's session (headers, cookies) is never kept.

type HarEntry = {
  request: { url: string }
  response: { content: { text?: string; encoding?: string } }
}
type GameEntity = { id?: number; cityentity_id?: string; [key: string]: unknown }
type CityMap = { entities?: GameEntity[]; unlocked_areas?: unknown[] }
type GameMessage = {
  requestClass?: string
  requestMethod?: string
  responseData?: {
    city_map?: CityMap
    user_data?: { player_id?: number; user_name?: string }
    other_player?: { player_id?: number; name?: string }
  }
}

export type HarCity = {
  world: string
  playerId: number
  playerName?: string
  // Same file name as FoE Helper's: "fr10_citymap_261106-1653_5323533.json"
  fileName: string
  data: {
    CityMapData: Record<string, GameEntity>
    CityEntities: Record<string, unknown>
    UnlockedAreas: unknown[]
  }
}

const decode = (content: HarEntry["response"]["content"]) =>
  content.encoding === "base64" ? atob(content.text ?? "") : (content.text ?? "")

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

const stamp = (date: Date) => {
  const two = (n: number) => String(n).padStart(2, "0")
  return `${String(date.getFullYear()).slice(2)}${two(date.getMonth() + 1)}${two(date.getDate())}-${two(date.getHours())}${two(date.getMinutes())}`
}

// `known`: definitions found elsewhere, for the buildings the browser had cached and did not
// download again in this capture
export function citiesFromHar(
  har: unknown,
  date = new Date(),
  known = new Map<string, unknown>(),
): HarCity[] {
  const entries = (har as { log?: { entries?: HarEntry[] } })?.log?.entries ?? []
  // Every building definition the game downloaded, by its id
  const definitions = new Map<string, unknown>(known)
  const maps: { world: string; playerId: number; playerName?: string; map: CityMap }[] = []
  for (const entry of entries) {
    const url = entry.request.url
    if (/\/start\/metadata\?/.test(url)) {
      const json = parse(decode(entry.response.content))
      for (const item of (Array.isArray(json) ? json : [json]) as {
        id?: string
        asset_id?: string
      }[]) {
        if (item?.id && item.asset_id) definitions.set(item.id, item)
      }
      continue
    }
    const world = url.match(/^https:\/\/([a-z]+\d+)\.forgeofempires\.com\/game\/json/)?.[1]
    if (!world) continue
    const messages = parse(decode(entry.response.content))
    if (!Array.isArray(messages)) continue
    for (const message of messages as GameMessage[]) {
      const data = message.responseData
      if (!data?.city_map?.entities) continue
      if (message.requestMethod === "getData" && data.user_data?.player_id) {
        maps.push({
          world,
          playerId: data.user_data.player_id,
          playerName: data.user_data.user_name,
          map: data.city_map,
        })
      } else if (message.requestMethod === "visitPlayer" && data.other_player?.player_id) {
        maps.push({
          world,
          playerId: data.other_player.player_id,
          playerName: data.other_player.name,
          map: data.city_map,
        })
      }
    }
  }
  // The last capture of each city
  const latest = new Map(maps.map((m) => [`${m.world}/${m.playerId}`, m]))
  return [...latest.values()].map(({ world, playerId, playerName, map }) => {
    const entities = map.entities ?? []
    const CityEntities: Record<string, unknown> = {}
    for (const entity of entities) {
      const id = entity.cityentity_id
      if (id && definitions.has(id)) CityEntities[id] = definitions.get(id)
    }
    return {
      world,
      playerId,
      ...(playerName && { playerName }),
      fileName: `${world}_citymap_${stamp(date)}_${playerId}.json`,
      data: {
        CityMapData: Object.fromEntries(
          entities.map((entity, i) => [String(entity.id ?? i), entity]),
        ),
        CityEntities,
        UnlockedAreas: map.unlocked_areas ?? [],
      },
    }
  })
}
