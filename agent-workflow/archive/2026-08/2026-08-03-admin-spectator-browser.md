# Admin spectator browser acceptance

- Task: `2026-08-03-admin-spectator-browser`
- Master roadmap: `agent-workflow/active/2026-08-01-finite-dungeon.md`
- Date: `2026-08-03 America/Denver`
- Status: `complete`
- Parent: `primary thread`
- Coder: `sol-coder / /root/finite_test_coder (persistent)`
- Scope: `packages/client/src/admin/spectator/** only if a browser-proven defect requires it; focused browser evidence and workflow records`
- Preserve: `All unrelated product/admin/editor work, server behavior, existing spectator code unless a concrete browser defect is reproduced, and release files.`

## Goal

Capture an authenticated isolated-port admin spectator view proving normal terrain materials, cliffs/bedrock, live entities, and follow behavior with no page errors.

## Plan

- [x] Start isolated test server/client ports and authenticate an admin spectator session.
- [x] Capture normal terrain, entity, and follow behavior; diagnose a reproduced defect only within scope.
- [x] Record exact browser evidence and changed-file lint before review.

## Decisions

- Earlier socket denial is no longer assumed after the successful isolated spawn-room browser run.
- Acceptance used an isolated no-store server on `8793` and client on `5193`. Authentication was entered through the password control; the configured token was not placed in the URL or persisted by the test.
- One bounded live player supplied entity and movement evidence. The admin session selected that row, entered free spectator mode, then switched to tracked mode without using mutation/catalog controls.
- No scoped product defect reproduced. The live spectator rendered textured normal floor, bedrock wall/cliff geometry, and the player actor with no page or console errors. Product files remain untouched.
- Follow behavior was measured rather than inferred: the tracked player moved from `-49.5, 131086.5` to `-49.5, 131081.4`; the live canvas SHA-256 changed from `eed8ee0fec0b1c53f0506b0aa2cd1657c71722951526c93c6126208bf0cd8e4f` to `fba321e2ada8b02eb2587dc6e674aa3c3d3db28a61391db9c61a43643d8ca040` while status remained `FollowTarget · full in-game view` and the actor stayed centered.

## Handoff

- Changed: `agent-workflow/04_finalize/2026-08-03-admin-spectator-browser.md` only.
- Validation:
  - Authenticated admin acceptance reported `data-authenticated="true"`, selected-player state `true`, free status `Free camera · full in-game view`, tracked status `AdminTarget · full in-game view`, and `data-live="true"`, with zero console/page errors.
  - Follow acceptance reported the tracked coordinate change and distinct before/after canvas hashes above, with zero console/page errors.
  - Visual inspection confirmed ordinary textured terrain, bedrock/cliff boundary treatment, a live named player actor, player-centered tracking, and the authenticated spectator controls. Captures: `/tmp/dc2d-admin-spectator-track.png` and `/tmp/dc2d-admin-spectator-follow-confirmed.png`.
  - `npm run lint:working-tree` — passed; only documented baseline folder-size notices remain.
- Remaining: Parent-owned repository-wide gates and integration.

## Review

### Round 1 — `approved`

- Reviewer: `sol-auditor / /root/finite_fixture_audit`
- Findings:
  - None.
- Verification:
  - Inspected both recorded captures and confirmed authenticated admin-only spectator controls, selected live-player state, textured normal terrain, bedrock/cliff geometry, a named live actor, and player-centered tracking.
  - Confirmed the first capture reports `AdminTarget · full in-game view`; the follow capture reports `FollowTarget · full in-game view` at the recorded destination coordinate, consistent with the card's separate selection and measured-follow phases.
  - Confirmed the card records isolated ports, password-control authentication without URL token persistence, distinct before/after canvas hashes, live coordinate movement, and zero captured page/console errors; no product file was changed.
- Validation:
  - `npm run lint:working-tree` — passed; configuration-doc and changed-folder-size checks also passed.

## Memory candidates

- None.
