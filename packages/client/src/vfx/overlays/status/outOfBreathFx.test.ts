import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import { describe, expect, it } from "vitest";
import { breathScreenAnchor } from "./outOfBreathFx.js";

describe("out-of-breath elevation tracking", () => {
  it("lifts panting puffs by the player's absolute z height", () => {
    const ground = breathScreenAnchor(4, 8, 0);
    const elevated = breathScreenAnchor(4, 8, 2.5);
    expect(elevated.x).toBe(ground.x);
    expect(elevated.y).toBeCloseTo(ground.y - 2.5 * SCREEN_TILE_PX);
  });
});
