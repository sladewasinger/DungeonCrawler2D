import { STEP_UP, TILE, WALL_RISE, ZONE, hash2D, hash2DFloat, type World } from "@dc2d/engine";
import atlas from "./atlas.json";
import { entryClimbDir } from "@dc2d/engine";

/**
 * Pure per-tile frame selection — the single place that turns world
 * geometry into atlas frames. Used by DungeonScene's tilemap builder
 * and by tools/render-sample.ts so sample renders are pixel-identical
 * to the live client.
 *
 * Layers:
 *   base    — floor everywhere (walls stand on real floor) / stairs
 *   border  — floor-side wall shadows and sanctuary bevel rims
 *   overlay — interactables, terrain cliff faces, ledge rims, and the
 *             wall's own brick face (lower half of the wall cell)
 *   cap     — wall TOPS, drawn on a layer shifted half a tile north and
 *             ABOVE entities: the wall's body leans over the tile
 *             behind it, so walking up from the south you stop at its
 *             visible base, and standing north of it you're half-hidden
 *
 * Wall autotile mask: open (non-wall) neighbors N=1, E=2, S=4, W=8.
 */

export interface TileFrames {
  base: number;
  /** Height used to tint the base tile, or null for untinted. */
  baseTintHeight: number | null;
  border: number; // -1 = none
  overlay: number; // -1 = none
  overlayTintHeight: number | null;
  /** Elevated surface frame for the north-shifted caps layer. -1 = none. */
  cap: number;
  capTintHeight: number | null;
}

/**
 * Elevation tint: higher ground renders brighter and warmer, depths
 * darker and cooler — the whole height range stays readable, not just
 * the first step (the old curve capped at h≈1.4 and the world read
 * flat). Shared by the live tilemap layers and the sample renderer.
 */
export function heightTintFactors(h: number): [number, number, number] {
  const t = Math.max(-1.3, Math.min(1, h / 6));
  const g = Math.max(0.5, Math.min(1, 0.78 + 0.22 * t));
  const r = Math.min(1, g + 0.07 * Math.max(0, t));
  const b = Math.min(1, g + 0.09 * Math.max(0, -t));
  return [r, g, b];
}

