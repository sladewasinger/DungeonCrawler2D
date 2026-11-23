# Sandbox Pose Tuner (`packages/client/src/sandbox/poseTuner`)

Interactive right-hand drawer mounted inside `/?sandbox=1` (toggle via **Pose Tuner** toolbar button or open automatically with `?sandbox=1&tuner=1`):
- `poseTunerStyles.ts`: Drawer and slider/pill CSS styles.
- `poseTunerControls.ts`: Stateless range slider, checkbox, pill-group, and event-isolation helpers.
- `poseTunerSections.ts`: Parameter editors for Empty Left/Right arms (offsets, elbow bend limit/sign, split upper/forearm/hand depth, shading/tapering), Sword, Lantern, and Two-Handed Bow across all 8 directions and both Female & Male rigs.
- `poseTunerPanel.ts`: Orchestrates preview overrides (`Body`, `Loadout`, `Lantern`, `Bow Charge`, `8-Dir Lock / Mouse`), E↔W mirroring, body copying, reset, and **Save to Repo** persistence via `/__dev/save-pose-tuning`.
