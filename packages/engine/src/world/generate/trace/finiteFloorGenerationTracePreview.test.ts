import { describe, expect, it } from "vitest";
import { DEFAULT_FLOOR_GENERATION_CONFIG, generateFiniteFloorTraceForTests } from "../finiteFloor.js";
import { normalizeFloorGenerationConfig } from "../config/floorGenerationConfig.js";

const FINAL_STAGE_ID = "final-validated" as const;
const EFFECTIVE_CONFIG_REQUEST = {
  worldSeed: 2, floor: 1, config: { roomSizeVariation: 10 },
} as const;
const OPTIONAL_CONFIG_REQUEST = {
  worldSeed: 2,
  floor: 1,
  config: {
    roomTargetCount: 300, roomSize: 25, roomSizeVariation: 10,
    minimumLoopPathSaving: 44, territoryLayoutDensity: 0.65,
    targetLoopCount: DEFAULT_FLOOR_GENERATION_CONFIG.targetLoopCount,
  },
} as const;
const effectiveConfigTrace = generateFiniteFloorTraceForTests(EFFECTIVE_CONFIG_REQUEST);
const optionalConfigTrace = generateFiniteFloorTraceForTests(OPTIONAL_CONFIG_REQUEST);

describe("finite generation preview boundary", () => {
  it("publishes the effective normalized preview configuration", () => {
    const requestedVariation = 10;
    const trace = effectiveConfigTrace.trace;
    const normalized = normalizeFloorGenerationConfig({ roomSizeVariation: requestedVariation });
    expect(trace.effectiveConfiguration).toMatchObject({
      roomSizeVariation: normalized.roomSizeVariation,
      roomMinWidth: normalized.roomMinWidth,
      roomMaxWidth: normalized.roomMaxWidth,
    });
  });

  it("accepts optional loop and density limits without retrying a usable editor request", () => {
    const config = OPTIONAL_CONFIG_REQUEST.config;
    const final = optionalConfigTrace.trace.snapshots.at(-1);
    expect(final?.stageId).toBe(FINAL_STAGE_ID);
    expect(final?.rooms.length).toBeLessThanOrEqual(config.roomTargetCount);
    expect(final?.connectors.filter(({ loop }) => loop).length).toBeLessThanOrEqual(config.targetLoopCount);
    expect(optionalConfigTrace.floor.topology.work?.loopBudgetExhausted).toBe(false);
    expect(optionalConfigTrace.trace.effectiveConfiguration?.roomSizeVariation).toBe(
      normalizeFloorGenerationConfig(config).roomSizeVariation,
    );
  });
});
