import { describe, expect, it } from "vitest";
import { hashString } from "../../core/rng.js";
import { TILE } from "../core/types.js";
import { World } from "../core/world.js";
import { DEFAULT_FLOOR_GENERATION_CONFIG, FLOOR_SEMANTIC, generateFiniteFloor, generateFiniteFloorTrace } from "./finiteFloor.js";
import { localIndex } from "./finiteFloorBuffers.js";
import { analyzeFloorMovement } from "./finiteFloorMovement.js";
import { disconnectedWalkableCells } from "./connections/validation/finiteFloorRequiredConnectivity.js";
import { TERRITORY_IDS } from "./territories/territoryCatalog.js";
import { floorConfigurationFingerprint, normalizeFloorGenerationConfig } from "./config/floorGenerationConfig.js";
import { connectDungeonRegions } from "./finiteFloorRegionConnections.js";
import { corridorWidthFixture } from "./test-support/finiteFloorTopology.js";

describe("finite floor topology policy", () => {
  it("connects the seeded-region regression floor without an orphan component", () => {
    const floor = generateFiniteFloor({ worldSeed: 7932, floor: 2 });
    expect(floor.topology.spanningConnectorCount).toBe(floor.topology.regionCount - 1);
  }, 30_000);

  it("records genuine spanning connectors, useful loops, and selective dead-end pruning", () => {
    const floor = generateFiniteFloor({ worldSeed: hashString("finite-topology-policy"), floor: 2 });
    expect(floor.topology.spanningConnectorCount).toBe(floor.topology.regionCount - 1);
    expect(floor.topology.connectorCandidateCount).toBeGreaterThan(floor.topology.spanningConnectorCount);
    expect(floor.topology.loopConnectorCount).toBe(DEFAULT_FLOOR_GENERATION_CONFIG.targetLoopCount);
    expect(floor.connectors.filter(({ loop }) => loop)).toHaveLength(floor.topology.loopConnectorCount);
    expect(floor.connectors.filter(({ loop }) => loop).every(({ pathSaving }) =>
      pathSaving >= DEFAULT_FLOOR_GENERATION_CONFIG.minimumLoopPathSaving)).toBe(true);
    expect(floor.topology.prunedDeadEndCount).toBeGreaterThan(0);
    expect(floor.topology.retainedDeadEndCount).toBeGreaterThan(0);
    expect(floor.topology.ordinaryCorridorWidthMinimum).toBe(DEFAULT_FLOOR_GENERATION_CONFIG.ordinaryCorridorWidthMin);
    expect(floor.topology.ordinaryCorridorWidthMaximum).toBe(DEFAULT_FLOOR_GENERATION_CONFIG.ordinaryCorridorWidthMax);
    expect(new Set(floor.topology.ordinaryCorridorWidths).size).toBeGreaterThan(1);
    expect(new Set(floor.territoryLayouts.map(({ layoutSignature }) => layoutSignature)).size).toBe(floor.configuration.territoryRoster.length);
    expect(floor.territories.every(({ visualIdentity, ownershipTags }) => visualIdentity.length > 0 && ownershipTags.length > 0)).toBe(true);
    const layouts = Object.fromEntries(floor.territoryLayouts.map((layout) => [layout.layoutSignature, layout]));
    expect(layouts["workshop-clusters"]?.openedCells).toBeGreaterThan(0);
    expect(layouts["workshop-clusters"]?.obstacleCells).toBeGreaterThan(0);
    expect(layouts["radial-brood-chambers"]?.branchPockets).toBeGreaterThan(0);
    expect(layouts["cell-block-guard-loops"]?.obstacleCells).toBeGreaterThan(0);
    expect(layouts["ritual-rings"]?.elevatedCells).toBeGreaterThan(0);
  }, 60_000);
  it("uses configured ordinary corridor widths in generated topology", () => {
    const config = normalizeFloorGenerationConfig({ ordinaryCorridorWidthMin: 5, ordinaryCorridorWidthMax: 6 });
    const fixture = corridorWidthFixture();
    const result = connectDungeonRegions({
      buffers: fixture.buffers, bounds: fixture.bounds, seed: 7,
      corridorWidth: config.ordinaryCorridorWidthMin, corridorWidthMax: config.ordinaryCorridorWidthMax,
      connectorDensity: 1, preferredRegionPoints: fixture.points,
    });
    expect(result.mergeCount).toBe(3);
    expect(Math.min(...result.bridgeWidths)).toBeGreaterThanOrEqual(config.ordinaryCorridorWidthMin);
    expect(Math.max(...result.bridgeWidths)).toBeLessThanOrEqual(config.ordinaryCorridorWidthMax);
    expect(new Set(result.bridgeWidths).size).toBeGreaterThan(1);
  });
  it("materializes non-default territory geometry and material mappings", () => {
    const floor = generateFiniteFloor({
      worldSeed: hashString("finite-non-default-territories"),
      floor: 2,
      config: { territoryRoster: [
        TERRITORY_IDS.BoneTitheOssuary, TERRITORY_IDS.MyconidBellows,
        TERRITORY_IDS.ClockworkReliquary, TERRITORY_IDS.CrystalResonatorGuild,
      ] },
    });
    expect(floor.territories.map(({ materialIndex }) => materialIndex)).toEqual([2, 1, 4, 4]);
    expect(floor.biome).toContain(4);
    expect(floor.territoryLayouts.every(({ geometryMetrics }) =>
      (geometryMetrics.structuralCells ?? 0) > 0)).toBe(true);
    expect(floor.identity.configurationFingerprint).not.toBe(
      floorConfigurationFingerprint(normalizeFloorGenerationConfig(undefined)));
  }, 30_000);
  it("places reproducible ordinary rooms across the usable envelope", () => {
    const config = { roomTargetCount: 24, roomAttemptBudget: 4096 };
    const request = { worldSeed: hashString("distributed-room-placement"), floor: 2, config };
    const first = generateFiniteFloor(request);
    const second = generateFiniteFloor(request);
    expect(first.rooms.map(({ x0, y0 }) => `${x0},${y0}`)).toEqual(
      second.rooms.map(({ x0, y0 }) => `${x0},${y0}`),
    );
    expect(first.rooms).toHaveLength(config.roomTargetCount);
    expect(first.rooms.length).toBeLessThan(config.roomAttemptBudget);
    const centers = first.rooms.map(({ center }) => center);
    const minX = Math.min(...centers.map(({ x }) => x));
    const maxX = Math.max(...centers.map(({ x }) => x));
    const minY = Math.min(...centers.map(({ y }) => y));
    const maxY = Math.max(...centers.map(({ y }) => y));
    expect(minX).toBeLessThan(first.bounds.minX + first.bounds.width * 0.35);
    expect(maxX).toBeGreaterThan(first.bounds.minX + first.bounds.width * 0.65);
    expect(minY).toBeLessThan(first.bounds.minY + first.bounds.height * 0.35);
    expect(maxY).toBeGreaterThan(first.bounds.minY + first.bounds.height * 0.65);
    expect(new Set(centers.map(({ x, y }) => `${x % 2},${y % 2}`)).size).toBeGreaterThan(1);
  }, 30_000);
  it("keeps a high-target floor usable when room admission is best-effort", () => {
    const floor = generateFiniteFloor({
      worldSeed: 2, floor: 1, config: { roomTargetCount: 300, roomSize: 25, roomSizeVariation: 10 },
    });
    expect(floor.rooms.length).toBeLessThan(floor.configuration.roomTargetCount);
    expect(floor.rooms.every(({ entrances }) => entrances.length > 0)).toBe(true);
  });
  it("connects protected territory transitions under dense editor controls", () => {
    const config = {
      roomTargetCount: 100, roomSize: 15, roomSizeVariation: 2,
      mazeDensity: 0.8, connectorDensity: 0.8, deadEndRemovalFraction: 0.9,
      territoryLayoutDensity: 0.8,
    };
    const floor = generateFiniteFloorTrace({ worldSeed: 1, floor: 1, config }).floor;
    const movement = analyzeFloorMovement({ buffers: floor, spawn: floor.spawn }, floor.bounds);
    const sealedArenas = [...floor.miniBossArenas, ...(floor.bossArena ? [floor.bossArena] : [])];
    expect(disconnectedWalkableCells({
      buffers: floor, bounds: floor.bounds, reachable: movement.reachable, sealedArenas,
    })).toHaveLength(0);
    const ritualTerritory = floor.territoryLayouts.findIndex(({ layoutSignature }) => layoutSignature === "ritual-rings");
    expect(ritualTerritory).toBeGreaterThanOrEqual(0);
    const corridorCell = localIndex({ bounds: floor.bounds, x: 362, y: 280 });
    expect(floor.tiles[corridorCell]).toBe(TILE.Floor);
    expect(floor.semantic[corridorCell]).toBe(FLOOR_SEMANTIC.Corridor);
    expect(floor.protectedCells[corridorCell]).toBe(0);
    expect(floor.territory[corridorCell]).toBe(ritualTerritory);
    expect(movement.reachable[corridorCell]).toBe(1);
    const solidCell = localIndex({ bounds: floor.bounds, x: 362, y: 296 });
    expect(floor.tiles[solidCell]).toBe(TILE.Void);
    expect(floor.semantic[solidCell]).toBe(FLOOR_SEMANTIC.Solid);
    expect(floor.protectedCells[solidCell]).toBe(0);
    expect(floor.territory[solidCell]).toBe(ritualTerritory);
    expect(movement.reachable[solidCell]).toBe(0);
  }, 30_000);
  it("materializes authored gates and elevation transitions with runtime semantics", () => {
    const world = new World(hashString("finite-runtime-semantics"), 2);
    const floor = world.generatedFloor;
    if (!floor) throw new Error("missing finite floor fixture");
    const safeRoom = floor.safeRooms[0];
    const arena = floor.miniBossArenas[0];
    const gate = arena?.gates[0];
    if (!safeRoom || !gate) throw new Error("missing mandatory feature fixture");
    for (let y = safeRoom.door.y - 5; y <= safeRoom.door.y + 5; y++) {
      for (let x = safeRoom.door.x - 1; x <= safeRoom.door.x + 1; x++) {
        expect(world.featureAt(x, y)).not.toBe(TILE.Stairs);
        expect(world.surfaceTileAt(x, y)).not.toBe(TILE.Bedrock);
        expect(world.isWalkable(x, y)).toBe(true);
        expect(world.heightAt(x, y)).toBe(0);
      }
    }
    expect(world.stairHeightAt(safeRoom.door.x + 0.5, safeRoom.door.y + 1.5)).toBeNull();
    expect(world.isWalkable(gate.x, gate.y)).toBe(false);
  }, 10_000);
});
