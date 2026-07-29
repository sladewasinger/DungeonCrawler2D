// Deterministic wall-mounted torch placement: scans a tile range for visible south-facing
// wall faces (the only cells that render brick, per VISUAL_DIRECTION's wall grammar) and
// hash-buckets them into evenly spaced torch positions. No two torches crowd one bucket,
// but placement never depends on load order or Math.random, so it's identical every run.
import { hasSouthFace, type TerrainRead } from "../../terrain/geometry/faces.js";
import { LIGHTING_VISUAL_STYLE } from "../lightingVisualStyle.js";

export interface TilePos {
  readonly wx: number;
  readonly wy: number;
}

export interface TileRect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** Grid-bucket size in tiles — big enough that torch pools read as distinct "islands of firelight", not one continuous glow. */
export const TORCH_SPACING_TILES =
  LIGHTING_VISUAL_STYLE.torch.authoredSpacingTiles;

/** Small multiplicative hash, deterministic for identical (wx, wy) every run. */
function hash2(wx: number, wy: number): number {
  let h = (wx * 374761393 + wy * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Every raised Floor cell in [x0,x1) x [y0,y1) that fronts open ground south of it — torch-mountable. */
export function torchCandidates(world: TerrainRead, bounds: TileRect): TilePos[] {
  const out: TilePos[] = [];
  for (let wy = bounds.y0; wy < bounds.y1; wy++) {
    appendTorchCandidates(world, out, { x0: bounds.x0, x1: bounds.x1, y: wy });
  }
  return out;
}

function appendTorchCandidates(world: TerrainRead, out: TilePos[], row: TorchCandidateRow): void {
  for (let wx = row.x0; wx < row.x1; wx++) {
    if (hasSouthFace(world, wx, row.y)) out.push({ wx, wy: row.y });
  }
}

interface TorchCandidateRow { readonly x0: number; readonly x1: number; readonly y: number; }

/**
 * Picks at most one torch per TORCH_SPACING_TILES-sized grid bucket, keeping the
 * highest-hash candidate in each bucket — spaces torches out without a min-distance search.
 */
export function selectTorchPositions(candidates: readonly TilePos[]): TilePos[] {
  const buckets = new Map<string, TilePos>();
  for (const c of candidates) {
    const key = `${Math.floor(c.wx / TORCH_SPACING_TILES)},${Math.floor(c.wy / TORCH_SPACING_TILES)}`;
    const existing = buckets.get(key);
    if (!existing || hash2(c.wx, c.wy) > hash2(existing.wx, existing.wy)) buckets.set(key, c);
  }
  return [...buckets.values()];
}
