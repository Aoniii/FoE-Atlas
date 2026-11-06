# FoE Atlas

Copyright (C) 2026 Aoni

This program is free software: you can redistribute it and/or modify it under the terms of the
GNU Affero General Public License as published by the Free Software Foundation, either version 3
of the License, or (at your option) any later version. See [LICENSE](LICENSE).

## Third-party data

- **Every building of the game** (`data/game-buildings.json`: values per age, size, road,
  chains and sets) comes from the game's own building definitions, read in FoE Helper city
  exports (`pnpm game-data`); the City tab also reads them in the player's own export. The
  reading of those definitions (`src/core/game-definitions.ts`) is adapted from
  [FoE Helper](https://github.com/mainIine/foe-helfer-extension) (`city-buildings.js`), licensed
  under the GNU AGPL v3. English and French names and pictures come from the official wiki
  (`data/wiki-pages.json`, `pnpm wiki-pages`).
- **Great Buildings since the prestige rework** (`data/gb-prestige.json`: bonuses at the game's
  breakpoints, first level costs) come from the game's own data, read in a network capture of
  the live servers (`pnpm har-extract`, then `pnpm gb-prestige`). Their icons
  (`public/bonus-icons/`) are cut from the game's icon sheet by `pnpm gb-prestige`.
- **Great Building level costs, patron rewards and bonus curve** follow the rules of
  [FoE Helper](https://github.com/mainIine/foe-helfer-extension) (`src/core/gb-prestige.ts`; the
  cost steps of each building in `data/gb-rewards.json`, `pnpm gb-rewards`), licensed under the
  GNU AGPL v3.
- **Historical allies** (`data/allies.json`: boosts, production and limited bonuses by
  rarity and level) come from the game's own definitions, read in a network capture of the
  live servers (`pnpm har-extract`, then `pnpm allies`), and from the official Forge of
  Empires wiki (English names and texts, pictures, Valor Tokens).
- **Events** (`data/events/`: quests, rival quests, prize lanes, as seen on the beta server)
  come from [foebeta.com](https://foebeta.com/events/). Refresh them with `pnpm events`.
- **Buildings, Great Buildings, images and icons** come from the official Forge of Empires wiki
  and game CDN. Forge of Empires is a trademark of InnoGames GmbH; FoE Atlas is an unofficial
  fan project.
