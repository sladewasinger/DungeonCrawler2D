# Finite generation barrier crossings

- Task: `2026-08-03-finite-barrier-crossings`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder James`
- Scope: finite generation wall-envelope, territory-structure, and connector
  admission paths plus focused topology/preview evidence
- Preserve: authored room safety, feature-port invariants, normal terrain
  rendering, editor/admin surfaces, and unrelated dirty worktree changes.

## Goal

Prevent stage-3-and-later finite generation from producing long, thick,
impassable wall runs that divide large portions of the dungeon. Every authored
room, territory structure, and required feature must remain reachable through
intentional 1–2 tile doorways or equivalent controlled crossings.

## Plan

- [x] Reproduce the long barriers from the stage-3 preview and identify
      whether they are room envelopes, territory stamps, maze walls, or route
      geometry.
- [x] Enforce bounded wall-envelope crossings during generation without
      deleting required feature geometry or weakening connectivity validation.
- [x] Verify no ordinary playable route is split by a long sealed barrier and
      that authored rooms/features retain their intended walls and doors.
- [x] Check stage previews and the final finite floor, then move this same card
      through review and finalization.

## Decisions

- Do not solve this by blindly punching random holes in authored features.
- Crossings must be deterministic, deliberate, and represented in topology so
  runtime movement and preview visualization agree.
- A wall may remain visually long when it bounds a room, but it must not span
  the playable floor without controlled access points.

## Handoff

- Changed:
  - `packages/engine/src/world/generate/connections/bridges/finiteMazeCrossings.ts`
    scans deterministic long horizontal/vertical maze-wall barriers, rejects
    room-wall/protected cells, and admits bounded 1–2 tile Transition apertures
    only when opposite carved regions are present. Each admitted aperture is a
    real protected connector consumed before region validation.
  - `packages/engine/src/world/generate/finiteFloorMazeGeneration.ts` seeds the
    crossings during maze fill and publishes them in the stage trace.
  - `packages/engine/src/world/generate/finiteFloor.ts` and
    `packages/engine/src/world/generate/finiteFloorRegionConnections.ts` carry
    those connectors into region union. Redundant unions retain their physical
    connector in the final topology while mergeCount counts only actual DSU
    merges, so loop/connectivity accounting is not fabricated.
  - `packages/engine/src/world/generate/finiteFloorMaze.ts` owns the shared
    maze-region adjacency helper used by the crossing path.
  - `packages/engine/src/world/generate/territories/territoryLayoutPatterns.ts`
    now excludes uncarved territory obstacles from carved-component admission
    and clears their region IDs when stamping them solid. This prevents a
    non-walkable obstacle from being treated as a topology region or as the
    target of a territory backbone bridge.
  - `packages/engine/src/world/generate/connections/bridges/finiteBarrierCrossings.test.ts`
    is the focused regression covering stage-3 crossing ownership, real
    opposite-region admission, protected 1–2 tile apertures, retained final
    connectors, ordinary-room entrances, and final carved-region validity.

- Reproduction/evidence:
  - A completed direct trace for seed `hashString("finite-barrier-crossings")`,
    floor 2, `roomTargetCount: 8` produced all seven stages and eight rooms,
    each with one entrance. At `maze-fill`, the interior unowned-solid scan
    reported a horizontal run of 510 cells and a vertical run of 314 cells
    (finite boundary cells excluded), confirming the owner is maze-wall
    geometry rather than ordinary room envelopes. The later region-connectivity
    stage produced 28 spanning connectors; the final stage produced 52
    connectors and 144 protected routes.
  - The diagnostic test's reduced 96x96 fixture was invalid for the mandatory
    feature contract and failed with disconnected safe-room/stair/arena ports,
    boundary walkable cells, zero retained rooms, and insufficient loops. It
    was removed from the fixture request; no production validation was weakened.
  - The full-size focused regression now passes using the valid 512x512 floor
    fixture: `npx vitest run
    packages/engine/src/world/generate/connections/bridges/finiteBarrierCrossings.test.ts
    --maxWorkers=1 --reporter=verbose` → 1 file / 1 test passed, test body
    15.78s, command 16.11s. The test confirms every maze-fill crossing is
    present in the final connector set; final generation also passes its strict
    required-feature, room-entrance, region, and walkability validation.
  - `npm run lint:working-tree` → passed. The folder-size check reports only
    documented legacy oversized folders; `packages/engine/src/world/generate`
    is 41 direct files against a baseline of 41.

- Remaining/blocker: none for this bounded slice. Full repository gates remain
  parent-owned and are intentionally deferred.

## Review

- Sol implementation review: resolved the maze-wall owner diagnosis with
  deterministic topology-aware apertures. Authored room envelopes and feature
  ports remain protected; no random holes or weakened validation were used.

### Luna review round 1 — approved

- `packages/engine/src/world/generate/connections/bridges/finiteMazeCrossings.ts:22-44,104-143`
  deterministically orders candidates with the supplied seed, admits only
  opposite carved-region crossings, clamps each aperture to 1–2 tiles, and
  rejects carved, authored-room-wall, or protected cells before carving and
  protecting the Transition aperture.
- `packages/engine/src/world/generate/finiteFloorRegionConnections.ts:39-61`
  consumes the maze crossings as preconnected topology, unions their region
  links, retains redundant physical connectors, and counts only actual DSU
  merges. This preserves connector/loop accounting without fabricating
  connectivity.
- `packages/engine/src/world/generate/territories/territoryLayoutPatterns.ts:127-143,204-223,395-426`
  keeps room/protected/feature cells unavailable to territory stamping and
  clears region IDs when an authored territory obstacle is made solid, so
  obstacle cells cannot become bridge targets or topology regions.
- `packages/engine/src/world/generate/connections/bridges/finiteBarrierCrossings.test.ts:7-23,26-50`
  independently passed with the valid full-size floor fixture and confirms
  non-empty opposite-region maze crossings, protected non-loop metadata,
  retention in the final connector set, bounded room entrances, and final
  carved-region validity. Result: 1 file / 1 test passed; test body 16.33s.
- `npm run lint:working-tree` passed. The only folder-size output is the
  documented legacy oversize report; `packages/engine/src/world/generate`
  remains at its 41-file baseline. The exploratory multi-file focused command
  was interrupted before output and is not used as evidence; the card's exact
  regression completed successfully.

No actionable finding remains in this engine-only slice. Status remains
`in-review` for parent final gates; repository-wide gates were not run.

## Memory candidates

- Maze barrier crossings must be admitted from opposite carved regions before
  final region validation; preserving a redundant physical connector is
  separate from counting a DSU merge. This keeps topology metadata and
  walkable geometry aligned without faking loop/connectivity metrics.
