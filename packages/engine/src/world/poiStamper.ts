/** Deterministic sparse Overworld POI stamper spanning 20 diverse frontier landmarks. */
import { hashUnit2d } from "../math/noise.js";
import { sampleWorldTile } from "./biomeSampler.js";
import { computeDangerTier, sampleMacroBiome } from "./biomes/macroBiome.js";
import {
  POI_LAYOUTS, layoutFloorGround, isInsidePoiLayoutMask, stampPoiLayoutPropsAndLights,
} from "./poiLayouts.js";
import { computeBrazierPositions, getFrontierPoiSpec } from "./pois/frontierPoiLayouts.js";
import { getPoiCatalogEntry, pickBiomeWeightedPoiKind } from "./pois/poiCatalog.js";
import {
  CHUNK_SIZE, GroundKind,
  type ChunkPoi, type ChunkProp, type PoiKind, type PoiLayoutKind, type PointLightSpec,
} from "./types.js";

const POI_KIND_BANDIT: PoiKind = "bandit-camp";
const POI_KIND_RUINS: PoiKind = "ancient-ruins";
const LAYOUT_RUINS_SHRINE: PoiLayoutKind = "ruins-shrine";

function isSparseMacroCellWinner(worldSeed: number, cx: number, cy: number): boolean {
  const mx = Math.floor(cx / 2);
  const my = Math.floor(cy / 2);
  const slot = Math.floor(hashUnit2d(worldSeed + 593, mx, my) * 4);
  const targetCx = mx * 2 + (slot % 2);
  const targetCy = my * 2 + Math.floor(slot / 2);
  return cx === targetCx && cy === targetCy;
}

const BANDIT_LAYOUTS: readonly (readonly [number, PoiLayoutKind])[] = [
  [0.28, "camp-outpost"], [0.58, "camp-l-shape"], [0.84, "camp-courtyard"], [1.0, "camp-warband"],
];
const RUINS_LAYOUTS: readonly (readonly [number, PoiLayoutKind])[] = [
  [0.38, LAYOUT_RUINS_SHRINE], [0.8, "ruins-colonnade"], [1.0, "ruins-sanctum"],
];

function starterPoiLayout(cx: number, cy: number): PoiLayoutKind | "skip" | null {
  if (cx === 1 && cy === 0) return "camp-courtyard";
  if (cx === -1 && cy === 0) return LAYOUT_RUINS_SHRINE;
  if (Math.abs(cx) <= 1 && Math.abs(cy) <= 1) return "skip";
  return null;
}

function chooseChunkPoiLayout(worldSeed: number, cx: number, cy: number): PoiLayoutKind | null {
  const fixed = starterPoiLayout(cx, cy);
  if (fixed === "skip") return null;
  if (fixed) return fixed;
  if (!isSparseMacroCellWinner(worldSeed, cx, cy) || hashUnit2d(worldSeed + 607, cx, cy) >= 0.44) return null;
  const wx = cx * CHUNK_SIZE + 16;
  const wy = cy * CHUNK_SIZE + 16;
  const biome = sampleMacroBiome(worldSeed, wx, wy);
  const dangerTier = computeDangerTier(biome, wx, wy);
  const kind = pickBiomeWeightedPoiKind({ worldSeed, cx, cy, biome, dangerTier });
  return pickLayoutForKind({ worldSeed, cx, cy, kind });
}

function pickLayoutForKind(q: { readonly worldSeed: number; readonly cx: number; readonly cy: number; readonly kind: PoiKind }): PoiLayoutKind {
  if (q.kind !== POI_KIND_BANDIT && q.kind !== POI_KIND_RUINS) return q.kind as PoiLayoutKind;
  const roll = hashUnit2d(q.worldSeed + 641, q.cx, q.cy);
  const table = q.kind === POI_KIND_BANDIT ? BANDIT_LAYOUTS : RUINS_LAYOUTS;
  return table.find(([thresh]) => roll < thresh)?.[1] ?? table[0]?.[1] ?? LAYOUT_RUINS_SHRINE;
}

function isFlatDryRow(opts: {
  readonly worldSeed: number; readonly cxWx: number; readonly wy: number; readonly elev: number; readonly rx: number;
}): boolean {
  for (let dx = -opts.rx; dx <= opts.rx; dx++) {
    const sample = sampleWorldTile(opts.worldSeed, opts.cxWx + dx, opts.wy);
    if (sample.ground === GroundKind.DeepWater || sample.ground === GroundKind.ShallowWater) return false;
    if (sample.stairs || sample.elevation !== opts.elev) return false;
  }
  return true;
}

function isFlatDryFootprint(opts: {
  readonly worldSeed: number; readonly centerWx: number; readonly centerWy: number; readonly rx: number; readonly ry: number;
}): number | null {
  if (Math.hypot(opts.centerWx, opts.centerWy) < 15) return null;
  const center = sampleWorldTile(opts.worldSeed, opts.centerWx, opts.centerWy);
  if (center.ground === GroundKind.DeepWater || center.ground === GroundKind.ShallowWater || center.stairs) return null;
  for (let dy = -opts.ry; dy <= opts.ry; dy++) {
    if (!isFlatDryRow({ worldSeed: opts.worldSeed, cxWx: opts.centerWx, wy: opts.centerWy + dy, elev: center.elevation, rx: opts.rx })) {
      return null;
    }
  }
  return center.elevation;
}

