import type { Output, Reward } from "./building"
import type { StatKey } from "./stats"

// Buildings with a choice of productions (Insect Hotel: supplies, coins, medals, FP or goods):
// each option's yield over a day of 3 collections, 8 hours apart (an option of 8h or less runs
// 3 times, a longer one 24h / its duration), then half the best FP option and half the best
// goods option, since both can be produced; without FP or goods, the best option.
export type Choice = { time: number; rewards: Reward[] }
const GOODS_STATS = new Set<StatKey>([
  "goods",
  "goods_prev",
  "goods_next",
  "special_goods",
  "guild_goods",
])

export function chooseProduction(choices: Choice[]): Output[] {
  const daily = choices
    .filter((choice) => choice.rewards.length)
    .map((choice) => {
      const runs = choice.time <= 28800 ? 3 : 86400 / choice.time
      return choice.rewards.map((r) => ({ ...r, amount: Math.round(r.amount * runs * 100) / 100 }))
    })
  const total = (rewards: Reward[], counts: (stat: StatKey) => boolean) =>
    rewards.reduce((sum, r) => sum + (r.type === "stat" && counts(r.stat) ? r.amount : 0), 0)
  const best = (counts: (stat: StatKey) => boolean) =>
    daily
      .filter((rewards) => total(rewards, counts) > 0)
      .sort((a, b) => total(b, counts) - total(a, counts))[0]
  const fp = best((stat) => stat === "fp")
  const goods = best((stat) => GOODS_STATS.has(stat))
  if (fp && goods && fp !== goods) {
    return [
      {
        kind: "random",
        options: [
          { chance: 50, rewards: fp },
          { chance: 50, rewards: goods },
        ],
      },
    ]
  }
  const chosen = fp ?? goods ?? best(() => true)
  return chosen ? [{ kind: "guaranteed", rewards: chosen }] : []
}
