import { describe, expect, it } from "vitest";
import { hashString } from "../../../core/rng.js";
import {
  DEFAULT_FLOOR_GENERATION_CONFIG,
  finiteFloorForRuntime,
  generateFiniteFloorTrace,
  generateFiniteFloorTraceForTests,
} from "../finiteFloor.js";
import { createFiniteFloorArtifact, restoreFiniteFloorArtifact, type FiniteFloorArtifact } from "../artifact/finiteFloorArtifact.js";
import type { FloorGenerationTraceRequest } from "../finiteFloor.js";
import {
  mutateSnapshotForTest,
  serializeTraceBytes,
  snapshotMutationValues,
} from "./finiteFloorGenerationTraceTestSupport.js";

const REQUEST: FloorGenerationTraceRequest = {
  worldSeed: hashString("finite-generation-trace"),
  floor: 2,
  config: {
    roomTargetCount: 8,
    targetLoopCount: 4, minimumLoopPathSaving: 4,
    connectorSpacing: 2,
  },
};
const FINAL_STAGE_ID = "final-validated" as const;
const HIGH_TARGET_REQUEST: FloorGenerationTraceRequest = {
  worldSeed: 2,
  floor: 1,
  config: { roomTargetCount: 300, roomSize: 25, roomSizeVariation: 10 },
};
const result = generateFiniteFloorTrace(REQUEST);
const repeat = generateFiniteFloorTrace(REQUEST);
const highTarget = generateFiniteFloorTraceForTests(HIGH_TARGET_REQUEST);

