import { TERRAIN } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { GroundLightPass } from "./groundLightPass.js";
import {
  playerGroundLightCells,
  type PlayerGroundLightWorld,
} from "./playerGroundLight.js";
import type { LightSource } from "../core/lightSource.js";

const flatFloor: PlayerGroundLightWorld = {
  terrainAt: () => TERRAIN.Floor,
  groundAt: () => 0,
};

describe("shared ground light search", () => {
  it("uses a smaller capped radius for a torch than the personal reveal", () => {
    const personal = playerGroundLightCells(flatFloor, {
      x: 0.5,
      y: 0.5,
      radiusTiles: 7,
    });
    const torch = playerGroundLightCells(flatFloor, {
      x: 0.5,
      y: 0.5,
      radiusTiles: 1.5,
    });

    expect(torch.length).toBeLessThan(personal.length);
    expect(torch.every((cell) => Math.hypot(cell.tileX, cell.tileY) <= 1.5)).toBe(true);
  });

  it("keeps the personal reveal's exact actor anchor beside its tile cells", () => {
    const pass = new GroundLightPass(flatFloor as never);
    pass.update(frame({
      enabled: true,
      nowMs: 0,
      maximumCells: 12,
      worldLights: [],
      personal: light({ x: 4.25, y: 6.75, groundHeight: 2 }),
    }));

    expect(pass.cellsForMask()).toContainEqual(expect.objectContaining({
      tileX: 4,
      tileY: 6,
      anchorX: 4.25,
      anchorY: 6.75,
      groundHeight: 2,
    }));
  });

  it("refreshes exact anchors within one tile without recomputing broad LOS cells", () => {
    const pass = new GroundLightPass(flatFloor as never);
    pass.update(frame({
      nowMs: 0,
      personal: light({ x: 4.1, y: 6.1, groundHeight: 0 }),
    }));
    const firstBroad = pass.cellsForMask().filter((cell) => cell.anchorX === undefined);

    expect(pass.update(frame({
      nowMs: 1,
      personal: light({ x: 4.9, y: 6.6, groundHeight: -1 }),
    }))).toBe(true);

    const nextCells = pass.cellsForMask();
    const nextBroad = nextCells.filter((cell) => cell.anchorX === undefined);
    expect(nextCells).toContainEqual(expect.objectContaining({
      anchorX: 4.9,
      anchorY: 6.6,
      groundHeight: -1,
    }));
    expect(nextBroad).toEqual(firstBroad);
    expect(nextBroad[0]).toBe(firstBroad[0]);
  });

  it("adds exact fractional stamps for both authored and placed torch sources", () => {
    const pass = new GroundLightPass(flatFloor as never);
    pass.update(frame({
      worldLights: [
        light({ id: "torch:authored", x: -2.25, y: 1.75, groundHeight: 1, kind: "torch" }),
        light({ id: "torch:placed", x: 8.6, y: -3.4, groundHeight: -2, kind: "torch" }),
      ],
    }));

    const anchors = pass.cellsForMask().filter((cell) => cell.anchorX !== undefined);
    expect(anchors).toEqual(expect.arrayContaining([
      expect.objectContaining({ anchorX: -2.25, anchorY: 1.75, groundHeight: 1 }),
      expect.objectContaining({ anchorX: 8.6, anchorY: -3.4, groundHeight: -2 }),
    ]));
  });
});

function frame(overrides: Partial<{
  enabled: boolean;
  nowMs: number;
  maximumCells: number;
  worldLights: readonly LightSource[];
  personal: LightSource;
}> = {}) {
  return {
    enabled: true,
    nowMs: 0,
    maximumCells: 24,
    worldLights: [],
    personal: light({}),
    ...overrides,
  };
}

function light(overrides: Partial<LightSource>): LightSource {
  return {
    id: "personal",
    x: 4.25,
    y: 6.75,
    groundHeight: 0,
    color: 0,
    radiusTiles: 2,
    kind: "personal",
    seed: 0,
    revealRadiusTiles: 2,
    revealCellRadiusTiles: 1,
    revealCellAlpha: 0.16,
    sourceRevealCellRadiusTiles: 0.7,
    sourceRevealCellAlpha: 0.6,
    ...overrides,
  };
}
