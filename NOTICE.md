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
- **Great Building patron rewards** (`data/gb-rewards.json`) and the rush calculation rules come
  from [FoE Helper](https://github.com/mainIine/foe-helfer-extension), licensed under the
  GNU AGPL v3. Refresh them with `pnpm gb-rewards`.
- **Great Building bonuses beyond level 80** (`data/gb-readings.json`) come from
  [FOE Assistant](https://foe-assistant.com). Refresh them with `pnpm gb-readings`.
- **Great Buildings of the beta server** (`data/gb-beta.json`, prestige rework) come from the
  game's own data, read in a network capture of the beta (`pnpm har-extract`, then
  `pnpm gb-beta`). Values between milestone levels and level costs are measured approximations.
  Their icons (`public/beta-icons/`) are cut from the game's icon sheet by `pnpm gb-beta`.
- **Events** (`data/events/`: quests, rival quests, prize lanes, as seen on the beta server)
  come from [foebeta.com](https://foebeta.com/events/). Refresh them with `pnpm events`.
- **Buildings, Great Buildings, images and icons** come from the official Forge of Empires wiki
  and game CDN. Forge of Empires is a trademark of InnoGames GmbH; FoE Atlas is an unofficial
  fan project.
