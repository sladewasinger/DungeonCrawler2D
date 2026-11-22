# Forest Landmarks (`packages/engine/src/world/generate/forest/landmarks`)

Parent world docs: [../../../README.md](../../../README.md)

## Deterministic Camps & Ruins

- [`forestLandmarks.ts`](forestLandmarks.ts) — Runs during finite forest floor
  generation before `placeForestProps` to stamp `7×7` **Bandit Camps**
  (`TILE.CampFence` perimeter with entry gates + two `TILE.CampTent`s) and
  `7×7` **Ancient Ruins** (`TILE.RuinPillar` colonnade) onto flat clearings
  outside the spawn buffer, marking `protectedCells` around each footprint.
- Paired server population lives in
  `packages/game-server/src/sim/enemies/population/forestLandmarksPopulation.ts`
  (campfire, unlocked `Bandit Camp Chest` / `Ancient Ruin Chest`, and 3–4 guards).
