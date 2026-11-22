/** Deterministic 32x32 chunk generator for terrain tiles, props, and point lights. */
import { hashUnit2d } from "../math/noise.js";
import { sampleWorldTile, type TileSample } from "./biomeSampler.js";
import {
  CHUNK_SIZE,
  GroundKind,
  PropKind,
  worldTileIndex,
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
    pushProp(input.props, PropKind.Campfire, { x: 2.5, y: -1.5, elevation: 0, radius: 0.45, blocks: true });
    input.lights.push({
      id: "spawn-campfire", kind: "campfire", x: 2.5, y: -1.5, color: CAMPFIRE_LIGHT_COLOR, radiusPx: 185, intensity: 1.15,
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
  const base = { x: px, y: py, elevation: ctx.sample.elevation };
  if (ctx.sample.ground === GroundKind.CliffStone || ctx.sample.ground === GroundKind.MossStone) {
    if (roll < 0.06) pushProp(ctx.props, PropKind.Boulder, { ...base, radius: 0.42, blocks: true });
    else if (roll < 0.16) pushProp(ctx.props, PropKind.PineTree, { ...base, radius: 0.36, blocks: true });
    return;
  }
  placeForestOrMeadowProp({ roll, density: ctx.sample.forestDensity, base, ground: ctx.sample.ground, props: ctx.props });
}

function chooseVegetationProp(input: {
  readonly roll: number;
  readonly density: number;
  readonly ground: GroundKind;
}): { readonly kind: PropKind; readonly radius: number; readonly blocks: boolean } | null {
  const { roll, density, ground } = input;
  if (roll < density * 0.045) return { kind: PropKind.PineTree, radius: 0.38, blocks: true };
  if (roll < density * 0.11) return { kind: PropKind.OakTree, radius: 0.38, blocks: true };
  if (roll < density * 0.15) return { kind: PropKind.Bush, radius: 0.34, blocks: true };
  if (roll < density * 0.165) return { kind: PropKind.Stump, radius: 0.3, blocks: true };
  if (roll < 0.36) return { kind: PropKind.TallGrass, radius: 0, blocks: false };
  if (roll < 0.44 && ground === GroundKind.MeadowGrass) return { kind: PropKind.Wildflower, radius: 0, blocks: false };
  return null;
}

function placeForestOrMeadowProp(input: {
  readonly roll: number;
  readonly density: number;
  readonly base: { readonly x: number; readonly y: number; readonly elevation: number };
  readonly ground: GroundKind;
  readonly props: ChunkProp[];
}): void {
  const { roll, density, base, ground, props } = input;
  if (ground === GroundKind.Sand) {
    if (roll < 0.04) pushProp(props, PropKind.Boulder, { ...base, radius: 0.38, blocks: true });
    return;
  }
  const choice = chooseVegetationProp({ roll, density, ground });
  if (choice) pushProp(props, choice.kind, { ...base, ...choice });
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
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    const wy = cy * CHUNK_SIZE + ly;
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = cx * CHUNK_SIZE + lx;
      const sample = sampleWorldTile(worldSeed, wx, wy);
      const idx = worldTileIndex(lx, ly);
      ground[idx] = sample.ground;
      elevation[idx] = sample.elevation;
      stairs[idx] = sample.stairs ? 1 : 0;
      variant[idx] = sample.variant;
      placeRandomTileProp({ worldSeed, wx, wy, sample, props, lights });
    }
  }
  return { cx, cy, ground, elevation, stairs, variant, props, lights };
}
