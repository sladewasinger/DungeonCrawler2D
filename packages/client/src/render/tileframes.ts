import { STEP_UP, TILE, ZONE, hash2D, type World } from "@dc2d/engine";
import atlas from "./atlas.json";

/**
 * Pure per-tile frame selection — the single place that turns world
 * geometry into atlas frames. Used by DungeonScene's tilemap builder
 * and by tools/render-sample.ts so sample renders are pixel-identical
 * to the live client.
 *
 * Layers:
 *   base    — floor / sanctuary / wall autotile / stairs
 *   border  — floor-side wall shadows and sanctuary bevel rims
 *   overlay — interactables, terrain cliff faces, ledge rims
 *
 * Wall autotile mask: open (non-wall) neighbors N=1, E=2, S=4, W=8.
 */

export interface TileFrames {
  base: number;
  /** Height used to tint the base tile, or null for untinted (walls, stairs). */
  baseTintHeight: number | null;
  border: number; // -1 = none
  overlay: number; // -1 = none
  overlayTintHeight: number | null;
}

const NESW: ReadonlyArray<readonly [number, number]> = [
  [0, -1], // N = 1
  [1, 0], // E = 2
  [0, 1], // S = 4
  [-1, 0], // W = 8
];

export function frameForTile(world: World, wx: number, wy: number): TileFrames {
  const tile = world.tileAt(wx, wy);
  const h = world.heightAt(wx, wy);
  const none: Omit<TileFrames, "base"> = {
    baseTintHeight: null,
    border: -1,
    overlay: -1,
    overlayTintHeight: null,
  };

  if (tile === TILE.Wall) {
    let mask = 0;
    NESW.forEach(([dx, dy], i) => {
      if (world.tileAt(wx + dx, wy + dy) !== TILE.Wall) mask |= 1 << i;
    });
    return { ...none, base: atlas.frames.wallAuto[mask]! };
  }

  if (tile === TILE.Stairs) {
    return { ...none, base: atlas.frames.stairs };
  }

  const sanctuary = world.zoneAt(wx, wy) === ZONE.Sanctuary;
  const variants = sanctuary ? atlas.frames.sanctuary : atlas.frames.floor;
  const base = variants[hash2D(11, wx, wy) % variants.length]!;

  // Borders: sanctuary floors get the platform bevel ring; ordinary
  // floors get the dark shadow band where they touch a wall.
  let borderMask = 0;
  NESW.forEach(([dx, dy], i) => {
    const nx = wx + dx;
    const ny = wy + dy;
    if (sanctuary) {
      if (world.tileAt(nx, ny) === TILE.Wall || world.zoneAt(nx, ny) !== ZONE.Sanctuary) {
        borderMask |= 1 << i;
      }
    } else if (world.tileAt(nx, ny) === TILE.Wall) {
      borderMask |= 1 << i;
    }
  });
  const border =
    borderMask === 0
      ? -1
      : (sanctuary ? atlas.frames.sancRimBase : atlas.frames.wallShadowBase) + borderMask;

  const special =
    tile === TILE.DoorPersonal
      ? atlas.frames.interact.doorPersonal
      : tile === TILE.DoorParty
        ? atlas.frames.interact.doorParty
        : tile === TILE.DoorExit
          ? atlas.frames.interact.doorPersonal
          : tile === TILE.CraftingTable
            ? atlas.frames.interact.craftingTable
            : tile === TILE.Stash
              ? atlas.frames.interact.stash
              : null;
  if (special !== null) {
    return { base, baseTintHeight: h, border, overlay: special, overlayTintHeight: null };
  }

  // Terrain verticality: cliff faces where the tile north of us is
  // higher; ledge rims where we drop off to the S/E/W.
  const rise = world.heightAt(wx, wy - 1) - h;
  let overlay = -1;
  let overlayTintHeight: number | null = h;
  if (rise > 2.5) {
    overlay = atlas.frames.faceTall[hash2D(13, wx, wy) % 2]!;
    overlayTintHeight = world.heightAt(wx, wy - 1);
  } else if (rise > STEP_UP) {
    overlay = atlas.frames.faceShort[hash2D(13, wx, wy) % 2]!;
    overlayTintHeight = world.heightAt(wx, wy - 1);
  } else {
    let rimMask = 0;
    if (h - world.heightAt(wx, wy + 1) > STEP_UP) rimMask |= 1;
    if (h - world.heightAt(wx + 1, wy) > STEP_UP) rimMask |= 2;
    if (h - world.heightAt(wx - 1, wy) > STEP_UP) rimMask |= 4;
    if (rimMask > 0) overlay = atlas.frames.rimBase + rimMask;
  }

  return { base, baseTintHeight: h, border, overlay, overlayTintHeight };
}
