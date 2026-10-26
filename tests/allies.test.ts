import { describe, expect, it } from "vitest"
import { atLevel, raritiesUpTo, type Ally } from "@/core/ally"
import { production, wikiAlly } from "../scripts/allies"

describe("allies", () => {
  it("reads production rewards", () => {
    expect(production("era_unit#heavy_melee#NextEra#1", [6])).toEqual({
      kind: "unit",
      unitClass: "heavy_melee",
      nextEra: true,
      amounts: [6],
    })
    expect(production("resource#strategy_points#1", [15])?.kind).toBe("fp")
    expect(production("goods#each#PreviousEra#1", [70])?.kind).toBe("goods_prev")
  })

  it("reads an ally's wiki page", () => {
    const page = `== Ally information ==
{|
| colspan="2" | https://foeen.innogamescdn.com/assets/historical_allies/allies_large/historical_allies_big_jayavarman_vii-acda012b3.png
Jayavarman VII, the prince.
|-
|}
=== {{sized-external-image|25px|https://foeen.innogamescdn.com/assets/historical_allies/window/historical_allies_ally_emblem_legendary-7f581160e.png}} Legendary ===
{|
| style="width: 30%;" | '''Boosts:'''
| style="width: 70%;" |
* {{sized-external-image|25px|https://foeen.innogamescdn.com/assets/shared/icons/att_boost_attacker_gbg-d6c8b3ab4.png}} Attack for Attacking Army

|-
| style="width: 30%;" | '''Limited Bonuses (Level 1):'''
| style="width: 70%;" |
* {{sized-external-image|25px|https://foeen.innogamescdn.com/assets/shared/icons/frenzy-999989cc7.png}} 17% chance to grant Frenzy to 200 light units in Guild Battlegrounds

|-
| style="width: 30%;" | '''Disband Rewards:'''
| style="width: 70%;" | 200 {{sized-external-image|25px|https://foeen.innogamescdn.com/assets/shared/icons/historical_allies_valor_token-444184a12.png}} Valor Token
|-
| style="width: 30%;" | '''Evolution Costs:'''
| style="width: 70%;" | 800 {{sized-external-image|25px|https://foeen.innogamescdn.com/assets/shared/icons/historical_allies_valor_token-444184a12.png}} Valor Token<br/>4,800 Heroic Scroll
|}`
    const [id, ally] = wikiAlly("Jayavarman VII", page)!
    expect(id).toBe("jayavarman_vii")
    expect(ally.description).toBe("Jayavarman VII, the prince.")
    const legendary = ally.rarities.get("legendary")!
    expect(legendary.boostIcons).toHaveLength(1)
    expect(legendary.abilities[0][1]).toMatch(/grant Frenzy/)
    expect(legendary.valor).toBe(800)
    expect(legendary.disband).toBe(200)
  })

  it("adds up rarities and reads values by level", () => {
    const ally = {
      rarities: ["common", "uncommon", "rare"].map((rarity) => ({ rarity })),
    } as unknown as Ally
    expect(raritiesUpTo(ally, "uncommon").map((r) => r.rarity)).toEqual(["common", "uncommon"])
    expect(atLevel([5, 6, 7], 2)).toBe(6)
    expect(atLevel([5, 6, 7], 100)).toBe(7)
  })
})
