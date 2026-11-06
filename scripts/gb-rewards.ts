// Downloads the level costs of the Great Buildings since the prestige rework from FoE Helper
// (AGPL-3.0, see NOTICE.md): the FP each level adds past level 10, per building and level
// segment, and the buildings whose costs stay linear. Into data/gb-rewards.json, used by
// build-data with the game's first ten level costs (data/gb-prestige.json).
//   pnpm gb-rewards

import { writeFileSync } from "node:fs"

const REPO = "mainIine/foe-helfer-extension"
const FILE = "js/web/greatbuildings/js/greatbuildings.js"

async function main() {
  const commit = await fetch(`https://api.github.com/repos/${REPO}/commits?path=${FILE}&per_page=1`)
    .then((response) => response.json() as Promise<{ sha: string }[]>)
    .then((commits) => (Array.isArray(commits) ? commits[0]?.sha : undefined))
  const source = await fetch(
    `https://raw.githubusercontent.com/${REPO}/${commit ?? "master"}/${FILE}`,
  )
  if (!source.ok) throw new Error(`Cannot download ${FILE} (HTTP ${source.status})`)
  const code = await source.text()

  // "ReworkSteps: { X_IronAge_Landmark2: [22, 38, 87, 971], // Lighthouse ... }"
  const start = code.indexOf("ReworkSteps: {")
  const block = code.slice(start, code.indexOf("\n    },", start))
  const steps: Record<string, number[]> = {}
  for (const match of block.matchAll(/^\s*(X_\w+):\s*\[([\d,\s]+)\]/gm)) {
    steps[match[1]] = match[2].split(",").map((value) => Number(value.trim()))
  }
  // "ReworkLinear: ['X_StellarAgeDiscovery_Landmark1']"
  const linear = [
    ...(code.match(/ReworkLinear:\s*\[([^\]]*)\]/)?.[1] ?? "").matchAll(/'(\w+)'/g),
  ].map((match) => match[1])
  if (Object.keys(steps).length < 40) throw new Error("ReworkSteps not found: FoE Helper changed")

  writeFileSync(
    "data/gb-rewards.json",
    JSON.stringify(
      {
        source: `https://github.com/${REPO}/blob/${commit ?? "master"}/${FILE}`,
        license: "AGPL-3.0",
        downloadedAt: new Date().toISOString(),
        steps,
        linear,
      },
      null,
      2,
    ) + "\n",
  )
  console.log(`${Object.keys(steps).length} cost curves, ${linear.length} linear`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
