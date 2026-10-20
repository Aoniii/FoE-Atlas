// Ages in game order, ids as used by the game metadata
export const AGES = [
  { id: "BronzeAge", name: { fr: "Âge du bronze", en: "Bronze Age" } },
  { id: "IronAge", name: { fr: "Âge du fer", en: "Iron Age" } },
  { id: "EarlyMiddleAge", name: { fr: "Haut Moyen Âge", en: "Early Middle Ages" } },
  { id: "HighMiddleAge", name: { fr: "Moyen Âge classique", en: "High Middle Ages" } },
  { id: "LateMiddleAge", name: { fr: "Moyen Âge tardif", en: "Late Middle Ages" } },
  { id: "ColonialAge", name: { fr: "Ère coloniale", en: "Colonial Age" } },
  { id: "IndustrialAge", name: { fr: "Ère industrielle", en: "Industrial Age" } },
  { id: "ProgressiveEra", name: { fr: "Ère progressiste", en: "Progressive Era" } },
  { id: "ModernEra", name: { fr: "Ère moderne", en: "Modern Era" } },
  { id: "PostModernEra", name: { fr: "Ère postmoderne", en: "Postmodern Era" } },
  { id: "ContemporaryEra", name: { fr: "Ère contemporaine", en: "Contemporary Era" } },
  { id: "TomorrowEra", name: { fr: "Demain", en: "Tomorrow Era" } },
  { id: "FutureEra", name: { fr: "Le Futur", en: "The Future" } },
  { id: "ArcticFuture", name: { fr: "Futur arctique", en: "Arctic Future" } },
  { id: "OceanicFuture", name: { fr: "Futur océanique", en: "Oceanic Future" } },
  { id: "VirtualFuture", name: { fr: "Futur virtuel", en: "Virtual Future" } },
  { id: "SpaceAgeMars", name: { fr: "Âge spatial – Mars", en: "Space Age Mars" } },
  {
    id: "SpaceAgeAsteroidBelt",
    name: { fr: "Âge spatial – Ceinture d'astéroïdes", en: "Space Age Asteroid Belt" },
  },
  { id: "SpaceAgeVenus", name: { fr: "Âge spatial – Vénus", en: "Space Age Venus" } },
  {
    id: "SpaceAgeJupiterMoon",
    name: { fr: "Âge spatial – Lune de Jupiter", en: "Space Age Jupiter Moon" },
  },
  { id: "SpaceAgeTitan", name: { fr: "Âge spatial – Titan", en: "Space Age Titan" } },
  {
    id: "SpaceAgeSpaceHub",
    name: { fr: "Âge spatial – Chantier spatial", en: "Space Age Space Hub" },
  },
  {
    id: "StellarAgeDiscovery",
    name: { fr: "Âge stellaire – Découverte", en: "Stellar Age: Discovery" },
  },
] as const

export type AgeId = (typeof AGES)[number]["id"]

export const AGE_IDS = AGES.map((age) => age.id) as [AgeId, ...AgeId[]]

export const LATEST_AGE: AgeId = AGE_IDS[AGE_IDS.length - 1]
