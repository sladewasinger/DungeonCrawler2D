import { describe, expect, it } from "vitest";
import type { LightSource } from "./lightSource.js";
import { lightHaloPresentation } from "./lightHaloPresentation.js";

function light(kind: LightSource["kind"], emitsTorchLight = false): LightSource {
  return {
    id: kind,
    x: 0,
    y: 0,
    color: 0xffffff,
    radiusTiles: 4,
    kind,
    seed: 0,
    emitsTorchLight,
  };
}

describe("light halo presentation", () => {
  it("clamps elemental lights to a small decorative accent", () => {
    const presentation = lightHaloPresentation(light("poison"));
    expect(presentation.radiusTiles).toBeLessThan(4);
    expect(presentation.alphaMultiplier).toBeLessThan(1);
  });

  it("preserves torch strength for wall, placed, and flying torches", () => {
    expect(lightHaloPresentation(light("torch")).radiusTiles).toBe(4);
    expect(lightHaloPresentation(light("fire", true)).radiusTiles).toBe(4);
  });
});
