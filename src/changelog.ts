// Release notes shown on /changelog, newest first. Add an entry with each release.
type Localized = { fr: string; en: string }

export type Release = { version: string; date: string; changes: Localized[] }

export const CHANGELOG: Release[] = [
  {
    version: "1.0.0-alpha.13",
    date: "2026-10-26",
    changes: [
      {
        fr: "Nouvelle section Événements : l'événement d'Halloween 2026 vu sur la bêta, avec ses quêtes principales et journalières traduites en français et les récompenses de chaque palier, d'après foebeta.com",
        en: "New Events section: the Halloween 2026 event seen on the beta, with its main and daily quests and the prizes of each step, from foebeta.com",
      },
      {
        fr: "Données : version du jeu 1.346, nouveaux bâtiments du wiki et bonus des Grands Monuments à jour",
        en: "Data: game version 1.346, new buildings from the wiki and Great Building bonuses updated",
      },
      {
        fr: "Grands Monuments : les bonus de la bêta suivent le même ordre que ceux du jeu actuel, et les bonus en deux parties (nombre et pourcentage, comme Amélioration marchandises) tiennent dans une seule case « 40 × 60 % »",
        en: 'Great Buildings: beta bonuses follow the same order as the live ones, and two-part bonuses (count and percent, like Supply Boost) fit in a single box, "40 × 60 %"',
      },
      {
        fr: "Bâtiments en double retirés : le wiki a parfois deux pages pour un nouveau bâtiment, l'une encore nommée par son code (WIN26E, FELL26A…) ; elles ne font plus qu'un, avec le vrai nom dans chaque langue",
        en: "Duplicate buildings removed: the wiki sometimes has two pages for a new building, one still named by its code (WIN26E, FELL26A…); they are now one, with the real name in each language",
      },
      {
        fr: "Reconstruction : routes tracées deux fois plus vite et les plus droites possible (chaque virage compte), donc plus d'essais et des plans mieux rangés",
        en: "Rebuild: roads laid twice as fast and as straight as possible (every bend counts), so more tries and tidier plans",
      },
      {
        fr: "Reconstruction : bloc libre sur mesure (par exemple 6×6 pour un bâtiment prévu), sinon le plus grand possible ; l'hôtel de ville peut être déplacé aussi (activé par défaut, à décocher pour le garder en place)",
        en: "Rebuild: a free block of a chosen size (6×6 for a planned building, say), else the biggest one; the town hall may move too (on by default, untick to keep it in place)",
      },
      {
        fr: "Ville : bouton sur chaque ligne du tableau pour marquer les bâtiments que tu vas supprimer (pas assez rentables) ; la reconstruction les laisse de côté",
        en: "City: a button on each line of the table to mark the buildings you will delete (not worth it); the rebuild leaves them out",
      },
    ],
  },
  {
    version: "1.0.0-alpha.12",
    date: "2026-10-26",
    changes: [
      {
        fr: "Accueil : nouvelle mise en page, avec ce que font le wiki et l'onglet Ville et un lien vers chacun ; contact par GitHub",
        en: "Home: new layout, with what the wiki and the City tab do and a link to each; contact through GitHub",
      },
      {
        fr: "Ville : bouton « Reconstruire la ville », qui réorganise ta ville avec moins de routes et toutes les cases libres en un seul bloc ; le plan s'affiche sur la carte, à comparer avec ta ville actuelle, avec un bilan à la fin (routes, cases libres, bloc libre)",
        en: 'City: a "Rebuild the city" button rearranging your city with fewer roads and every free tile in one block; the plan shows on the map, to compare with your current city, with a summary at the end (roads, free tiles, free block)',
      },
      {
        fr: "Reconstruction : l'hôtel de ville reste en place, les bâtiments gardent leur sens, chaînes et ensembles restent collés, les routes doubles partent de l'hôtel de ville en blocs 2x2, et les bâtiments d'une même famille se regroupent, rangés par niveau puis par âge",
        en: "Rebuild: the town hall stays in place, buildings keep their direction, chains and sets stay together, two-lane roads start from the town hall in 2x2 blocks, and buildings of a family gather, in level then age order",
      },
      {
        fr: "Reconstruction : recuit simulé parti de ta ville ou de rangées le long des rues, routes retracées au plus court à chaque essai, zones refaites en rangées le long d'une rue, rangement MaxRects des bâtiments sans route ; le calcul utilise tous les cœurs du processeur (des recherches qui s'échangent leurs meilleurs plans), avec une durée réglable (5 min par défaut) et une barre de progression",
        en: "Rebuild: simulated annealing from your city or rows along streets, roads routed again by shortest paths at each try, zones redone in rows along a street, MaxRects packing of the buildings without a road; it uses every core of the processor (searches sharing their best plans), with a time to set (5 min by default) and a progress bar",
      },
    ],
  },
  {
    version: "1.0.0-alpha.11",
    date: "2026-10-25",
    changes: [
      {
        fr: "Tailles : celles du wiki étaient lues à l'envers (« 3x2 » donne la longueur d'abord) ; les Grands Monuments et les bâtiments connus du seul wiki ont maintenant le bon sens, comme dans le jeu",
        en: 'Sizes: the wiki\'s were read the wrong way round ("3x2" gives the length first); Great Buildings and buildings known only from the wiki now face the right way, as in the game',
      },
      {
        fr: "Ville : carte dans la vue du jeu (en losange), case par case, chaque bâtiment à sa place dans la couleur de son score (Grands Monuments en blanc, maillons d'une chaîne dans la couleur de leur départ) ; le survol montre le score et éclaire tous les bâtiments de la même ligne, un clic ouvre la fiche. Terrain libre en noir et routes en marron après une mise à jour de la ville",
        en: "City: map in the game's view (diamond-shaped), tile by tile, each building in place in its score's color (Great Buildings white, chain links in their start's color); hovering shows the score and lights every building of the same line, a click opens its page. Free land in black and roads in brown after updating the city",
      },
      {
        fr: "Carte de la ville : barre de recherche pour trouver un bâtiment, et bouton « Voir sur la carte » sur chaque ligne du tableau ; les bâtiments trouvés clignotent, les autres s'estompent",
        en: 'City map: a search bar to find a building, and a "Show on the map" button on each line of the table; the buildings found blink, the others fade',
      },
    ],
  },
  {
    version: "1.0.0-alpha.10",
    date: "2026-10-25",
    changes: [
      {
        fr: "Wiki : nouveau type « Objets », les kits d'amélioration et de sélection du jeu (944), avec leur fiche : ce que chacun place ou améliore",
        en: 'Wiki: new "Items" type, the game\'s upgrade and selection kits (944), each with its page: what it places or upgrades',
      },
      {
        fr: "Fiche d'un bâtiment : les objets qui le placent, qui donnent ce niveau ou qui l'améliorent au suivant ; niveaux reliés selon les parcours d'amélioration du jeu, branches comprises (Navire royal, pirate ou marchand)",
        en: "Building page: the items that place it, give this level or upgrade it to the next; levels linked by the game's upgrade paths, branches included (Royal, Pirate or Trader Ship)",
      },
      {
        fr: "Recherche : les objets aussi",
        en: "Search: items too",
      },
      {
        fr: "Ville : bouton « Mettre à jour » pour remplacer la ville choisie par un nouvel export (fichier ou collage), en gardant son numéro",
        en: 'City: "Update" button to replace the selected city with a new export (file or paste), keeping its number',
      },
    ],
  },
  {
    version: "1.0.0-alpha.9",
    date: "2026-10-22",
    changes: [
      {
        fr: "Score : les bonus en % (PF, ressources, guilde) valent un pourcentage de ta production par jour, à régler sous chaque case (2 000 PF, 1 500 ressources et 500 de guilde par défaut) ; l'onglet Ville la calcule depuis ta ville. Ils comptaient bien trop jusqu'ici (1 % de PF valait 200 PF)",
        en: "Score: percent boosts (FP, goods, guild goods) are worth a share of your daily production, set under each box (2,000 FP, 1,500 goods and 500 guild goods by default); the City tab computes it from your city. They counted far too much so far (1% FP was worth 200 FP)",
      },
      {
        fr: "Monuments : pastilles Or et Cuivre sur la grille selon leur rang sur la bêta, et pastille Or devant les nouveaux effets or",
        en: "Great Buildings: Gold and Copper chips on the grid by their beta tier, and a Gold chip before the new gold effects",
      },
      {
        fr: "Wiki : tous les bâtiments du jeu (maisons, productions, marchandises, militaires, culture, décorations et tous les événements), avec les valeurs du jeu lui-même, et un score pour chaque type",
        en: "Wiki: every building of the game (houses, production, goods, military, culture, decorations and every event), with the game's own values, and a score for every type",
      },
      {
        fr: "Ville : tous tes bâtiments notés ; une chaîne compte avec ses maillons attachés (Sanctuaire du panda +4), un bâtiment d'ensemble avec les bonus de ses voisins ; il ne reste que l'hôtel de ville non noté",
        en: "City: all your buildings rated; a chain counts with its attached links (Panda Sanctuary +4), a set building with its neighbours' bonuses; only the town hall stays unrated",
      },
      {
        fr: "Bâtiments à production au choix (Hôtel d'insectes…) : rendement par jour sur 3 collectes de 8 h, moitié PF moitié ressources ; les bâtiments hors de la carte (ports arctique et océanique, taverne, navires…) ne comptent plus dans la ville",
        en: "Buildings with a choice of productions (Insect Hotel…): daily yield over 3 collections 8 hours apart, half FP half goods; buildings outside the map (Arctic and Oceanic harbours, tavern, ships…) no longer count in the city",
      },
      {
        fr: "Ville : les bâtiments que le wiki ne connaît pas sont notés avec leur définition du jeu, tirée de ton export FoE Helper ; toutes les villes sont couvertes",
        en: "City: buildings the wiki does not know are rated with their game definition, from your FoE Helper export; every city is covered",
      },
      {
        fr: "Fiche d'un bâtiment : section « Bâtiments à lier » (maillons d'une chaîne, bâtiments du même ensemble, avec ce que chacun apporte) ; niveaux que le wiki ne reliait pas (Place des vainqueurs niv. 1 et 2…)",
        en: 'Building page: "Buildings to link" section (chain links, buildings of the same set, with what each adds); levels the wiki did not link (Winners\' Plaza Lv. 1 and 2…)',
      },
    ],
  },
  {
    version: "1.0.0-alpha.8",
    date: "2026-10-21",
    changes: [
      {
        fr: "Onglet Ville : importe ta ville depuis FoE Helper (fichier ou copier-coller) et vois tes bâtiments notés du moins rentable au plus rentable, à ton ère ; plusieurs serveurs possibles, ta ville reste dans ton navigateur",
        en: "City tab: import your city from FoE Helper (file or copy-paste) and see your buildings rated from least to most profitable, at your age; several servers possible, your city stays in your browser",
      },
      {
        fr: "Onglet Ville : bouton de comparaison sur chaque bâtiment, comme dans le wiki",
        en: "City tab: compare button on each building, like in the wiki",
      },
      {
        fr: "Onglet Ville : les Grands Monuments aussi, marqués GM et classés sous 0, avec une option pour les cacher",
        en: "City tab: Great Buildings too, tagged GB and ranked below 0, with an option to hide them",
      },
      {
        fr: "Wiki : la page défile normalement (plus de zone de défilement dans le tableau), colonnes à la largeur de leur contenu",
        en: "Wiki: the page scrolls normally (no more scroll area inside the table), columns as wide as their content",
      },
      {
        fr: "Wiki et Ville : boutons Réinitialiser et Tout décocher sous le réglage du score",
        en: "Wiki and City: Reset and Uncheck all buttons under the score settings",
      },
    ],
  },
  {
    version: "1.0.0-alpha.7",
    date: "2026-10-21",
    changes: [
      {
        fr: "Bêta : effets des monuments repris des données du jeu (refonte du 8 octobre : plus de rang argent, rang or du niveau 101 au 500 pour 21 GM), au lieu de foebeta.com qui n'était plus à jour",
        en: "Beta: Great Building effects from the game's own data (October 8 redesign: no more silver tier, gold tier from level 101 to 500 for 21 buildings), instead of the outdated foebeta.com",
      },
      {
        fr: "Bêta : valeurs exactes aux paliers, très proches entre deux ; coûts approchés",
        en: "Beta: exact values on milestone levels, very close in between; approximate costs",
      },
      {
        fr: "Monuments : niveaux jusqu'à 500",
        en: "Great Buildings: levels up to 500",
      },
      {
        fr: "Monuments : les nouveaux effets or de la bêta dans la liste des bonus, en orange, avec leur icône et leur définition",
        en: "Great Buildings: the beta's new gold effects in the bonus list, in orange, with their icon and definition",
      },
      {
        fr: "Monuments : « ≈ » devant chaque valeur calculée et non vérifiée en jeu (au-delà du niveau 80 et sur la bêta)",
        en: 'Great Buildings: "≈" before every value computed and not checked in game (past level 80 and on the beta)',
      },
    ],
  },
  {
    version: "1.0.0-alpha.6",
    date: "2026-10-21",
    changes: [
      {
        fr: "Monuments : les effets de la bêta (refonte du prestige) sous ceux du jeu, avec leurs rangs cuivre, argent et or, d'après foebeta.com",
        en: "Great Buildings: beta effects (prestige rework) below the live ones, with their copper, silver and gold tiers, from foebeta.com",
      },
      {
        fr: "Monuments : niveau maximum de la bêta, 200 pour un GM n'ayant que des bonus cuivre",
        en: "Great Buildings: beta max level, 200 for a building with copper bonuses only",
      },
      {
        fr: "Grille des monuments : pastille « Bêta » sur ceux qui ont des ligues argent ou or sur la bêta",
        en: 'Great Buildings grid: "Beta" badge on those with silver or gold leagues on the beta',
      },
    ],
  },
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
        fr: "Temple des reliques, Tour de Galata et Forêt tropicale : bonus calculés au-delà du niveau 80, à partir de relevés en jeu",
        en: "Temple of Relics, Galata Tower and Rain Forest Project: bonuses computed beyond level 80, from in-game readings",
      },
      {
        fr: "Monuments : bonus au-delà du niveau 80 (chances, nombres, boosts) repris des relevés de FOE Assistant, jusqu'au niveau 110 à 200 selon le GM",
        en: "Great Buildings: bonuses beyond level 80 (chances, counts, boosts) from FOE Assistant's readings, up to level 110 to 200 depending on the building",
      },
      {
        fr: "Monuments : les bonus sans formule exacte sont estimés avec une courbe approchée au-delà des niveaux connus, au lieu de rester vides",
        en: "Great Buildings: bonuses with no exact formula are estimated with an approximate curve beyond the known levels, instead of staying empty",
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
