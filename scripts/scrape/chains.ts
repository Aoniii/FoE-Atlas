// Upgrade chains: buildings linked by "... Upgrade Kit upgrades this building to [[...]]"
// (Whisperwood Watermill Lv. 1 -> ... -> Lv. 8 -> Sylvan -> Arcadian -> Elysian -> Ascended).
// "X - Lv. N" -> "X - Lv. N+1" titles are linked too, in case the wiki misses a link.

export type ChainNode = { id: string; title: string; upgradesTo: string[] }
export type Chain = { id: string; level: number }

// "Terrace Farm - Lv. 2" -> "terrace_farm_lv_2"
export function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
}

const LEVEL_SUFFIX = / - Lv\. (\d+)$/

export function buildChains(nodes: ChainNode[]): Map<string, Chain> {
  const byTitle = new Map(nodes.map((node) => [node.title, node.id]))
  const titleOf = new Map(nodes.map((node) => [node.id, node.title]))
  const next = new Map<string, Set<string>>(nodes.map((node) => [node.id, new Set()]))
  const link = (from: string, to: string | undefined) => {
    if (to && to !== from) next.get(from)!.add(to)
  }

  for (const node of nodes) {
    for (const target of node.upgradesTo) link(node.id, byTitle.get(target))
    const match = node.title.match(LEVEL_SUFFIX)
    const base = match ? node.title.slice(0, match.index) : node.title
    const level = match ? Number(match[1]) : 1
    link(node.id, byTitle.get(`${base} - Lv. ${level + 1}`))
  }

  // Connected groups (links followed in both directions)
  const parent = new Map(nodes.map((node) => [node.id, node.id]))
  const find = (id: string): string => {
    while (parent.get(id) !== id) id = parent.get(id)!
    return id
  }
  for (const [from, targets] of next) for (const to of targets) parent.set(find(to), find(from))
  const groups = new Map<string, string[]>()
  for (const node of nodes) {
    const root = find(node.id)
    groups.set(root, [...(groups.get(root) ?? []), node.id])
  }

  const chains = new Map<string, Chain>()
  for (const members of groups.values()) {
    if (members.length < 2) continue
    // Level = longest path from a first building (Kahn's topological order)
    const incoming = new Map(members.map((id) => [id, 0]))
    for (const id of members)
      for (const to of next.get(id)!) incoming.set(to, incoming.get(to)! + 1)
    const level = new Map(members.map((id) => [id, 1]))
    const queue = members.filter((id) => incoming.get(id) === 0)
    for (let i = 0; i < queue.length; i++) {
      for (const to of next.get(queue[i])!) {
        level.set(to, Math.max(level.get(to)!, level.get(queue[i])! + 1))
        incoming.set(to, incoming.get(to)! - 1)
        if (incoming.get(to) === 0) queue.push(to)
      }
    }
    const firsts = members.filter((id) => level.get(id) === 1).map((id) => titleOf.get(id)!)
    const first = firsts.sort((a, b) => a.length - b.length || a.localeCompare(b))[0]
    const chainId = slug(first.replace(LEVEL_SUFFIX, ""))
    for (const id of members) chains.set(id, { id: chainId, level: level.get(id)! })
  }
  return chains
}
