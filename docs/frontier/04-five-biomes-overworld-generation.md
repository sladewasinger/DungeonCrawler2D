# Spec 04 — Five Distinct Overworld Biomes

> **Touchpoints**:
> `@dc2d/content` (`src/biomes/biomeCatalog.ts`),
> `@dc2d/engine` (`src/world/types.ts`, `src/world/biomes/macroBiome.ts`, `src/world/biomeSampler.ts`, `src/world/chunkGenerator.ts`, `src/world/propFootprints.ts`),
> `@dc2d/game-server` (`src/sim/wildlife/worldEcology.ts`),
> `@dc2d/client` (`src/render/textures/terrainTextures.ts`, `src/render/textures/terrainTileDetails.ts`, `src/render/world/tileBuilder.ts`, `src/render/shaders/glsl/tilemapGlsl.ts`, `src/render/textures/biomes/biomePropTextures.ts`, `src/render/shaders/ambientParticles.ts`, `src/ui/map/minimapOverlay.ts`).

---

## 1. The 5 Macro-Biomes (`BiomeKind`)

Inside `r < 28` tiles of `(0, 0)`, the world always resolves to `verdant-forest` so the Spawn Glade, river, and starter clearing remain safe and familiar. Beyond `r >= 28` tiles, a low-frequency 2D temperature + moisture fBm field (`macroBiome.ts`) selects seamlessly among 5 distinct regions (with `cursed-ruinlands` weighted outward past `r > 70` tiles so Tier IV terror waits out on the frontier):

| Biome ID | Display Name | Base Danger | Ground Tiles (`GroundKind`) | Signature Props & Harvestables | Wildlife Roster | Ambient Particles |
| --- | --- | --- | --- | --- | --- | --- |
| `verdant-forest` | Verdant Forest | Tier I | `Grass`, `MeadowGrass`, `ForestFloor`, `DirtPath` | `OakTree`, `PineTree`, `Bush`, `Wildflower`, `Boulder` | `wolf`, `boar`, `bear` | Golden sun-motes & fireflies |
| `autumn-woods` | Autumn Woods | Tier II | `AutumnGrass`, `AutumnFloor`, `DirtPath` | `BirchTree` (drops `wood` + `amber-resin`), `MapleTree`, golden `TallGrass`, `Bush` | `wolf`, `bear`, `boar`, `goblin` | Drifting amber & crimson leaves |
| `misty-bog` | Misty Bog | Tier II | `BogMud`, `BogMoss`, `ShallowWater` | `DeadTree`, `GiantMushroom` (drops `bog-spore`/`herb`), `BogReed`, murky pools | `slime`, `spider`, `boar` | Rising glowing teal bog spores |
| `craggy-highlands` | Craggy Highlands | Tier III | `SlateRock`, `AshGround`, `CliffStone`, `MossStone` | `CopperVein`, `IronVein` (plus `sunstone`), `PineTree`, `Boulder` | `orc`, `golem`, `bear`, `wolf` | Drifting ash & ember sparks |
| `cursed-ruinlands` | Cursed Ruinlands | Tier IV | `RuinFlagstone`, `CursedMoss`, `SlateRock` | `CursedCrystal` (drops `shadow-shard`), `DeadTree`, `RuinPillar` | `skeleton`, `golem`, `spider`, `orc` | Eerie violet arcane wisps |

---

## 2. Expanded Terrain Atlas & Shader Contract

`GroundKind` expands cleanly from `0..8` to `0..16`:
- `9`: `AutumnGrass` (warm golden-olive turf)
- `10`: `AutumnFloor` (fallen russet-ochre leaves)
- `11`: `BogMud` (dark peaty marsh silt)
- `12`: `BogMoss` (saturated swamp moss & lichen)
- `13`: `SlateRock` (cool charcoal slate highland stone)
- `14`: `AshGround` (windswept volcanic/granite scree)
- `15`: `RuinFlagstone` (carved dark ancient stone tiles)
- `16`: `CursedMoss` (deep indigo-plum cursed overgrowth)

`terrainTextures.ts` sets `TERRAIN_ATLAS_ROWS = 17` (`136 × 578` px, still tiny and well below mobile `GL_MAX_TEXTURE_SIZE`). `tileBuilder.ts` & `tilemapGlsl.ts` map fringe codes (`1..7`) so transitions between `AutumnGrass`, `BogMoss`, `SlateRock`, and `CursedMoss` blend organically at tile edges.

---

## 3. Biome-Native Harvestables & Prop Footprints

- `BirchTree` & `MapleTree`: Harvested with Axe/hand (`wood`, plus `28%` chance for `amber-resin` on `MapleTree`/`BirchTree`).
- `GiantMushroom`: Harvested by hand/`[E]` or weapon -> drops `bog-spore` + `herb`.
- `CursedCrystal`: Mined with Pickaxe -> drops `shadow-shard` + `stone`.
- `IronVein` in `craggy-highlands` (Tier III+): adds `30%` chance for `sunstone` alongside `iron-ore`.
- `DeadTree` & `BogReed`: atmospheric cover & wood/herb foraging.
