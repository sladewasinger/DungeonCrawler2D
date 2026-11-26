/** Seeded 96x32 right-half biome diorama (river, sand, meadow, tree grove, rocks, cliff & stairs). */
import {
  CHUNK_SIZE, GroundKind, PropKind, TILE_PX, WorldChunkCache, worldTileIndex, worldToChunkCoord,
  type ChunkProp, type PlayerSnapshot, type PointLightSpec, type WorldChunk,
} from "@dc2d/engine";
import { Sprite } from "pixi.js";
import type { ShadowCaster } from "../render/shaders/castShadows.js";
import type { PropTextureSet } from "../render/textures/propTextures.js";
import { createTerrainTileAtlas, type TerrainTileAtlas } from "../render/textures/terrainTextures.js";
import { animateChunkPropsAndFoliage, mountChunkProp, type MountedChunk, type WorldLayers } from "../render/world/chunkProps.js";
import { bakeElevatedChunkRows } from "../render/world/cliffStrips.js";
import { buildChunkTilemapMeshes } from "../render/world/tileBuilder.js";

export const SANDBOX_H = 32;

const LIGHT_TORCH_COLOR = 0xffb84d;
const LIGHT_FIRE_COLOR = 0xffa040;
const BLOCKING_PROPS = new Set<PropKind>([PropKind.OakTree, PropKind.PineTree, PropKind.Boulder, PropKind.RuinPillar, PropKind.Campfire]);
const PROP_RADII: Partial<Record<PropKind, number>> = {
  [PropKind.OakTree]: 0.42, [PropKind.PineTree]: 0.36, [PropKind.Boulder]: 0.4, [PropKind.RuinPillar]: 0.38,
};

interface CellSample { readonly ground: GroundKind; readonly elev: number; readonly stairs: number }
type PropRow = readonly [string, PropKind, number, number, number?];

export interface SandboxDioramaView {
  readonly lights: readonly PointLightSpec[];
  readonly casters: readonly ShadowCaster[];
  animate(players: readonly PlayerSnapshot[], timeSec: number): void;
}

const DIORAMA_PROP_ROWS: readonly PropRow[] = [
  ["dt1", PropKind.Torch, 50, 13.4], ["dt2", PropKind.Torch, 50, 17.6],
  ["db1", PropKind.Boulder, 52.5, 9.5], ["db2", PropKind.Boulder, 53.4, 22.4], ["db3", PropKind.Boulder, 63.6, 11.2],
  ["ds1", PropKind.Stump, 63.6, 20.6], ["do1", PropKind.OakTree, 67.5, 6.2], ["do2", PropKind.OakTree, 72.2, 5.2],
  ["do3", PropKind.OakTree, 75.6, 9.4], ["dp1", PropKind.PineTree, 69.6, 10.6], ["dp2", PropKind.PineTree, 74.6, 5.6],
  ["dp3", PropKind.PineTree, 66.8, 12.1], ["du1", PropKind.Bush, 68.5, 8.2], ["du2", PropKind.Bush, 73.2, 11.8],
  ["du3", PropKind.Bush, 76.5, 12.5], ["db4", PropKind.Boulder, 71.5, 8.4], ["db5", PropKind.Boulder, 76.8, 6.8],
  ["ds2", PropKind.Stump, 70.8, 12.6], ["df1", PropKind.Campfire, 72.0, 23.0], ["ds3", PropKind.Stump, 70.2, 23.4],
  ["dg1", PropKind.TallGrass, 67.2, 20.5], ["dg2", PropKind.TallGrass, 75.5, 20.0], ["dg3", PropKind.TallGrass, 68.5, 26.5],
  ["dg4", PropKind.TallGrass, 74.8, 26.2], ["dw1", PropKind.Wildflower, 68.2, 21.8], ["dw2", PropKind.Wildflower, 74.2, 21.2],
  ["dw3", PropKind.Wildflower, 69.5, 25.0], ["dw4", PropKind.Wildflower, 76.2, 24.5], ["dw5", PropKind.Wildflower, 73.0, 25.8],
  ["dr1", PropKind.RuinPillar, 83.2, 11.2, 1], ["dt3", PropKind.Torch, 84.4, 23.2, 1], ["dt4", PropKind.Torch, 86.6, 23.2, 1],
  ["dt5", PropKind.Torch, 82.2, 12.2, 1], ["db6", PropKind.Boulder, 90.5, 8.5, 1], ["db7", PropKind.Boulder, 81.8, 19.5, 1],
  ["dp4", PropKind.PineTree, 90.5, 17.8, 1], ["dg5", PropKind.TallGrass, 88.5, 19.2, 1],
];

