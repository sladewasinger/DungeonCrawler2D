import { describe, expect, it } from "vitest";
import { hashString } from "../../../../core/rng.js";
import { DEFAULT_FLOOR_GENERATION_CONFIG, generateFiniteFloorTrace } from "../../finiteFloor.js";
import { analyzeFloorMovement } from "../../finiteFloorMovement.js";
import { localIndex } from "../../finiteFloorBuffers.js";
import type { FloorGenerationSnapshot, GeneratedConnector } from "../../finiteFloorTypes.js";
import { disconnectedWalkableCells } from "../validation/finiteFloorRequiredConnectivity.js";
import { longestOrdinaryBarrier } from "./finiteBarrierCrossingAssertions.js";
import { deterministicBarrierOpeningOffsets } from "./finiteMazeCrossings.js";

describe("finite barrier crossings", () => {
  it("measures ordinary barriers across negative and positive world coordinates", () => {
    const bounds = {
      minX: -5, minY: -3, width: 11, height: 7,
      maxX: 5, maxY: 3, minChunkX: -1, minChunkY: -1, maxChunkX: 0, maxChunkY: 0,
    };
    const barrierLength = (walkableX: readonly number[]): number => {
      const semantic = new Uint8Array(bounds.width * bounds.height);
      for (const x of walkableX) {
        semantic[(0 - bounds.minY) * bounds.width + x - bounds.minX] = 1;
        semantic[(-2 - bounds.minY) * bounds.width + x - bounds.minX] = 1;
      }
      const snapshot = {
        bounds,
        semantic,
        roomWallIds: new Int16Array(semantic.length).fill(-1),
      } as unknown as FloorGenerationSnapshot;
      return longestOrdinaryBarrier(snapshot);
    };

    expect(barrierLength([-4, -3, -2, -1])).toBe(4);
    expect(barrierLength([1, 2, 3])).toBe(3);
  });

  it("spaces deterministic apertures across a long ordinary barrier", () => {
    const offsets = deterministicBarrierOpeningOffsets({
      start: 0,
      end: DEFAULT_FLOOR_GENERATION_CONFIG.mazeCorridorWidth * 32 - 1,
      width: DEFAULT_FLOOR_GENERATION_CONFIG.mazeCorridorWidth,
    });
    expect(offsets.length).toBeGreaterThan(1);
    const first = offsets[0];
    const second = offsets[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first === undefined || second === undefined) return;
    const spacing = second - first;
    expect(offsets.slice(2).every((offset, index) => offset - (offsets[index + 1] ?? offset) === spacing)).toBe(true);
  });

  it("admits deterministic maze crossings before final region validation", () => {
    const trace = generateFiniteFloorTrace({
      worldSeed: hashString("finite-barrier-crossings"),
      floor: 2,
      config: { roomTargetCount: 8 },
    });
    const stage = trace.trace.snapshots.find(({ stageId }) => stageId === "maze-fill");
    const final = trace.trace.snapshots.at(-1);
    if (!stage || !final) throw new Error("missing finite barrier trace stages");
    expect(stage.connectors.length).toBeGreaterThan(0);
    expect(stage.connectors.every((connector) => validCrossing(stage, connector))).toBe(true);
    expect(stage.connectors.every((connector) => connector.protected && !connector.loop)).toBe(true);
    expect([...final.connectors]).toEqual(expect.arrayContaining([...stage.connectors]));
    expect(final.rooms.every(({ entrances }) => entrances.length > 0
      && entrances.every(({ width }) => width >= 1 && width <= 2))).toBe(true);
    expect(final.region.every((region, index) => region === 0 || (final.semantic[index] ?? 0) > 0)).toBe(true);
    expect(longestOrdinaryBarrier(stage)).toBeLessThan(Math.min(stage.bounds.width, stage.bounds.height) / 2);
  }, 120_000);

  it("classifies the reported preview bands with native movement topology", () => {
    const generated = generateFiniteFloorTrace({
      worldSeed: 1,
      floor: 1,
      config: {
        roomTargetCount: 100, roomSize: 15, roomSizeVariation: 2,
        mazeDensity: 0.8, connectorDensity: 0.8,
        deadEndRemovalFraction: 0.9, territoryLayoutDensity: 0.8,
      },
    });
    const final = generated.trace.snapshots.at(-1);
    if (!final) throw new Error("missing final preview snapshot");
    const movement = analyzeFloorMovement({ buffers: generated.floor, spawn: generated.floor.spawn }, generated.floor.bounds);
    const sealedArenas = [
      ...generated.floor.miniBossArenas,
      ...(generated.floor.bossArena ? [generated.floor.bossArena] : []),
    ];
    const disconnected = disconnectedWalkableCells({
      buffers: generated.floor,
      bounds: generated.floor.bounds,
      reachable: movement.reachable,
      sealedArenas,
    });
    const spacing = Math.max(8, generated.floor.configuration.mazeCorridorWidth * 4) * 2;
    expect(movement.failures).toEqual([]);
    expect(disconnected).toEqual([]);
    expect(longestOrdinaryBarrier(final)).toBeLessThanOrEqual(spacing);
    expect(final.connectors.every(({ x, y }) => movement.reachable[
      localIndex({ bounds: generated.floor.bounds, x, y })
    ] === 1)).toBe(true);
  }, 120_000);
});

function validCrossing(snapshot: FloorGenerationSnapshot, connector: GeneratedConnector): boolean {
  const index = snapshotIndex(snapshot, connector.x, connector.y);
  if (index < 0 || snapshot.semantic[index] === 0) return false;
  return oppositeNeighbors(snapshot, connector, { x: 0, y: 1 })
    || oppositeNeighbors(snapshot, connector, { x: 1, y: 0 });
}

function oppositeNeighbors(snapshot: FloorGenerationSnapshot, connector: GeneratedConnector, direction: { readonly x: number; readonly y: number }): boolean {
  const first = neighbor(snapshot, connector, { x: -direction.x, y: -direction.y });
  const second = neighbor(snapshot, connector, direction);
  if (!first || !second || first.region <= 0 || second.region <= 0) return false;
  const firstRegion = connector.regionIds[0];
  const secondRegion = connector.regionIds[1];
  if (firstRegion === undefined || secondRegion === undefined) return false;
  const actual = [first.region, second.region].toSorted((left, right) => left - right);
  const expected = [firstRegion, secondRegion].toSorted((left, right) => left - right);
  return actual[0] === expected[0] && actual[1] === expected[1];
}

function neighbor(snapshot: FloorGenerationSnapshot, connector: GeneratedConnector, direction: { readonly x: number; readonly y: number }): { readonly region: number } | null {
  const x = connector.x + direction.x;
  const y = connector.y + direction.y;
  const index = snapshotIndex(snapshot, x, y);
  return index >= 0 && (snapshot.semantic[index] ?? 0) > 0 ? { region: snapshot.region[index] ?? 0 } : null;
}

function snapshotIndex(snapshot: FloorGenerationSnapshot, x: number, y: number): number {
  if (x < snapshot.bounds.minX || x > snapshot.bounds.maxX || y < snapshot.bounds.minY || y > snapshot.bounds.maxY) return -1;
  return (y - snapshot.bounds.minY) * snapshot.bounds.width + x - snapshot.bounds.minX;
}
