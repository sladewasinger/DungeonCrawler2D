/** Deterministic 32x32 chunk generator for terrain tiles, props, and point lights. */
import { hashUnit2d } from "../math/noise.js";
import { chooseBiomeTileProp } from "./biomes/biomeProps.js";
import { sampleWorldTile, type TileSample } from "./biomeSampler.js";
import { findChunkPoi, isInsidePoiFootprint, poiFloorGround, stampPoiPropsAndLights } from "./poiStamper.js";
import {
  CHUNK_SIZE,
  GroundKind,
  PropKind,
  worldTileIndex,
  type ChunkPoi,
  type ChunkProp,
  type PointLightSpec,
  type WorldChunk,
} from "./types.js";

const CAMPFIRE_LIGHT_COLOR = 0xff9a3c;
const TORCH_LIGHT_COLOR = 0xffb357;

interface PropBuilderContext {
  readonly worldSeed: number;
  readonly wx: number;
  readonly wy: number;
  readonly sample: TileSample;
  readonly props: ChunkProp[];
  readonly lights: PointLightSpec[];
}

function addSpawnLandmarks(input: {
  readonly cx: number;
  readonly cy: number;
  readonly props: ChunkProp[];
  readonly lights: PointLightSpec[];
}): void {
  if (input.cx === 0 && input.cy === 0) {
    pushProp(input.props, PropKind.Campfire, { x: 2.5, y: -1.5, elevation: 0, radius: 0.78, blocks: true });
    input.lights.push({
      id: "spawn-campfire", kind: "campfire", x: 2.5, y: -1.5, color: CAMPFIRE_LIGHT_COLOR, radiusPx: 230, intensity: 1.25,
    });
    pushProp(input.props, PropKind.Torch, { x: 5.5, y: 1.5, elevation: 0, radius: 0.2, blocks: false });
    input.lights.push({
      id: "spawn-torch-east", kind: "torch", x: 5.5, y: 1.5, color: TORCH_LIGHT_COLOR, radiusPx: 140, intensity: 0.9,
    });
  }
  addWestSpawnTorches(input);
}

function addWestSpawnTorches(input: {
  readonly cx: number;
  readonly cy: number;
  readonly props: ChunkProp[];
  readonly lights: PointLightSpec[];
}): void {
  if (input.cx === -1 && input.cy === 0) {
    pushProp(input.props, PropKind.Torch, { x: -3.5, y: 2.5, elevation: 0, radius: 0.2, blocks: false });
    input.lights.push({
      id: "spawn-torch-west", kind: "torch", x: -3.5, y: 2.5, color: TORCH_LIGHT_COLOR, radiusPx: 140, intensity: 0.9,
    });
  }
  if (input.cx === -1 && input.cy === -1) {
    pushProp(input.props, PropKind.Torch, { x: -8.5, y: -5.5, elevation: 0, radius: 0.2, blocks: false });
    input.lights.push({
      id: "spawn-torch-stairs", kind: "torch", x: -8.5, y: -5.5, color: TORCH_LIGHT_COLOR, radiusPx: 150, intensity: 0.95,
    });
  }
}

function pushProp(
  props: ChunkProp[],
  kind: PropKind,
  opts: { readonly x: number; readonly y: number; readonly elevation: number; readonly radius: number; readonly blocks: boolean },
): void {
  props.push({
    id: `${kind}:${Math.round(opts.x * 10)},${Math.round(opts.y * 10)}`,
    kind,
    x: opts.x,
    y: opts.y,
    variant: Math.floor(hashUnit2d(401, Math.floor(opts.x), Math.floor(opts.y)) * 3),
    elevation: opts.elevation,
    radius: opts.radius,
    blocksMovement: opts.blocks,
  });
}

function isProtectedFromRandomProps(wx: number, wy: number, sample: TileSample): boolean {
  if (sample.stairs || sample.ground === GroundKind.DeepWater || sample.ground === GroundKind.ShallowWater) return true;
  if (sample.ground === GroundKind.DirtPath) return true;
  return Math.hypot(wx, wy) < 5.5;
}

function placeRandomTileProp(ctx: PropBuilderContext): void {
  if (isProtectedFromRandomProps(ctx.wx, ctx.wy, ctx.sample)) return;
  const roll = hashUnit2d(ctx.worldSeed + 887, ctx.wx, ctx.wy);
  const px = ctx.wx + 0.5 + (hashUnit2d(ctx.worldSeed + 911, ctx.wx, ctx.wy) - 0.5) * 0.28;
  const py = ctx.wy + 0.5 + (hashUnit2d(ctx.worldSeed + 947, ctx.wx, ctx.wy) - 0.5) * 0.28;
  const choice = chooseBiomeTileProp({
    biome: ctx.sample.biome,
    ground: ctx.sample.ground,
    density: ctx.sample.forestDensity,
    roll,
    distOrigin: Math.hypot(ctx.wx, ctx.wy),
  });
  if (choice) pushProp(ctx.props, choice.kind, { x: px, y: py, elevation: ctx.sample.elevation, radius: choice.radius, blocks: choice.blocks });
}

function fillChunkTile(opts: {
  readonly worldSeed: number; readonly wx: number; readonly wy: number; readonly idx: number;
  readonly poi: ChunkPoi | null; readonly ground: Uint8Array; readonly elevation: Uint8Array;
  readonly stairs: Uint8Array; readonly variant: Uint8Array;
  readonly props: ChunkProp[]; readonly lights: PointLightSpec[];
}): void {
  const sample = sampleWorldTile(opts.worldSeed, opts.wx, opts.wy);
  const inPoi = opts.poi !== null && isInsidePoiFootprint(opts.poi, opts.wx, opts.wy);
  opts.ground[opts.idx] = inPoi && opts.poi ? poiFloorGround(opts.poi, opts.wx, opts.wy) : sample.ground;
  opts.elevation[opts.idx] = sample.elevation;
  opts.stairs[opts.idx] = sample.stairs ? 1 : 0;
  opts.variant[opts.idx] = sample.variant;
  if (!inPoi) {
    placeRandomTileProp({ worldSeed: opts.worldSeed, wx: opts.wx, wy: opts.wy, sample, props: opts.props, lights: opts.lights });
  }
}

export function generateChunk(worldSeed: number, cx: number, cy: number): WorldChunk {
  const size = CHUNK_SIZE * CHUNK_SIZE;
  const ground = new Uint8Array(size);
  const elevation = new Uint8Array(size);
  const stairs = new Uint8Array(size);
  const variant = new Uint8Array(size);
  const props: ChunkProp[] = [];
  const lights: PointLightSpec[] = [];
  addSpawnLandmarks({ cx, cy, props, lights });
  const poi = findChunkPoi(worldSeed, cx, cy);
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    const wy = cy * CHUNK_SIZE + ly;
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      fillChunkTile({ worldSeed, wx: cx * CHUNK_SIZE + lx, wy, idx: worldTileIndex(lx, ly), poi, ground, elevation, stairs, variant, props, lights });
    }
  }
  if (poi) stampPoiPropsAndLights({ poi, props, lights });
  return { cx, cy, ground, elevation, stairs, variant, props, lights, pois: poi ? [poi] : [] };
}