function makeProp(row: PropRow): ChunkProp {
  const [id, kind, x, y, elev = 0] = row;
  return {
    id, kind, x, y, elevation: elev, variant: Math.abs(Math.floor(x * 7 + y * 13)),
    radius: PROP_RADII[kind] ?? 0, blocksMovement: BLOCKING_PROPS.has(kind),
  };
}

function inBox(wx: number, wy: number, b: readonly [number, number, number, number]): boolean {
  return wx >= b[0] && wx <= b[1] && wy >= b[2] && wy <= b[3];
}

function classifyRiverCell(wx: number, wy: number): CellSample | null {
  if (wy < 2 || wy > 29) return null;
  const dist = Math.abs(wx - (58.5 + Math.sin(wy * 0.22) * 2.8));
  const ford = wy >= 14 && wy <= 17;
  if (!ford && dist <= 1.35) return { ground: GroundKind.DeepWater, elev: 0, stairs: 0 };
  if (dist <= 3.1) return { ground: GroundKind.ShallowWater, elev: 0, stairs: 0 };
  return dist <= 5.0 ? { ground: GroundKind.Sand, elev: 0, stairs: 0 } : null;
}

function isCliffRim(wx: number, wy: number): boolean {
  return wx === 80 || wx === 93 || wy === 6 || wy === 23;
}

function pickPlateauGround(wx: number, wy: number): GroundKind {
  if (wy >= 21 && (wx === 85 || wx === 86)) return GroundKind.DirtPath;
  if (isCliffRim(wx, wy)) return GroundKind.CliffStone;
  if (inBox(wx, wy, [82, 91, 8, 15])) return GroundKind.MossStone;
  return (wx + wy) % 3 === 0 ? GroundKind.MeadowGrass : GroundKind.Grass;
}

function classifyCliffCell(wx: number, wy: number): CellSample | null {
  if (wy === 24 && (wx === 85 || wx === 86)) return { ground: GroundKind.DirtPath, elev: 0, stairs: 1 };
  if (!inBox(wx, wy, [80, 93, 6, 23])) return null;
  return { ground: pickPlateauGround(wx, wy), elev: 1, stairs: 0 };
}

function classifyTrailOrBiome(wx: number, wy: number): CellSample | null {
  if (inBox(wx, wy, [46, 54, 14, 16]) || inBox(wx, wy, [63, 79, 15, 16]) || inBox(wx, wy, [84, 87, 24, 26])) {
    return { ground: GroundKind.DirtPath, elev: 0, stairs: 0 };
  }
  if (inBox(wx, wy, [65, 78, 2, 13])) return { ground: GroundKind.ForestFloor, elev: 0, stairs: 0 };
  return inBox(wx, wy, [66, 78, 18, 29]) ? { ground: GroundKind.MeadowGrass, elev: 0, stairs: 0 } : null;
}

function sampleDioramaCell(wx: number, wy: number): CellSample {
  if (wx < 46) return { ground: GroundKind.Grass, elev: 0, stairs: 0 };
  return classifyCliffCell(wx, wy) ?? classifyRiverCell(wx, wy) ?? classifyTrailOrBiome(wx, wy)
    ?? { ground: (wx + wy) % 5 === 0 ? GroundKind.MeadowGrass : GroundKind.Grass, elev: 0, stairs: 0 };
}

function lightForProp(prop: ChunkProp): PointLightSpec | null {
  if (prop.kind === PropKind.Campfire) return { id: prop.id, kind: "campfire", x: prop.x, y: prop.y, color: LIGHT_FIRE_COLOR, radiusPx: 145, intensity: 1.25 };
  if (prop.kind === PropKind.Torch) return { id: prop.id, kind: "torch", x: prop.x, y: prop.y, color: LIGHT_TORCH_COLOR, radiusPx: 95, intensity: 1.0 };
  return null;
}

function buildFlatFallbackChunk(cx: number, cy: number): WorldChunk {
  const n = CHUNK_SIZE * CHUNK_SIZE;
  const ground = new Uint8Array(n);
  ground.fill(GroundKind.Grass);
  return { cx, cy, ground, elevation: new Uint8Array(n), stairs: new Uint8Array(n), variant: new Uint8Array(n), props: [], lights: [], pois: [] };
}

