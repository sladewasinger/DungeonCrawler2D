import type Phaser from "phaser";
import { describe, expect, it } from "vitest";
import { SCREEN_TILE_PX } from "../../../../boot/assetManifest.js";
import type { InputController } from "../../../../input/index.js";
import { presentationEntityFilter } from "../entityPresentationFilter.js";

const viewport = {
  x: 0,
  y: 0,
  width: 10 * SCREEN_TILE_PX,
  height: 10 * SCREEN_TILE_PX,
} as Phaser.Geom.Rectangle;

const inputController = {
  reviveHoldView: () => null,
  fistbumpHoldView: () => null,
} as unknown as InputController;

function remote(id: string, x: number, y: number) {
  return {
    snap: { id, kind: "enemy" as const, x, y, z: 0 },
    samples: [],
  };
}

describe("entity presentation filter", () => {
  it("applies toon LOS on desktop independently of viewport culling", () => {
    const filter = presentationEntityFilter({
      inputController,
      localPlayerId: "self",
      viewerX: 1,
      viewerY: 1,
      viewport,
      constrainedPresentation: false,
      terrainVisibility: { isWorldPositionVisible: () => false },
    });

    expect(filter(remote("hidden", 1, 1))).toBe(false);
  });

  it("keeps standard desktop presentation unchanged without toon visibility", () => {
    const filter = presentationEntityFilter({
      inputController,
      localPlayerId: "self",
      viewerX: 1,
      viewerY: 1,
      viewport,
      constrainedPresentation: false,
    });

    expect(filter(remote("far", 100, 100))).toBe(true);
  });
});
