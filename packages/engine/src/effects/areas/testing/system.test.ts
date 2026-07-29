import { describe, expect, it } from "vitest";
import { Rng } from "../../../core/rng.js";
import {
  areaTestContent,
  FIRE_AREA_ID,
  flatAreaWorld,
  OIL_AREA_ID,
  STEAM_AREA_ID,
  WET_AREA_ID,
} from "./areaTestSupport.js";
import { AreaSystem } from "../system.js";

describe("area system", () => {
  it("spawns a blob and decays it away", () => {
    const areas = new AreaSystem(areaTestContent, flatAreaWorld());
    areas.spawn({ defId: STEAM_AREA_ID, x: 10, y: 10, radius: 1 });
    expect(areas.size).toBeGreaterThanOrEqual(5);
    expect(areas.defAt(10, 10)).toBe(STEAM_AREA_ID);
    const rng = new Rng(1);
    for (let i = 0; i < 5 / 0.05; i++) areas.tick(0.05, () => rng.next());
    expect(areas.size).toBe(0);
    expect(areas.drainDirty().some((tile) => tile.defId === null)).toBe(true);
  });

  it("fire follows oil without spreading onto bare floor", () => {
    const areas = new AreaSystem(areaTestContent, flatAreaWorld());
    for (let x = 11; x <= 14; x++) {
      areas.place({ defId: OIL_AREA_ID, x, y: 10, steps: 0 });
    }
    areas.place({ defId: FIRE_AREA_ID, x: 10, y: 10, steps: 0 });
    const rng = new Rng(7);
    for (let i = 0; i < 200; i++) areas.tick(0.05, () => rng.next());
    const fires = [10, 11, 12, 13, 14]
      .filter((x) => areas.hasTagAt(x, 10, "fire"));
    expect(fires.length).toBeGreaterThanOrEqual(2);
    expect(areas.defAt(10, 12)).toBeNull();
    expect(areas.defAt(8, 10)).toBeNull();
  });

  it("fire and wet become steam", () => {
    const areas = new AreaSystem(areaTestContent, flatAreaWorld());
    areas.place({ defId: WET_AREA_ID, x: 5, y: 5, steps: 0 });
    areas.place({ defId: FIRE_AREA_ID, x: 5, y: 5, steps: 0 });
    expect(areas.defAt(5, 5)).toBe(STEAM_AREA_ID);
  });

  it("heavy gas never spreads uphill", () => {
    const world = flatAreaWorld({ heightFn: (x) => x * 2 });
    const areas = new AreaSystem(areaTestContent, world);
    areas.place({ defId: "area-poison", x: 10, y: 10, steps: 0 });
    const rng = new Rng(3);
    for (let i = 0; i < 240; i++) areas.tick(0.05, () => rng.next());
    expect(areas.defAt(11, 10)).toBeNull();
    expect(areas.defAt(12, 10)).toBeNull();
  });

  it("smoke never spreads downhill", () => {
    const world = flatAreaWorld({ heightFn: (x) => x * 2 });
    const areas = new AreaSystem(areaTestContent, world);
    areas.place({ defId: "area-smoke", x: 10, y: 10, steps: 0 });
    const rng = new Rng(3);
    for (let i = 0; i < 160; i++) areas.tick(0.05, () => rng.next());
    expect(areas.defAt(9, 10)).toBeNull();
    expect(areas.defAt(8, 10)).toBeNull();
  });

  it("hostile areas stop at sanctuary boundaries", () => {
    const world = flatAreaWorld({ sanctuary: (x) => x >= 12 });
    const areas = new AreaSystem(areaTestContent, world);
    areas.spawn({ defId: FIRE_AREA_ID, x: 12, y: 10, radius: 2 });
    expect(areas.defAt(12, 10)).toBeNull();
    expect(areas.defAt(13, 10)).toBeNull();
    expect(areas.defAt(10, 10)).toBe(FIRE_AREA_ID);
    areas.place({ defId: STEAM_AREA_ID, x: 13, y: 10, steps: 0 });
    expect(areas.defAt(13, 10)).toBe(STEAM_AREA_ID);
  });

  it("respects authored spread generations", () => {
    const areas = new AreaSystem(areaTestContent, flatAreaWorld());
    areas.place({ defId: WET_AREA_ID, x: 50, y: 50, steps: 0 });
    const rng = new Rng(9);
    for (let i = 0; i < 400; i++) areas.tick(0.05, () => rng.next());
    for (const tile of areas.allTiles()) {
      expect(Math.abs(tile.x - 50) + Math.abs(tile.y - 50))
        .toBeLessThanOrEqual(2);
    }
  });
});
