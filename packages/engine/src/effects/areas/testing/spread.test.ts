import { describe, expect, it } from "vitest";
import { pickAreaSpread } from "../spread.js";
import {
  areaTestContent,
  FIRE_AREA_ID,
  flatAreaWorld,
} from "./areaTestSupport.js";

describe("area spread selection", () => {
  it("keeps authored cardinal candidate order", () => {
    const east = spreadWithSelection(0);
    const west = spreadWithSelection(0.75);

    expect(east).toMatchObject({ x: 11, y: 10 });
    expect(west).toMatchObject({ x: 9, y: 10 });
  });

  it("consumes the selection roll even without eligible neighbors", () => {
    let calls = 0;
    const result = pickAreaSpread({
      content: areaTestContent,
      world: flatAreaWorld(),
      key: "10,10",
      layer: { defId: FIRE_AREA_ID, remaining: 12, steps: 0 },
      dt: 1,
      rng: () => {
        calls++;
        return 0;
      },
      hasTagAt: () => false,
      hasAreaAt: () => false,
    });

    expect(result).toBeNull();
    expect(calls).toBe(2);
  });
});

function spreadWithSelection(selection: number) {
  const rolls = [0, selection];
  let index = 0;
  return pickAreaSpread({
    content: areaTestContent,
    world: flatAreaWorld(),
    key: "10,10",
    layer: { defId: FIRE_AREA_ID, remaining: 12, steps: 0 },
    dt: 1,
    rng: () => rolls[index++] ?? 0,
    hasTagAt: (x, y, tag) => tag === "flammable" && y === 10 && Math.abs(x - 10) === 1,
    hasAreaAt: () => false,
  });
}
