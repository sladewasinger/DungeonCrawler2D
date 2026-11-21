import { generationSnapshotDelta, type FloorGenerationSnapshot } from "@dc2d/engine";
import type { GenerationPreviewControls } from "../../controls/generationPreviewControls.js";
import type { GenerationPreviewReplayState } from "../generationPreviewReplay.js";

export function generationPreviewDeltaDrawInput(
  replay: GenerationPreviewReplayState,
  shown: boolean,
  snapshot: FloorGenerationSnapshot,
): { readonly deltaMask?: Uint8Array } {
  if (!shown) return {};
  const previous = replay.trace?.snapshots[replay.snapshotIndex - 1];
  return previous ? { deltaMask: generationSnapshotDelta(previous, snapshot).cellMask } : {};
}

export function updateGenerationPreviewStageButtons(
  controls: GenerationPreviewControls,
  replay: GenerationPreviewReplayState,
): void {
  const snapshotCount = replay.trace?.snapshots.length ?? 0;
  controls.previous.disabled = replay.snapshotIndex <= 0;
  controls.next.disabled = snapshotCount === 0 || replay.snapshotIndex >= snapshotCount - 1;
}
