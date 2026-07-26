import { TILE, ZONE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import type { ViewOrientation } from "../view/viewOrientation.js";
import { visibleTerrainFaceAt } from "./stairFace.js";
import type { TerrainWorld } from "./terrainWorld.js";
import type { ViewTerrainWorld } from "./viewWorld.js";

const DELTAS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const;

function stairFixture(direction: number, orientation: ViewOrientation): ViewTerrainWorld {
  const high = DELTAS[direction] ?? DELTAS[0];
  const low = DELTAS[(direction + 2) % 4] ?? DELTAS[2];
  const real: TerrainWorld = {
    tileAt: (x, y) => x === 0 && y === 0 ? TILE.Stairs : TILE.Floor,
    heightAt: (x, y) => x === high.x && y === high.y
      ? 2
      : x === low.x && y === low.y ? 0 : 1,
    zoneAt: () => ZONE.None,
    isSanctuary: () => false,
    isWalkable: () => true,
    groundAt: () => 1,
  };
  return {
    ...real,
    real,
    orientation,
    toReal: () => ({ x: 0, y: 0 }),
    heightAt: (_x, y) => y > 0 ? 0 : 1,
  };
}

describe("stair face suppression", () => {
  it.each([0, 2] as const)(
    "suppresses the false south face beneath a screen N/S ramp (direction %i)",
    (direction) => {
      expect(visibleTerrainFaceAt(stairFixture(direction, 0), 0, 0)).toBeNull();
    },
  );

  it("retains a real side face when the stair runs east/west on screen", () => {
    expect(visibleTerrainFaceAt(stairFixture(1, 0), 0, 0)).not.toBeNull();
  });
});
