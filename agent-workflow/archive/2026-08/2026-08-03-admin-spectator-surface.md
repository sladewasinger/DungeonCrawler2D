# Admin live spectator surface

- Task: `2026-08-03-admin-spectator-surface`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder James`
- Scope: `packages/client/src/admin/spectator/**`, packages/client/src/admin/catalog/**, related admin lifecycle/view/styles/tests
- Preserve: `The standalone /editor route, generation preview, runtime game, and unrelated dirty worktree changes.`

## Goal

Restore the authenticated `/admin` live spectator view so it visibly renders
the selected player and other entities from `spectatorMap.entities`, follows
the selected player when Free camera is off, and highlights the target. Restore
the runtime entity spawner's Enemy, Item, Weapon, and Pet tab/card layout so all
four selectors remain readable and independently selectable.

## Plan

- [x] Trace admin observer state from websocket update through view rendering.
- [x] Wire the live map/entity renderer or correct the embedded spectator path;
      prove target follow and actor rendering without changing `/editor`.
- [x] Fix the runtime palette's grid placement and preserve all four selectors.
- [x] Add focused observer, actor, and layout-contract tests.
- [x] Record focused validation and hand off to review.

## Decisions

- `/admin` is authenticated operational control; it does not gain generation
  preview or editor functionality.
- Do not use port 8787 for validation; use an explicit isolated server port.
- The live observer consumes the authoritative `adminSpectatorMap` directly;
  track mode supplies its target id to the shared actor plan, while free mode
  intentionally supplies no target and centers on the map center.
- The runtime palette is a full-width second grid row with four desktop tab
  columns and two narrow-screen columns; cards remain independently selectable.
- Catalog assets and the retained embed compatibility implementation are kept
  in cohesive subfolders so the assigned catalog and spectator roots each stay
  within the 12-direct-file limit.

## Handoff

- Changed paths:
  - `packages/client/src/admin/spectator/actors/liveSpectatorActors.test.ts` —
    per-entity renderer regression covering player, enemy, pet, item, weapon,
    projectile, and torch atlas/fallback paths, including target-ring drawing.
  - `packages/client/src/admin/catalog/tests/adminCatalogDom.test.ts` —
    Node-compatible DOM test double proving readable labels, tab roles/aria
    semantics, selected/unselected state, derived tab/panel ID linkage,
    independent tab callbacks, and representative card selection for all four
    categories.
  - `packages/client/src/admin/catalog/assets/adminCatalogImages.ts` — moved
    catalog asset definitions into a cohesive asset subarea.
  - `packages/client/src/admin/spectator/embed/fullSpectatorEmbed.ts` — moved
    retained embed compatibility into its existing embed subarea.
  - `packages/client/src/admin/spectator/adminPlayerObserver.ts` and
    `adminPlayerObserverController.ts` — authenticated observer renders the
    live canvas from `spectatorMap.entities`, preserving player controls and
    zoom/follow lifecycle.
  - `packages/client/src/admin/spectator/adminLiveViewerProjection.ts` — track
    target selection falls back to the selected player; free mode has no target
    and does not follow.
  - `packages/client/src/admin/spectator/liveSpectatorRenderer.ts` and
    `liveSpectatorView.ts` — live map projection supports target-centered
    rendering and zoom.
  - `packages/client/src/admin/spectator/actors/liveSpectatorActors.ts` and
    `actors/liveSpectatorActorPlan.ts` — all map entities are depth-sorted and
    drawn, with target ring/label highlighting and entity-kind rendering.
  - `packages/client/src/admin/spectator/adminPlayerObserver.test.ts` — proves
    authoritative actor coverage, target marking, track fallback, and free
    camera behavior.
  - `packages/client/src/admin/map/camera/adminMapCameraFollow.test.ts` and
    `packages/client/src/admin/lifecycle/adminPageLifecycle.test.ts` — follow
    refresh and spectator-map selection regressions.
  - `packages/client/src/admin/catalog/adminSpawnCatalog.ts`,
    `adminSpawnTypeTabs.ts`, `adminSpawnTypeTabs.test.ts`, and
    `adminSpawnCatalogLayout.test.ts` — four-category palette contract.
  - `packages/client/src/admin/styles/adminTheme.css` — full-width palette row,
    readable four-column desktop tabs, narrow two-column tabs, and bounded
    card grid.
- Validation:
  - Focused admin spectator/catalog/lifecycle command — **12 files / 31 tests
    passed**.
  - `npm run typecheck -w @dc2d/client` — **passed**.
  - Changed-slice ESLint over admin spectator/catalog/lifecycle/view paths —
    **passed**.
  - No browser/server check was run; no port was bound.
  - `npm run lint:working-tree` no longer flags the assigned catalog or
    spectator folders: each has **12 direct source files**. It still reports
    only adjacent pre-existing `packages/client/src/admin/map/camera` at 13
    files, plus legacy oversized-folder notices.
- Preserved: standalone `/editor`, generation preview, engine generation,
  terrain/performance paths, and runtime spawner behavior outside its layout.

## Review

### Implementation handoff — 2026-08-03

Status: `in-review`.

The authenticated admin observer now has one live spectator canvas driven by
the server's `spectatorMap.entities`. Track mode centers on and highlights the
selected target; free mode uses the map center and does not follow. The
runtime palette remains separate from `/editor` and exposes readable Enemy,
Item, Weapon, and Pet tabs/cards in a full-width responsive row.

### Luna review — 2026-08-03

Status: `changes-requested`.

Findings, severity ordered:

- P2 — The actor regression does not cover every `spectatorMap.entities` kind
  or the drawing path. `packages/client/src/admin/spectator/adminPlayerObserver.test.ts:36-49`
  only plans `player`, `enemy`, and `pet` entities and asserts IDs/target flags;
  it never exercises `drawLiveSpectatorActors` with `item`, `weapon`, or
  `torch`. The production branches for those kinds are at
  `packages/client/src/admin/spectator/actors/liveSpectatorActors.ts:105-118`
  and the fallback colors at `:149-155`, so regressions in those required
  categories can pass the focused suite. Add a renderer-level regression with
  all supported entity kinds and both atlas/fallback behavior.

- P2 — The catalog tests do not prove that the four selectors are readable or
  independently selectable. `packages/client/src/admin/catalog/adminSpawnTypeTabs.test.ts:4-9`
  checks only the exported array/count, and
  `packages/client/src/admin/catalog/adminSpawnCatalogLayout.test.ts:4-7`
  checks only the layout string. No focused test invokes the DOM builders in
  `packages/client/src/admin/catalog/adminSpawnTypeTabs.ts:6-35` or
  `packages/client/src/admin/catalog/adminSpawnCatalog.ts:44-83` to verify
  labels, tab semantics, card selection, and callback dispatch. Add a DOM/test
  double regression for all four tabs and representative cards.

Validation evidence:

- Focused admin spectator/catalog/lifecycle/map checks: **11 files / 34 tests
  passed**.
- Changed-slice ESLint over `packages/client/src/admin/spectator`,
  `packages/client/src/admin/catalog`,
  `packages/client/src/admin/lifecycle/adminPageLifecycle.ts`, and
  `packages/client/src/admin/map/camera/adminMapCameraFollow.test.ts`:
  **passed**.
- `npm run lint:working-tree`: **failed only at the changed-folder-size
  subcheck**. `packages/client/src/admin/catalog` and
  `packages/client/src/admin/spectator` each have 13 direct source files, and
  the adjacent `packages/client/src/admin/map/camera` also has 13, versus the
  limit of 12 (`scripts/check-folder-size.mjs:7,68-86`). The map/camera result
  is adjacent existing worktree scope rather than a finding against this
  spectator implementation. The command also reported pre-existing legacy
  oversized folders; no ESLint or config-doc error was reported.

### Luna P2 resolution — 2026-08-03

Status: `in-review`.

- Renderer coverage now draws every supported `spectatorMap.entities` kind,
  including item, weapon, torch, and projectile, and exercises both ready
  atlas sprites and unavailable-atlas fallback drawing.
- The catalog DOM test double invokes the actual builders and verifies all four
  readable labels, tab roles/ARIA relationships, independent tab callbacks,
  selected-card semantics, and representative card callbacks.
- Catalog and spectator cohesive subareas were split to **12 direct source
  files each**. The adjacent map/camera folder remains the only changed-tree
  size report outside this card's scope.
- Both P2 findings are resolved without changing `/editor`, engine, terrain,
  performance, or runtime behavior.

### Luna final P2 resolution — 2026-08-03

Status: `in-review`.

The catalog regression now derives the active tab and tabpanel from the
generated DOM and asserts `activeTab.getAttribute("aria-controls") ===
panel.id` plus `panel.getAttribute("aria-labelledby") === activeTab.id` for
each Enemy, Item, Weapon, and Pet render. No literal ID can satisfy the test
when the generated linkage is mismatched.

Final focused tests, client typecheck, and changed-slice ESLint are green. The
assigned catalog and spectator roots remain at 12 direct source files each.

### Luna re-review P2 resolution — 2026-08-03

Status: `in-review`.

- Each supported actor kind is rendered in isolation and asserted against its
  exact atlas or fallback operation count; aggregate draw totals are no longer
  the acceptance proof.
- Each catalog render now asserts the labeled tablist, all four tab labels and
  `aria-selected` values, and the active tabpanel's `aria-labelledby` link.
- Final focused tests, typecheck, and scoped ESLint are green. The assigned
  catalog and spectator roots remain at 12 direct files each; working-tree
  lint reports only the adjacent pre-existing map/camera size finding.

### Luna re-review — 2026-08-03

Status: `changes-requested`.

Findings, severity ordered:

- P2 — The renderer regression enumerates all seven supported kinds, but its
  assertions remain aggregate and can pass while one kind is skipped. In
  `packages/client/src/admin/spectator/actors/liveSpectatorActors.test.ts:7-17`,
  `drawImage > 0` and `fillRect >= entityCount()` only prove that some actors
  drew; the fallback threshold is especially non-discriminating because each
  surviving actor can contribute multiple rectangles. The fixture does include
  item, weapon, projectile, and torch at `:72-80`, but it does not associate any
  draw/fallback operation with those entities. Add per-entity draw tracing or
  targeted assertions that each supported kind takes its atlas/fallback path.

- P2 — The catalog DOM regression still does not verify the complete ARIA
  contract. `packages/client/src/admin/catalog/tests/adminCatalogDom.test.ts:34-47`
  checks readable tab text, `role="tab"`, `aria-controls`, callbacks, and
  representative card selection, but never checks the tablist label,
  `aria-selected`, or the panel's `role="tabpanel"`/`aria-labelledby` linkage
  emitted by `packages/client/src/admin/catalog/adminSpawnTypeTabs.ts:10-33`
  and `packages/client/src/admin/catalog/adminSpawnCatalog.ts:53-59`. Add
  assertions for the selected/unselected state and panel relationships for all
  four tab renders.

Validation evidence:

- Scoped spectator/catalog/lifecycle/map checks: **15 files / 44 tests
  passed**.
- Changed-slice ESLint over the assigned spectator/catalog/lifecycle paths and
  the related camera-follow test: **passed**.
- Assigned folder-size checks: **clear**; both
  `packages/client/src/admin/catalog` and
  `packages/client/src/admin/spectator` have 12 direct source files.
- `npm run lint:working-tree`: exited nonzero only for the adjacent,
  pre-existing `packages/client/src/admin/map/camera` count of 13; legacy
  oversized-folder notices were also reported. No relevant ESLint or
  config-doc error occurred.

### Luna final re-review — 2026-08-03

Status: `changes-requested`.

Finding:

- P2 — The catalog test now checks the expected ARIA roles and values, but it
  still does not prove the actual tab-to-panel relationships. At
  `packages/client/src/admin/catalog/tests/adminCatalogDom.test.ts:40-43`,
  `aria-controls` is compared to the literal `admin-spawn-catalog-panel` and
  `aria-labelledby` to a constructed literal, rather than to `panel.id` and
  the active tab's `id`. A regression that changes either emitted ID can
  therefore leave both sides mismatched while the test remains green. Assert
  each tab's `aria-controls === panel.id` and the active panel's
  `aria-labelledby === activeTab.id` for all four renders.

Validation evidence:

- Scoped spectator/catalog/lifecycle/map checks: **15 files / 44 tests
  passed**.
- Changed-slice ESLint over the assigned spectator/catalog/lifecycle paths and
  related camera-follow test: **passed**.
- Assigned folder-size checks: **clear**; `packages/client/src/admin/catalog`
  and `packages/client/src/admin/spectator` each have 12 direct source files.
- `npm run lint:working-tree`: exited nonzero only for the acknowledged
  adjacent pre-existing `packages/client/src/admin/map/camera` count of 13;
  legacy oversized-folder notices were also reported.

### Luna approval review — 2026-08-03

Status: `in-review`.

Findings: None.

Evidence:

- `packages/client/src/admin/spectator/actors/liveSpectatorActors.test.ts:7-21`
  isolates every supported player, enemy, pet, item, weapon, projectile, and
  torch entity and asserts its exact atlas/fallback and label path, plus target
  highlighting.
- `packages/client/src/admin/catalog/tests/adminCatalogDom.test.ts:23-75`
  covers all four readable categories, tablist/tab/tabpanel semantics,
  selected state, callbacks, representative cards, and cross-element
  `aria-controls === panel.id` / `aria-labelledby === activeTab.id` links.
- Scoped spectator/catalog/lifecycle/map checks: **15 files / 44 tests passed**.
- Changed-slice ESLint: **passed**.
- Assigned folder-size checks are clear: `admin/catalog` and `admin/spectator`
  each contain 12 direct source files. `npm run lint:working-tree` reports only
  the acknowledged adjacent pre-existing `admin/map/camera` size failure and
  unrelated legacy notices.

The admin spectator/catalog slice is ready for parent final gates. No editor,
engine, terrain, performance, or subagent work was performed.

## Memory candidates

- None.

## Finalization — 2026-08-03

- Final-gate scope: authenticated admin spectator and runtime palette slice;
  repository-wide gates remain parent-owned until the combined roadmap is
  ready.
- Final evidence: 15 focused files and 44 tests passed; client typecheck,
  changed-slice ESLint, and assigned catalog/spectator folder-size checks
  passed.
- Known combined-worktree issue: the adjacent pre-existing
  `admin/map/camera` folder-size warning remains tracked separately.
- Memory promotion: the parent retained the live-spectator and DOM-contract
  testing lessons in the relevant task/memory records.
- Master roadmap: admin spectator slice complete; terrain, lighting,
  performance, and remaining bug slices remain active/planned.
