# Finite ordinary elevation visibility and route-overlay clarity

- Date: `2026-08-04 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Executor: persistent `sol-coder`; Luna and Spark are not authorized
- Scope: finite ordinary elevation/materialization, exact movement and
  visibility regressions, and generation-preview protected-route drawing
- Preserve: authored feature geometry, room/feature walls, finite bounds,
  deterministic identity, legal movement, below-zero terrain, unrelated dirty
  work, and the completed barrier-preview contracts

## Reports

1. Ordinary terrain can descend to z=-2 immediately behind a foreground wall
   whose materialized top is z=2. Under the shared elevation projection, the
   resulting four-tile face can cover the player and a large portion of the
   screen-north view.
2. Enabling the optional generation-preview route overlay can show a dense,
   center-heavy cluster of magenta north/south paths that looks erroneous or
   insufficiently random.

These reports share the same immutable generation snapshot and browser proof
surface, but they do not currently share a demonstrated generator cause. Keep
their diagnosis and correction separate within one bounded roadmap.

## Source diagnosis

### Elevation visibility

- `finiteFloorElevation.ts` assigns ordinary Corridor, Room, and Transition
  cells coherent height bands down to `minimumElevation` before terrain is
  materialized. With defaults, the bands can reach z=-2 while retaining
  one-level changes between neighboring ordinary cells.
- Its breadth-first distance seeds only carved authored surfaces. Uncarved
  ordinary wall margins do not constrain the nearby ordinary floor height, so
  z=-2 can remain directly adjacent to a future wall.
- `finiteFloorMaterialization.ts` subsequently converts every unowned,
  uncarved non-void cell to Bedrock at absolute z=2. It does not use the local
  ordinary floor base. Thus z=2 minus z=-2 produces the reported four-tile
  visible face.
- The client occlusion rule already follows the projection exactly: terrain
  `step` rows toward screen-south occludes when `height - actor.z >= step`, in
  all four orientations. Changing that rule or hiding the silhouette would
  conceal the geometry defect rather than correct it.

### Protected-route overlay

- `attemptRouteTargets` intentionally includes mandatory feature ports, the
  last room, every room entrance, and every connector. This can be a large
  target set concentrated around the dungeon's connected core.
- `carvedPaths` performs one deterministic breadth-first search from spawn and
  restores a path to every target from the same predecessor tree. Valid paths
  therefore share long central prefixes and cardinal runs; they are not meant
  to look like independent random walks.
- `generationPreviewDrawing.ts` strokes every complete route independently at
  0.75 alpha. Shared cells and edges are painted repeatedly, so legitimate
  prefix sharing becomes saturated magenta clustering. The overlay can look
  denser than the actual protected-cell union.
- The final trace snapshot currently retains semantic, height, ownership, and
  region planes, but not authoritative `tiles`, `terrain`, `features`, feature
  ramp data, or `protectedCells`. Consequently the preview's
  `semantic > Solid` check cannot prove the runtime contract used by
  `isMovementWalkable`, and it cannot prove a route edge's height/stair
  transition is legal.
- Preview colors also have distinct meanings that the screenshots can
  visually conflate: violet/magenta strokes are protected route metadata,
  cyan squares are connector-point glyphs, and gold/yellow cells are
  Transition or authored-feature semantics. Cyan glyphs are wider than their
  owning source cell and can paint over adjacent Bedrock even when the
  connector itself is valid. Conversely, a gold semantic cell can look
  traversable even though the preview has no final tile/terrain plane with
  which to reconcile it. Pixel overlap is a projection bug; an owning
  coordinate that is actually Bedrock or feature-blocked is a generator bug.
- The reported screenshot is seed 2 with `Show protected route debug overlay`
  enabled, and Austin observes the same central cluster on seed 1. This is
  consistent with the overlay drawing the spawn-rooted route tree, not with a
  seed-specific raster or terrain failure. Before changing engine routes,
  reproduce both requests and measure target coordinates, route
  count, duplicate endpoint count, shared-edge multiplicity, direction
  histogram, cardinal continuity, walkability, and spawn reachability. Source
  evidence favors visualization accumulation, but the newer screenshots of
  cyan markers and yellow/reserved roles aligned with final vertical Bedrock
  require authoritative surface reconciliation. They do not excuse a real
  reservation-materialization loss, duplicate target, or invalid route.
- Austin's stage-3 seed evidence has the protected-route overlay **off** and
  still shows gold Transition components and cyan connector points apparently
  crossing dark wall cells. Route-stroke overdraw cannot explain those marks.
  Treat each component as a concrete potential reservation/materialization
  loss until its source and final coordinates are reconciled. Stage 3 is still
  a planning snapshot, so map its intent into the final snapshot rather than
  assuming either that the dark cell is final or that the planned crossing may
  be discarded silently.

### Preview stage observability

- Stage 1 (`mandatory-backbone`) and stage 2 (`rooms-envelopes`) are captured
  on opposite sides of room placement, so their semantic, room-wall, region,
  and room metadata should differ. At full-floor scale those distributed cell
  changes can be visually subtle, and the UI reports only a label—not a delta.
- Stage 3 (`maze-fill`) and stage 4 (`room-feature-entrances`) are currently
  captured in consecutive statements with no generator operation between
  them. Their stage id/index and therefore snapshot fingerprints differ, but
  their planes and metadata are identical. Moreover, room entrances are
  already registered inside `placeAdmittedRooms` before stage 2 is captured,
  so the stage-4 label claims work that did not happen at that boundary.
- A fingerprint difference is not evidence of a visible generation delta,
  because the trace fingerprint intentionally includes stage id and index.
  Stage diagnosis must compare planes and metadata directly.

### Editor Void-boundary presentation

- The ordinary terrain planner deliberately emits a one-tile floating
  south-facing face when Floor borders screen-south Void. That runtime contract
  must remain unchanged for normal terrain.
- The map editor uses the same `TerrainRenderer`, while `EditorTerrainWorld`
  does not provide the optional `voidBoundaryAt` policy already consumed by
  cliff/face planning. Editor Void drawing therefore inherits floating faces
  where actual adjacent occupancy represents an open gap that should stay
  flat.
- This is an editor-preview policy defect, not a reason to change generator
  heights or global Void rendering. Diagnose authoritative adjacent
  terrain/tile occupancy across all rotations; do not infer a boundary from
  zero height or a broad close-open-area heuristic.

## Selected correction

### Lane A — ordinary wall-margin elevation

Add one pure, deterministic ordinary-boundary shaping step at the elevation /
materialization seam:

1. Classify only unowned ordinary solid boundaries and their adjacent ordinary
   Corridor, Room, or Transition surfaces. Exclude the finite exterior's void
   contract, `RoomWall`, SafeRoom, SpawnExterior, MiniBossArena, BossArena,
   registered feature cells, room-owned cells, and authored/protected geometry.
2. Treat ordinary walkable cells cardinally adjacent to those boundaries as
   local elevation anchors. Continue the existing coherent bands inward from
   the boundary, so a deep ordinary basin occurs only after a gradual spatial
   transition rather than immediately behind its foreground rim. Apply the
   rule symmetrically in world space; every rotation must receive the same
   guarantee.
3. Materialize each visible unowned ordinary boundary top from its local
   anchored ground base plus the ordinary two-tile visibility allowance,
   instead of resetting it to absolute z=2. Keep a deterministic propagation
   for non-visible interior solid fill, but do not let interior fill determine
   a visible edge's top.
4. Assert the final cardinal interface invariant rather than relying on a
   default-only example: for every ordinary walkable cell beside an unowned
   visible solid wall, `wallTop - floorHeight <= 2`. The wall top must not fall
   below its highest adjacent ordinary surface. If adjacent candidates cannot
   satisfy both conditions, extend the ordinary boundary anchor/grade inward;
   do not clamp an authored wall or create an invisible blocking wall.

This preserves the configured negative range in sufficiently broad ordinary
areas, while moving the first negative band away from a tall foreground edge.
Do not globally change `minimumElevation`, flatten the floor, shorten faces in
the renderer, or make collision ignore Bedrock. If the existing eight-cell
band width eliminates negative terrain for the measured representative floor,
adjust only the deterministic ordinary band spacing with explicit seed-corpus
proof; do not restore a direct wall-to-deep-floor discontinuity.

The implementation should use small domain helpers, for example an ordinary
boundary classifier, boundary-distance field, and local wall-top resolver,
rather than adding conditionals to `materializeCell`. Any output-changing
algorithm/version or prepared-floor cache contract must be advanced through
the repository's existing finite identity convention so stale floors cannot
masquerade as corrected output.

### Lane B — route truth before route styling

First extend immutable trace snapshots with the minimum authoritative planes
needed to explain final movement: `tiles`, `terrain`, `features`,
`featureFaces`, `featureHeight`, and `protectedCells`. Include them in cloning,
immutability, byte serialization, fingerprinting, and stage-delta accounting.
Do not infer final surface state from semantic color. Keep the trace bounded by
retaining typed arrays, not expanded per-cell objects.

Build one pure engine-owned final-route audit and use it both in generation
validation and preview diagnostics. It must use the same tile, terrain,
solid-feature, height, stair, and directed-edge rules as runtime movement—not a
client reimplementation. For the exact seed-1 and seed-2 requests:

- compare coordinate-deduplicated requested targets with route endpoints;
- prove every route point is in bounds, `TILE.Floor`, non-Void terrain, free of
  a blocking feature, still protected, and reachable from spawn;
- prove consecutive points are cardinal neighbors and each directed edge is
  legal under final height/stair transition rules;
- compare the route-cell union with `protectedCells` and report unique edge
  count versus total stroked edge count;
- identify exact duplicate endpoints separately from expected shared prefixes;
- audit connector coordinates with the same final-cell predicate, and classify
  every screenshot-yellow cell by semantic, tile, terrain, feature,
  protection, and route membership.

Make final route-surface validity a generator invariant before styling. A
successful final floor may not contain route metadata whose cell is Bedrock,
Void, feature-blocked, unprotected, unreachable, or joined by an illegal edge;
nor may a final connector point own such a cell. Validation must report the
first route/point and precise tile, terrain, feature, semantic, protection, and
height reason. It must run after every topology/elevation/materialization pass
that can affect the authoritative surface, not merely when the path was first
reserved.

If an invariant fails, use stage-plane evidence to locate the first pass where
the route changed from carved/traversable to blocked. Correct that owning pass:

- when a later unowned stamp overwrote a protected route, prevent that stamp
  from consuming the reserved cell and retain its ownership/protection;
- when authored geometry legitimately owns the cell, rerun the existing
  bounded target connection against the finalized obstruction and replace the
  stale route metadata with the repaired path;
- when reservation was recorded without carving, make route admission
  transactional so protection and metadata commit only with a complete legal
  carved path.

Never blindly turn every protected cell into Floor: protected authored walls
and feature shells can be intentionally solid. Never split or filter an
invalid final route in the renderer and call the remainder valid. The engine
must either repair the complete required connection deterministically or fail
the attempt with the invariant so retry/failure is explicit.

Only after the final audit passes, canonicalize cardinal edges across all
routes and draw each unique edge once. Use a native-cell route/connector mask
or clip vector marks to the owning traversable cells so anti-aliasing and
oversized cyan glyphs cannot spill across final Bedrock. Draw the shared
spawn/root and distinct target endpoints as separate bounded glyphs if needed.
Final Transition coloring is allowed only on an authoritative walkable surface;
Bedrock/Void surface color wins over stale semantic/reservation color. The
overlay remains optional and off by default; its color remains distinct from
Transition cells and connector points. Hover/debug text must expose tile,
terrain, feature, semantic, protection, route, and connector roles so a user
can identify which plane produced a mark.

For a malformed or stale externally supplied snapshot, the client must refuse
to render the invalid final route/connector and surface an explicit diagnostic;
this defense is not a substitute for the generation invariant. Intermediate
planning stages may show reservation intent, but their label must say
`planned/reserved—not yet final-surface validated`; the final stage may say
`protected route` only after reconciliation.

If all final engine checks pass and the screenshot marks merely overlap an
adjacent wall, leave route generation, neighbor ordering, topology,
protection, and floor identity unchanged; fix only source-cell projection and
legend semantics. This is the required distinction between a preview bug and
reservation-materialization loss.

#### Lane B implementation handoff order

1. Reproduce seeds 1 and 2 with stage 3 and its route overlay off. Record the
   exact gold component cells, cyan connector owners, and dark cells from
   Austin's marks as world coordinates, not screenshot pixels only.
2. For every cardinally connected gold Transition component, record its
   stage-3 tile, semantic, protection, region, connector ownership, route
   membership, and the two walkable regions/sides it appears intended to join.
   Map those coordinates into the final snapshot's tile, terrain, feature,
   height, protection, and reachability planes.
3. Audit each cyan connector's owning coordinate—not its oversized glyph—and
   prove the final cell is walkable, spawn-reachable, and movement-connected to
   the connector's declared `regionIds`. Prove the intended corridor between
   its sides remains cardinally continuous through legal final edges.
4. Classify each finding exactly once:
   - **projection:** the owning Transition/connector cell and edge are valid,
     but semantic color or marker extent paints neighboring wall pixels;
   - **transient planning intent:** stage 3 proposes a component that a later
     phase explicitly rejects, with no final connector/route metadata still
     claiming it;
   - **reservation/materialization loss:** final connector/route metadata or
     protected Transition intent remains, but intended cells/edges become
     Bedrock, Void, feature-blocked, unprotected, unreachable, or height
     illegal.
5. Fix projection only after the generator audit is green. For a true loss,
   identify the first changing trace stage and repair the owning pass or
   deterministically reroute around authored geometry. Re-run final
   materialization and the shared invariant before emitting the trace.

Gold Transition components that remain intended corridors may not be
recolored, hidden, or relabeled to avoid failure. A dark cell in their required
final continuity must become a legal surface or the complete connection must
be rerouted. Protected authored room/feature walls must never be punched
through merely because a planning line overlaps them.

Do not randomize breadth-first neighbor order or invent wandering paths merely
to make the image look random. Deduplicate only exact coordinate targets when
measurement proves duplicate requests, preserve required feature/room/
connector reachability, and include any output change in finite identity. Do
not infer an engine defect from central prefix sharing alone.

### Lane C — truthful stage deltas

Add a pure snapshot-delta summary used by tests and the preview UI. Compare all
retained planning and authoritative surface planes cell-by-cell and separately
count added/removed/changed
rooms, connectors, routes, feature stamps, and territory layouts. Do not use
the stage fingerprint as a delta proxy.

1. Remove/merge the no-op `room-feature-entrances` capture and stage id. Rename
   the stage-2 label to state the operation it actually contains: ordinary
   rooms, wall envelopes, and admitted entrances. Keep `maze-fill` as the next
   stage. This changes trace/debug metadata only; it must not reorder or rerun
   generation and must leave the final floor planes, topology, identity, and
   deterministic result unchanged.
2. Show the previous-to-current delta in the stage status, for example changed
   cell count plus concise metadata additions. Stage 1 reports itself as the
   baseline. A zero-cell metadata-only change must be named as such rather than
   appearing silently identical.
3. Add a local `Highlight changes from previous stage` preview control (default
   on for stages after the baseline). Build a one-pixel-per-floor-cell delta
   raster from plane changes and nearest-neighbor scale it through the existing
   projection. Use a translucent high-contrast color distinct from violet
   protected routes, cyan connectors, gold Transition cells, and feature
   markers. Toggling it redraws only; it never regenerates or mutates trace
   snapshots.
4. Keep protected-route union display independently toggleable. Its label and
   legend must say that it is a union of deterministic spawn-rooted protected
   paths with shared trunks drawn once—not a random-route visualization. Stage
   delta and route union may be enabled together without sharing color or
   controls.

Do not create synthetic intermediate snapshots, mutate snapshots to exaggerate
differences, or move a generation operation solely for animation. If an
adjacent pair other than the known no-op capture has zero plane and metadata
delta on seeds 1 and 2, either merge it when the operation is unconditionally
empty or retain it with an explicit `no changes for this request` status when
the phase is conditional and meaningful for other configurations.

### Lane D — editor-only flat Void gaps (final priority)

Handle this only after elevation, route reconciliation, and stage observability
are approved. Add an editor-owned, edge-specific Void-boundary policy through
the terrain-source seam:

1. Evolve the optional boundary query so it receives both cells of the exact
   directed edge: the current Floor/solid surface and its view-screen-south
   neighbor after orientation remapping. Keep a compatibility fallback for
   sources that expose no policy; their existing floating boundary behavior
   must be unchanged. Do not use a cell-wide "has any Void neighbor" result,
   because that could cull an unrelated occupied side after rotation.
2. Forward the optional edge query through the renderer's structural
   `TerrainWorld` source. Implement it only on `EditorTerrainWorld`, and only
   when the editor is presenting Void drawing mode. Read the exact current and
   neighbor coordinates from authoritative `terrainAt`, the base/edited
   surface tile, and any edge-owning feature or fixture.
3. Classify an edge as an **actual gap** only when the current cell has a
   renderable non-Void surface, the exact adjacent cell is `TERRAIN.Void`, and
   no explicit editor-authored wall/edge fixture owns that boundary. An
   unrelated open cell elsewhere, a diagonal Void, or a Void two or more cells
   away has no effect.
4. For an actual editor gap, suppress every artifact owned by that same edge:
   the projected south-face quad, face-attached wall feature, wall AO, and
   void-boundary cliff edge. Do not merely hide the brick texture while
   retaining occlusion/AO geometry.
5. Preserve top/cap feature art such as a stair that remains on the current
   surface. A wall-mounted door or explicit edge fixture may retain a face only
   when its feature face matches that exact oriented edge and editor occupancy
   says the boundary is authored rather than empty. Feature presence on some
   other edge may not keep the reported face alive.

Height is not occupancy. For an actual Floor→Void editor gap, the result is
flat/no-face for current heights below zero, zero, and above zero, regardless
of the Void cell's stored placeholder height. For Floor→Floor, existing height
drop thresholds remain authoritative and ordinary cliff/wall faces continue
to render. Changing height alone must never turn a gap into an occupied edge or
vice versa.

Do not change ordinary runtime `World`, global `appendVoidSouthFace` defaults,
finite generation, collision, editor serialization, normal non-Void terrain
faces, or inside-room presentation. If the marked cell is not actually
adjacent to Void in editor data, stop and diagnose stale editor cache/revision
or picking coordinates instead of broadening the culling rule.

## Proposed implementation boundaries

Lane A may touch only:

- `packages/engine/src/world/generate/finiteFloorElevation.ts`;
- `packages/engine/src/world/generate/terrain/finiteFloorMaterialization.ts`
  and the smallest buffer/materialization call seam needed to provide bounds
  and ordinary-boundary context;
- `packages/engine/src/world/generate/elevation/finiteFloorElevation.test.ts`;
- one focused materialization/interface test module, plus the nearest seeded
  finite movement/determinism test if full-floor proof is not expressible in
  the elevation test;
- finite generator identity/version code only if required by the established
  compatibility convention.

Lane B may touch only:

- `packages/client/src/admin/worldEditor/preview/generationPreviewDrawing.ts`;
- preview raster/colors/hover/panel code needed for authoritative surface
  precedence and bounded route/connector masks;
- `packages/engine/src/world/generate/finiteFloorMovement.ts`, validation, and
  one small final-route audit module shared by validation and preview;
- trace snapshot types/builder/test support needed to retain authoritative
  surface and protection planes;
- production target/path/owning stamp code only after the evidence gate proves
  reservation-materialization loss and identifies the first offending pass.

Lane C may touch only:

- the capture calls and stage-id union in
  `packages/engine/src/world/generate/finiteFloor.ts` and
  `finiteFloorTypes.ts`;
- `packages/engine/src/world/generate/trace/**` and focused trace tests;
- `packages/client/src/admin/worldEditor/preview/generationPreviewStage.ts`,
  replay/controller/panel controls, a small delta-raster helper, and focused
  preview tests.

Lane D may touch only:

- `packages/client/src/scenes/editor/EditorTerrainWorld.ts` and its tests;
- `packages/client/src/render/terrain/runtime/world.ts` and `source.ts` for the
  optional boundary-style forwarding seam;
- the edge-policy type and its exact consumers in
  `geometry/terrainPlannerModel.ts`, `planning/terrainPlannerBuild.ts`, and
  `geometry/cliffGeometry.ts`; avoid changes to batching, atlases, depth, or
  ordinary face geometry;
- focused terrain-planner/editor visual-plan tests proving the editor-specific
  policy at four orientations.

Do not change gameplay occlusion, camera, entity depth, movement physics,
stairs, ordinary barrier carving, room placement, authored feature stamps,
global preview colors, worker budgets, or root test configuration.

## Acceptance

### Elevation and movement

- A focused fixture reproduces ordinary z=-2 behind an absolute z=2 wall
  before the correction and proves the corrected final materialized interface
  is no more than two tiles tall.
- The interface invariant holds for all four cardinal sides, corner pockets,
  default `minimumElevation: -2`, supported deeper negative configuration, and
  a lowered `maximumElevation`; no orientation-specific screen-south special
  case is introduced.
- A representative deterministic seed corpus still contains ordinary height
  variation and at least one below-zero ordinary region. It also contains no
  ordinary visible floor-to-wall rise above two, no non-finite height, and no
  change to authored feature/room wall heights or footprints.
- Identical requests produce identical height planes and fingerprints;
  corrected output cannot reuse a stale prepared artifact identity.
- `analyzeFloorMovement` reports no new illegal required-route edges or
  disconnected non-arena walkable cells. Spawn, stair, safe-room, arena, and
  authored route reachability remain intact inside unchanged finite bounds.
- Browser evidence at the reproduced location and a contrasting below-zero
  basin is captured in all four rotations. The player remains legible without
  a four-row ordinary foreground wall, while the existing partial occlusion
  silhouette still appears where a legitimate one- or two-row face covers it.

### Route overlay

- The exact reported request records route target count, endpoint duplicates,
  unique cells/edges, repeated-edge multiplicity, direction histogram, and
  final movement validity for seeds 1 and 2. Every route point/edge and
  connector is reconciled with authoritative tile, terrain, feature,
  protection, height, and stair state. The result explicitly classifies
  expected shared-prefix accumulation, source-cell marker spill, stale
  semantic coloring, and actual topology defects.
- Every marked stage-3 gold Transition component on seeds 1 and 2 has an
  explicit final disposition: a continuous legal final corridor, or an
  explicitly rejected transient proposal with no surviving connector, route,
  or protected-corridor claim. Every cyan connector owner joins its declared
  regions through final movement-legal cells; no intended corridor crosses a
  dark final wall.
- A focused loss fixture reserves and records a legal route, then applies the
  reproduced offending stamp/materialization sequence. The corrected pipeline
  either preserves the complete traversable reservation or deterministically
  reroutes it; a Bedrock, Void, blocking-feature, unprotected, or illegal-edge
  route fails final validation. A renderer-only filter cannot make this test
  pass.
- Final Transition cells drawn gold are authoritative walkable Floor cells.
  Authored gold feature markers on solid shells remain named as features and
  are never described as routes. Hovering every screenshot coordinate reports
  the exact tile/terrain/feature/semantic/protection/route/connector roles.
- With valid topology, drawing N routes that share one edge strokes that edge
  once; reversing or duplicating a segment cannot increase its opacity.
  Distinct branches and endpoints remain visible, route cells/edges are drawn
  only on final traversable surfaces, and bounded connector glyphs cannot paint
  neighboring Bedrock. Overlay toggling does not regenerate or mutate the
  snapshot.
- The base raster, stage, hover coordinates, fingerprint, Transition cells,
  and cyan connector markers are identical with the overlay off and on.
- Isolated `/editor` captures show routes off and on for the same immutable
  final snapshot. The enabled view no longer misrepresents shared central
  prefixes as stacked magenta paths or places cyan/gold route meaning on final
  Bedrock. Capture source-cell hover evidence for each formerly suspect wall;
  no browser/page errors occur.

### Stage replay

- For seeds 1 and 2, a recorded adjacent-stage delta table lists changed cells
  by plane and metadata changes. Stage 1→2 visibly identifies the added rooms,
  wall envelopes, and entrances even at fit-to-floor scale.
- No two unconditional adjacent stages have identical planes and metadata.
  The current duplicate maze/entrance snapshot is absent; labels and stage
  count match the remaining actual operation boundaries.
- The final snapshot before and after the stage-observability change has equal
  topology, every existing and newly retained authoritative plane, metadata,
  movement analysis, deterministic finite identity, and floor fingerprint.
  Only trace stage ids/counts, trace fingerprints, and client debug
  presentation may change when the engine surface audit finds no defect.
- Delta highlighting is derived from immutable snapshots, uses the same native
  cell projection and hover coordinates as the base raster, and toggles without
  a worker request. Its legend/color cannot be mistaken for protected routes,
  connectors, Transitions, or authored features.
- Focused trace tests prove stage order and meaningful direct deltas without
  relying on differing stage fingerprints. Controller/projection tests prove
  route and delta controls are independent and local.

### Editor Void drawing

- A table-driven editor fixture covers all four orientations, exact
  screen-south Void, the other three cardinal Void sides, diagonal Void, and a
  Void cell two tiles away. Only the exact edge under consideration is culled;
  no editor south-face, wall-mounted feature, wall AO, or void-boundary cliff
  edge survives on an actual gap.
- Repeat the exact-gap fixture at representative current heights `-2`, `0`,
  and `2`, with distinct placeholder heights in the Void neighbor. Results are
  identical. The corresponding Floor→Floor height drops retain ordinary
  face/cliff behavior and thresholds.
- Feature regressions cover no feature, a top-mounted stair, a wall-mounted
  door facing the tested edge, the same door facing another edge, and an
  explicit editor wall/edge fixture. Top art survives flat-gap culling; only an
  exactly owned authored boundary may retain face-attached art.
- The ordinary runtime terrain source, normal finite Void presentation, inside
  rooms, doors/stairs, editor map serialization, and non-Void drawing mode keep
  their existing visual plans and tests unchanged.
- An editor edit that changes occupancy increments the existing revision/cache
  identity and immediately replans the affected boundary; no stale wall face
  survives after the gap becomes Void or vice versa.
- Reproduce the exact reported seed/configuration and coordinates when
  captured, plus deterministic Void-enabled seeds 1 and 2 as contrasting
  coverage. The same request/edit sequence produces the same plan; seed choice
  cannot change the edge rule.
- Isolated browser acceptance on a non-8787 editor port loads the reported map,
  selects Void drawing mode, and captures the marked boundary at orientations
  0/90/180/270 before and after the correction. A nearby legitimate
  Floor→Floor face and an explicit authored boundary remain visible in the
  same captures. Editing the adjacent cell between occupied and Void updates
  immediately with no page/console error or stale face.

## Validation and handoff

During implementation, run only focused elevation/materialization or preview
tests and `npm run lint:working-tree`. At coder handoff run the affected engine
and client workspace typechecks and the smallest seeded movement/determinism
shard. A reviewer may run one bounded cross-lane shard and inspect the four
rotation plus route-overlay captures. The parent owns final `npm run lint`,
`npm test`, and the representative generation sweep immediately before
commit/release gating.

For final-priority Lane D specifically, the coder runs the focused
`terrainPlannerVoid`, Void-mode, editor-world, and editor visual-plan tests,
then the client workspace typecheck and working-tree lint. The reviewer repeats
the four-orientation matrix and inspects the isolated editor captures. Because
this lane is presentation-only, any changed generated floor fingerprint,
movement result, serialized editor map, or normal runtime terrain plan is an
automatic rejection rather than an expected snapshot update.

## Risks and stop conditions

- Anchoring every carved cell near any solid indiscriminately can flatten
  narrow corridors and erase negative terrain. The classifier must be
  ordinary/unowned, and seed-corpus acceptance must prove below-zero variation
  remains.
- Deriving one wall top from incompatible adjacent bases can make the wall
  invisible from its high side or too tall from its low side. Resolve the
  ordinary ground grade first and assert both wall-top conditions; never fix
  this by altering authored geometry.
- Height output changes can invalidate prepared artifacts even when topology
  is unchanged. Fingerprint/version evidence is mandatory before browser
  proof.
- Shared shortest-path prefixes are expected in a spawn-rooted tree. Removing
  or randomizing them can weaken dead-end protection and required reachability.
  Deduplicate drawing first; change engine targets only with exact failing
  evidence.
- Semantic and protection planes are intent/ownership, not authoritative
  movement surfaces. Coloring final cells from them without tile, terrain, and
  feature reconciliation can paint a plausible opening over Bedrock. Final
  raster precedence and hover diagnostics must use all planes.
- Silently clipping an actually invalid route makes the screenshot cleaner
  while leaving gameplay disconnected. Invalid metadata must fail generation;
  client refusal is only a defensive signal for malformed/stale traces.
- Blindly carving every protected cell would destroy intentional authored
  walls because protection is also used for feature shells and room envelopes.
  Repair only the proven route path and respect authored ownership.
- Applying the editor's flat-gap policy in the shared default would erase
  legitimate runtime floating-island and pit faces. Keep the behavior behind
  the editor world's explicit boundary query and prove the absent-query plan is
  byte-for-byte unchanged.
- A cell-wide Void flag can over-cull three valid sides when only one edge is a
  gap. Pass both edge endpoints after view rotation and test each orientation.
- Treating any feature as occupied can preserve the bug through an unrelated
  stair or differently oriented door. Only an explicitly edge-owning feature
  on the tested boundary may override the gap classification.
- Occupancy-sensitive editor geometry can remain stale if cache identity omits
  the edit revision. Reuse the existing revision seam and assert invalidation;
  do not disable terrain caching globally.
- Retaining a label-only duplicate stage gives false observability; deleting a
  conditional stage globally can hide useful no-op evidence. Merge the known
  unconditional back-to-back capture, but explicitly label request-specific
  zero deltas for any conditional phase.
- A delta overlay can become a second source of visual clutter. Keep it a
  native-cell translucent mask, separately toggled and clearly labeled; do not
  overload the magenta route union.
- If the reproduced wall belongs to a room or feature rather than unowned
  ordinary terrain, or if the preview metrics show illegal/disconnected
  routes, stop and re-scope those findings instead of broadening this slice.

## Parent final gate — 2026-08-04

The combined worktree passed `npm run lint`, `npm run typecheck`, and
`npm test` after all four bounded cards completed independent review.
Browser acceptance for Void culling remains a useful manual confirmation but
does not alter normal runtime rendering or finite generation behavior.
