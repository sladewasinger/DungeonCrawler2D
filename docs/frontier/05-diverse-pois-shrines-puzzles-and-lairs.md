# Spec 05 — 17 New Diverse POIs (19 Total): Shrines, Micro-Scenes, Lairs, Puzzles & Friendly Spots

> **Touchpoints**:
> `@dc2d/engine` (`src/world/types.ts`, `src/world/poiLayouts.ts`, `src/world/poiStamper.ts`, `src/world/pois/poiCatalog.ts`, `src/world/pois/shrineLayouts.ts`, `src/world/pois/microLayouts.ts`, `src/world/pois/lairAndPuzzleLayouts.ts`),
> `@dc2d/game-server` (`src/sim/frontier/poiInteractions.ts`, `src/sim/wildlife/worldEcology.ts`, `src/sim/combatSim.ts`, `src/sim/survival/persistenceStore.ts`),
> `@dc2d/client` (`src/render/textures/pois/frontierPoiTextures.ts`, `src/render/world/chunkProps.ts`).

---

## 1. Complete 19-POI Catalog

Beyond the existing **`bandit-camp`** and **`ancient-ruins`**, **17 new POI kinds** give players constant surprises across all 5 biomes:

### A. Interactive Shrines & Waystones (4)
1. **`shrine-swiftness`** (`Wind Shrine`, All Biomes, Common-Uncommon): Stone altar + wind banners. `[E] Activate`: grants `+22%` move speed & `+12` stamina/s for `180s` (`120s` per-player cooldown).
2. **`shrine-vigor`** (`Vigor Wellspring`, Verdant / Autumn / Highlands): Mossy glowing altar. `[E] Activate`: restores full HP + grants `+25` Max HP & `+1.5` HP/s for `240s`.
3. **`shrine-shadow`** (`Shadow Altar`, Bog / Cursed Ruinlands): Dark obsidian shrine. `[E] Activate`: grants `-35%` stealth visibility & `+40%` backstab damage for `180s`.
4. **`ancient-waystone`** (`Ancient Waystone`, All Biomes): Tall cyan-runed obelisk. `[E] Attune`: emits cyan pulse wave and reveals up to **3 nearest undiscovered POIs** within `160` tiles as `?` beacons on your `[M]` Overworld Map!

### B. Rare Environmental Micro-Scenes (6)
5. **`fallen-knight-grave`** (`Fallen Knight's Grave`, Verdant / Autumn / Highlands): Weathered `Gravestone`, sword-plinth vibes, lantern torch, 1 skeleton guard, **knight's chest** (high chance for Iron/Knight armor or blade).
6. **`overturned-cart`** (`Overturned Merchant Cart`, Verdant / Autumn): `BrokenCart` + spilled barrels, `1–2` goblin scavengers, **supply chest** with elixirs, arrows, and merchant curios.
7. **`fairy-ring`** (`Fairy Ring`, Verdant / Misty Bog): Circle of glowing `GiantMushroom`s + `FairyRing` petals, ambient fireflies, peaceful wildlife, **hidden forest chest** with `herb`, `bog-spore`, and nature/stalker gear.
8. **`hollow-great-stump`** (`Hollow Great Stump`, Verdant / Autumn): Massive ancient `GreatStump` with lantern, spider/boar den, **stash chest** inside the hollow.
9. **`sunken-rowboat`** (`Sunken Rowboat`, Misty Bog / Riverlands): Beached `SunkenBoat` + reeds + slime guard, **waterlogged chest** with fishing/explorer loot & rare trinkets.
10. **`hunters-blind`** (`Hunter's Blind`, Autumn / Verdant): Timber blind + campfire + `LoreSign`, **hunter's chest** stocked with bows, arrows, and `Hunter's`-prefixed gear.

### C. Elite / Mini-Boss Lairs (4)
11. **`broodmother-hollow`** (`Broodmother Hollow`, Misty Bog / Deep Forest): Web-draped rock clearing guarded by **Elite Broodmother Spider** (`isElite: true`) + spiderlings, guarding a **Rare+ Brood Chest**.
12. **`orc-totem-ring`** (`Orc Totem Ring`, Craggy Highlands / Autumn): `BoneTotem` ring + roaring campfire + **Elite Orc Warchief** + orc/goblin warband, guarding a **Warchest**.
13. **`golem-forge`** (`Ancient Golem Forge`, Craggy Highlands / Ruinlands): `RunicForge` + glowing ember braziers + **Elite Runic Golem** + skeletons, guarding a **Relic Chest**.
14. **`cursed-obelisk`** (`Cursed Obelisk`, Cursed Ruinlands): Towering violet `CursedObelisk` + `CursedCrystal`s + **Elite Cursed Warden** + skeletons, guarding an **Epic+ Cursed Vault**.

### D. Puzzle / Torch-Trigger Vaults (2)
15. **`brazier-vault`** (`Sealed Brazier Vault`, Ruins / Highlands / Cursed): `3` unlit `BrazierUnlit` pedestals surrounding a **sealed treasure chest** (`sealed: true`) + 2 skeleton guards. Hitting or `[E]`-interacting with a brazier while holding a **Torch** (or `blazing` / `burn` weapon!) ignites it (`BrazierLit` + flickering light). Lighting all 3 unseals the vault chest with a golden chime and unlocks guaranteed **Rare/Epic** treasure!
16. **`sun-dial-ruin`** (`Sundial Sanctum`, Verdant / Autumn / Highlands): `2` sun-braziers flanking a stone plinth + **sealed relic chest**. Lighting both braziers unlocks the sanctum cache (`sunstone` / `radiant` gear).

### E. Rare Friendly / Neutral Camps (2)
17. **`hermits-hut`** (`Hermit's Sanctuary`, Verdant / Autumn / Bog): Safe sanctuary hearth (`inSanctuary` aura!), `HermitHut`, `Workbench`, `Campfire`, `LoreSign` (`[E] Read Note`), and a shared herbalist chest.
18. **`tinker-camp`** (`Tinker's Roadside Camp`, All Biomes): Safe `Campfire`, `Tent`, `Workbench`, `LoreSign`, and a supply chest with tools and elixirs.

---

## 2. Placement & Pacing Rules

- Macro-cell stamping (`poiStamper.ts`) keeps `spawn (0,0)` clean while allowing rich chunk POI coverage (`44%` macro-cell spawn chance, with biome-weighted selection from `POI_CATALOG`).
- Smaller micro-scenes (`radius <= 3`) fit easily even in hilly or wet terrain, ensuring players reliably encounter memorable sights every 20–40 seconds of exploration.
- Interactive POI states (`litBraziers`, `unlockedVaults`) persist across restarts in `world-save.json` and sync cleanly to clients via `WorldDeltaSnapshot`.
