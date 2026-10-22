// Game resource and boost keys (also the wiki's icon names) -> stats, shared by the wiki
// scraper and the reading of the game's building definitions

import type { StatKey } from "./stats"

// Army boost icons: "{att|def|att_def}_boost_{attacker|defender|attacker_defender}{_gbg|_gex|_gr|}"
// (gex = Guild Expeditions, gr = guild raids = Quantum Incursions)
function armyIcons(): Record<string, StatKey[]> {
  const kinds = { att: ["att"], def: ["def"], att_def: ["att", "def"] }
  const sides = { attacker: ["atk"], defender: ["def"], attacker_defender: ["atk", "def"] }
  const contexts = { "": "classic", _gbg: "gbg", _gex: "ge", _gr: "qi" }
  const icons: Record<string, StatKey[]> = {}
  for (const [kind, stats] of Object.entries(kinds)) {
    for (const [side, armies] of Object.entries(sides)) {
      for (const [suffix, context] of Object.entries(contexts)) {
        icons[`${kind}_boost_${side}${suffix}`] = armies.flatMap((army) =>
          stats.map((stat) => `${army}_army_${stat}_${context}` as StatKey),
        )
      }
    }
  }
  return icons
}

// Wiki icon file name (without hash) -> stats. Icons missing here are kept as
// items and listed in the report: add them here once identified.
export const ICON_STATS: Record<string, StatKey[]> = {
  strategy_points: ["fp"],
  forge_points_production: ["fp_boost"],
  all_goods_of_age: ["goods"],
  random_good_of_age: ["goods"],
  all_goods_of_previous_age: ["goods_prev"],
  random_good_of_previous_age: ["goods_prev"],
  all_goods_of_next_age: ["goods_next"],
  random_good_of_next_age: ["goods_next"],
  random_special_good_up_to_age: ["special_goods"],
  each_special_goods_up_to_age: ["special_goods"],
  guild_treasury: ["guild_goods"],
  goods_production: ["goods_boost"],
  guild_goods_production: ["guild_goods_boost"],
  guild_raids_supplies_production: ["qi_supplies_boost"],
  guild_raids_coins_production: ["qi_coins_boost"],
  money: ["coins"],
  coin_production: ["coins_boost"],
  supplies: ["supplies"],
  supply_production: ["supplies_boost"],
  medals: ["medals"],
  population: ["population"],
  happiness: ["happiness"],
  premium: ["diamonds"],
  military: ["units"],
  guild_raids_action_points_collection: ["qi_actions"],
  guild_raids_action_points_capacity: ["qi_actions_capacity"],
  guild_raids_coins_start: ["qi_coins"],
  guild_raids_supplies_start: ["qi_supplies"],
  guild_raids_goods_start: ["qi_goods"],
  guild_raids_units_start: ["qi_units"],
  ...armyIcons(),
}

// Packages worth a fixed amount of a stat. To verify in game.
export const ICON_PACKS: Record<string, [StatKey, number]> = {
  small_forgepoints: ["fp", 2],
  medium_forgepoints: ["fp", 5],
  large_forgepoints: ["fp", 10],
}
