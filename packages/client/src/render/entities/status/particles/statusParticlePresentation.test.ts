import { describe, expect, it } from "vitest";
import { ASSET_KEYS } from "../../../../boot/assetManifest.js";
import { STATUS_VISUAL_STYLE } from "../../combat/statusVisualStyle.js";
import { statusParticlePresentation } from "./statusParticlePresentation.js";

describe("status particle presentation", () => {
  it("uses the actual two-times chunk-tiny recipe for actor fire sparks", () => {
    const spark = statusParticlePresentation("fire-spark", 0);
    expect(spark.texture).toBe(ASSET_KEYS.particleAtlas);
    expect(spark.frame).toBe("chunk_tiny");
    expect(spark.scaleX).toBe(2);
    expect(spark.scaleY).toBe(2);
    expect([0xfff0a0, 0xffb12b]).toContain(spark.tint);
  });

  it("wires poison gas style into the fixed status-particle slots", () => {
    const gas = statusParticlePresentation("poison-gas", 0);
    expect(gas.tint).toBe(STATUS_VISUAL_STYLE.poisoned.gas.color);
    expect(gas.alpha).toBe(STATUS_VISUAL_STYLE.poisoned.gas.alpha);
    expect(gas.scaleX).toBe(STATUS_VISUAL_STYLE.poisoned.gas.scale);
  });
});
