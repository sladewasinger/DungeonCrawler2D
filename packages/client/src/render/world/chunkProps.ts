/** Prop mounting with elevation lift, foliage rustling, canopy fading, and animated fire helpers. */
import { PropKind, TILE_PX, type ChunkProp, type PlayerSnapshot, type PointLightSpec, type WorldChunkCache } from "@dc2d/engine";
import { Container, Sprite, type Texture } from "pixi.js";
import { shadowCasterForProp, type ShadowCaster } from "../shaders/castShadows.js";
import type { TilemapLayerHandle } from "../shaders/tilemapMesh.js";
import { getPoiPropSpriteSpec, type PoiPropSpriteSpec } from "../textures/poiPropTextures.js";
import { HD_PROP_SCALE, isTreeProp, resolvePropTexture, resolveTreeTextures, type PropTextureSet } from "../textures/propTextures.js";

const grassBendState = new WeakMap<Sprite, number>();
import { ELEVATION_LIFT_PX } from "./cliffStrips.js";

export interface WorldLayers {
  readonly ground: Container;
  readonly water: Container;
  readonly grass: Container;
  readonly ysort: Container;
  readonly canopy: Container;
}

export interface MountedPropEntry {
  readonly sprite: Sprite;
  readonly canopy?: Sprite | undefined;
  readonly kind: PropKind;
  readonly baseX: number;
  readonly baseY: number;
  readonly elevation: number;
}

export interface MountedChunk {
  readonly key: string;
  readonly cx: number;
  readonly cy: number;
  readonly revision?: number;
  readonly ground: TilemapLayerHandle;
  readonly water?: TilemapLayerHandle | undefined;
  readonly grassSprites: readonly { sprite: Sprite; wx: number; wy: number }[];
  readonly ysortSprites: readonly Sprite[];
  readonly canopySprites: readonly { sprite: Sprite; wx: number; wy: number }[];
  readonly animatedProps: readonly { sprite: Sprite; kind: PropKind; phase: number }[];
  readonly propSprites: ReadonlyMap<string, MountedPropEntry>;
  readonly lights: readonly PointLightSpec[];
  readonly casters: readonly ShadowCaster[];
}

interface MountTarget {
  readonly grassSprites: { sprite: Sprite; wx: number; wy: number }[];
  readonly ysortSprites: Sprite[];
  readonly canopySprites: { sprite: Sprite; wx: number; wy: number }[];
  readonly animatedProps: { sprite: Sprite; kind: PropKind; phase: number }[];
  readonly propSprites: Map<string, MountedPropEntry>;
  readonly casters: ShadowCaster[];
}

function resolvePoiSpec(kind: PropKind | undefined, tex: Texture): PoiPropSpriteSpec | null {
  if (kind === undefined || tex.width < 48) return null;
  return getPoiPropSpriteSpec(kind);
}

function addPropSprite(
  parent: Container,
  tex: Texture,
  prop: { readonly x: number; readonly y: number; readonly elevation?: number; readonly kind?: PropKind },
): Sprite {
  const elev = prop.elevation ?? 0;
  const sprite = new Sprite(tex);
  const spec = resolvePoiSpec(prop.kind, tex);
  const foliage = prop.kind === PropKind.TallGrass || prop.kind === PropKind.Wildflower;
  const baseAnchorY = prop.kind === PropKind.Campfire ? 0.78 : foliage ? 0.94 : 0.9;
  sprite.anchor.set(spec ? spec.anchorX : 0.5, spec ? spec.anchorY : baseAnchorY);
  sprite.scale.set(spec ? spec.scale : HD_PROP_SCALE);
  sprite.position.set(prop.x * TILE_PX, prop.y * TILE_PX - elev * ELEVATION_LIFT_PX);
  sprite.zIndex = Math.round(prop.y * TILE_PX) + elev * 2;
  parent.addChild(sprite);
  return sprite;
}

export { REGISTERED_PROP_RENDER_KINDS } from "../textures/propTextures.js";

