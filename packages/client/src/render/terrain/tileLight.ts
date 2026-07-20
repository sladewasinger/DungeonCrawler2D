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
/** Levels at/below this sit on the ambient floor; between it and `curveFullLevel` an
 * S-curve falls off. Not a tuning knob (no visual-direction case for moving it) —
 * unlike ambient/curveFullLevel/warmth below, it never varies. */
const CURVE_DARK_LEVEL = 0;
/** Warm firelight tint at full level, blended in with the level curve. */
const WARM_R = 1.0;
const WARM_G = 0.84;
const WARM_B = 0.58;
/** Cool moonless cast at the ambient floor. With ambient this high, torches barely
 * changed LUMINANCE — so their presence now reads through HUE contrast instead:
 * unlit stone is cool blue-gray, torchlight is warm gold (user: "torches seem to
 * do nearly nothing" after the brightness lifts). */
const COOL_R = 0.86;
const COOL_G = 0.94;
const COOL_B = 1.1;

/** The tunable knobs behind the baked lighting curve — injectable so the editor's
 * lighting workbench can preview tuning changes live. See `setTileLightConfig`. */
export interface TileLightConfig {
  /** Brightness of a fully unlit tile (0..1). User has now demanded brighter twice
   * (0.26 -> 0.42 -> 0.55 -> 0.72, 2026-07-20 "make it way brighter, I can't see
   * shit"): the dungeon reads fully at a glance; torches add warmth, not visibility. */
  readonly ambient: number;
  /** Levels at/above this render at full brightness (the lit plateau near a torch). */
  readonly curveFullLevel: number;
  /** 0..1 scale on the warm/cool hue split: 1 is the shipped full split, 0 collapses
   * every level to the cool tint regardless of light level (pure brightness, no hue cue). */
  readonly warmth: number;
}

/** The last-shipped tuning (2026-07-20) — what every client bakes against unless the
 * editor has overridden it for this session. */
export const DEFAULT_TILE_LIGHT_CONFIG: TileLightConfig = {
  ambient: 0.72,
  curveFullLevel: 7,
  warmth: 1,
};

let config: TileLightConfig = DEFAULT_TILE_LIGHT_CONFIG;
let levelTints: readonly number[] = buildLevelTints(config);

/**
 * Overrides the baked-light tuning knobs and recomputes the derived per-level tint
 * table. CONTRACT: only `scenes/editor`'s lighting panel may call this — it is a
 * process-wide mutable override, not a per-bake parameter, so it exists purely for
 * the editor's live preview loop. No dungeon/gameplay code path may call this; live
 * play always bakes against `DEFAULT_TILE_LIGHT_CONFIG`.
 */
export function setTileLightConfig(overrides: Partial<TileLightConfig>): void {
  config = { ...config, ...overrides };
  levelTints = buildLevelTints(config);
}

/** The config the next `computeLightField` bake will use — read by the editor's
 * lighting panel to seed its sliders and copy-paste readout. */
export function getTileLightConfig(): TileLightConfig {
  return config;
}

export interface LightField {
  /** Multiply-tint (0xRRGGBB) for the tile — brightness + warmth baked together. */
  tintAt(wx: number, wy: number): number;
}

/**
 * S-shaped brightness: mid-to-high levels hold near full brightness (torch-lit
 * floors read clearly), then a steep smoothstep tail drops into the ambient
 * dark — wide bright-to-dark range so darkness still feels like darkness.
 */
function levelCurve(level: number, cfg: TileLightConfig): number {
  const x = Math.min(1, Math.max(0, (level - CURVE_DARK_LEVEL) / (cfg.curveFullLevel - CURVE_DARK_LEVEL)));
  const s = x * x * (3 - 2 * x);
  return cfg.ambient + (1 - cfg.ambient) * s;
}

/** Per-level multiply tints: cool blue-gray ambient up to warm near-white. Rebuilt
 * whenever `setTileLightConfig` changes the underlying knobs. */
function buildLevelTints(cfg: TileLightConfig): readonly number[] {
  return Array.from({ length: LIGHT_MAX + 1 }, (_, level) => {
    const b = levelCurve(level, cfg);
    const warmth = (level / LIGHT_MAX) * cfg.warmth;
    const ch = (cool: number, warm: number) =>
      Math.min(255, Math.round(255 * b * (cool + warmth * (warm - cool))));
    return (ch(COOL_R, WARM_R) << 16) | (ch(COOL_G, WARM_G) << 8) | ch(COOL_B, WARM_B);
  });
}

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
      return levelTints[level] ?? levelTints[0] ?? 0x2e2e2e;
    },
  };
}
