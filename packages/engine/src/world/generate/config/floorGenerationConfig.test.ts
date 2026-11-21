import { describe, expect, it } from "vitest";
import { hashString } from "../../../core/rng.js";
import { clampFiniteFloorPosition, FINITE_NOCLIP_EDGE_MARGIN, generateFiniteFloor } from "../finiteFloor.js";
import { DEFAULT_FLOOR_GENERATION_CONFIG } from "../finiteFloorTypes.js";
import { TERRITORY_IDS } from "../territories/territoryCatalog.js";
import {
  FINITE_GENERATION_CONFIG_LIMITS,
  FloorGenerationConfigError,
  floorConfigurationFingerprint,
  normalizeFloorGenerationConfig,
} from "./floorGenerationConfig.js";

describe("finite floor generation configuration", () => {
  it("clamps admin noclip positions to the generated floor envelope", () => {
    const bounds = { minX: -8, minY: -4, maxX: 8, maxY: 4 };
    const clamped = clampFiniteFloorPosition(bounds, { x: 100, y: -100 });
    expect(clamped).toEqual({
      x: bounds.maxX + 1 - FINITE_NOCLIP_EDGE_MARGIN,
      y: bounds.minY + FINITE_NOCLIP_EDGE_MARGIN,
    });
    expect(clampFiniteFloorPosition(null, { x: 100, y: -100 })).toEqual({ x: 100, y: -100 });
  });

  it("normalizes configurable corridor, stair-detail, and territory-roster limits", () => {
    const roster = Object.values(TERRITORY_IDS).slice(0, 12);
    const config = normalizeFloorGenerationConfig({
      ordinaryCorridorWidthMin: 2,
      ordinaryCorridorWidthMax: 3,
      stairTreadCount: 99,
      minimumElevation: -99,
      maximumElevation: 99,
      territoryRoster: roster,
    });

    expect(config.ordinaryCorridorWidthMin).toBe(4);
    expect(config.ordinaryCorridorWidthMax).toBe(4);
    expect(config.mazeCorridorWidth).toBe(4);
    expect(config.stairTreadCount).toBe(12);
    expect(config.minimumElevation).toBe(-4);
    expect(config.maximumElevation).toBe(0);
    expect(config.territoryRoster).toEqual(roster);
    expect(config.biomeCount).toBe(12);
  });

  it("fingerprints corridor, visual tread, and territory roster controls", () => {
    const baseline = normalizeFloorGenerationConfig(undefined);
    const configurations = [
      normalizeFloorGenerationConfig({ ordinaryCorridorWidthMin: baseline.ordinaryCorridorWidthMin + 1 }),
      normalizeFloorGenerationConfig({ mazeCorridorWidth: baseline.mazeCorridorWidth + 1 }),
      normalizeFloorGenerationConfig({ stairTreadCount: baseline.stairTreadCount + 1 }),
      normalizeFloorGenerationConfig({ minimumElevation: baseline.minimumElevation - 1 }),
      normalizeFloorGenerationConfig({ maximumElevation: baseline.maximumElevation - 1 }),
      normalizeFloorGenerationConfig({ territoryRoster: Object.values(TERRITORY_IDS).slice(4, 8) }),
    ];

    expect(baseline.stairTreadCount).toBe(DEFAULT_FLOOR_GENERATION_CONFIG.stairTreadCount);
    expect(configurations.every((config) =>
      floorConfigurationFingerprint(config) !== floorConfigurationFingerprint(baseline))).toBe(true);
    expect(floorConfigurationFingerprint(normalizeFloorGenerationConfig({ maximumElevation: 4 })))
      .toBe(floorConfigurationFingerprint(baseline));
  });
  it("keeps the ordinary elevation range ordered when its ceiling is negative", () => {
    const config = normalizeFloorGenerationConfig({ minimumElevation: 0, maximumElevation: -1 });
    expect(config.minimumElevation).toBe(-1);
    expect(config.maximumElevation).toBe(-1);
  });
  it("bounds adversarial editor controls before generation work begins", () => {
    const config = normalizeFloorGenerationConfig({
      roomTargetCount: Number.MAX_SAFE_INTEGER,
      roomAttemptBudget: Number.MAX_SAFE_INTEGER,
      targetLoopCount: Number.MAX_SAFE_INTEGER,
      minimumLoopPathSaving: Number.MAX_SAFE_INTEGER,
      connectorSpacing: Number.MAX_SAFE_INTEGER,
      roomMinWidth: Number.MAX_SAFE_INTEGER,
      roomMaxWidth: Number.MAX_SAFE_INTEGER,
    });
    expect(config.roomTargetCount).toBe(FINITE_GENERATION_CONFIG_LIMITS.maxRoomTargetCount);
    expect(config.roomAttemptBudget).toBe(FINITE_GENERATION_CONFIG_LIMITS.maxRoomAttemptBudget);
    expect(config.targetLoopCount).toBe(FINITE_GENERATION_CONFIG_LIMITS.maxLoopTargetCount);
    expect(config.minimumLoopPathSaving).toBe(FINITE_GENERATION_CONFIG_LIMITS.maxLoopPathSaving);
    expect(config.connectorSpacing).toBe(FINITE_GENERATION_CONFIG_LIMITS.maxConnectorSpacing);
    expect(config.roomMaxWidth).toBeLessThan(config.width);
    expect(config.roomMaxHeight).toBeLessThan(config.height);
  });
  it("rejects non-finite controls with an actionable normalization error", () => {
    expect(() => normalizeFloorGenerationConfig({ roomTargetCount: Number.NaN })).toThrow(FloorGenerationConfigError);
    expect(() => normalizeFloorGenerationConfig({ roomTargetCount: Number.POSITIVE_INFINITY })).toThrow("roomTargetCount");
  });
  it("starts deterministically with the configured maze density", () => {
    const floor = generateFiniteFloor({ worldSeed: hashString("finite-maze-density-startup"), floor: 2, config: { mazeDensity: 0.75 } });
    expect(floor.configuration.mazeDensity).toBe(0.75);
    expect(floor.tiles.length).toBe(floor.bounds.width * floor.bounds.height);
    expect(floor.identity.configurationFingerprint).toBeTruthy();
  }, 30_000);
});
