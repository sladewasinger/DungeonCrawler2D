import { TILE } from "./types.js";

/** Continuous ground ramping across a staircase's physical run of tiles. */

export interface StairView {
  tileAt(wx: number, wy: number): number;
  heightAt(wx: number, wy: number): number;
}

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

const STAIR_RUN_LENGTH = 2.5;

interface StairRun {
  stairX: number;
  stairY: number;
  direction: number;
}

export function entryClimbDir(world: StairView, wx: number, wy: number): number | null {
  if (world.tileAt(wx, wy) !== TILE.Stairs) return null;
  const h = world.heightAt(wx, wy);
  for (let direction = 0; direction < DIRS.length; direction++) {
    const dir = DIRS[direction];
    if (!dir) continue;
    const [dx, dy] = dir;
    if (world.tileAt(wx + dx, wy + dy) === TILE.Stairs) continue;
    if (world.tileAt(wx - dx, wy - dy) === TILE.Stairs) continue;
    const rise = world.heightAt(wx + dx, wy + dy) - h;
    const drop = world.heightAt(wx - dx, wy - dy) - h;
    if (rise > 0.5 && rise < 1.5 && drop < -0.5 && drop > -1.5) return direction;
  }
  return null;
}

function stairRunAt(world: StairView, tx: number, ty: number): StairRun | null {
  for (let direction = 0; direction < DIRS.length; direction++) {
    const dir = DIRS[direction];
    if (!dir) continue;
    const [dx, dy] = dir;
    for (let offset = 0; offset <= 2; offset++) {
      const stairX = tx + dx * offset;
      const stairY = ty + dy * offset;
      if (entryClimbDir(world, stairX, stairY) === direction) {
        return { stairX, stairY, direction };
      }
    }
  }

  return null;
}

function distanceFromHighEdge(run: StairRun, x: number, y: number): number {
  switch (run.direction) {
    case 0:
      return run.stairY - y;
    case 1:
      return x - (run.stairX + 1);
    case 2:
      return y - (run.stairY + 1);
    default:
      return run.stairX - x;
  }
}

export function stairRampAt(world: StairView, x: number, y: number): number | null {
  const run = stairRunAt(world, Math.floor(x), Math.floor(y));
  if (!run) return null;
  const dir = DIRS[run.direction];
  if (!dir) return null;
  const [dx, dy] = dir;
  const high = world.heightAt(run.stairX + dx, run.stairY + dy);
  const low = world.heightAt(run.stairX - dx, run.stairY - dy);
  const t = (distanceFromHighEdge(run, x, y) + STAIR_RUN_LENGTH) / STAIR_RUN_LENGTH;
  if (t < 0) return null;
  return low + (high - low) * Math.min(1, t);
}
