# Lighting, minimap, and entity occlusion

- Task: `2026-08-03-lighting-minimap-occlusion`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder James`
- Scope: client frame lighting, ground-light/entity presentation, terrain-backed
  minimap layers, and focused terrain-lighting integration tests
- Preserve: `The standalone /editor route, /admin operational surface,
  generation code, and unrelated dirty worktree changes.`

## Goal

Make wall occlusion and navigation presentation consistent: player light must
stop at blocking walls, the minimap must retain terrain definition while
showing entities, and enemies and pets behind walls must receive the same
readable occlusion treatment as players.

## Plan

- [x] Trace the shared line-of-sight/light and entity presentation paths for
      open rooms, narrow corridors, and wall-adjacent actors.
- [x] Apply the smallest shared correction without changing combat hitboxes or
      the finite map model.
- [x] Add focused behavior tests for wall-blocked light, terrain-bearing
      minimap output, and enemy/pet occlusion presentation.
- [x] Record focused validation and hand off to review.

## Decisions

- Preserve the intentional bounded light radius; only fix light leaking
  through blockers.
- Keep minimap terrain and entity layers separate so one cannot erase the
  other.

## Implementation

- Player ground light retains the configured radius and presentation budget,
  but topology now rejects non-walkable floor walls and uses bounded indexed
  line-of-sight checks for every queued cell. Compatibility room lighting stays
  on its authored-room path; finite and ordinary dungeon cells use the same
  wall/height barrier contract.
- The shared `syncEntityOcclusion` path is used by players, monsters, and pets.
  Occlusion ghosts clone each body's current texture and animation frame, so
  native pet sheets are never asked for world-atlas frames. Ghost lifecycle and
  crop/depth behavior remain separate from collision and combat hitboxes.
- Minimap terrain is cached from finite indexed height/walkability data without
  materializing finite chunks, while authored room minimap requests admit only
  the bounded visible room chunk window. `MinimapCanvasRenderer` draws the
  terrain canvas first and entity/landmark markers afterward.

## Handoff

- Changed paths:
  - `packages/client/src/render/lighting/ground/playerGroundLight.ts`
  - `packages/client/src/render/lighting/ground/groundLightVisibility.ts`
  - `packages/client/src/render/lighting/ground/playerGroundLightPass.ts`
  - `packages/client/src/render/lighting/ground/playerGroundLightPool.ts`
  - `packages/client/src/render/lighting/ground/playerGroundLightDrawing.ts`
  - `packages/client/src/render/lighting/ground/playerGroundLightLayers.ts`
  - `packages/client/src/render/lighting/ground/playerGroundLightPresentation.ts`
  - `packages/client/src/render/lighting/ground/roomGroundLight.ts`
  - `packages/client/src/render/entities/geometry/occlusion.ts`
  - `packages/client/src/render/entities/geometry/occlusionTestSprite.ts`
  - `packages/client/src/render/entities/player/playerChrome.ts`
  - `packages/client/src/render/entities/visuals/monsterVisual.ts`
  - `packages/client/src/render/entities/pets/petVisual.ts`
  - `packages/client/src/scenes/dungeon/frame/frameSync.ts`
  - `packages/client/src/scenes/dungeon/hud/minimap/minimapTerrainCache.ts`
  - `packages/client/src/render/lighting/ground/playerGroundLight.test.ts`
  - `packages/client/src/render/lighting/ground/playerGroundLightPool.test.ts`
  - `packages/client/src/render/lighting/ground/playerGroundLightLayers.test.ts`
  - `packages/client/src/render/entities/geometry/occlusion.test.ts`
  - `packages/client/src/scenes/dungeon/hud/minimap/minimapTerrainCache.test.ts`
  - `packages/client/src/ui/hud/model/minimap/minimapMarkerRendering.test.ts`
- Focused client validation:
  - `npx vitest run packages/client/src/render/lighting/ground/playerGroundLight.test.ts packages/client/src/render/lighting/ground/playerGroundLightPool.test.ts packages/client/src/render/lighting/ground/playerGroundLightLayers.test.ts packages/client/src/render/entities/geometry/occlusion.test.ts packages/client/src/scenes/dungeon/hud/minimap/minimapTerrainCache.test.ts packages/client/src/scenes/dungeon/hud/minimap/minimapEntityMarkers.test.ts packages/client/src/ui/hud/model/minimap/minimapMarkerRendering.test.ts --maxWorkers=1`: **7 files, 53 tests passed**.
  - World-construction minimap fixtures use explicit **30-second local
    timeouts** under parallel-load conditions; assertions are unchanged.
  - `npm run typecheck -w @dc2d/client`: **passed** (client and service-worker
    TypeScript projects).
  - Changed-slice ESLint: **passed**.
- No server was started and no port was used; 8787 was untouched.
- Preserved generation, editor/admin, gameplay collision/hitboxes, and the
  bounded performance budgets.

## Review

### Luna approval review — 2026-08-03

Status: `in-review`.

Findings: None.

Evidence:

- `packages/client/src/render/lighting/ground/playerGroundLight.ts:114-146`
  keeps ground-light traversal bounded by the configured radius/cell budget,
  while `groundLightVisibility.ts:28-61` rejects non-walkable surfaces, excess
  height steps, and blocked line-of-sight cells. The focused tests cover finite
  walls, non-walkable floor walls, chasms, raised walls, room compatibility,
  and pool/layer caps.
- `syncEntityOcclusion` is shared by player, monster, and pet presentation at
  `playerChrome.ts:111-113`, `monsterVisual.ts:97-103`, and
  `petVisual.ts:119-127`. `occlusion.ts:89-103,158-183` clones the body's
  current texture/frame and applies the bounded, cropped ghost; focused tests
  cover enemy/pet height behavior and native pet texture/frame sources.
- `minimapCanvasRenderer.ts:53-76` draws the terrain layer before entities and
  landmarks. `minimapTerrainCache.ts:16-35,72-112` uses direct finite height /
  walkability reads and bounded authored-room chunk admission. The minimap
  tests verify terrain remains beneath entity markers and finite cache reuse /
  refresh behavior.
- The exact focused handoff command passed: **7 files / 53 tests**.
- Changed-slice ESLint passed. All scoped lighting/entity/minimap directories
  are within the folder-size limit. `npm run lint:working-tree` reports only
  the unrelated adjacent pre-existing `packages/client/src/admin/map/camera`
  folder-size failure and legacy notices.

The lighting-minimap-occlusion slice is ready for parent final gates. No
editor, admin, engine, performance, server, or subagent work was performed.

## Memory candidates

- None.

## Finalization — 2026-08-03

- Final-gate scope: lighting, minimap terrain, and entity occlusion slice
  only; combined repository gates remain parent-owned.
- Final evidence: 7 focused files and 53 tests passed; client typecheck,
  changed-slice ESLint, and scoped folder-size checks passed.
- The bounded ground-light and native-texture ghost behavior is covered by
  focused tests; full browser traversal remains a combined acceptance step.
- Master roadmap: lighting/minimap/occlusion slice complete; runtime
  performance and remaining finite-dungeon slices remain active/planned.
