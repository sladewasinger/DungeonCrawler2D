import { TILE, ZONE, type World } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import atlas from "./atlas.json";
import { frameForTile } from "./tileframes";

const openFloor = {
  tileAt: () => TILE.Floor,
  heightAt: () => 0,
  zoneAt: () => ZONE.None,
} as unknown as World;

describe("frameForTile", () => {
  it("uses deterministic, contiguous grass courtyards on ordinary floor", () => {
    const grass = frameForTile(openFloor, 0, 18);
    const matchingPatch = frameForTile(openFloor, 5, 23);
    const stone = frameForTile(openFloor, 6, 18);

    expect(atlas.frames.grass).toContain(grass.base);
    expect(atlas.frames.grass).toContain(matchingPatch.base);
    expect(atlas.frames.floor).toContain(stone.base);
  });

  it("exposes a wall face when a z4 wall top drops south to a z2 wall top", () => {
    const steppedWall = {
      tileAt: () => TILE.Wall,
      heightAt: (x: number, y: number) => (x === 0 && y === 1 ? 2 : 4),
      zoneAt: () => ZONE.None,
    } as unknown as World;

    const high = frameForTile(steppedWall, 0, 0);
    const low = frameForTile(steppedWall, 0, 1);

    expect(high.overlay).toBe(atlas.frames.wallFace);
    expect(high.cap).toBe(atlas.frames.wallAuto[4]);
    expect(low.cap).toBe(-1);
  });

  it("keeps equal-height wall tops seamless", () => {
    const levelWall = {
      tileAt: () => TILE.Wall,
      heightAt: () => 4,
      zoneAt: () => ZONE.None,
    } as unknown as World;

    const wall = frameForTile(levelWall, 0, 0);

    expect(wall.overlay).toBe(-1);
    expect(wall.cap).toBe(atlas.frames.wallAuto[0]);
  });

  it("projects the north edge of a z2 floor so its cliff is visible", () => {
    const terrace = {
      tileAt: () => TILE.Floor,
      heightAt: (_x: number, y: number) => (y < 0 ? 0 : 2),
      zoneAt: () => ZONE.None,
    } as unknown as World;

    const edge = frameForTile(terrace, 0, 0);

    expect(edge.cap).toBe(edge.base);
    expect(edge.capTintHeight).toBe(2);
  });
});
