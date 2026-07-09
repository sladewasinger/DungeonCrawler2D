import { TILE } from "./types";

export interface StairView {
  tileAt(wx: number, wy: number): number;
  heightAt(wx: number, wy: number): number;
}

const DIRS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;

interface StairRun {
  stairX: number;
  stairY: number;
  direction: number;
  onApproach: boolean;
}

export function entryClimbDir(world: StairView, wx: number, wy: number): number | null {
  if (world.tileAt(wx, wy) !== TILE.Stairs) return null;
  const h = world.heightAt(wx, wy);
  for (let direction = 0; direction < DIRS.length; direction++) {
    const [dx, dy] = DIRS[direction]!;
    if (world.tileAt(wx + dx, wy + dy) === TILE.Stairs) continue;
    if (world.tileAt(wx - dx, wy - dy) === TILE.Stairs) continue;
    const rise = world.heightAt(wx + dx, wy + dy) - h;
    const drop = world.heightAt(wx - dx, wy - dy) - h;
    if (rise > 0.5 && rise < 1.5 && drop < -0.5 && drop > -1.5) return direction;
  }
  return null;
}

function stairRunAt(world: StairView, tx: number, ty: number): StairRun | null {
  const direction = entryClimbDir(world, tx, ty);
  if (direction !== null) return { stairX: tx, stairY: ty, direction, onApproach: false };

  for (let direction = 0; direction < DIRS.length; direction++) {
    const [dx, dy] = DIRS[direction]!;
    const stairX = tx + dx;
    const stairY = ty + dy;
    if (entryClimbDir(world, stairX, stairY) === direction) {
      return { stairX, stairY, direction, onApproach: true };
    }
  }

  return null;
}

export function stairRampAt(world: StairView, x: number, y: number): number | null {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  const run = stairRunAt(world, tx, ty);
  if (!run) return null;
  const [dx, dy] = DIRS[run.direction]!;
  const high = world.heightAt(run.stairX + dx, run.stairY + dy);
  const low = world.heightAt(run.stairX - dx, run.stairY - dy);
  const progress =
    run.direction === 0
      ? 1 - (y - ty)
      : run.direction === 1
        ? x - tx
        : run.direction === 2
          ? y - ty
          : 1 - (x - tx);
  const t = (run.onApproach ? progress : 1 + progress) / 2;
  return low + (high - low) * t;
}
