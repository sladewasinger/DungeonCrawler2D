import { describe, expect, it } from "vitest";
import type { AreaTileView } from "../areaEffectPool.js";
import { puddleLayerSignature } from "./puddleLayerSignature.js";

const wet = (id: string, neighborMask = 0): AreaTileView => ({
  id,
  effectId: "area-wet",
  x: 0.5,
  y: 0.5,
  groundHeight: 0,
  screenX: 0,
  screenY: 0,
  sprite: "wet",
  neighborMask,
});

describe("puddle layer signature", () => {
  it("is stable until visible topology or orientation changes", () => {
    const original = puddleLayerSignature([wet("0,0")], "wet", 0);
    expect(puddleLayerSignature([wet("0,0")], "wet", 0)).toBe(original);
    expect(puddleLayerSignature([wet("0,0", 2)], "wet", 0)).not.toBe(original);
    expect(puddleLayerSignature([wet("0,0")], "wet", 90)).not.toBe(original);
  });

  it("ignores other material layers", () => {
    const oil = { ...wet("1,0"), sprite: "oil" as const, effectId: "area-oil" };
    expect(puddleLayerSignature([wet("0,0"), oil], "wet", 0))
      .toBe(puddleLayerSignature([wet("0,0")], "wet", 0));
  });
});
