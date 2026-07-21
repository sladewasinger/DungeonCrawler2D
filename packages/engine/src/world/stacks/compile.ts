// The one function every other stack-model surface (worldgen's output layer,
// the editor's loader) compiles through: stacksToHeightField() turns an authored
// per-tile stack grid into EXACTLY the {tiles, height} pair World/Chunk already
// simulate — stepBody/collision/lighting consume this output completely
// unaware stacks ever existed.

import { TILE, type TileType } from "../types.js";
import { FEATURE_TILE, type CompiledField, type StackDir, type StackTile } from "./types.js";

/** Matches world/stairs.ts's DIRS convention: 0=N, 1=E, 2=S, 3=W. */
const DIR_STEP: ReadonlyArray<{ readonly dx: number; readonly dy: number }> = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
];

/**
 * Non-stair (or explicit-height stair) tile: `cap` alone decides
 * walkability — a floor variant on top makes it a walkable Floor at height
 * `walls`; no cap makes it a solid Wall at height `walls`, full stop,
 * regardless of `walls`'s sign or magnitude. "Nothing painted" in the
 * editor is authored as walls=0 WITH a default floor cap, not as a capless
 * wall — see stacksRoundtrip.test.ts's discovery of this exact edge case
 * (a room's wall ring sunk by a neighboring pit can legitimately raise to
 * exactly height 0 after WALL_RISE, still a real solid wall).
 */
function compileBase(stack: StackTile): { tile: TileType; height: number } {
  if (stack.feature) return { tile: FEATURE_TILE[stack.feature], height: stack.walls };
  if (stack.cap !== null) return { tile: TILE.Floor, height: stack.walls };
  return { tile: TILE.Wall, height: stack.walls };
}

function inGrid(x: number, y: number, width: number, rows: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < rows;
}

/** True when `stack` continues a height-less run climbing `dir` (a same-direction stair with no explicit height override). */
function continuesRun(stack: StackTile | undefined, dir: StackDir): boolean {
  if (!stack?.stair) return false;
  return stack.stair.dir === dir && stack.stair.height === undefined;
}

/** Walk from `start` along `dir` while every tile is a stair (no explicit height) sharing `dir`; returns the count and the first non-matching index (may be out of grid). */
function walkRun(
  stacks: readonly StackTile[],
  width: number,
  rows: number,
  start: number,
  dir: StackDir,
  sign: 1 | -1,
): { steps: number; anchorIndex: number } {
  const step = DIR_STEP[dir];
  if (!step) return { steps: 0, anchorIndex: start };
  let x = start % width;
  let y = Math.floor(start / width);
  let steps = 0;
  for (;;) {
    const nx = x + step.dx * sign;
    const ny = y + step.dy * sign;
    if (!inGrid(nx, ny, width, rows)) return { steps, anchorIndex: -1 };
    const next = ny * width + nx;
    if (!continuesRun(stacks[next], dir)) return { steps, anchorIndex: next };
    x = nx;
    y = ny;
    steps++;
  }
}

/** An anchor's already-compiled base height, or 0 (neutral ground) for a run that reaches the grid edge without one. */
function anchorHeight(anchorIndex: number, height: Float32Array): number {
  return anchorIndex >= 0 ? (height[anchorIndex] ?? 0) : 0;
}

/**
 * Stamp one run's treads at the docs/R2-STAIRS-SPEC.md section 2 midpoint
 * form: tread `k` (1-indexed from the low anchor) sits at
 * `low + delta * (k - 0.5) / stepCount` — the tile-CENTER height for a
 * deliberate one-z-per-tile stair (k=1 of 1 gives the exact midpoint,
 * identical to the old even-split formula there; only multi-tile runs
 * move, from even-split to per-tile midpoints).
 */
function writeTreads(
  fields: { tiles: Uint8Array; height: Float32Array; resolved: Uint8Array },
  width: number,
  step: { readonly dx: number; readonly dy: number },
  origin: { readonly x: number; readonly y: number },
  run: { readonly stepCount: number; readonly low: number; readonly delta: number },
): void {
  for (let n = 1; n <= run.stepCount; n++) {
    const i = (origin.y + step.dy * (n - 1)) * width + (origin.x + step.dx * (n - 1));
    fields.tiles[i] = TILE.Stairs;
    fields.height[i] = run.low + (run.delta * (n - 0.5)) / run.stepCount;
    fields.resolved[i] = 1;
  }
}

/**
 * One contiguous run of height-less stair tiles sharing `dir`: interpolate
 * every tread linearly between its low (-dir) and high (+dir) anchors,
 * using each anchor's already-compiled base height — "the engine figures
 * out what height it is at" for a freshly hand-authored ramp (Austin's
 * decree). A run that reaches the grid edge before finding a real anchor
 * falls back to height 0 there (neutral ground); this only matters for
 * hand-authored content missing a far anchor entirely.
 */
function resolveRun(
  stacks: readonly StackTile[],
  fields: { tiles: Uint8Array; height: Float32Array; resolved: Uint8Array },
  width: number,
  rows: number,
  seedIndex: number,
): void {
  const dir = stacks[seedIndex]?.stair?.dir;
  if (dir === undefined || fields.resolved[seedIndex]) return;
  const step = DIR_STEP[dir];
  if (!step) return;
  const back = walkRun(stacks, width, rows, seedIndex, dir, -1);
  const fwd = walkRun(stacks, width, rows, seedIndex, dir, 1);
  const low = anchorHeight(back.anchorIndex, fields.height);
  const high = anchorHeight(fwd.anchorIndex, fields.height);
  const origin = {
    x: (seedIndex % width) - step.dx * back.steps,
    y: Math.floor(seedIndex / width) - step.dy * back.steps,
  };
  const stepCount = back.steps + fwd.steps + 1;
  writeTreads(fields, width, step, origin, { stepCount, low, delta: high - low });
}

/**
 * First pass, one tile: a stair's explicit height (worldgen's mechanical
 * conversion, v1->v2 migration — both already know the real height and
 * must reproduce it byte-for-byte) always wins over interpolation, marking
 * it resolved immediately; a height-less stair gets a 0 placeholder for
 * pass two's resolveRun to overwrite. See compileBase's doc comment for
 * every other tile kind.
 */
function compileFirstPass(fields: { tiles: Uint8Array; height: Float32Array; resolved: Uint8Array }, i: number, stack: StackTile): void {
  if (stack.stair) {
    fields.tiles[i] = TILE.Stairs;
    fields.height[i] = stack.stair.height ?? 0;
    if (stack.stair.height !== undefined) fields.resolved[i] = 1;
    return;
  }
  const { tile, height } = compileBase(stack);
  fields.tiles[i] = tile;
  fields.height[i] = height;
}

/** Compile an authored stack grid to the {tiles, height} shape World/Chunk already consume. */
export function stacksToHeightField(stacks: readonly StackTile[], width: number, rows: number): CompiledField {
  const fields = {
    tiles: new Uint8Array(width * rows),
    height: new Float32Array(width * rows),
    resolved: new Uint8Array(width * rows),
  };
  for (let i = 0; i < stacks.length; i++) {
    const stack = stacks[i];
    if (stack) compileFirstPass(fields, i, stack);
  }
  for (let i = 0; i < stacks.length; i++) resolveRun(stacks, fields, width, rows, i);
  return { tiles: fields.tiles, height: fields.height };
}
