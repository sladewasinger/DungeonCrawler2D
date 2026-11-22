/** Deterministic 7x7 Overworld POI stamper (Bandit Camps and Ancient Forest Ruins). */
import { hashUnit2d } from "../math/noise.js";
import { sampleWorldTile } from "./biomeSampler.js";
import {
  CHUNK_SIZE, GroundKind, PropKind,
  type ChunkPoi, type ChunkProp, type PoiKind, type PointLightSpec,
} from "./types.js";

const POI_KIND_BANDIT: PoiKind = "bandit-camp";
const POI_KIND_RUINS: PoiKind = "ancient-ruins";
const CAMPFIRE_COLOR = 0xff9a3c;
const TORCH_COLOR = 0xffb357;

function chooseChunkPoiKind(worldSeed: number, cx: number, cy: number): PoiKind | null {
  const key = `${cx},${cy}`;
  if (key === "0,0") return null;
  if (key === "1,0") return POI_KIND_BANDIT;
  if (key === "-1,0") return POI_KIND_RUINS;
  if (hashUnit2d(worldSeed + 607, cx, cy) >= 0.55) return null;
  return hashUnit2d(worldSeed + 613, cx, cy) < 0.52 ? POI_KIND_BANDIT : POI_KIND_RUINS;
}

function isFlatDryRow(opts: { readonly worldSeed: number; readonly cxWx: number; readonly wy: number; readonly elev: number }): boolean {
  for (let dx = -3; dx <= 3; dx++) {
    const sample = sampleWorldTile(opts.worldSeed, opts.cxWx + dx, opts.wy);
    if (sample.ground === GroundKind.DeepWater || sample.ground === GroundKind.ShallowWater) return false;
    if (sample.stairs || sample.elevation !== opts.elev) return false;
  }
  return true;
}

function isFlatDryFootprint(worldSeed: number, centerWx: number, centerWy: number): number | null {
  if (Math.hypot(centerWx, centerWy) < 15) return null;
  const center = sampleWorldTile(worldSeed, centerWx, centerWy);
  if (center.ground === GroundKind.DeepWater || center.ground === GroundKind.ShallowWater || center.stairs) return null;
  for (let dy = -3; dy <= 3; dy++) {
    if (!isFlatDryRow({ worldSeed, cxWx: centerWx, wy: centerWy + dy, elev: center.elevation })) return null;
  }
  return center.elevation;
}

function buildChunkPoiAt(opts: {
  readonly kind: PoiKind; readonly cx: number; readonly cy: number;
  readonly wx: number; readonly wy: number; readonly elevation: number;
}): ChunkPoi {
  const chestY = opts.kind === POI_KIND_BANDIT ? opts.wy - 1.5 : opts.wy + 0.5;
  return {
    id: `${opts.kind}:${opts.cx},${opts.cy}`,
    kind: opts.kind,
    cx: opts.cx,
    cy: opts.cy,
    centerX: opts.wx + 0.5,
    centerY: opts.wy + 0.5,
    elevation: opts.elevation,
    chestX: opts.wx + 0.5,
    chestY,
  };
}

function scanPoiRow(opts: {
  readonly worldSeed: number; readonly kind: PoiKind;
  readonly cx: number; readonly cy: number;
  readonly startLx: number; readonly wy: number;
}): ChunkPoi | null {
  for (let ox = 0; ox < 18; ox++) {
    const lx = 7 + ((opts.startLx - 7 + ox) % 18);
    const wx = opts.cx * CHUNK_SIZE + lx;
    const elevation = isFlatDryFootprint(opts.worldSeed, wx, opts.wy);
    if (elevation !== null) {
      return buildChunkPoiAt({ kind: opts.kind, cx: opts.cx, cy: opts.cy, wx, wy: opts.wy, elevation });
    }
  }
  return null;
}

export function findChunkPoi(worldSeed: number, cx: number, cy: number): ChunkPoi | null {
  const kind = chooseChunkPoiKind(worldSeed, cx, cy);
  if (!kind) return null;
  const startLx = 7 + Math.floor(hashUnit2d(worldSeed + 619, cx, cy) * 18);
  const startLy = 7 + Math.floor(hashUnit2d(worldSeed + 631, cx, cy) * 18);
  for (let oy = 0; oy < 18; oy++) {
    const wy = cy * CHUNK_SIZE + 7 + ((startLy - 7 + oy) % 18);
    const hit = scanPoiRow({ worldSeed, kind, cx, cy, startLx, wy });
    if (hit) return hit;
  }
  return null;
}

export function isInsidePoiFootprint(poi: ChunkPoi | null, wx: number, wy: number): boolean {
  if (!poi) return false;
  return Math.abs(wx - Math.floor(poi.centerX)) <= 3 && Math.abs(wy - Math.floor(poi.centerY)) <= 3;
}

