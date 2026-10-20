// Release notes shown on /changelog, newest first. Add an entry with each release.
type Localized = { fr: string; en: string }

export type Release = { version: string; date: string; changes: Localized[] }

export const CHANGELOG: Release[] = [
  {
    version: "1.0.0-alpha.5",
    date: "2026-10-20",
    changes: [
      {
        fr: "Tableau des bâtiments à hauteur d'écran : en-têtes toujours visibles, la page défile d'abord puis les lignes, sans barre de défilement",
        en: "Screen-height buildings table: headers always visible, the page scrolls first then the rows, without a scrollbar",
      },
      {
        fr: "Mode comparaison : jusqu'à 4 bâtiments ou Grands Monuments côte à côte, meilleure valeur en vert, écarts et décomposition du score",
        en: "Comparison mode: up to 4 buildings or Great Buildings side by side, best value in green, differences and score breakdown",
      },
      {
        fr: "Les Grands Monuments apparaissent dans la recherche",
        en: "Great Buildings show up in the search",
      },
      {
        fr: "Temple des reliques et Tour de Galata : bonus calculés au-delà du niveau 80, à partir de relevés en jeu",
        en: "Temple of Relics and Galata Tower: bonuses computed beyond level 80, from in-game readings",
      },
    ],
  },
  {
    version: "1.0.0-alpha.4",
    date: "2026-10-20",
    changes: [
      {
        fr: "Page Changelog : la liste des changements de chaque version",
        en: "Changelog page: the list of changes of each release",
      },
      {
        fr: "Bouton « Tout décocher » pour le score de rentabilité",
        en: "“Uncheck all” button for the efficiency score",
      },
      {
        fr: "Score juste après le nom du bâtiment, dans une pastille colorée de violet (0) à bleu (10 et plus), au texte toujours lisible",
        en: "Score right after the building name, in a pill colored from violet (0) to blue (10 and more), with always readable text",
      },
      {
        fr: "Score de chaque niveau d'une chaîne sur les fiches, calculé avec tes cases du wiki",
        en: "Score of each chain level on building pages, computed with your wiki checkboxes",
      },
      {
        fr: "Version du jeu et date des données affichées sur l'accueil, filtre « Source » renommé « Filtre »",
        en: "Game version and data date shown on the home page, “Source” filter renamed “Filter”",
      },
    ],
  },
  {
    version: "1.0.0-alpha.3",
    date: "2026-10-20",
    changes: [
      {
        fr: "Grands Monuments : grille par âge et fiche par GM (description, bonus, sélecteur de niveau)",
        en: "Great Buildings: grid by age and a page per building (description, boosts, level picker)",
      },
      {
        fr: "Niveaux jusqu'à 400 : coûts exacts, effets calculés au-delà du niveau 80",
        en: "Levels up to 400: exact costs, effects computed beyond level 80",
      },
      {
        fr: "Calculateur de Rush : ce que te coûte la montée d'un GM avec les places P1 à P5 et le bonus d'Arche",
        en: "Rush calculator: what leveling a Great Building costs you with places P1 to P5 and the Arc bonus",
      },
      {
        fr: "Les Incursions quantiques peuvent compter dans le score de rentabilité (actions en priorité)",
        en: "Quantum Incursions stats can count in the efficiency score (actions first)",
      },
      {
        fr: "Infobulles sur le score : nom complet de chaque stat et valeur d'un point",
        en: "Score tooltips: full name of each stat and what a point is worth",
      },
      {
        fr: "Licence AGPL-3.0, avec les crédits à FoE Helper pour les récompenses des places",
        en: "AGPL-3.0 license, crediting FoE Helper for the place rewards",
      },
    ],
  },
  {
    version: "1.0.0-alpha.2",
    date: "2026-10-20",
    changes: [
      {
        fr: "Recherche de bâtiments depuis la barre du haut (Ctrl+K), en français et en anglais",
        en: "Building search from the header (Ctrl+K), in English and French",
      },
      {
        fr: "Chaînes d'amélioration complètes sur les fiches (Sylvestre, Arcadien…)",
        en: "Complete upgrade chains on building pages (Sylvan, Arcadian…)",
      },
      {
        fr: "Noms courts pour les étapes de chaîne",
        en: "Short names for chain steps",
      },
      {
        fr: "L'âge choisi est mémorisé entre deux visites",
        en: "The selected age is remembered between visits",
      },
    ],
  },
  {
    version: "1.0.0-alpha.1",
    date: "2026-10-20",
    changes: [
      {
        fr: "Wiki des bâtiments spéciaux : stats par âge, valeur par case, tri par colonne",
        en: "Special buildings wiki: stats by age, value per tile, sorting by column",
      },
      {
        fr: "Score de rentabilité personnalisable et choix des colonnes",
        en: "Customizable efficiency score and column picker",
      },
      {
        fr: "Carte au survol et page dédiée pour chaque bâtiment",
        en: "Hover card and a dedicated page for each building",
      },
      {
        fr: "Classement par source : événements, Incursions quantiques, Champs de bataille de guilde…",
        en: "Sorted by source: events, Quantum Incursions, Guild Battlegrounds…",
      },
      {
        fr: "Icônes des stats, thème clair ou sombre, français et anglais",
        en: "Stat icons, light or dark theme, English and French",
      },
    ],
  },
]