/** heightTintFactors packed for Phaser's per-tile tint. */
export function heightTint(h: number): number {
  const [r, g, b] = heightTintFactors(h);
  return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
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
    cap: -1,
    capTintHeight: null,
  };

  if (tile === TILE.Wall) {
    let mask = 0;
    NESW.forEach(([dx, dy], i) => {
      const neighborIsWall = world.tileAt(wx + dx, wy + dy) === TILE.Wall;
      const dropsToNeighbor = h - world.heightAt(wx + dx, wy + dy) > STEP_UP;
      if (!neighborIsWall || dropsToNeighbor) mask |= 1 << i;
    });
    // Real floor underneath; the wall's brick face fills its own cell
    // (that's the base you collide with); the top cap goes to the
    // full-tile-north-shifted layer above entities — two tiles tall.
    const floorVariants = atlas.frames.floor;
    const southIsWall = world.tileAt(wx, wy + 1) === TILE.Wall;
    const southOpen = !southIsWall || h - world.heightAt(wx, wy + 1) > STEP_UP;
    const northIsHigherWall =
      world.tileAt(wx, wy - 1) === TILE.Wall && world.heightAt(wx, wy - 1) - h > STEP_UP;
    return {
      base: floorVariants[hash2D(11, wx, wy) % floorVariants.length]!,
      baseTintHeight: h - WALL_RISE,
      border: -1,
      overlay: southOpen ? atlas.frames.wallFace : -1,
      overlayTintHeight: h,
      // The cap renders one tile north. A higher wall there owns that
      // screen space, so its south face must hide this lower cap.
      cap: northIsHigherWall ? -1 : atlas.frames.wallAuto[mask]!,
      capTintHeight: h,
    };
  }

  if (tile === TILE.Stairs) {
    // Single-step entries that wear a full staircase OBJECT (see
    // stairsprites.ts) render as plain ground — the object IS the
    // stairs; tread tiles underneath doubled the art. Climb-S entries
    // (no sprite: the face points away) and long ramps fall through to
    // the tread branch below.
    const objectDir = entryClimbDir(world, wx, wy);
    if (objectDir !== null && objectDir !== 2) {
      const floorVariants = atlas.frames.floor;
      return {
        ...none,
        base: floorVariants[hash2D(11, wx, wy) % floorVariants.length]!,
        baseTintHeight: h,
      };
    }
    // Tread lines run perpendicular to the climb: pick the frame by the
    // dominant WALKABLE slope axis (an east-climbing run must not wear
    // north-south treads, and a cliff dropping off one side must not
    // out-vote the actual climb direction). Two-tile context at half
    // weight lets a run's flat top step inherit its direction.
    const wr = (dh: number) => (Math.abs(dh) <= STEP_UP * 1.5 ? Math.abs(dh) : 0);
    const hE = world.heightAt(wx + 1, wy);
    const hW = world.heightAt(wx - 1, wy);
    const hN = world.heightAt(wx, wy - 1);
    const hS = world.heightAt(wx, wy + 1);
    // Primary vote: the signed THROUGH-climb — a real staircase steps
    // down on one side and up on the other along its climb axis. This
    // is what separates a stair in a terrace-edge notch (both sideways
    // neighbors higher) from the direction you actually walk it.
    const sw = (dh: number) => (Math.abs(dh) <= STEP_UP * 1.5 ? dh : 0);
    const throughEW = Math.abs(sw(hE - h) + sw(h - hW));
    const throughNS = Math.abs(sw(hN - h) + sw(h - hS));
    const ew =
      wr(hE - h) +
      wr(hW - h) +
      0.5 * (wr(world.heightAt(wx + 2, wy) - hE) + wr(world.heightAt(wx - 2, wy) - hW));
    const ns =
      wr(hN - h) +
      wr(hS - h) +
      0.5 * (wr(world.heightAt(wx, wy - 2) - hN) + wr(world.heightAt(wx, wy + 2) - hS));
    const climbsEW = throughEW !== throughNS ? throughEW > throughNS : ew > ns;
    // Run-edge railings, like the pack's own staircases: a rail wherever
    // the run borders a wall or a different level (anything that isn't
    // more stairs or same-height floor).
    const railAt = (dx: number, dy: number): boolean => {
      const t = world.tileAt(wx + dx, wy + dy);
      if (t === TILE.Stairs) return false;
      return t === TILE.Wall || Math.abs(world.heightAt(wx + dx, wy + dy) - h) > 0.5;
    };
    let overlay = -1;
    if (climbsEW) {
      if (railAt(0, -1)) overlay = atlas.frames.stairRailN;
      else if (railAt(0, 1)) overlay = atlas.frames.stairRailS;
    } else {
      if (railAt(-1, 0)) overlay = atlas.frames.stairRailW;
      else if (railAt(1, 0)) overlay = atlas.frames.stairRailE;
    }
    return {
      ...none,
      base: climbsEW ? atlas.frames.stairsEW : atlas.frames.stairs,
      baseTintHeight: h,
      overlay,
      overlayTintHeight: h,
    };
  }

  const sanctuary = world.zoneAt(wx, wy) === ZONE.Sanctuary;
  const grassPatch =
    !sanctuary &&
    tile === TILE.Floor &&
    hash2DFloat(71, Math.floor(wx / 6), Math.floor(wy / 6)) < 0.28;
  const variants = sanctuary ? atlas.frames.sanctuary : grassPatch ? atlas.frames.grass : atlas.frames.floor;
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
        : tile === TILE.DoorSafeRoom
          ? atlas.frames.interact.doorSafeRoom
          : tile === TILE.DoorExit
            ? atlas.frames.interact.doorExit
            : tile === TILE.CraftingTable
              ? atlas.frames.interact.craftingTable
              : tile === TILE.Stash
                ? atlas.frames.interact.stash
                : null;
  if (special !== null) {
    return { ...none, base, baseTintHeight: h, border, overlay: special };
  }

  // Terrain verticality, anchored the way the pack anchors it: a raised
  // tile's own south-edge row carries the cliff FACE — so climbing up
  // from below, your feet stop exactly at the visible base — and
  // drop-offs to the N/E/W draw rim lines along the top's border.
  // Heights are honest everywhere (walls included), so pure height math
  // decides; no tile-kind special cases.
  const dropS = h - world.heightAt(wx, wy + 1);
  let overlay = -1;
  const overlayTintHeight: number | null = h;
  if (dropS > 1.8) {
    overlay = atlas.frames.faceTall[hash2D(13, wx, wy) % 2]!;
  } else if (dropS > STEP_UP) {
    overlay = atlas.frames.faceShort[hash2D(13, wx, wy) % 2]!;
  } else {
    // South drops always took the face path above, so rims mark E/W/N.
    let rimMask = 0;
    if (h - world.heightAt(wx + 1, wy) > STEP_UP) rimMask |= 2;
    if (h - world.heightAt(wx - 1, wy) > STEP_UP) rimMask |= 4;
    if (h - world.heightAt(wx, wy - 1) > STEP_UP) rimMask |= 8; // the top border
    if (rimMask > 0) overlay = atlas.frames.rimBase + rimMask;
  }

  // A two-level platform projects its first top row one tile north.
  // Without this cap, the collision edge is only a thin rim and an
  // actor who jumps onto the platform appears to float over lower art.
  const northDrop = h - world.heightAt(wx, wy - 1);
  const cap = northDrop > 1.8 ? base : -1;
  return {
    base,
    baseTintHeight: h,
    border,
    overlay,
    overlayTintHeight,
    cap,
    capTintHeight: cap >= 0 ? h : null,
  };
}