export function poiFloorGround(poi: ChunkPoi, wx: number, wy: number): GroundKind {
  const dx = Math.abs(wx - Math.floor(poi.centerX));
  const dy = Math.abs(wy - Math.floor(poi.centerY));
  if (poi.kind === POI_KIND_BANDIT) {
    return dx <= 2 && dy <= 2 ? GroundKind.DirtPath : GroundKind.ForestFloor;
  }
  return dx <= 1 && dy <= 1 ? GroundKind.CliffStone : GroundKind.MossStone;
}

function makePoiProp(opts: {
  readonly kind: PropKind; readonly x: number; readonly y: number;
  readonly elevation: number; readonly radius: number; readonly blocks: boolean;
}): ChunkProp {
  return {
    id: `poi-${opts.kind}:${Math.round(opts.x * 10)},${Math.round(opts.y * 10)}`,
    kind: opts.kind, x: opts.x, y: opts.y, variant: 0,
    elevation: opts.elevation, radius: opts.radius, blocksMovement: opts.blocks,
  };
}

function stampBanditCamp(poi: ChunkPoi, props: ChunkProp[], lights: PointLightSpec[]): void {
  const { centerX: cx, centerY: cy, elevation } = poi;
  const palisades: readonly (readonly [number, number])[] = [
    [-3, -3], [-2, -3], [-1, -3], [0, -3], [1, -3], [2, -3], [3, -3],
    [-3, -2], [-3, -1], [-3, 0], [-3, 1], [-3, 2], [-3, 3],
    [3, -2], [3, -1], [3, 0], [3, 1], [3, 2], [3, 3],
    [-2, 3], [2, 3],
  ];
  for (const [dx, dy] of palisades) {
    props.push(makePoiProp({ kind: PropKind.Palisade, x: cx + dx, y: cy + dy, elevation, radius: 0.42, blocks: true }));
  }
  props.push(makePoiProp({ kind: PropKind.Tent, x: cx - 1.7, y: cy - 1.7, elevation, radius: 0.55, blocks: true }));
  props.push(makePoiProp({ kind: PropKind.Tent, x: cx + 1.7, y: cy - 1.7, elevation, radius: 0.55, blocks: true }));
  props.push(makePoiProp({ kind: PropKind.Campfire, x: cx, y: cy + 0.5, elevation, radius: 0.42, blocks: true }));
  lights.push({ id: `${poi.id}-fire`, kind: "campfire", x: cx, y: cy + 0.5, color: CAMPFIRE_COLOR, radiusPx: 175, intensity: 1.1 });
  props.push(makePoiProp({ kind: PropKind.Torch, x: cx - 1.2, y: cy + 2.6, elevation, radius: 0.2, blocks: false }));
  lights.push({ id: `${poi.id}-torch`, kind: "torch", x: cx - 1.2, y: cy + 2.6, color: TORCH_COLOR, radiusPx: 130, intensity: 0.85 });
}

function stampAncientRuins(poi: ChunkPoi, props: ChunkProp[], lights: PointLightSpec[]): void {
  const { centerX: cx, centerY: cy, elevation } = poi;
  const pillars: readonly (readonly [number, number])[] = [[-2.6, -2.6], [2.6, -2.6], [-2.8, 0], [2.8, 0], [-2.6, 2.6], [2.6, 2.6]];
  for (const [dx, dy] of pillars) {
    props.push(makePoiProp({ kind: PropKind.RuinPillar, x: cx + dx, y: cy + dy, elevation, radius: 0.4, blocks: true }));
  }
  props.push(makePoiProp({ kind: PropKind.Torch, x: cx - 1.5, y: cy - 1.4, elevation, radius: 0.2, blocks: false }));
  props.push(makePoiProp({ kind: PropKind.Torch, x: cx + 1.5, y: cy + 1.5, elevation, radius: 0.2, blocks: false }));
  lights.push({ id: `${poi.id}-t1`, kind: "torch", x: cx - 1.5, y: cy - 1.4, color: TORCH_COLOR, radiusPx: 145, intensity: 0.9 });
  lights.push({ id: `${poi.id}-t2`, kind: "torch", x: cx + 1.5, y: cy + 1.5, color: TORCH_COLOR, radiusPx: 145, intensity: 0.9 });
}

export function stampPoiPropsAndLights(opts: {
  readonly poi: ChunkPoi;
  readonly props: ChunkProp[];
  readonly lights: PointLightSpec[];
}): void {
  if (opts.poi.kind === POI_KIND_BANDIT) stampBanditCamp(opts.poi, opts.props, opts.lights);
  else stampAncientRuins(opts.poi, opts.props, opts.lights);
}
