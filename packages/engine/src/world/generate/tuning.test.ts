import { describe, expect, it } from "vitest";
import { CHUNK_SIZE } from "../core/types.js";
import { WORLD_GENERATION_TUNING as TUNING } from "./tuning.js";

describe("world generation tuning", () => {
  it("keeps corridor controls compatible with the smallest rooms", () => {
    const minimumLeafRoom = TUNING.roomLayout.minimumRoomSpan +
      TUNING.roomLayout.roomInset.min * 2;
    expect(minimumLeafRoom)
      .toBeLessThanOrEqual(TUNING.roomLayout.minimumPartitionSpan);
    expect(TUNING.corridors.roomToRoomWidth.max)
      .toBeLessThanOrEqual(TUNING.roomLayout.minimumRoomSpan);
    expect(TUNING.corridors.avenueWidth.max)
      .toBeLessThanOrEqual(TUNING.corridors.edgeAnchorMargin);
  });

  it("keeps authored structures inside a fixed 32x32 chunk", () => {
    const arenaClearance = TUNING.bossArena.radius +
      TUNING.bossArena.exitThroatLength + 1;
    expect(arenaClearance).toBeLessThanOrEqual(CHUNK_SIZE / 2);
    expect(TUNING.landmarks.towerOuterRadius * 2 + 1)
      .toBeLessThanOrEqual(CHUNK_SIZE);
    expect(TUNING.landmarks.arenaWallRadius * 2 + 1)
      .toBeLessThanOrEqual(CHUNK_SIZE);
    expect(TUNING.landmarks.shrineRingRadius * 2 + 1)
      .toBeLessThanOrEqual(CHUNK_SIZE);
    expect(TUNING.fixedFeatures.safeRoomRadius +
      TUNING.fixedFeatures.safeRoomBlendMargin).toBeLessThan(CHUNK_SIZE / 2);
  });

  it("keeps dependent feature dimensions internally valid", () => {
    expect(TUNING.districts.chunkSpan).toBeGreaterThanOrEqual(3);
    expect(TUNING.districts.chunkSpan % 2).toBe(1);
    expect(TUNING.heightFeatures.chasmBridgeWidth % 2).toBe(1);
    expect(TUNING.bossArena.wallThickness)
      .toBeLessThanOrEqual(TUNING.bossArena.radius);
    expect(TUNING.descentStructure.backWallDepth)
      .toBeLessThanOrEqual(TUNING.descentStructure.backReach);
  });
});
