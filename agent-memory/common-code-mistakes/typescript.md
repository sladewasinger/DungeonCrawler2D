# TypeScript Architecture and Clean Code

Use this file for confirmed recurring mistakes involving TypeScript boundaries,
coupling, state ownership, validation, naming, function size, or modularity.
Read it before implementing a cross-module or stateful change.

## Share domain classifiers across presentation paths

- Mistake: the admin spectator copied gameplay terrain-material precedence
  locally after reusing the gameplay geometry planner.
- Why it failed: the two paths drifted on territory roles and multi-height
  wall-feature segmentation even though they rendered the same world data.
- Prevention: extract pure domain classifiers at the shared terrain boundary
  and consume them from both gameplay and operational presentation adapters;
  parity tests should exercise the shared decisions and segmented geometry.
- Evidence: [admin spectator normal terrain](../../agent-workflow/04_finalize/2026-08-03-admin-spectator-normal-terrain.md)
  Sol review rounds.
- Last confirmed: 2026-08-03

## Preserve exact optional-property semantics

- Mistake: passed a possibly-undefined optional property into a helper whose
  `exactOptionalPropertyTypes` contract allowed omission or `null`, but not
  explicit `undefined`.
- Why it failed: the client typecheck correctly rejected the widened value at
  the rendering boundary.
- Prevention: omit the property when the value is undefined and preserve an
  explicit null when null carries meaning; do not weaken compiler settings.
- Evidence: [editor preview typecheck](../../agent-workflow/04_finalize/2026-08-03-editor-preview-typecheck.md)
  focused review.
- Last confirmed: 2026-08-03

Add entries using the schema in [`../CONTEXT.md`](../CONTEXT.md). Prefer a concise
prevention rule backed by a real repository failure.
