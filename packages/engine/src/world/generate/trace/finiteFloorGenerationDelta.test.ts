import { describe, expect, it } from "vitest";
import { generateFiniteFloorTraceForTests } from "../finiteFloor.js";
import { GENERATION_SNAPSHOT_METADATA_NAMES, generationSnapshotDelta } from "./finiteFloorGenerationDelta.js";

const REQUESTS = [
  { worldSeed: 1, floor: 1, config: { roomSizeVariation: 10 } },
  { worldSeed: 2, floor: 1, config: { roomSizeVariation: 10 } },
] as const;

const EXPECTED_STAGE_CELLS = [
  { fingerprint: "8d0800ed", cells: [20068, 153182, 44042, 199231, 69839] },
  { fingerprint: "c40ae6d5", cells: [22560, 148653, 43501, 200032, 69781] },
] as const;

describe("finite generation snapshot deltas", () => {
  it("keeps every retained seed-1/2 stage observably distinct", () => {
    REQUESTS.forEach((request, requestIndex) => {
      const result = generateFiniteFloorTraceForTests(request);
      expect(result.trace.snapshots.map(({ stageId }) => stageId)).toEqual([
        "mandatory-backbone", "rooms-envelopes", "maze-fill",
        "region-connectivity", "loops-dead-ends-elevation", "final-validated",
      ]);
      const deltas = adjacentDeltas(result.trace.snapshots);
      const expected = EXPECTED_STAGE_CELLS[requestIndex];
      if (!expected) throw new Error(`missing stage delta expectation ${requestIndex}`);
      expect(deltas.map(({ changedCellCount }) => changedCellCount)).toEqual(expected.cells);
      expect(deltas.every((delta) => delta.changedCellCount + metadataActivity(delta) > 0)).toBe(true);
      expect(deltas.every((delta) => delta.cellMask.length === result.floor.tiles.length)).toBe(true);
      expect(result.trace.snapshots.at(-1)?.fingerprint).toBeDefined();
      expect(result.floor.identity.fingerprint).toBe(expected.fingerprint);
    });
  }, 60_000);

  it("marks the union of changed native cells without double-counting planes", () => {
    const snapshots = generateFiniteFloorTraceForTests(REQUESTS[0]).trace.snapshots;
    const previous = snapshots[0];
    const current = snapshots[1];
    if (!previous || !current) throw new Error("missing delta fixture stages");
    const delta = generationSnapshotDelta(previous, current);
    const maskCount = delta.cellMask.reduce((count, changed) => count + changed, 0);
    const planeTotal = Object.values(delta.planeChanges).reduce((sum, changed) => sum + changed, 0);
    expect(delta.changedCellCount).toBe(maskCount);
    expect(delta.changedCellCount).toBeGreaterThan(0);
    expect(planeTotal).toBeGreaterThanOrEqual(delta.changedCellCount);
  }, 30_000);
});

function adjacentDeltas(
  snapshots: ReturnType<typeof generateFiniteFloorTraceForTests>["trace"]["snapshots"],
) {
  return snapshots.slice(1).map((snapshot, index) => generationSnapshotDelta(snapshots[index] ?? snapshot, snapshot));
}

function metadataActivity(delta: ReturnType<typeof generationSnapshotDelta>): number {
  return GENERATION_SNAPSHOT_METADATA_NAMES.reduce((total, name) => {
    const change = delta.metadataChanges[name];
    return total + change.added + change.removed + change.changed;
  }, 0);
}
