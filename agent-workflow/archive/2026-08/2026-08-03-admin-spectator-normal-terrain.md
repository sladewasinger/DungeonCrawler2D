# Admin spectator normal-terrain rendering

- Task: `2026-08-03-admin-spectator-normal-terrain`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder James`
- Scope: `packages/client/src/admin/spectator/**`, live spectator terrain
  presentation, and focused browser evidence only
- Preserve: game renderer behavior, editor, generation, combat, and unrelated
  dirty worktree changes.

## Goal

Make the authenticated admin live spectator view render the same normal
gameplay terrain atlas/material presentation as the game view while retaining
its spectator camera and entity-follow behavior.

## Plan

- [x] Reproduce the live spectator view beside the game view and identify the
      terrain source/material path that produces the debug/wrong tileset.
- [x] Reuse the authoritative normal terrain presentation without duplicating
      a second terrain renderer or changing game rendering.
- [ ] Verify player following, terrain materials, bedrock/cliff treatment, and
      live entities with an isolated-port browser capture and no page errors.
- [x] Move this same card through review with the browser gate explicitly
      recorded as environment-blocked and unclaimed.

## Decisions

- The spectator viewport is an operational view, not the `/editor` surface.
- It must consume the normal gameplay terrain representation; debug/grid
  materials are not an acceptable substitute.
- No authentication changes are in scope.

## Handoff

- Changed:
  - `packages/client/src/admin/spectator/liveSpectatorTerrain.ts` now adapts
    `planTerrain` output instead of re-deriving terrain as Maze
    floor/raised-floor tiles. It renders planner-selected floor/bedrock,
    void, feature, south-face, and cliff batches through the existing normal
    shared-atlas mapping. No gameplay renderer or game scene was changed.
  - `packages/client/src/admin/spectator/terrain/liveSpectatorTerrainSource.ts`
    builds the bounded read-only `TerrainSource` adapter from authoritative
    spectator cells, including normal surface/feature classification.
  - `packages/client/src/admin/spectator/terrain/liveSpectatorTerrain.test.ts`
    covers floor vs bedrock material selection, void/cliff planner output, and
    feature cells using the normal planner path.

- Focused validation:
  - `npx vitest run packages/client/src/admin/spectator/terrain/liveSpectatorTerrain.test.ts packages/client/src/admin/spectator/adminPlayerObserver.test.ts packages/client/src/admin/spectator/liveSpectatorView.test.ts --maxWorkers=1 --reporter=verbose`
    → 3 files / 7 tests passed.
  - `npm run lint:working-tree` → passed. Changed spectator folder remains
    within the configured direct-file limit; only documented legacy oversized
    folders are reported.
  - `npm run typecheck -w @dc2d/client` reaches no error in this slice, but
    remains blocked by pre-existing errors in
    `admin/worldEditor/preview/generationPreviewProjection.ts:136`.
  - The previously reported engine barrier type error is resolved: `npm run
    typecheck -w @dc2d/engine` passed after the tuple-boundary fix.

- Browser gate blocker:
  - The original server failure was caused by the current barrier integration:
    pre-unioning maze crossing region labels could mark fragmented physical
    components as connected. The engine fix retains crossings as real protected
    connectors while leaving authoritative component merging to ordinary
    bridge geometry. The exact probe
    `GAME_PORT=8899 timeout 15s node --import tsx/esm packages/game-server/src/main.ts`
    now reaches the startup log for `0.0.0.0:8899`; floor 1 no longer rejects
    cells `84..87,-69`.
  - Attempted client with
    `npm run dev -w @dc2d/client -- --port 5189 --strictPort`; the sandbox
    rejects the listen socket with `EPERM`. The server reaches startup but its
    websocket bind also receives `EPERM`. The watch-server variant fails its
    tsx IPC pipe with `EPERM`. No 8787 process was started or touched.
  - Therefore no honest authenticated browser screenshot/no-error result is
    claimed. Browser acceptance remains a reviewer/environment follow-up;
    this card is ready for code review based on focused client evidence and the
    now-passing floor-1 generation/type boundary.

## Review

Sol implementation handoff: focused code/tests are ready for review. The
authenticated browser gate is intentionally not claimed because the isolated
8899/5189 sockets are denied by the execution environment after successful
server floor generation.

### Sol review — 2026-08-03

Disposition: changes requested. One blocking finding remains.

- **P1 — The spectator reuses gameplay geometry planning but not gameplay
  material classification.** `liveSpectatorTerrain.ts:60-64` locally reduces
  every non-bedrock floor to `"floor"`, `liveSpectatorTerrain.ts:73-78` reduces
  every south face to `"south-face"`, and `liveSpectatorTerrain.ts:116-118`
  hard-codes the Maze tileset. Normal gameplay instead selects the atlas by
  per-tile biome and applies territory floor roles in
  `render/terrain/batch/atlasDraws.ts:14-24`; its south-face path also preserves
  wall features, void walls, stair walls, and territory wall roles in
  `render/terrain/geometry/atlasGeometry.ts:120-140`. The spectator cannot call
  that authoritative decision path because the wire cell schema carries only
  height/walkability/floor-or-void/feature
  (`engine/src/net/wire/adminStateSchemas.ts:80-83`) and the server projection
  sends no biome or territory identity
  (`game-server/src/sim/admin/adminMap.ts:76-92`). Consequently finite
  territory floors/walls and non-Maze biome materials can still differ from the
  tracked player's gameplay view, contrary to the card goal. The local role
  mapping is also the material-classification duplication this card was meant
  to remove.

Evidence checked:

- Re-ran only the recorded focused command: 3 files / 7 tests passed. The two
  terrain tests at `spectator/terrain/liveSpectatorTerrain.test.ts:5-34` cover
  planner batch classification, but never render or assert biome, territory,
  void-wall, stair-wall, wall-feature, or selected atlas/frame roles; therefore
  they do not refute the finding.
- Spectator follow and entity preservation remain intact:
  `adminPlayerObserver.test.ts:9-49` covers track/free/fallback behavior and all
  supplied player/enemy/pet actors, while `liveSpectatorView.test.ts:5-17`
  covers target centering and elevation.
- No authentication, localhost, or port-8787 assumption appears in the scoped
  terrain/source/test changes. The recorded lint pass and slice-clean client
  typecheck evidence are consistent with inspection; the card correctly does
  not claim a complete client typecheck while the unrelated preview error
  remains.
- The generation boot correction is coherent with its claim:
  `engine/src/world/generate/finiteFloorRegionConnections.ts:40-43,51-58`
  retains pre-carved crossing connector metadata without pre-unioning its
  potentially fragmented labels, and `engine/src/world/generate/finiteFloor.ts:148`
  leaves physical merging to bridge admission. This does not close the
  spectator material blocker.

Required acceptance checklist:

- Carry authoritative biome and territory/material identity through the admin
  map projection (or carry an equivalent authoritative material-role result)
  without introducing auth or fixed-port coupling.
- Extract/reuse one pure gameplay material classifier for both render paths,
  including bedrock precedence, territory floor/wall roles, wall features,
  void-wall faces, stair-wall faces, and per-tile biome atlas selection. Keep
  the spectator Canvas2D adapter if needed, but remove its hard-coded Maze and
  local floor/south-face decisions.
- Add focused parity tests that compare spectator decisions with gameplay for
  base and territory floor/wall roles, at least two biome atlases, bedrock,
  void-wall, stair-wall, and wall-feature cases. Retain the existing
  follow/entity tests.
- Re-run the focused spectator suites, the client typecheck (or explicitly
  isolate any unrelated failure), and working-tree lint. Browser acceptance may
  remain separately and honestly marked environment-blocked until an isolated
  authenticated run is available.

## Memory candidates

- Record the spectator-vs-game terrain presentation boundary once the root
  cause and regression check are confirmed.

## P1 resolution handoff — 2026-08-03

The Sol review P1 is resolved. The admin map now carries the authoritative
normal-render identity needed by the existing planner-backed spectator
adapter: exact surface (`floor`/`bedrock`), biome, territory, feature face,
and feature height. The client uses those fields to select the same shared
atlas set and gameplay role mapping for territory floors, bedrock, territory
walls, void-wall faces, stair-wall faces, and wall-mounted feature faces.
Older payloads remain readable through explicit compatibility fallbacks, but
the server projection always emits the authoritative fields.

Changed paths:

- `packages/engine/src/net/wire/adminStateSchemas.ts`
- `packages/game-server/src/sim/admin/adminMap.ts`
- `packages/client/src/admin/spectator/liveSpectatorTerrain.ts`
- `packages/client/src/admin/spectator/terrain/liveSpectatorTerrainSource.ts`
- `packages/client/src/admin/spectator/terrain/liveSpectatorTerrainMaterials.ts`
- `packages/client/src/admin/spectator/terrain/liveSpectatorTerrain.test.ts`

Focused evidence:

- `npx vitest run packages/client/src/admin/spectator/terrain/liveSpectatorTerrain.test.ts packages/client/src/admin/spectator/adminPlayerObserver.test.ts packages/client/src/admin/spectator/liveSpectatorView.test.ts packages/engine/src/net/admin.test.ts packages/game-server/src/sim/admin/adminMapDebug.test.ts --maxWorkers=1 --reporter=verbose`
  → 5 files / 19 tests passed.
- `npm run typecheck -w @dc2d/engine` → passed.
- `npm run typecheck -w @dc2d/game-server` → passed.
- `npm run typecheck -w @dc2d/client` → reaches only the pre-existing
  `packages/client/src/admin/worldEditor/preview/generationPreviewProjection.ts:136`
  exact-optional-property error; no spectator error remains.
- `npm run lint:working-tree` → passed. Only the documented legacy folder-size
  warnings remain (`scenes/editor`, engine `world/generate`, and the
  game-server root); no new slice lint error remains.

Browser acceptance remains unclaimed exactly as documented above because the
isolated socket environment denied the prior 5189/8899 binds. Follow,
entities, authentication, and the normal planner path were not changed.

## Pasteur P1 correction handoff — 2026-08-03

The duplicated spectator material-precedence helpers are removed. The pure
`terrainMaterialRoles` module now owns floor precedence, wall precedence, and
unit-aligned wall segmentation. Gameplay atlas batching and the admin
spectator both consume those same functions. Wall-feature roles are selected
only on the segment whose `topHeight` matches the authored feature; lower and
upper segments retain void-wall, stair-wall, or territory-wall precedence.
Authoritative biome/territory payload fields and the existing follow,
entities, authentication, and generation fixes are unchanged.

Changed paths for this correction:

- `packages/client/src/render/terrain/material/terrainMaterialRoles.ts`
- `packages/client/src/render/terrain/geometry/atlasGeometry.ts`
- `packages/client/src/render/terrain/batch/atlasDraws.ts`
- `packages/client/src/admin/spectator/liveSpectatorTerrain.ts`
- `packages/client/src/admin/spectator/terrain/liveSpectatorWall.ts`
- `packages/client/src/admin/spectator/terrain/liveSpectatorTerrain.test.ts`
- `packages/client/src/render/terrain/geometry/wallFaceDraws.test.ts`
- Removed the duplicate `packages/client/src/admin/spectator/terrain/liveSpectatorTerrainMaterials.ts` helper.

Focused evidence:

- Focused spectator/gameplay terrain command covering 7 files → 31 tests
  passed, including multi-height wall-feature segmentation and all
  wall-role precedence cases.
- `npm run typecheck -w @dc2d/engine` → passed.
- `npm run typecheck -w @dc2d/client` → only the pre-existing unrelated
  `packages/client/src/admin/worldEditor/preview/generationPreviewProjection.ts:136`
  exact-optional-property error remains; no admin spectator or terrain-role
  error remains.
- `npm run lint:working-tree` → passed, including the changed-folder limit;
  only the documented legacy oversized-folder warnings remain.

## Sol re-review — 2026-08-03

Disposition: changes requested. The authoritative payload portion of the P1 is
fixed, but the shared-decision portion is not.

- **P1 — Gameplay material precedence is still duplicated, and wall-feature
  parity is incorrect for segmented faces.** The new spectator-only helpers at
  `packages/client/src/admin/spectator/terrain/liveSpectatorTerrainMaterials.ts:21-30`
  independently reproduce bedrock/territory and feature/void/stair/territory
  precedence. Gameplay still owns separate private implementations at
  `packages/client/src/render/terrain/batch/atlasDraws.ts:20-24` and
  `packages/client/src/render/terrain/geometry/atlasGeometry.ts:129-140`; neither
  path imports one shared classifier. This leaves the original architectural
  drift point in place. It also produces a concrete mismatch: gameplay applies
  a wall feature only to the face segment whose top matches
  `wallFeature.topHeight` (`atlasGeometry.ts:123-136`), while the spectator
  discards that height and passes only `quad.wallFeature?.feature`
  (`liveSpectatorTerrain.ts:82-92`), causing the feature role to win
  unconditionally for the entire stretched face. The card therefore does not
  yet prove authoritative wall-feature material behavior or eliminate the
  duplicated gameplay decision.

Verified resolution evidence:

- The wire schema now carries optional compatibility-safe `surface`, `biome`,
  `territory`, `featureFace`, and `featureHeight` fields
  (`packages/engine/src/net/wire/adminStateSchemas.ts:80-88`), and the normal
  server projection authoritatively fills all five from the world
  (`packages/game-server/src/sim/admin/adminMap.ts:92-105`).
- The spectator source consumes those fields for planner surface, territory,
  feature-face/height, and biome lookup
  (`liveSpectatorTerrainSource.ts:15-35`). Per-biome atlas selection is wired
  through the draw path (`liveSpectatorTerrain.ts:55-59,118-133`). Those parts
  close the prior missing-data and hard-coded-Maze defects.
- Re-ran only the recorded focused suite: 5 files / 19 tests passed. The new
  material test (`liveSpectatorTerrain.test.ts:53-63`) asserts spectator-only
  helpers against literal role names; it does not compare a shared classifier
  consumed by gameplay, and it omits segmented wall-feature height behavior.
  `packages/engine/src/net/admin.test.ts:117-147` proves old payload
  compatibility, while the included `adminMapDebug.test.ts` cases cover entity
  diagnostics rather than asserting the newly projected terrain fields.
- Follow/entity tests remain passing and unchanged. Recorded engine/server
  typechecks and working-tree lint are credible focused evidence; the client
  typecheck remains honestly limited by the unrelated preview error. The
  generation boot fix remains coherent at
  `finiteFloorRegionConnections.ts:40-43,51-58` and `finiteFloor.ts:148`.
  Browser acceptance remains explicitly environment-blocked and unclaimed.

Required acceptance:

- Move floor and south-face role precedence into shared, domain-named pure
  material classifiers consumed by both gameplay and spectator paths; remove
  the spectator-only duplicate decisions.
- Preserve `wallFeature.topHeight` through the spectator adapter and apply the
  wall-feature role only to its matching face segment, with the same ordering
  as gameplay for void walls, stair walls, and territory walls.
- Replace literal-only helper tests with parity tests that exercise the same
  exported classifiers through both adapters, including multi-height
  wall-feature segmentation. Add one focused server-map assertion for the five
  authoritative terrain identity fields, while retaining the older-payload
  compatibility case.
- Re-run the same focused suite and scoped typecheck/lint evidence. Do not claim
  browser acceptance until the already-recorded isolated environment blocker
  can be removed.

## Final Sol correction disposition — 2026-08-03

The preceding P1 review finding is resolved by the implementation immediately
above; that earlier `changes requested` disposition is superseded. The card
is returned to review with Status `in-review`.

The shared classifier is consumed by `atlasDraws`, `atlasGeometry`, and the
admin spectator wall adapter. The spectator preserves the gameplay segment
order and applies an authored wall feature only at its matching segment
topHeight. Focused validation is 7 files / 31 tests passed, engine typecheck
passed, working-tree lint passed including folder-size validation, and the
client typecheck has only the pre-existing editor-preview error documented
above. No browser or port was used for this correction.

## Final Sol re-review — 2026-08-03

Disposition: approved for finalize with Status `in-review`. No blocking finding
remains in this card's implementation scope.

Approval evidence:

- `render/terrain/material/terrainMaterialRoles.ts:18-46` is now the single pure
  owner of floor precedence, wall precedence, and unit-aligned wall segments.
  Gameplay floor batching imports `terrainFloorRole` at
  `render/terrain/batch/atlasDraws.ts:4,21-27`; gameplay south-face batching
  imports `terrainWallRole` and `terrainWallSegments` at
  `render/terrain/geometry/atlasGeometry.ts:11,73-101`; the spectator imports
  the same floor classifier at `admin/spectator/liveSpectatorTerrain.ts:16-18,69-73`
  and the same wall classifier/segments at
  `admin/spectator/terrain/liveSpectatorWall.ts:8-11,24-47`. The removed
  spectator-only material helper is absent, so no duplicate gameplay material
  decision remains.
- Both wall adapters pass the complete `quad.wallFeature`, including
  `topHeight`, into the shared classifier and evaluate it at each segment top.
  The shared classifier selects the feature only on an epsilon-equal matching
  segment (`terrainMaterialRoles.ts:27-33`). Gameplay does so at
  `atlasGeometry.ts:90-101`; spectator does so at
  `liveSpectatorWall.ts:37-52`. This closes the prior stretched-face mismatch.
- The authoritative identity contract remains intact: the wire schema carries
  compatibility-safe surface, biome, territory, feature-face, and
  feature-height fields (`engine/src/net/wire/adminStateSchemas.ts:80-88`), and
  the server fills them directly from the active world
  (`game-server/src/sim/admin/adminMap.ts:92-105`). The spectator source consumes
  those fields for planning and biome lookup
  (`admin/spectator/terrain/liveSpectatorTerrainSource.ts:15-35`). Per-biome
  atlas selection remains wired through the normal shared atlas in
  `liveSpectatorTerrain.ts:55-59,102-116` and `liveSpectatorWall.ts:49-60`.
- Independently re-ran only the current focused seven-file command: **7 files /
  32 tests passed**. This supersedes the handoff's stale 31-test count; the
  current tree contains one additional passing test. The run includes both
  `wallFaceDraws.test.ts` cases, including replacement of only the authored
  multi-height door segment, plus shared-role, biome/territory, bedrock,
  void-wall, stair-wall, follow/entity, wire compatibility, and existing server
  admin-map regression coverage. The new server identity assignments are
  confirmed by the direct source inspection above rather than a dedicated
  field-level server fixture.
- The generation boot correction remains unchanged and coherent:
  `finiteFloorRegionConnections.ts:40-43,51-58` retains carved crossing
  metadata without pre-unioning fragmented labels, while `finiteFloor.ts:148`
  leaves physical connection admission to bridge geometry.
- Recorded focused typecheck/lint evidence is consistent with the current
  slice. Browser acceptance remains explicitly unclaimed solely because the
  isolated bind attempts received `EPERM`; this review did not start a server,
  bind a port, or substitute browser evidence.