function mountTreeProp(input: {
  readonly prop: ChunkProp;
  readonly layers: WorldLayers;
  readonly propsAtlas: PropTextureSet;
  readonly target: MountTarget;
}): void {
  const { prop, layers, propsAtlas, target } = input;
  const [trunkTex, canopyTex] = resolveTreeTextures(prop.kind, propsAtlas);
  const trunk = addPropSprite(layers.ysort, trunkTex, prop);
  target.ysortSprites.push(trunk);
  const crown = addPropSprite(layers.canopy, canopyTex, {
    x: prop.x, y: prop.y - 0.38, elevation: prop.elevation,
  });
  target.canopySprites.push({ sprite: crown, wx: prop.x, wy: prop.y });
  target.propSprites.set(prop.id, { sprite: trunk, canopy: crown, kind: prop.kind, baseX: trunk.x, baseY: trunk.y, elevation: prop.elevation });
}

function mountFoliageProp(input: {
  readonly prop: ChunkProp;
  readonly layers: WorldLayers;
  readonly propsAtlas: PropTextureSet;
  readonly target: MountTarget;
}): void {
  const { prop, layers, propsAtlas, target } = input;
  const list = prop.kind === PropKind.TallGrass ? propsAtlas.tallGrass : propsAtlas.wildflower;
  const parent = prop.elevation > 0 ? layers.ysort : layers.grass;
  const sp = addPropSprite(parent, list[prop.variant % list.length]!, prop);
  target.grassSprites.push({ sprite: sp, wx: prop.x, wy: prop.y });
  target.propSprites.set(prop.id, { sprite: sp, kind: prop.kind, baseX: sp.x, baseY: sp.y, elevation: prop.elevation });
}

function applyBedRotation(sprite: Sprite, prop: ChunkProp): void {
  if (!prop.rotation || prop.kind !== PropKind.Bed) return;
  if (prop.rotation >= 2) sprite.scale.x = -Math.abs(sprite.scale.x);
  if (prop.rotation % 2 === 1) sprite.rotation = 0.14;
}

function applyMountedPropBehavior(input: {
  readonly prop: ChunkProp; readonly sprite: Sprite; readonly cache?: WorldChunkCache | undefined;
  readonly layers: WorldLayers; readonly propsAtlas: PropTextureSet; readonly target: MountTarget;
}): void {
  const { prop, sprite, cache, layers, propsAtlas, target } = input;
  applyBedRotation(sprite, prop);
  target.ysortSprites.push(sprite);
  target.propSprites.set(prop.id, { sprite, kind: prop.kind, baseX: sprite.x, baseY: sprite.y, elevation: prop.elevation });
  if (prop.kind === PropKind.Palisade && cache) mountPalisadeRails({ prop, cache, layers, propsAtlas, target });
  if (prop.kind === PropKind.Campfire || prop.kind === PropKind.Torch) {
    target.animatedProps.push({ sprite, kind: prop.kind, phase: prop.variant });
  }
}

function isOrderedAdjacentPalisade(prop: ChunkProp, n: ChunkProp): boolean {
  if (n.kind !== PropKind.Palisade || n.id === prop.id) return false;
  const ordered = prop.x < n.x || (prop.x === n.x && prop.y < n.y);
  return ordered && Math.hypot(n.x - prop.x, n.y - prop.y) <= 1.2;
}

function mountPalisadeRails(opts: {
  readonly prop: ChunkProp; readonly cache: WorldChunkCache; readonly layers: WorldLayers;
  readonly propsAtlas: PropTextureSet; readonly target: MountTarget;
}): void {
  const { prop, cache, layers, propsAtlas, target } = opts;
  for (const n of cache.propsNear(prop.x, prop.y)) {
    if (!isOrderedAdjacentPalisade(prop, n)) continue;
    const horiz = Math.abs(n.x - prop.x) >= Math.abs(n.y - prop.y);
    const tex = horiz ? propsAtlas.palisadeRailH : propsAtlas.palisadeRailV;
    const rail = addPropSprite(layers.ysort, tex, { x: (prop.x + n.x) * 0.5, y: (prop.y + n.y) * 0.5, elevation: prop.elevation });
    rail.anchor.set(0.5, 0.72);
    target.ysortSprites.push(rail);
  }
}

