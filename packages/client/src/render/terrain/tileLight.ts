// Baked Minecraft-style tile lighting: BFS flood from deterministic torch/door
// sources — level 14 at a source, minus one per orthogonal step, stopped by
// solid rock so light wraps corners along real paths. Computed once per chunk
// (with an apron so neighbors' torches shine across seams) and multiplied into
// the baked tile tints: ZERO per-frame lighting cost.
import { TILE } from "@dc2d/engine";
import type { TerrainRead } from "./faces.js";
import { doorLightPositions } from "../lighting/doorLights.js";
import { selectTorchPositions, torchCandidates } from "../lighting/torchPlacement.js";

export const LIGHT_MAX = 14;
const DOOR_LIGHT_LEVEL = 11;
/** Sources within this many tiles outside the region still light its edge — also the
 * radius render/terrain/lightRebake.ts uses to find every chunk a dynamic light touches. */
export const LIGHT_APRON = LIGHT_MAX + 1;
const APRON = LIGHT_APRON;

/** A live (non-authored) light seed to flood from, e.g. a placed thrown torch —
 * always a full-strength source, like a world torch. */
export interface DynamicLightSeed {
  readonly tileX: number;
  readonly tileY: number;
  readonly level: number;
}
/** Brightness of a fully unlit tile — visible but clearly dark. */
const AMBIENT = 0.26;
/** Levels at/above this render at full brightness (the lit plateau near a torch). */
const CURVE_FULL_LEVEL = 9.5;
/** Levels at/below this sit on the ambient floor; between the two an S-curve falls off. */
const CURVE_DARK_LEVEL = 1;
/** Warm firelight tint at full level, blended in with the level curve. */
const WARM_R = 1.0;
const WARM_G = 0.84;
const WARM_B = 0.58;

export interface LightField {
  /** Multiply-tint (0xRRGGBB) for the tile — brightness + warmth baked together. */
  tintAt(wx: number, wy: number): number;
}

/**
 * S-shaped brightness: mid-to-high levels hold near full brightness (torch-lit
 * floors read clearly), then a steep smoothstep tail drops into the ambient
 * dark — wide bright-to-dark range so darkness still feels like darkness.
 */
function levelCurve(level: number): number {
  const x = Math.min(1, Math.max(0, (level - CURVE_DARK_LEVEL) / (CURVE_FULL_LEVEL - CURVE_DARK_LEVEL)));
  const s = x * x * (3 - 2 * x);
  return AMBIENT + (1 - AMBIENT) * s;
}

/** Precomputed per-level multiply tints: dark cool ambient up to warm near-white. */
const LEVEL_TINTS: readonly number[] = Array.from({ length: LIGHT_MAX + 1 }, (_, level) => {
  const b = levelCurve(level);
  const warmth = level / LIGHT_MAX;
  const ch = (warm: number) => Math.round(255 * b * (1 - warmth + warmth * warm));
  return (ch(WARM_R) << 16) | (ch(WARM_G) << 8) | ch(WARM_B);
});

/** Mutable BFS grid state shared by the seed/flood helpers. */
interface LightGrid {
  readonly gx0: number;
  readonly gy0: number;
  readonly gsize: number;
  readonly levels: Uint8Array;
  readonly queue: number[];
}

function inGrid(g: LightGrid, wx: number, wy: number): boolean {
  return wx >= g.gx0 && wy >= g.gy0 && wx < g.gx0 + g.gsize && wy < g.gy0 + g.gsize;
}

function gridIndex(g: LightGrid, wx: number, wy: number): number {
  return (wy - g.gy0) * g.gsize + (wx - g.gx0);
}

function seed(g: LightGrid, wx: number, wy: number, level: number): void {
  if (!inGrid(g, wx, wy)) return;
  const i = gridIndex(g, wx, wy);
  if ((g.levels[i] ?? 0) >= level) return;
  g.levels[i] = level;
  g.queue.push(wx, wy, level);
}

const ORTHOGONAL: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function spread(g: LightGrid, world: TerrainRead, wx: number, wy: number, level: number): void {
  for (const [dx, dy] of ORTHOGONAL) {
    const nx = wx + dx;
    const ny = wy + dy;
    if (inGrid(g, nx, ny) && world.tileAt(nx, ny) !== TILE.Wall) seed(g, nx, ny, level - 1);
  }
}

function flood(g: LightGrid, world: TerrainRead): void {
  for (let head = 0; head < g.queue.length; head += 3) {
    const wx = g.queue[head] ?? 0;
    const wy = g.queue[head + 1] ?? 0;
    const level = g.queue[head + 2] ?? 0;
    if ((g.levels[gridIndex(g, wx, wy)] ?? 0) !== level || level <= 1) continue;
    spread(g, world, wx, wy, level);
  }
}

/**
 * Flood-fills light levels over [x0-APRON, y0-APRON, x0+size+APRON) and exposes
 * per-tile tints. `dynamicSources` seeds live (non-authored) lights — placed thrown
 * torches — into the same deterministic flood; harmless (and cheap) to pass sources
 * outside this region, since seed() drops anything outside the grid.
 */
export function computeLightField(
  world: TerrainRead,
  x0: number,
  y0: number,
  size: number,
  dynamicSources: readonly DynamicLightSeed[] = [],
): LightField {
  const gsize = size + APRON * 2;
  const g: LightGrid = {
    gx0: x0 - APRON,
    gy0: y0 - APRON,
    gsize,
    levels: new Uint8Array(gsize * gsize),
    queue: [],
  };
  for (const t of selectTorchPositions(torchCandidates(world, g.gx0, g.gy0, g.gx0 + gsize, g.gy0 + gsize))) {
    seed(g, t.wx, t.wy + 1, LIGHT_MAX);
  }
  for (const d of doorLightPositions(world, g.gx0, g.gy0, g.gx0 + gsize, g.gy0 + gsize)) {
    seed(g, d.wx, d.wy + 1, DOOR_LIGHT_LEVEL);
  }
  for (const d of dynamicSources) seed(g, d.tileX, d.tileY, d.level);
  flood(g, world);
  return {
    tintAt(wx: number, wy: number): number {
      const level = inGrid(g, wx, wy) ? (g.levels[gridIndex(g, wx, wy)] ?? 0) : 0;
      return LEVEL_TINTS[level] ?? LEVEL_TINTS[0] ?? 0x2e2e2e;
    },
  };
}
