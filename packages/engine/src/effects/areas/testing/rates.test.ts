import { describe, expect, it } from "vitest";
import {
  AreaReactionConsumptionBuffer,
  areaReactionConsumption,
} from "../reactions/rates.js";
import {
  areaTestContent,
  FIRE_AREA_ID,
  OIL_AREA_ID,
} from "./areaTestSupport.js";

describe("area reaction rate consumption", () => {
  it("matches the layer-keyed compatibility result without retaining old rates", () => {
    const layers = [
      { defId: OIL_AREA_ID, remaining: 3, steps: 2, sourceId: "oil-owner" },
      { defId: FIRE_AREA_ID, remaining: 2, steps: 1, sourceId: "fire-owner" },
    ];
    const buffer = new AreaReactionConsumptionBuffer();

    buffer.collect(areaTestContent, layers, 5);

    const compatibility = areaReactionConsumption(areaTestContent, layers, 5);
    expect([buffer.amountAt(0), buffer.amountAt(1)]).toEqual([6, 0]);
    expect(layers.map((layer) => compatibility.get(layer) ?? 0)).toEqual([6, 0]);
    expect(layers.map((layer) => layer.sourceId))
      .toEqual(["oil-owner", "fire-owner"]);

    const oil = layers[0];
    if (!oil) throw new Error("expected the oil test layer");
    buffer.collect(areaTestContent, [oil], 0.5);

    expect(buffer.amountAt(0)).toBe(0);
    expect(buffer.amountAt(1)).toBe(0);
  });
});
