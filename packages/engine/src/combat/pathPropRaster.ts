/** Upfront A* obstacle grid rasterization so cell lookup runs in O(1) instead of rescanning props per node. */
import type { BlockingObstacle } from "../world/collision.js";
import { closestObstacleCorePoint } from "../world/propFootprints.js";

const PROP_HARD_PAD = 0.34;
const PROP_SOFT_PAD = 0.22;

interface RasterCfg {
  readonly propGrid: Int8Array; readonly p: BlockingObstacle;
  readonly minTx: number; readonly minTy: number; readonly side: number;
  readonly hardThresh: number; readonly softThresh: number;
  readonly goalTx: number; readonly goalTy: number;
}

function stampPropCell(c: RasterCfg, lx: number, ly: number): void {
  const tx = c.minTx + lx;
  const ty = c.minTy + ly;
  const core = closestObstacleCorePoint(c.p, { x: tx + 0.5, y: ty + 0.5 });
  const d = Math.hypot(tx + 0.5 - core.x, ty + 0.5 - core.y);
  const idx = ly * c.side + lx;
  if ((tx !== c.goalTx || ty !== c.goalTy) && d < c.p.radius + c.hardThresh) {
    c.propGrid[idx] = -1;
    return;
  }
  if (d < c.p.radius + c.softThresh && c.propGrid[idx] === 0) c.propGrid[idx] = 1;
}

function stampSingleObstacle(opts: {
  readonly p: BlockingObstacle; readonly propGrid: Int8Array;
  readonly minTx: number; readonly minTy: number; readonly side: number;
  readonly hardThresh: number; readonly softThresh: number;
  readonly goalTx: number; readonly goalTy: number;
}): void {
  const { p } = opts;
  const reach = p.radius + opts.softThresh + 1;
  const x0 = Math.max(0, Math.floor(p.x - (p.halfX ?? 0) - reach) - opts.minTx);
  const x1 = Math.min(opts.side - 1, Math.floor(p.x + (p.halfX ?? 0) + reach) - opts.minTx);
  const y0 = Math.max(0, Math.floor(p.y - (p.halfY ?? 0) - reach) - opts.minTy);
  const y1 = Math.min(opts.side - 1, Math.floor(p.y + (p.halfY ?? 0) + reach) - opts.minTy);
  const cfg: RasterCfg = { ...opts };
  for (let ly = y0; ly <= y1; ly++) for (let lx = x0; lx <= x1; lx++) stampPropCell(cfg, lx, ly);
}

/** Rasterizes blocking obstacles onto a dense local Int8Array (-1 blocked, 0 clear, 1 soft penalty). */
export function rasterizePropCosts(opts: {
  readonly props: readonly BlockingObstacle[]; readonly agentRadius: number;
  readonly minTx: number; readonly minTy: number; readonly side: number;
  readonly startTx: number; readonly startTy: number; readonly goalTx: number; readonly goalTy: number;
}): Int8Array {
  const propGrid = new Int8Array(opts.side * opts.side);
  const hardThresh = Math.min(opts.agentRadius, PROP_HARD_PAD);
  const softThresh = opts.agentRadius + PROP_SOFT_PAD;
  for (const p of opts.props) {
    stampSingleObstacle({
      p, propGrid, minTx: opts.minTx, minTy: opts.minTy, side: opts.side,
      hardThresh, softThresh, goalTx: opts.goalTx, goalTy: opts.goalTy,
    });
  }
  const sLx = opts.startTx - opts.minTx;
  const sLy = opts.startTy - opts.minTy;
  if (sLx >= 0 && sLy >= 0 && sLx < opts.side && sLy < opts.side) propGrid[sLy * opts.side + sLx] = 0;
  return propGrid;
}
