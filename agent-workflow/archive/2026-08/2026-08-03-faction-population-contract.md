# Territory faction population contract

- Task: `2026-08-03-faction-population-contract`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder James`
- Scope: `packages/game-server/src/sim/enemies/populationRoster.ts`,
  `packages/game-server/src/sim/enemies/population/packs.ts`, related
  population tests, and territory ownership policy definitions only
- Preserve: `The explicit shared chort/pitchbloom encounter rule, combat
  tuning, editor/admin, terrain, and unrelated dirty worktree changes.`

## Goal

Make territory ownership materially control ordinary enemy populations. Every
selectable territory catalog must resolve to a declared faction policy, global
outliers must be explicit and bounded, and ordinary packs must not silently
fall back to unrelated biome rosters. Preserve the product rule that chorts
and pitchblooms spawn together when the pack rule requires them.

## Plan

- [x] Inventory ownership tags and declared roster policies against the
      selectable territory catalog.
- [x] Define missing policies or narrow catalog selection to supported policy
      identities; make shared pack members explicit rather than accidental.
- [x] Add deterministic tests proving ordinary pack membership stays within
      its territory policy and documented outliers remain bounded.
- [x] Record focused validation and hand off to review.

## Decisions

- Ownership tags now resolve through `population/territoryFactionPolicies.ts`.
  An unknown or empty tag set throws a data-contract error instead of falling
  back to the biome roster.
- The catalog's current ownership tags all have at least three valid content
  enemy IDs, while the biome roster remains the path for non-territory worlds.
- Keep the shared chort/pitchbloom pairing as an explicit, tested encounter
  rule rather than treating it as faction leakage. Pack construction imports
  the named pair contract and retains its atomic cap behavior.

## Handoff

- Changed:
  - `packages/game-server/src/sim/enemies/population/territoryFactionPolicies.ts`
  - `packages/game-server/src/sim/enemies/population/territoryFactionPolicies.test.ts`
  - `packages/game-server/src/sim/enemies/populationRoster.ts`
  - `packages/game-server/src/sim/enemies/population/packs.ts`
- Focused validation:
  - `npx vitest run packages/game-server/src/sim/enemies/population/territoryFactionPolicies.test.ts --maxWorkers=1`: **2 passed**.
  - `npx vitest run packages/game-server/src/sim/enemies/populationCohesion.test.ts -t "uses territory ownership" --maxWorkers=1`: **1 passed**.
  - The first focused population run also covered `nearSpawn.test.ts`: **7 passed**; `populationCohesion.test.ts` had **9 passed, 2 default-5s timeouts** in existing World-construction tests (`spawns a tight pack...`, `uses the configured pack bounds...`). No assertions failed and no timeout was changed in this slice.
  - `npm run typecheck -w @dc2d/game-server`: **passed**.
  - Changed-slice ESLint for the five changed source/test files: **passed**.
  - `npm run lint:working-tree`: code/config checks passed; folder-size gate retains unrelated baseline warnings and fails on pre-existing `packages/client/src/admin/map/camera` (13 direct files, limit 12). The faction files did not add a folder-size violation.
- Remaining: parent/reviewer should route the two eager-generation fixture timeouts to the finite-fixture-migration work; they are outside this faction policy scope.

## Review

### Luna review round 1 — approved

- Scope review: approved. The faction slice is limited to the territory policy
  table, roster selection, pack construction, and population tests. No editor,
  admin, terrain, combat-tuning, or unrelated dirty-worktree changes were
  included in the reviewed paths.
- `territoryFactionPolicies.test.ts` independently passed 1 file/2 tests. Its
  catalog-derived tag set covers every ownership tag exposed by the selectable
  territory catalog and rejects undeclared tags; the policy entries each have
  at least three IDs. `populationRoster.ts:100-115` uses the territory policy
  whenever a finite territory is present and retains biome selection only for
  non-territory worlds.
- `packs.ts:16,35-48` consumes the named
  `CHORT_PITCHBLOOM_PAIR` contract as an atomic required pair. The focused
  cohesion and near-spawn assertions cover pair presence, atomic cap behavior,
  bounded optional/global outliers, and territory-owned roster selection.
- Independent checks: near-spawn suite passed 1 file/7 tests; the focused
  policy test passed 1 file/2 tests; the game-server typecheck passed; scoped
  ESLint passed across all changed source/test/support paths. The two cohesion
  tests reported in the handoff reproduced as default-5s timeouts with no
  assertion failures, then both passed with `--testTimeout=30000`; they are
  unchanged finite-World construction budget failures, not faction-policy
  failures. The documented unrelated folder-size warning remains context only.
- No actionable findings remain in this slice. Status intentionally remains
  `in-review` for parent gates.

## Memory candidates

- None.

## Finalization — 2026-08-03

- Parent scope check: passed; the changed population files remain within the
  approved faction contract.
- Finalization disposition: archived after Luna approval and focused
  validation. The eager-generation fixture timeout remains tracked by the
  separate fixture slice and is not silently absorbed here.