function buildSandboxChunk(cx: number, allProps: readonly ChunkProp[]): WorldChunk {
  const n = CHUNK_SIZE * CHUNK_SIZE;
  const ground = new Uint8Array(n);
  const elevation = new Uint8Array(n);
  const stairs = new Uint8Array(n);
  const variant = new Uint8Array(n);
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = cx * CHUNK_SIZE + lx;
      const cell = sampleDioramaCell(wx, ly);
      const idx = worldTileIndex(lx, ly);
      ground[idx] = cell.ground; elevation[idx] = cell.elev; stairs[idx] = cell.stairs; variant[idx] = (wx * 7 + ly * 13) & 3;
    }
  }
  const props = allProps.filter((pr) => worldToChunkCoord(Math.floor(pr.x)) === cx);
  const lights = props.map(lightForProp).filter((l): l is PointLightSpec => l !== null);
  return { cx, cy: 0, ground, elevation, stairs, variant, props, lights, pois: [] };
}

export class SandboxChunkCache extends WorldChunkCache {
  private readonly fixed = new Map<number, WorldChunk>();

  constructor() {
    super(42);
    const props = DIORAMA_PROP_ROWS.map(makeProp);
    for (const cx of [0, 1, 2]) this.fixed.set(cx, buildSandboxChunk(cx, props));
  }

  override getChunk(cx: number, cy: number): WorldChunk {
    return cy === 0 ? (this.fixed.get(cx) ?? buildFlatFallbackChunk(cx, cy)) : buildFlatFallbackChunk(cx, cy);
  }
}

function mountDioramaChunk(opts: {
  readonly cx: number; readonly cache: WorldChunkCache; readonly terrainAtlas: TerrainTileAtlas;
  readonly layers: WorldLayers; readonly propsAtlas: PropTextureSet;
}): MountedChunk {
  const { cx, cache, terrainAtlas, layers, propsAtlas } = opts;
  const chunk = cache.getChunk(cx, 0);
  const baked = buildChunkTilemapMeshes(cache, terrainAtlas, { cx, cy: 0 });
  baked.ground.mesh.position.set(cx * CHUNK_SIZE * TILE_PX, 0);
  layers.ground.addChild(baked.ground.mesh);
  if (baked.water) {
    baked.water.mesh.position.copyFrom(baked.ground.mesh.position);
    layers.water.addChild(baked.water.mesh);
  }
  const target = {
    grassSprites: [] as { sprite: Sprite; wx: number; wy: number }[], ysortSprites: [] as Sprite[],
    canopySprites: [] as { sprite: Sprite; wx: number; wy: number }[], animatedProps: [] as { sprite: Sprite; kind: PropKind; phase: number }[],
    casters: [] as ShadowCaster[],
  };
  for (const strip of bakeElevatedChunkRows(cache, terrainAtlas, { cx, cy: 0 })) {
    const sp = new Sprite(strip.texture); sp.scale.set(strip.scale); sp.position.set(strip.x, strip.y); sp.zIndex = strip.zIndex;
    layers.ysort.addChild(sp); target.ysortSprites.push(sp);
  }
  for (const prop of chunk.props) mountChunkProp({ prop, layers, propsAtlas, target });
  return { key: `${cx},0`, cx, cy: 0, ground: baked.ground, water: baked.water, ...target, lights: chunk.lights };
}

export function mountSandboxTerrainDiorama(opts: {
  readonly layers: WorldLayers; readonly cache: WorldChunkCache; readonly propsAtlas: PropTextureSet;
}): SandboxDioramaView {
  const terrainAtlas = createTerrainTileAtlas();
  const mounted = [1, 2].map((cx) => mountDioramaChunk({ cx, cache: opts.cache, terrainAtlas, layers: opts.layers, propsAtlas: opts.propsAtlas }));
  return {
    lights: mounted.flatMap((m) => m.lights),
    casters: mounted.flatMap((m) => m.casters),
    animate(players: readonly PlayerSnapshot[], timeSec: number): void {
      for (const m of mounted) animateChunkPropsAndFoliage({ chunk: m, players, propsAtlas: opts.propsAtlas, timeSec });
    },
  };
}
