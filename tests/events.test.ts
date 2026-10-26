import { describe, expect, it } from "vitest"
import { eventTranslator } from "../scripts/event-texts"
import { parseEvent } from "../scripts/events"

// Trimmed copy of a foebeta.com event article
const html = `<article>
<h1>Fall Event 2026: Missions, Rival, and Store</h1>
<p>The event begins on September 28, 2026 on the beta server, ending on October 19, 2026.</p>
<table><tr><th>Rush Quest</th><th>Task</th><th>Reward</th></tr>
<tr><td>1</td><td>Spend 1 Wooden Spoon</td><td>1 <img alt="reward_icon_folk"></td></tr>
<tr><td>2a</td><td>Collect 3 Jars</td><td>1 Spatula</td></tr></table>
<table><tr><th>Daily Quest</th><th>Task</th><th>Reward</th></tr>
<tr><td>1</td><td>Win 5 battles</td><td>2 Forks</td></tr></table>
<table><tr><th>Rival</th><th>Task</th><th>Reward</th></tr>
<tr><td>1</td><td>Pop 50 Desserts</td><td>2 Forks</td></tr>
<tr><td></td><td>Milestone Reward</td><td>3 Wooden Spoons</td></tr></table>
<table><tr><th colspan="3">Grand Prize Lane</th></tr>
<tr><td>#</td><td>Prize Lane</td><td>Gold Pass</td></tr>
<tr><td>6</td><td>Apple Mill</td><td>5 Valor Tokens (x5)</td></tr></table>
</article>`

describe("foebeta event parser", () => {
  const event = parseEvent(
    html,
    "https://foebeta.com/events/fall-event-2026-missions-rival-and-store/",
  )!

  it("reads the name, id, year and beta dates", () => {
    expect(event.id).toBe("fall-event-2026")
    expect(event.name).toBe("Fall Event 2026")
    expect(event.year).toBe(2026)
    expect(event.beta).toEqual({ start: "2026-09-28", end: "2026-10-19" })
  })

  it("reads quests, rival milestones and prize lanes", () => {
    expect(event.quests.main).toEqual([
      { n: "1", text: "Spend 1 Wooden Spoon", reward: "1 folk" },
      { n: "2a", text: "Collect 3 Jars", reward: "1 Spatula" },
    ])
    expect(event.quests.daily).toHaveLength(1)
    expect(event.quests.rival).toEqual([
      { n: "1", text: "Pop 50 Desserts", reward: "2 Forks" },
      { milestone: "3 Wooden Spoons" },
    ])
    expect(event.prizes.lanes).toEqual(["Prize Lane", "Gold Pass"])
    expect(event.prizes.steps).toEqual([{ at: "6", prizes: ["Apple Mill", "5 Valor Tokens (x5)"] }])
  })
})

describe("event texts in French", () => {
  const { translate, missing } = eventTranslator({
    "build {0} decorations": "Construire {0} décorations",
    "spend some forge points": "Dépenser des points de forge",
    "{0} tickets (x{1})": "{0} tickets",
  })

  it("translates a quest part by part, numbers kept", () => {
    expect(translate("Build 7 decorations AND Spend some Forge Points").fr).toBe(
      "Construire 7 décorations ET Dépenser des points de forge",
    )
    expect(translate("14 Tickets (x14)").fr).toBe("14 tickets")
  })

  it("keeps the English of unknown parts and lists them", () => {
    expect(translate("Spend some Forge Points OR Pay some coins").fr).toBe(
      "Dépenser des points de forge OU Pay some coins",
    )
    expect([...missing]).toEqual(["pay some coins"])
  })
})