function layoutShapeFor(layout: PoiLayoutKind): { readonly kind: PoiKind; readonly radiusX: number; readonly radiusY: number; readonly chestOffset: readonly [number, number] } {
  const frontier = getFrontierPoiSpec(layout);
  if (frontier) return frontier;
  const classic = POI_LAYOUTS[layout];
  if (classic) return classic;
  return { kind: POI_KIND_RUINS, radiusX: 3, radiusY: 3, chestOffset: [0, 0] };
}

function buildChunkPoiAt(opts: {
  readonly layout: PoiLayoutKind; readonly cx: number; readonly cy: number;
  readonly wx: number; readonly wy: number; readonly elevation: number;
}): ChunkPoi {
  const spec = layoutShapeFor(opts.layout);
  const meta = getPoiCatalogEntry(spec.kind);
  const id = `${spec.kind}:${opts.cx},${opts.cy}`;
  const centerX = opts.wx + 0.5;
  const centerY = opts.wy + 0.5;
  const braziers = computeBrazierPositions({ poiId: id, layout: opts.layout, centerX, centerY });
  return {
    id, kind: spec.kind, layout: opts.layout, cx: opts.cx, cy: opts.cy, centerX, centerY,
    radiusX: spec.radiusX, radiusY: spec.radiusY, elevation: opts.elevation,
    chestX: centerX + spec.chestOffset[0], chestY: centerY + spec.chestOffset[1],
    hasChest: meta.hasChest,
    ...(meta.isSanctuary ? { isSanctuary: true } : {}),
    ...(meta.eliteKind ? { eliteKind: meta.eliteKind, eliteTitle: meta.eliteTitle } : {}),
    ...(meta.shrineKind ? { shrineKind: meta.shrineKind } : {}),
    ...(meta.loreText ? { loreText: meta.loreText } : {}),
    ...(braziers ? { brazierPositions: braziers } : {}),
  };
}

function scanPoiRow(opts: {
  readonly worldSeed: number; readonly layout: PoiLayoutKind;
  readonly cx: number; readonly cy: number;
  readonly startLx: number; readonly wy: number;
}): ChunkPoi | null {
  const { radiusX: rx, radiusY: ry } = layoutShapeFor(opts.layout);
  const span = Math.max(1, CHUNK_SIZE - 2 * rx);
  for (let ox = 0; ox < span; ox++) {
    const lx = rx + ((opts.startLx + ox) % span);
    const wx = opts.cx * CHUNK_SIZE + lx;
    const elevation = isFlatDryFootprint({ worldSeed: opts.worldSeed, centerWx: wx, centerWy: opts.wy, rx, ry });
    if (elevation !== null) {
      return buildChunkPoiAt({ layout: opts.layout, cx: opts.cx, cy: opts.cy, wx, wy: opts.wy, elevation });
    }
  }
  return null;
}

function findForLayout(q: {
  readonly worldSeed: number; readonly cx: number; readonly cy: number; readonly layout: PoiLayoutKind;
}): ChunkPoi | null {
  const { radiusY: ry } = layoutShapeFor(q.layout);
  const span = Math.max(1, CHUNK_SIZE - 2 * ry);
  const startLx = Math.floor(hashUnit2d(q.worldSeed + 619, q.cx, q.cy) * CHUNK_SIZE);
  const startLy = Math.floor(hashUnit2d(q.worldSeed + 631, q.cx, q.cy) * span);
  for (let oy = 0; oy < span; oy++) {
    const wy = q.cy * CHUNK_SIZE + ry + ((startLy + oy) % span);
    const hit = scanPoiRow({ worldSeed: q.worldSeed, layout: q.layout, cx: q.cx, cy: q.cy, startLx, wy });
    if (hit) return hit;
  }
  return null;
}

export function findChunkPoi(worldSeed: number, cx: number, cy: number): ChunkPoi | null {
  const layout = chooseChunkPoiLayout(worldSeed, cx, cy);
  if (!layout) return null;
  const primary = findForLayout({ worldSeed, cx, cy, layout });
  if (primary) return primary;
  const fallback: PoiLayoutKind = layoutShapeFor(layout).kind === POI_KIND_BANDIT ? "camp-outpost" : LAYOUT_RUINS_SHRINE;
  return fallback === layout ? null : findForLayout({ worldSeed, cx, cy, layout: fallback });
}

export function isInsidePoiFootprint(poi: ChunkPoi | null, wx: number, wy: number): boolean {
  return poi !== null && isInsidePoiLayoutMask(poi, wx, wy);
}

export function poiFloorGround(poi: ChunkPoi, wx: number, wy: number): GroundKind {
  return layoutFloorGround(poi, wx, wy);
}

export function stampPoiPropsAndLights(opts: {
  readonly poi: ChunkPoi;
  readonly props: ChunkProp[];
  readonly lights: PointLightSpec[];
}): void {
  stampPoiLayoutPropsAndLights(opts);
}
