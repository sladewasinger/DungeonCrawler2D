import {
  GENERATION_SNAPSHOT_METADATA_NAMES,
  generationSnapshotDelta,
  type FloorGenerationSnapshot,
  type GenerationSnapshotDelta,
} from "@dc2d/engine";
import { currentGenerationPreviewSnapshot, type GenerationPreviewReplayState } from "./generationPreviewReplay.js";

export function generationPreviewStageStatus(replay: GenerationPreviewReplayState): string {
  const snapshot = currentGenerationPreviewSnapshot(replay);
  if (!snapshot) return "Choose Generate to build a local preview.";
  const prefix = `Stage ${replay.snapshotIndex + 1}/${replay.trace?.snapshots.length ?? 0} · ${stageLabel(snapshot)}`;
  const previous = replay.trace?.snapshots[replay.snapshotIndex - 1];
  if (!previous) return `${prefix} · baseline`;
  return `${prefix} · ${deltaLabel(generationSnapshotDelta(previous, snapshot))}`;
}

function deltaLabel(delta: GenerationSnapshotDelta): string {
  const metadata = GENERATION_SNAPSHOT_METADATA_NAMES.flatMap((name) => {
    const change = delta.metadataChanges[name];
    const count = change.added + change.removed + change.changed;
    return count > 0 ? [`${name} Δ${count}`] : [];
  });
  const cells = changedCellLabel(delta.changedCellCount);
  return metadata.length > 0 ? `${cells} · ${metadata.join(", ")}` : cells;
}

function changedCellLabel(count: number): string {
  if (count === 0) return "no changed cells";
  return count === 1 ? "1 changed cell" : `${count} changed cells`;
}

function stageLabel(snapshot: FloorGenerationSnapshot): string {
  const labels: Record<FloorGenerationSnapshot["stageId"], string> = {
    "mandatory-backbone": "Mandatory features and safe routes",
    "rooms-envelopes": "Ordinary rooms, wall envelopes, and admitted entrances",
    "maze-fill": "Maze and territory topology",
    "region-connectivity": "Region connectivity routes",
    "loops-dead-ends-elevation": "Loops, dead ends, and height",
    "final-validated": "Final validated floor",
  };
  return labels[snapshot.stageId];
}
