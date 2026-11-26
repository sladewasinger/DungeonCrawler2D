/** Pure geometric helpers, solid prop anchor lookup, and sector hit checks for dynamic cloth webs. */
import { PropKind, WorldChunkCache, isWithinSector } from "@dc2d/engine";

export interface WebNode {
  readonly id: number;
  x: number;
  y: number;
  readonly restX: number;
  readonly restY: number;
  vx: number;
  vy: number;
  readonly pinned: boolean;
  fire: number;
  ageSec: number;
}

export interface WebStrand {
  readonly a: WebNode;
  readonly b: WebNode;
  readonly restLen: number;
  fire: number;
}

const ANCHOR_PROPS = new Set<PropKind>([
  PropKind.OakTree, PropKind.PineTree, PropKind.BirchTree, PropKind.MapleTree, PropKind.DeadTree,
  PropKind.GiantMushroom, PropKind.GreatStump, PropKind.Boulder, PropKind.Palisade, PropKind.RuinPillar,
]);

export function pickWebAnchor(cache: WorldChunkCache, wx: number, wy: number): { readonly x: number; readonly y: number } {
  let best = { x: wx, y: wy };
  let bestDist = 1.65;
  for (const prop of cache.propsNear(wx, wy)) {
    if (!ANCHOR_PROPS.has(prop.kind)) continue;
    const d = Math.hypot(prop.x - wx, prop.y - wy);
    if (d < bestDist) { bestDist = d; best = { x: prop.x, y: prop.y }; }
  }
  return best;
}

export function pointToSegDistSq(
  pt: { readonly x: number; readonly y: number },
  seg: { readonly ax: number; readonly ay: number; readonly bx: number; readonly by: number },
): number {
  const vx = seg.bx - seg.ax;
  const vy = seg.by - seg.ay;
  const lenSq = vx * vx + vy * vy;
  if (lenSq < 1e-6) return (pt.x - seg.ax) * (pt.x - seg.ax) + (pt.y - seg.ay) * (pt.y - seg.ay);
  const t = Math.max(0, Math.min(1, ((pt.x - seg.ax) * vx + (pt.y - seg.ay) * vy) / lenSq));
  const dx = pt.x - (seg.ax + vx * t);
  const dy = pt.y - (seg.ay + vy * t);
  return dx * dx + dy * dy;
}

export function segHitsSector(opts: {
  readonly strand: WebStrand; readonly origin: { readonly x: number; readonly y: number };
  readonly dir: { readonly x: number; readonly y: number }; readonly range: number; readonly halfArcRad: number;
}): boolean {
  const { strand, origin, dir, range, halfArcRad } = opts;
  for (const t of [0, 0.33, 0.67, 1]) {
    const pt = { x: strand.a.x + (strand.b.x - strand.a.x) * t, y: strand.a.y + (strand.b.y - strand.a.y) * t };
    if (isWithinSector({ origin, dir, target: pt, range, halfArcRad })) return true;
  }
  return false;
}
