# Pose Tuning (`packages/client/src/render/poseTuning`)

Canonical 8-directional arm, sword, lantern, and two-handed bow pose configuration shared between the live game renderer and the `/?sandbox=1` Pose Tuner drawer:
- `poseTuningTypes.ts`: TypeScript schemas (`FreeArmDirTune`, `RightCarryDirTune`, `LeftCarryDirTune`, `BowAimDirTune`, `PlayerPoseTuning`) plus `DIR8_LABELS` and `DIR8_VECTORS`.
- `playerPoseTuning.json`: Persisted per-body (`female` / `male`) 8-dir pose table saved by the dev server (`POST /__dev/save-pose-tuning`).
- `poseTuningStore.ts`: Mutable singleton store initialized from `playerPoseTuning.json` with reset, body copy, E/W mirroring, and Vite dev-server persistence.
- `poseTuningHelpers.ts`: Pure lookups consumed by `playerArmIk.ts` and `playerPoseHelpers.ts`.
