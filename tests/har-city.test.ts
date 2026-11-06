import { describe, expect, it } from "vitest"
import { parseFoeHelperExport } from "@/core/city"
import { citiesFromHar } from "@/core/har-city"

const entry = (url: string, body: unknown, base64 = false) => ({
  request: { url },
  response: {
    content: base64
      ? { text: btoa(JSON.stringify(body)), encoding: "base64" }
      : { text: JSON.stringify(body) },
  },
})

const house = {
  id: "R_IronAge_House",
  asset_id: "R_IronAge_House",
  name: "Maison",
  width: 2,
  length: 2,
}
const har = {
  log: {
    entries: [
      entry(
        "https://foefr.innogamescdn.com/start/metadata?id=building_entity_R_IronAge_House",
        house,
      ),
      entry(
        "https://fr10.forgeofempires.com/game/json?h=x",
        [
          {
            requestClass: "OtherPlayerService",
            requestMethod: "visitPlayer",
            responseData: {
              other_player: { player_id: 42, name: "ArtemisJoue" },
              city_map: {
                entities: [
                  {
                    id: 7,
                    cityentity_id: "R_IronAge_House",
                    type: "residential",
                    x: 9,
                    y: 9,
                    connected: 1,
                  },
                  {
                    id: 8,
                    cityentity_id: "X_IronAge_Landmark2",
                    type: "greatbuilding",
                    x: 12,
                    y: 9,
                    level: 30,
                  },
                ],
                unlocked_areas: [{ x: 8, y: 8, width: 16, length: 16 }],
              },
            },
          },
        ],
        true,
      ),
    ],
  },
}

describe("cities from a capture", () => {
  it("rebuilds a visited city as a FoE Helper export the City tab reads", () => {
    const known = new Map<string, unknown>([
      [
        "X_IronAge_Landmark2",
        { id: "X_IronAge_Landmark2", asset_id: "X_IronAge_Landmark2", width: 4, length: 4 },
      ],
    ])
    const [city] = citiesFromHar(har, new Date(2026, 10, 6, 16, 53), known)
    expect(city).toMatchObject({ world: "fr10", playerId: 42, playerName: "ArtemisJoue" })
    expect(city.fileName).toBe("fr10_citymap_261106-1653_42.json")
    expect(Object.keys(city.data.CityEntities).sort()).toEqual([
      "R_IronAge_House",
      "X_IronAge_Landmark2",
    ])
    const parsed = parseFoeHelperExport(city.data, city.fileName)
    expect(parsed).toMatchObject({ world: "fr10", playerId: 42 })
    expect(parsed.entities.map((e) => [e.id, e.w, e.h, e.level])).toEqual([
      ["R_IronAge_House", 2, 2, undefined],
      ["X_IronAge_Landmark2", 4, 4, 30],
    ])
  })
})
