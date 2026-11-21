# Floor-3 prewarm topology repair

- Task: `2026-08-03-floor3-prewarm-topology`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `in-review`
- Parent: `primary thread`
- Coder: `sol-coder James`
- Scope: `packages/engine/src/world/generate/**` finite topology/repair paths,
  `packages/game-server/src/floors/floorRegistryArtifact.test.ts`, and focused
  generation/prewarm tests only
- Preserve: client rendering/editor/admin, combat, population policy,
  deployment, and unrelated dirty worktree changes.

## Goal

Make the deterministic production floor-1 → floor-2 → floor-3 prewarm chain
generate, validate, install, and hand off floor 3 without weakening required
walkable-cell, feature-port, or identity checks.

## Plan

- [x] Reproduce the exact `floor-registry-artifact` identity and trace the
      disconnected required cells near `23..26,-124`.
- [x] Repair the finite topology or deterministic connectivity pass at the
      smallest valid architectural boundary; do not suppress validation or
      change the seed.
- [x] Prove floor-3 artifact creation and authoritative handoff through the
      production prewarm test.
- [x] Record focused evidence and move this same card to `03_review/`.

## Decisions

- Required feature ports and walkable cells remain hard invariants.
- Retry may remain a bounded fallback, but success must not depend on blindly
  accepting a disconnected deterministic floor.
- The reproduced cells are ordinary carved cells in region `82`, not a room
  wall, feature port, or protected aperture. In the exact floor-3 retry trace,
  `(23..26,-124..-121)` is a 4x4 open component immediately beside the finite
  boundary and remains unreachable from the spawn component. The failure is
  therefore in seeded-region admission/connection, not in floor identity or
  client artifact transfer.
- The first attempted cleanup that removed the component after generic region
  merging was rejected: it changed the required-merge accounting and caused
  ordinary floor-1 attempts to fail with `region connector pass opened ... of
  ... required merges`. The repair must connect or reject this carved region
  before region scoring, without deleting valid ordinary corridors afterward.
- Room admission/refill preserves deliberate room IDs, so retained rooms can
  have gaps after rejected candidates. Region allocation must therefore use
  the maximum retained room region plus one, not retained-room count. This is
  now centralized at the maze-region boundary in `finiteFloor.ts`.

## Handoff

- Changed: `packages/engine/src/world/generate/finiteFloor.ts` now allocates
  the maze's first region after the maximum retained room region ID. This
  prevents a refill gap from reusing a room region for an unrelated maze
  component. No seed, retry count, validation rule, feature-port rule, or
  client path changed.
- Validation:
  - `npx vitest run packages/game-server/src/floors/floorRegistryArtifact.test.ts -t
    "prewarms the following authoritative floor" --maxWorkers=1`: **1 passed / 3 skipped**.
  - `npx vitest run packages/game-server/src/floors/floorRegistryArtifact.test.ts --maxWorkers=1`:
    **4 passed**.
  - `npx vitest run packages/engine/src/world/generate/finiteFloorTopology.test.ts --maxWorkers=1`:
    **7 passed**.
  - `npm run typecheck -w @dc2d/engine`: **passed**.
  - `npx eslint packages/engine/src/world/generate/finiteFloor.ts`: **passed**.
  - `npm run lint:working-tree`: TypeScript ESLint and config-doc checks passed;
    the command remains nonzero only at the unrelated changed-tree folder-size
    gate for `packages/client/src/admin/map/camera` (13 direct files, no
    baseline). This slice did not touch that folder; engine/generate remains at
    its baseline 41 direct files.
- Remaining: Parent-owned unrelated folder-size blocker is documented above.
  This card's engine/server implementation and floor-3 prewarm handoff are
  ready for review.

## Review

### Luna review round 1 — approved

- Scope review: approved. The repair is confined to finite engine region-ID
  allocation and the floor-registry artifact/prewarm test; no editor/admin or
  client paths were changed or relied on for acceptance.
- `finiteFloor.ts:144,172-176` starts maze regions after the maximum retained
  room region ID. `registerRoomEntrances()` clears rejected room cells and
  their region IDs, so refill gaps cannot be reused by maze components and no
  valid retained room or feature region is overwritten. Seed derivation,
  retry bounds, required validation, feature-port admission, and artifact
  identity logic remain intact.
- Independent focused evidence: `floorRegistryArtifact.test.ts` passed 1
  file/4 tests, including the floor-1 → floor-2 → floor-3 prewarm and
  authoritative artifact handoff; `finiteFloorTopology.test.ts` passed 1
  file/7 tests, including the reproduced seeded-region regression, spanning
  connector invariant, required corridor/feature/elevation checks, and
  protected movement semantics. Engine typecheck and scoped ESLint for
  `finiteFloor.ts` passed.
- No validation was weakened: the generator still throws after its bounded
  retry loop when failures remain, and the artifact tests retain strict
  fingerprint/presence assertions. The documented unrelated client folder-size
  blocker remains context only.
- No actionable findings remain. Status intentionally remains `in-review` for
  parent gates.

## Finalization

- Finalization gate: focused artifact suite, finite topology suite, engine
  typecheck, and scoped ESLint all passed; the unrelated admin camera
  folder-size gate remains owned by the final-gates card.
- Scope check: only the finite engine region allocation and prewarm artifact
  evidence changed for this slice. Editor/admin, combat, population, and
  deployment surfaces were preserved.
- Status: `complete`

## Memory promotion

- Promoted to `agent-memory/bugs/regressions.md`: retained room IDs can have
  gaps after rejected candidates; maze region allocation must begin after the
  maximum retained room region ID, never after retained-room count.
