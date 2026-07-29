import { describe, expect, it } from "vitest";
import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import { groundToScreen } from "../../../render/entities/geometry/worldToScreen.js";
import type { AreaTileView } from "../areaEffectPool.js";
import { AREA_POISON_BUBBLES } from "../presentation/areaVisualStyle.js";
import {
  createPoisonBubbleFrame,
  createPoisonBubbleSamples,
  updatePoisonBubbleFrame,
} from "./poisonBubbleMotion.js";

function tile(id: string, x: number, groundHeight = 0): AreaTileView {
  const screen = groundToScreen(x, 0, groundHeight);
  return {
    id,
    effectId: "area-poison",
    x,
    y: 0,
    groundHeight,
    screenX: screen.x,
    screenY: screen.y,
    sprite: "poison",
    neighborMask: 0,
  };
}

describe("connected poison-pool bubbles", () => {
  it("covers cells before adding a second deterministic bubble pass", () => {
    const tiles = [tile("a", 0), tile("b", 1), tile("c", 2)];
    const samples = createPoisonBubbleSamples(tiles, 6);
    expect(samples).toHaveLength(6);
    expect(createPoisonBubbleSamples(tiles, 6)).toEqual(samples);
  });

  it("keeps materially sized bubbles inside their poison cell", () => {
    const source = tile("contained", 0);
    const center = { x: source.screenX, y: source.screenY };
    const [sample] = createPoisonBubbleSamples([source], 1);
    expect(sample).toBeDefined();
    expect(Math.abs(sample!.x - center.x) + AREA_POISON_BUBBLES.maximumRadiusPx)
      .toBeLessThan(SCREEN_TILE_PX / 2);
    const frame = createPoisonBubbleFrame();
    updatePoisonBubbleFrame(frame, sample!, 450);
    expect(frame.radiusX).toBeGreaterThanOrEqual(4);
    expect(frame.radiusY).toBeLessThan(frame.radiusX);
  });
});
