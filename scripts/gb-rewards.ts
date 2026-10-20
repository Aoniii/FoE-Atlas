// Downloads the Great Building patron rewards (first place, per era and level) from
// FoE Helper (AGPL-3.0, see NOTICE.md) into data/gb-rewards.json.
//   pnpm gb-rewards

import { writeFileSync } from "node:fs"

const REPO = "mainIine/foe-helfer-extension"
const FILE = "js/web/greatbuildings/js/greatbuildings.js"

async function main() {
  const commit = await fetch(`https://api.github.com/repos/${REPO}/commits?path=${FILE}&per_page=1`)
    .then((response) => response.json() as Promise<{ sha: string }[]>)
    .then((commits) => commits[0]?.sha)
  const source = await fetch(
    `https://raw.githubusercontent.com/${REPO}/${commit ?? "master"}/${FILE}`,
  )
  if (!source.ok) throw new Error(`Cannot download ${FILE} (HTTP ${source.status})`)
  const code = await source.text()

  // "Rewards: { 0: [5, 10, ...], 2: [...], ... }": one era per line, keyed by FoE Helper era id
  const block = code.slice(
    code.indexOf("Rewards: {"),
    code.indexOf("\n    },", code.indexOf("Rewards: {")),
  )
  const rewards: Record<string, number[]> = {}
  for (const match of block.matchAll(/^\s*(\d+):\s*\[([\d.,\s]+)\]/gm)) {
    rewards[match[1]] = match[2].split(",").map((value) => Number(value.trim()))
  }
  if (Object.keys(rewards).length < 10)
    throw new Error("Rewards table not found: FoE Helper changed")

  writeFileSync(
    "data/gb-rewards.json",
    JSON.stringify(
      {
        // FoE Helper era ids: 0 = all ages, 1 = Stone Age, 2 = Bronze Age ... (see src/core/rush.ts)
        source: `https://github.com/${REPO}/blob/${commit ?? "master"}/${FILE}`,
        license: "AGPL-3.0",
        downloadedAt: new Date().toISOString(),
        rewards,
      },
      null,
      2,
    ) + "\n",
  )
  const levels = Object.values(rewards).map((table) => table.length)
  console.log(
    `${Object.keys(rewards).length} eras, ${Math.min(...levels)}-${Math.max(...levels)} levels`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
