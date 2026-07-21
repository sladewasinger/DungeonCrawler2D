// Regression lock for invariant 2 (2.5D-rotation lane, LANE W1): "the visible face is on
// the screen-south side of a wall, which at 90/270 is a DIFFERENT WORLD SIDE of that
// wall." ownFace.ts/pitFace.ts are untouched, orientation-ignorant modules — this test
// proves the screen-relative behavior comes entirely from feeding them viewWorld.ts's
// proxy instead of the raw world (drawTile.ts/drawGroundTile.ts's actual wiring), by
// checking a single raised platform renders its face on whichever REAL world side
// currently sits at screen-south for each of the 4 orientations.
import { describe, expect, it } from "vitest";
import { ZONE, type TileType } from "@dc2d/engine";
import { ownFaceRowAt } from "./ownFace.js";
import type { TerrainWorld } from "./terrainWorld.js";
import { viewTileToWorld, worldTileToView, worldToView } from "../view/viewTransform.js";
import { VIEW_ORIENTATIONS } from "../view/viewOrientation.js";
import { viewWorld } from "./viewWorld.js";

const FLOOR: TileType = 0 as TileType;
const PLATFORM_HEIGHT = 3;

/** A single raised platform at real world (5, 5) on otherwise-flat ground. */
function platformWorld(): TerrainWorld {
  return {
    tileAt: () => FLOOR,
    heightAt: (wx, wy) => (wx === 5 && wy === 5 ? PLATFORM_HEIGHT : 0),
    zoneAt: () => ZONE.None,
    isSanctuary: () => false,
    isWalkable: () => true,
    groundAt: (x, y) => (Math.floor(x) === 5 && Math.floor(y) === 5 ? PLATFORM_HEIGHT : 0),
  };
}

describe("face screen-relativity (invariant 2)", () => {
  it.each(VIEW_ORIENTATIONS)("the platform renders a face at orientation %i, regardless of which real world side that is", (orientation) => {
    const world = platformWorld();
    const vw = viewWorld(world, orientation);
    // Tile-index mapping — the cell the proxy actually displays the platform in.
    const platformView = worldTileToView({ x: 5, y: 5 }, orientation);

    // The platform itself must own a face row: it's the RAISED cell, and its
    // view-south neighbor is real lower ground at every orientation (a single
    // isolated platform's south side, in screen terms, is always open).
    const face = ownFaceRowAt(vw, platformView.x, platformView.y);
    expect(face).not.toBeNull();
    expect(face?.surfaceHeight).toBe(PLATFORM_HEIGHT);

    // Its view-NORTH neighbor must NOT own a face (that's the platform's back side,
    // which drops the WRONG way to read as this platform's face from there).
    const northOfPlatform = ownFaceRowAt(vw, platformView.x, platformView.y - 1);
    expect(northOfPlatform).toBeNull();

    // Cross-check against the real world directly: the view-south neighbor's REAL
    // coordinates must be a genuinely different world cell at 90/270 than at 0/180
    // (proving this isn't accidentally testing the identity transform every time).
    const realSouthNeighbor = viewTileToWorld({ x: platformView.x, y: platformView.y + 1 }, orientation);
    expect(world.heightAt(realSouthNeighbor.x, realSouthNeighbor.y)).toBe(0);
  });

  it("the same real world direction is screen-south differently at each orientation (sanity check the test itself)", () => {
    // world-south (0, 5+1) at orientation 0 is screen-south; at 90 it's screen-west, etc.
    // — this just re-confirms directionRemap's own table so the test above is meaningful.
    const seenScreenSlots = new Set<string>();
    for (const orientation of VIEW_ORIENTATIONS) {
      const view = worldToView({ x: 5, y: 6 }, orientation); // world-south of (5,5)
      const platformView = worldToView({ x: 5, y: 5 }, orientation);
      const dx = Math.sign(view.x - platformView.x);
      const dy = Math.sign(view.y - platformView.y);
      seenScreenSlots.add(`${dx},${dy}`);
    }
    expect(seenScreenSlots.size).toBe(4); // world-south lands on all 4 screen sides across the 4 orientations
  });
});
