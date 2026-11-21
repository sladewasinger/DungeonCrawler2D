# Normal-atlas terrain wall-cap acceptance

- Task: `2026-08-03-terrain-live-visual-acceptance`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `in-review`
- Parent: `primary thread`
- Coder: `sol-coder James`
- Scope: current terrain presentation/chunk-root paths and an explicit-port
  Playwright/browser acceptance harness or evidence only; no editor/admin
  redesign
- Preserve: finite generation topology, editor workflow, admin operational
  separation, combat, and unrelated dirty worktree changes.

## Goal

Close the retained normal-atlas rendering regression by proving directional
reloads in Maze and Flooded Pools (or another independently distinct second
territory) show correct bedrock caps, continuous exposed rims, no striped
material bands/void bleed, and no page errors.

## Plan

- [x] Reproduce the directional north/south chunk-root traversal on isolated
      client/server ports without using `8787`.
- [x] Capture both territory materials and inspect the retained terrain roots,
      wall caps, cliff rims, and page/console errors.
- [x] Fix only a confirmed rendering defect within the scoped terrain paths;
      otherwise record browser evidence that closes the regression.
- [x] Move this same card through review with screenshots or equivalent
      machine-readable evidence.

## Decisions

- `/editor` generation evidence does not substitute for live Phaser terrain
  roots.
- Normal-atlas directional evidence is required; debug materials are not
  sufficient.

## Handoff

- Changed: No production terrain files. The current normal-atlas terrain path
  was exercised unchanged; no confirmed stale-root, fallback-material, or
  finite-boundary planner defect was found.
- Browser command/evidence:
  - `GAME_PORT=8890 npx tsx src/main.ts` from `packages/game-server` and
    `npx vite --host 127.0.0.1 --port 5190 --strictPort` from `packages/client`.
  - Playwright loaded
    `http://127.0.0.1:5190/?runtimeTrace=1&server=ws://127.0.0.1:8890`, entered
    the dungeon, used the existing `/tp 0 0` finite-floor debug path, held W
    for 5 seconds, then S for 5 seconds, and captured:
    `/tmp/dc2d-terrain-acceptance-before.png` and
    `/tmp/dc2d-terrain-acceptance-after-north-south.png`.
  - The Goblin/Maze view had 759 floor draws, 311 bedrock draws, 66 south-face
    draws, and 225 cliff-edge draws both before and after traversal. Active and
    retained mesh keys matched; the sole root reported
    `graphicsVisible:false`, `atlasVisible:true`. No page, console, or failed
    request errors occurred.
  - The same fresh run used `/tp 150 -126`, a deterministic Silkbound
    second-territory floor coordinate, and captured
    `/tmp/dc2d-terrain-silk-before.png` and
    `/tmp/dc2d-terrain-silk-after-north-south.png`. The view emitted
    `territory-spider-floor`/`territory-spider-wall` plus bedrock roles, with
    462/134/45/109 floor/bedrock/south-face/cliff counts before and
    759/71/19/87 after; active and retained keys again matched. No errors
    occurred.
  - Bedrock samples used `terrain:shared-atlas:0:bedrock` with the corrected
    row-0 column-3 UV crop (`u0=0.3342013889`, `u1=0.4435763889`), while the
    second territory used its own authored spider roles. Both temporary ports
    were cleanly stopped and verified free afterward.
- Focused validation:
  - Four terrain suites: **4 files / 15 tests passed**.
  - `npm run typecheck -w @dc2d/client`: **passed**.
  - Scoped ESLint on the four terrain suites: **passed**.
- Remaining: No terrain-path defect remains in this bounded slice. The card is
  ready for review; unrelated editor/admin and full-suite blockers remain
  outside this scope.

## Review

### Luna review round 1 — approved

- Scope review: approved. The handoff changed no production terrain files and
  the browser recipe exercises the live Phaser terrain roots only; no editor or
  admin surface is used as a substitute.
- Evidence reviewed from isolated client `5190` / game-server `8890`:
  directional W→S traversal was captured in the Goblin/Maze view and in the
  distinct Silkbound territory view. Both runs report zero page, console, and
  failed-request errors; active and retained mesh keys match; the fallback
  graphics root is hidden while the normal atlas root is active.
- The Maze capture reports floor, bedrock, south-face, and cliff-edge batches
  before and after traversal. Silkbound reports authored
  `territory-spider-floor`/`territory-spider-wall` roles plus bedrock, south
  faces, and cliff edges in both directions. The recorded bedrock frame is
  `terrain:shared-atlas:0:bedrock`; no void/striped fallback batch is reported.
  The four referenced captures were inspected as live gameplay images, not
  `/editor` output.
- Independent static evidence: focused atlas/material/cache terrain checks
  passed 4 files/23 tests; client typecheck passed; scoped ESLint over the
  relevant terrain batch, geometry, planning, and acceptance-test paths passed.
- No actionable findings remain. Status intentionally remains `in-review` for
  parent gates.

## Finalization

- Finalization gate: focused terrain suites, client typecheck, scoped ESLint,
  and isolated-port live browser evidence all passed. No production terrain
  change was needed; the reported artifact is not reproduced in the current
  normal-atlas roots.
- Scope check: this slice changed no editor/admin surface and did not use
  port 8787.
- Status: `complete`

## Memory promotion

- Promoted to `agent-memory/common-code-mistakes/testing.md`: editor preview
  output cannot substitute for live Phaser terrain-root acceptance; directional
  reloads must be checked with normal atlas materials and fallback-root state.
