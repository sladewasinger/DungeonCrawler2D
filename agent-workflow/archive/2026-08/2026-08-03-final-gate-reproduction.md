# Final-gate failure reproduction

- Task: `2026-08-03-final-gate-reproduction`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder / /root/finite_test_coder (persistent)`
- Scope: `only the 15 final-gate failing test files and their nearest existing test-support paths; workflow records`
- Preserve: `All production paths, unrelated tests, admin/editor work, and release files.`

## Goal

Reproduce and classify each current final-gate failure as stale fixture, worker contention, or a separately authorized product defect before repairs.

## Plan

- [x] Run exact test-name reproductions and record timing/failure evidence.
- [x] Classify each failure and add only necessary test/support paths to follow-on cards.
- [x] Do not repair production behavior in this diagnostic card.

## Decisions

- Use the persistent Sol coder; Luna and Spark remain prohibited.
- Preserve the current dirty-tree fixture migrations while diagnosing the exact
  current state. An isolated pass is contention-only for this checkpoint and is
  not described as a repair made by this card.
- The four lightweight client files also ran as the required small aggregate.
  The aggregate failed in `1.96s` with the same six prompt semantic/test-double
  failures seen in isolation; no timeout or worker starvation reproduced.

### Exact isolated evidence

Every row used `npx vitest run <file> --maxWorkers=1 --reporter=verbose` with
the root setup files intact.

| File | Exact current result | Classification |
| --- | --- | --- |
| `selfInterpolation.test.ts` | `1/3` failed in `6ms`: `renders into the unsimulated tick remainder instead of one tick behind`; expected `-11.84`, received `-12` | Prompt assertion mismatch; separate interpolation semantic/product triage is required. No product defect is established by this card. |
| `playerVisual.test.ts` | `1/1` failed in `564ms`: `updates remote reconnect state and preserves unarmed combat facing`; the `occlusion.js` mock lacks `syncEntityOcclusion` | Stale test double. Scope a client player-visual test-support repair only. |
| `frameInteractionPrompt.test.ts` | `3/3` failed in `3ms/0ms/0ms`; the world stub lacks `downStairwayPositions()` | Stale authored world test double. Scope the frame-prompt test fixture only. |
| `inputAdapters.test.ts` | `1/2` failed in `4ms`: `keeps action gates and body state live after construction`; initial `adapter.canAct` expected `true`, received `false` | Prompt assertion mismatch; separate input-adapter contract triage is required. No product defect is established by this card. |
| `selfInterpolationWalls.test.ts` | `3/3` failed in `6ms/2ms/2ms`; every case throws `seed fixture has no east-facing wall approach` | Stale authored fixture/search premise. Scope the explicit Sandbox wall fixture and this test only. |
| `enemyLifecycle.test.ts` | `1/2` failed in `123ms`: `enemies chase and hurt players; kills drop loot and respawn far away`; throws `missing respawn snapshot` | Prompt lifecycle-fixture failure. Give server enemy respawn setup/contract its own triage card; no gameplay repair is authorized here. |
| `districtGeneration.test.ts` | `4/4` passed; cases `235ms/11ms/1ms/0ms` | Isolated pass; contention-only at this checkpoint. |
| `runtimeChunk.test.ts` | `8/8` passed; real compatibility case `188ms`, remaining cases `0-23ms` | Isolated pass; contention-only at this checkpoint. |
| `walls.test.ts` | `1/6` failed in `387ms`: `authored raised cells remain finite Floor surfaces`; raised cell height expected `> 0`, received `0` | Prompt assertion/fixture-identity mismatch after prepared-floor setup. Scope an engine wall-fixture semantic triage card; no production defect is established here. |
| `worldBedrock.test.ts` | `2/2` passed in `390ms/242ms` | Isolated pass; contention-only at this checkpoint. |
| `populationRooms.test.ts` | `1/4` failed in `2ms`: `places eligible loot candidates at active room centers`; throws `Expected an eligible room-loot chunk in the scan range` | Stale prepared-floor scan fixture. Scope this test and nearest existing population fixture helper only. |
| `biome.test.ts` | `2/2` passed in `357ms/246ms` | Isolated pass; contention-only at this checkpoint. |
| `bossArenaRingShardA.test.ts` | `2/2` passed in `195ms/13ms`, including the real first-seed assertion and seeds `0-7` matrix | Isolated pass; contention-only at this checkpoint. |
| `spawnRoomExit.test.ts` | `1/1` passed in `276ms` | Isolated pass; contention-only at this checkpoint. |
| `sim/floors/boss.test.ts` | `6/6` passed in `464ms/50ms/45ms/33ms/33ms/32ms` | Isolated pass; contention-only at this checkpoint. |

### Recovery routing

- No isolated timeout, hook timeout, or import delay reproduced in any of the
  15 files. Seven files pass isolated and require no edits from this evidence.
- Create bounded stale-fixture/test-double repairs for player visual, frame
  prompt, wall interpolation, and population-room coverage. Do not combine
  those unrelated domains.
- Route self interpolation, input adapter, enemy lifecycle, and engine wall
  semantics to separate domain triage. Their prompt isolated failures justify
  investigation, not an assertion rewrite or production change in this card.
- After the scoped fixture/semantic cards are reviewed, rerun the bounded
  15-file aggregate before considering worker-pool changes. This checkpoint
  provides no evidence for timeout inflation, skips, retries, or global worker
  configuration changes.

## Handoff

- Changed: This workflow evidence record only; no production, test, or test-
  support files were modified.
- Validation: Exact isolated single-worker runs completed for all 15 files;
  required four-file lightweight aggregate completed separately. Current
  result: 7 passing files, 8 promptly failing files, 0 timeout-class failures.
- Remaining: Independent review, then parent-created bounded follow-on cards
  using the recovery routing above. The full suite was intentionally not rerun.

## Review

### Round 1 — `2026-08-03` — `sol-auditor / /root/finite_fixture_audit`

- Outcome: clean.
- Classification verification: the seven isolated passes are correctly held as
  contention-only evidence for this checkpoint, the four explicit stale test
  doubles/fixtures are routed to test-owned repairs, and the four remaining
  prompt semantic or lifecycle mismatches are routed to independent domain
  triage without authorizing assertion rewrites or production changes.
- Routing verification: each of the eight prompt failures has a bounded domain
  destination, unrelated domains remain separate, and the parent-owned creation
  of follow-on cards after this reviewed diagnostic checkpoint matches the
  sequencing in the master roadmap.
- Validation: no reproduction was rerun because the card records the exact
  single-worker command, failed test, result, timing, and failure kind for all 15
  files plus the required lightweight aggregate; that evidence is sufficient
  for this classification-and-routing-only review.
- Findings: none.
- Resolution: ready for parent finalization and creation of the routed bounded
  follow-on cards.

## Memory candidates

- None.