describe("finite generation trace", () => {
  it("emits the bounded ordered stage contract", () => {
    expect(result.trace.snapshots.map(({ stageId }) => stageId)).toEqual([
      "mandatory-backbone", "rooms-envelopes", "maze-fill",
      "region-connectivity", "loops-dead-ends-elevation", FINAL_STAGE_ID,
    ]);
  });

  it("is byte-deterministic for identical requests", () => {
    const resultBytes = serializeTraceBytes(result.trace);
    const repeatBytes = serializeTraceBytes(repeat.trace);
    expect(resultBytes === repeatBytes).toBe(true);
    expect(result.floor.identity.fingerprint).toBe(repeat.floor.identity.fingerprint);
  }, 10_000);

  it("does not retain mutation attempts against planes or nested metadata", () => {
    const snapshot = result.trace.snapshots[1];
    if (!snapshot) return;
    const original = snapshotMutationValues(snapshot);
    mutateSnapshotForTest(snapshot);
    expect(snapshotMutationValues(snapshot)).toEqual(original);
    expect(snapshot.fingerprint).toBe(repeat.trace.snapshots[1]?.fingerprint);
  });

  it("does not share mutable planes between stages", () => {
    const first = result.trace.snapshots[0];
    const second = result.trace.snapshots[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!first || !second) return;
    expect(first.height).not.toBe(second.height);
    expect(first.semantic).not.toBe(second.semantic);
    expect(first.fingerprint).toBe(repeat.trace.snapshots[0]?.fingerprint);
  });

  it("keeps the final snapshot equal to the returned floor", () => {
    const final = result.trace.snapshots.at(-1);
    expect(final?.stageId).toBe(FINAL_STAGE_ID);
    if (!final) return;
    expect(Array.from(final.tiles)).toEqual(Array.from(result.floor.tiles));
    expect(Array.from(final.terrain)).toEqual(Array.from(result.floor.terrain));
    expect(Array.from(final.features)).toEqual(Array.from(result.floor.features));
    expect(Array.from(final.featureFaces)).toEqual(Array.from(result.floor.featureFaces));
    expect(Array.from(final.featureHeight)).toEqual(Array.from(result.floor.featureHeight));
    expect(Array.from(final.height)).toEqual(Array.from(result.floor.height));
    expect(Array.from(final.semantic)).toEqual(Array.from(result.floor.semantic));
    expect(Array.from(final.roomWallIds)).toEqual(Array.from(result.floor.roomWallIds));
    expect(Array.from(final.protectedCells)).toEqual(Array.from(result.floor.protectedCells));
    expect(final.surfaceValidation).toEqual({ status: "validated", failures: [] });
    expect(final.rooms).toEqual(result.floor.rooms);
    expect(final.connectors).toEqual(result.floor.connectors);
    expect(final.featureStamps).toEqual(result.floor.featureStamps);
  });

  it("carries catalog labels and ownership hooks for territory preview", () => {
    const snapshot = result.trace.snapshots.find(({ stageId }) => stageId === FINAL_STAGE_ID);
    expect(snapshot?.territoryLayouts.every((layout) =>
      layout.catalogId === layout.territoryId && layout.label.length > 0 &&
      layout.visualIdentity.length > 0 && layout.ownershipTags.length > 0,
    )).toBe(true);
  });

  it("round-trips typed floor planes through the artifact boundary", () => {
    const artifact = createFiniteFloorArtifact(result.floor, encodePlane);
    const restored = restoreFiniteFloorArtifact(artifact, decodePlane);
    expect(restored.identity).toEqual(result.floor.identity);
    expect(restored.height).toBeInstanceOf(Float32Array);
    expect(restored.region).toBeInstanceOf(Uint16Array);
    expect(restored.roomIds).toBeInstanceOf(Int16Array);
    expect(result.floor.height.some((value) => !Number.isInteger(value))).toBe(true);
    expect(result.floor.region.some((value) => value > 0)).toBe(true);
    expect(result.floor.roomIds.some((value) => value < 0)).toBe(true);
    expect(Array.from(restored.height)).toEqual(Array.from(result.floor.height));
    expect(Array.from(restored.region)).toEqual(Array.from(result.floor.region));
  });

  it("rejects missing, misaligned, and incorrectly sized planes", () => {
    const artifact = createFiniteFloorArtifact(result.floor, encodePlane);
    const missing = {
      ...artifact,
      planes: { ...artifact.planes, height: undefined },
    } as unknown as FiniteFloorArtifact;
    expect(() => restoreFiniteFloorArtifact(missing, decodePlane)).toThrow("missing plane height");

    const misaligned = { ...artifact, planes: { ...artifact.planes, height: "00" } };
    expect(() => restoreFiniteFloorArtifact(misaligned, decodePlane)).toThrow("misaligned plane height");

    const wrongLength = { ...artifact, planes: { ...artifact.planes, tiles: "00" } };
    expect(() => restoreFiniteFloorArtifact(wrongLength, decodePlane)).toThrow("invalid length for plane tiles");
  });

  it("keeps ordinary World generation trace-free", () => {
    const floor = finiteFloorForRuntime(REQUEST);
    expect("trace" in floor).toBe(false);
    expect(floor.identity.fingerprint).toBe(result.floor.identity.fingerprint);
  });

  it("publishes a usable trace when a high room target is best-effort", () => {
    const final = highTarget.trace.snapshots.at(-1);
    expect(final?.stageId).toBe(FINAL_STAGE_ID);
    expect(final?.rooms.length).toBeLessThan(HIGH_TARGET_REQUEST.config?.roomTargetCount ?? DEFAULT_FLOOR_GENERATION_CONFIG.roomTargetCount);
    expect(final?.rooms.every(({ entrances }) => entrances.length > 0)).toBe(true);
    expect(final?.semantic.some((semantic) => semantic > 0)).toBe(true);
    expect(final?.rooms).toEqual(highTarget.floor.rooms);
  });

});

function encodePlane(plane: ArrayBufferView): string {
  return [...new Uint8Array(plane.buffer, plane.byteOffset, plane.byteLength)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function decodePlane(encoded: string): Uint8Array {
  const bytes = new Uint8Array(encoded.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(encoded.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}
