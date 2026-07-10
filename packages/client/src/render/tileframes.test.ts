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
});
