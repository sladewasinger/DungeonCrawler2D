import type { FloorGenerationSnapshot, FloorGenerationTrace } from "@dc2d/engine";

export interface GenerationPreviewReplayState {
  readonly trace: FloorGenerationTrace | null;
  readonly snapshotIndex: number;
}

export function emptyGenerationPreviewReplay(): GenerationPreviewReplayState {
  return { trace: null, snapshotIndex: 0 };
}

export function setGenerationPreviewTrace(
  state: GenerationPreviewReplayState,
  trace: FloorGenerationTrace,
): GenerationPreviewReplayState {
  return { ...state, trace, snapshotIndex: 0 };
}

export function previousGenerationPreviewStage(
  state: GenerationPreviewReplayState,
): GenerationPreviewReplayState {
  return stepGenerationPreview(state, -1);
}

export function nextGenerationPreviewStage(
  state: GenerationPreviewReplayState,
): GenerationPreviewReplayState {
  return stepGenerationPreview(state, 1);
}

function stepGenerationPreview(
  state: GenerationPreviewReplayState,
  delta: number,
): GenerationPreviewReplayState {
  const lastIndex = Math.max(0, (state.trace?.snapshots.length ?? 1) - 1);
  const snapshotIndex = Math.max(0, Math.min(lastIndex, state.snapshotIndex + delta));
  return { ...state, snapshotIndex };
}

export function currentGenerationPreviewSnapshot(
  state: GenerationPreviewReplayState,
): FloorGenerationSnapshot | null {
  return state.trace?.snapshots[state.snapshotIndex] ?? null;
}
