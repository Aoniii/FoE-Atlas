// Event family and year from the image asset id:
//   "W_SS_MultiAge_WIN25A2"            -> winter 2025
//   "R_SS_MultiAge_SummerBonus21b"     -> summer 2021
//   "W_SS_MultiAge_GBGWatchtower2023B" -> gbg 2023
//   "R_SS_MultiAge_CulturalBuilding7i" -> cultural_settlements

// Asset code -> event family id (see src/core/events.ts for the names)
const FAMILIES: Record<string, string> = {
  WIN: "winter",
  Winter: "winter",
  Spring: "spring",
  Easter: "easter",
  SUM: "summer",
  Summer: "summer",
  FALL: "fall",
  Fall: "fall",
  HAL: "halloween",
  Halloween: "halloween",
  PAT: "st_patrick",
  Patrick: "st_patrick",
  WILD: "wildlife",
  Wild: "wildlife",
  ANNI: "anniversary",
  Age: "anniversary",
  FELL: "fellowship",
  ARCH: "archeology",
  Archeology: "archeology",
  HERO: "hero",
  Hero: "hero",
  ARTHUR: "king_arthur",
  // The spreadsheet groups every soccer / Forge Bowl / Forge Games edition together
  Soccer: "football",
  CUP: "football",
  Cup: "football",
  Sport: "football",
  BOWL: "football",
  Forge: "football",
  CARE: "care",
  HIS: "his",
  // GR = guild raids, the internal name of Quantum Incursions
  GR: "quantum_incursions",
  LTE: "limited",
  Pass: "event_pass",
  GBG: "gbg",
  GBGWatchtower: "gbg",
  Expedition: "guild_expeditions",
  GEX: "guild_expeditions",
  // COP = cultural outposts (newer cultural settlements)
  COP: "cultural_settlements",
  CulturalBuilding: "cultural_settlements",
  HistoricalAlliesStarter: "historical_allies",
  ONBOARD: "onboarding",
  TEMP: "temp",
  Shah: "old",
  Anw: "old",
}

export function eventFromAsset(assetId: string): { event: string; year?: number } | undefined {
  const body = assetId.match(/^[A-Z]_SS_(?:MultiAge|AllAge)_(.+)$/)?.[1]
  if (!body) return undefined
  const match =
    // Old style: "SummerBonus21b", "HalloweenBonusGP22g", "SpringBonusSet18a"
    body.match(/^([A-Za-z]+?)Bonus[A-Za-z]*?(\d{2})/) ??
    // New style: "WIN25A2", "FALL24D1", "COP24E7TEMP"
    body.match(/^([A-Z]{2,})(\d{2})[A-Z]/) ??
    // Words then a year: "Expedition16", "GBGWatchtower2023B", "Anw23A1"
    body.match(/^([A-Za-z]+?)(?:20)?(\d{2})/) ??
    // No year: "CulturalBuilding7i", "EasterBonus4"
    body.match(/^([A-Za-z]+?)(?:Bonus|\d|$)/)
  if (!match) return undefined
  const code = match[1]
  const event = FAMILIES[code] ?? code.toLowerCase()
  return match[2] ? { event, year: 2000 + Number(match[2]) } : { event }
}
