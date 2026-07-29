import { describe, expect, it } from "vitest";
import {
  areaTestContent,
  FIRE_AREA_ID,
  flatAreaWorld,
  OIL_AREA_ID,
  STEAM_AREA_ID,
} from "./areaTestSupport.js";
import { AreaSystem } from "../system.js";

const X = 4;
const Y = 5;
const FIRE_SOURCE_ID = "fire-owner";
const OIL_SOURCE_ID = "oil-owner";

function burningOil(order: "oil-first" | "fire-first"): AreaSystem {
  const areas = new AreaSystem(areaTestContent, flatAreaWorld());
  const placements = order === "oil-first"
    ? [OIL_AREA_ID, FIRE_AREA_ID]
    : [FIRE_AREA_ID, OIL_AREA_ID];
  for (const defId of placements) {
    const sourceId = defId === FIRE_AREA_ID ? FIRE_SOURCE_ID : OIL_SOURCE_ID;
    areas.place({ defId, x: X, y: Y, steps: 0, sourceId });
  }
  return areas;
}

describe("compound area fuel ignition", () => {
  it("retains oil and fire with independent source attribution", () => {
    const areas = new AreaSystem(areaTestContent, flatAreaWorld());
    areas.place({
      defId: OIL_AREA_ID,
      x: X,
      y: Y,
      steps: 2,
      sourceId: OIL_SOURCE_ID,
    });

    expect(areas.igniteFuelAt({
      fireDefId: FIRE_AREA_ID,
      x: X,
      y: Y,
      sourceId: FIRE_SOURCE_ID,
    })).toBe(true);
    expect(areas.defsAt(X, Y)).toEqual([OIL_AREA_ID, FIRE_AREA_ID]);
    expect(areas.sourceIdFor(X, Y, OIL_AREA_ID)).toBe(OIL_SOURCE_ID);
    expect(areas.sourceIdFor(X, Y, FIRE_AREA_ID)).toBe(FIRE_SOURCE_ID);
    expect(areas.igniteFuelAt({ fireDefId: FIRE_AREA_ID, x: X, y: Y }))
      .toBe(false);
  });

  it("is invariant to oil and fire placement order", () => {
    const oilFirst = burningOil("oil-first");
    const fireFirst = burningOil("fire-first");
    expect(oilFirst.allTiles()).toEqual(fireFirst.allTiles());
    expect(oilFirst.sourceIdFor(X, Y, OIL_AREA_ID))
      .toBe(fireFirst.sourceIdFor(X, Y, OIL_AREA_ID));
    expect(oilFirst.sourceIdFor(X, Y, FIRE_AREA_ID))
      .toBe(fireFirst.sourceIdFor(X, Y, FIRE_AREA_ID));
  });

  it("burns oil away first while fire keeps its own lifetime", () => {
    const areas = burningOil("oil-first");
    areas.drainDirty();
    areas.tick(10.1, () => 1);

    expect(areas.defsAt(X, Y)).toEqual([FIRE_AREA_ID]);
    expect(areas.drainDirty()).toEqual([{ x: X, y: Y, defId: FIRE_AREA_ID }]);
    areas.tick(2, () => 1);
    expect(areas.defAt(X, Y)).toBeNull();
  });

  it("stops accelerated oil consumption when fire is extinguished", () => {
    const areas = burningOil("oil-first");
    areas.tick(1, () => 1);
    areas.place({ defId: STEAM_AREA_ID, x: X, y: Y, steps: 0 });
    expect(areas.hasTagAt(X, Y, "fire")).toBe(false);
    expect(areas.hasTagAt(X, Y, "oil")).toBe(true);

    areas.tick(31, () => 1);
    expect(areas.hasTagAt(X, Y, "oil")).toBe(true);
    areas.tick(1.1, () => 1);
    expect(areas.hasTagAt(X, Y, "oil")).toBe(false);
  });

  it("replicates both layers in canonical channel order", () => {
    const areas = burningOil("fire-first");
    expect(areas.drainDirty()).toEqual([{
      x: X,
      y: Y,
      defId: FIRE_AREA_ID,
      layers: [OIL_AREA_ID, FIRE_AREA_ID],
    }]);
  });

  it("does nothing for bare floor or sanctuary fuel", () => {
    const bare = new AreaSystem(areaTestContent, flatAreaWorld());
    expect(bare.igniteFuelAt({ fireDefId: FIRE_AREA_ID, x: X, y: Y }))
      .toBe(false);

    const sanctuary = new AreaSystem(
      areaTestContent,
      flatAreaWorld({ sanctuary: () => true }),
    );
    sanctuary.place({ defId: OIL_AREA_ID, x: X, y: Y, steps: 0 });
    expect(sanctuary.igniteFuelAt({ fireDefId: FIRE_AREA_ID, x: X, y: Y }))
      .toBe(false);
    expect(sanctuary.defAt(X, Y)).toBe(OIL_AREA_ID);
  });
});