export function mountChunkProp(input: {
  readonly prop: ChunkProp; readonly layers: WorldLayers; readonly propsAtlas: PropTextureSet;
  readonly target: MountTarget; readonly cache?: WorldChunkCache | undefined;
}): void {
  const { prop, layers, propsAtlas } = input;
  const caster = shadowCasterForProp(prop);
  if (caster) input.target.casters.push(caster);
  if (prop.kind === PropKind.TallGrass || prop.kind === PropKind.Wildflower) { mountFoliageProp(input); return; }
  if (isTreeProp(prop.kind)) { mountTreeProp(input); return; }
  if (prop.kind === PropKind.WoodChest) return;
  const sprite = addPropSprite(layers.ysort, resolvePropTexture(prop, propsAtlas), prop);
  applyMountedPropBehavior({ ...input, sprite });
}

function animateFireSprite(anim: { sprite: Sprite; kind: PropKind; phase: number }, propsAtlas: PropTextureSet, timeSec: number): void {
  const frames = anim.kind === PropKind.Campfire ? propsAtlas.campfireFrames : propsAtlas.torchFrames;
  const tex = frames[Math.floor(timeSec * 10 + anim.phase) % frames.length];
  if (tex) anim.sprite.texture = tex;
}

function updateCanopyAlpha(canopy: { sprite: Sprite; wx: number; wy: number }, players: readonly PlayerSnapshot[]): void {
  const behind = players.some((p) => Math.abs(p.x - canopy.wx) < 1.35 && p.y < canopy.wy - 0.05 && p.y > canopy.wy - 2.6);
  canopy.sprite.alpha += ((behind ? 0.42 : 1) - canopy.sprite.alpha) * 0.2;
}

function findGrassPush(grass: { wx: number; wy: number }, players: readonly PlayerSnapshot[]): number {
  let bestDist = 0.95;
  let pushDir = 0;
  for (const p of players) {
    const dx = grass.wx - p.x;
    const d = Math.hypot(dx, grass.wy - p.y);
    if (d < bestDist) {
      bestDist = d;
      pushDir = dx >= 0 ? 1 : -1;
    }
  }
  return bestDist < 0.95 ? ((0.95 - bestDist) / 0.95) * pushDir * 0.44 : 0;
}

function updateGrassRustle(
  grass: { sprite: Sprite; wx: number; wy: number },
  players: readonly PlayerSnapshot[],
  timeSec: number,
): void {
  const phase = grass.wx * 0.42 + grass.wy * 0.31;
  const gust = Math.sin(timeSec * 2.1 + phase) * 0.08 + Math.sin(timeSec * 4.3 + phase * 1.7) * 0.035;
  const prev = grassBendState.get(grass.sprite) ?? 0;
  const bend = prev + (findGrassPush(grass, players) - prev) * 0.22;
  grassBendState.set(grass.sprite, bend);
  grass.sprite.rotation = gust + bend;
  grass.sprite.scale.set(HD_PROP_SCALE, HD_PROP_SCALE * (1 - Math.abs(bend) * 0.14));
}

export function animateChunkPropsAndFoliage(input: {
  readonly chunk: MountedChunk;
  readonly players: readonly PlayerSnapshot[];
  readonly propsAtlas: PropTextureSet;
  readonly viewBounds?: { readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number } | undefined;
  readonly timeSec: number;
}): void {
  const vb = input.viewBounds;
  for (const anim of input.chunk.animatedProps) animateFireSprite(anim, input.propsAtlas, input.timeSec);
  for (const canopy of input.chunk.canopySprites) {
    if (!vb || inView({ x: canopy.wx, y: canopy.wy, b: vb, pad: 3 })) updateCanopyAlpha(canopy, input.players);
  }
  for (const grass of input.chunk.grassSprites) {
    if (!vb || inView({ x: grass.wx, y: grass.wy, b: vb, pad: 1.5 })) updateGrassRustle(grass, input.players, input.timeSec);
  }
}

function inView(q: {
  readonly x: number; readonly y: number;
  readonly b: { readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number };
  readonly pad: number;
}): boolean {
  return q.x >= q.b.minX - q.pad && q.x <= q.b.maxX + q.pad && q.y >= q.b.minY - q.pad && q.y <= q.b.maxY + q.pad;
}
