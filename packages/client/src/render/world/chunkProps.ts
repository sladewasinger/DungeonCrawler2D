/** Prop mounting with elevation lift, foliage rustling, canopy fading, and animated fire helpers. */
import { PropKind, TILE_PX, type ChunkProp, type PlayerSnapshot, type PointLightSpec } from "@dc2d/engine";
import { Container, Sprite, type Texture } from "pixi.js";
import { shadowCasterForProp, type ShadowCaster } from "../shaders/castShadows.js";
import type { TilemapLayerHandle } from "../shaders/tilemapMesh.js";
import { getPoiPropSpriteSpec, type PoiPropSpriteSpec } from "../textures/poiPropTextures.js";
import { isTreeProp, type PropTextureSet } from "../textures/propTextures.js";
import { ELEVATION_LIFT_PX } from "./cliffStrips.js";

export interface WorldLayers {
  readonly ground: Container;
  readonly water: Container;
  readonly grass: Container;
  readonly ysort: Container;
  readonly canopy: Container;
}

export interface MountedChunk {
  readonly key: string;
  readonly cx: number;
  readonly cy: number;
  readonly ground: TilemapLayerHandle;
  readonly water: TilemapLayerHandle;
  readonly grassSprites: readonly { sprite: Sprite; wx: number; wy: number }[];
  readonly ysortSprites: readonly Sprite[];
  readonly canopySprites: readonly { sprite: Sprite; wx: number; wy: number }[];
  readonly animatedProps: readonly { sprite: Sprite; kind: PropKind; phase: number }[];
  readonly lights: readonly PointLightSpec[];
  readonly casters: readonly ShadowCaster[];
}

interface MountTarget {
  readonly grassSprites: { sprite: Sprite; wx: number; wy: number }[];
  readonly ysortSprites: Sprite[];
  readonly canopySprites: { sprite: Sprite; wx: number; wy: number }[];
  readonly animatedProps: { sprite: Sprite; kind: PropKind; phase: number }[];
  readonly casters: ShadowCaster[];
}

function resolvePoiSpec(kind: PropKind | undefined, tex: Texture): PoiPropSpriteSpec | null {
  if (kind === undefined || tex.width < 48) return null;
  return getPoiPropSpriteSpec(kind);
}

export function addPropSprite(
  parent: Container,
  tex: Texture,
  prop: { readonly x: number; readonly y: number; readonly elevation?: number; readonly kind?: PropKind },
): Sprite {
  const elev = prop.elevation ?? 0;
  const sprite = new Sprite(tex);
  const spec = resolvePoiSpec(prop.kind, tex);
  sprite.anchor.set(spec ? spec.anchorX : 0.5, spec ? spec.anchorY : 0.9);
  if (spec) sprite.scale.set(spec.scale);
  sprite.position.set(prop.x * TILE_PX, prop.y * TILE_PX - elev * ELEVATION_LIFT_PX);
  sprite.zIndex = Math.round(prop.y * TILE_PX) + elev * 2;
  parent.addChild(sprite);
  return sprite;
}

function propTextureFor(prop: ChunkProp, p: PropTextureSet): Texture {
  if (prop.kind === PropKind.Boulder) return p.boulder[prop.variant % p.boulder.length]!;
  if (prop.kind === PropKind.Bush) return p.bush[prop.variant % p.bush.length]!;
  if (prop.kind === PropKind.Campfire) return p.campfireFrames[0]!;
  if (prop.kind === PropKind.Torch) return p.torchFrames[0]!;
  if (prop.kind === PropKind.Palisade) return p.palisade;
  if (prop.kind === PropKind.Tent) return p.tent;
  if (prop.kind === PropKind.RuinPillar) return p.ruinPillar;
  return p.stump;
}

function mountTreeProp(input: {
  readonly prop: ChunkProp;
  readonly layers: WorldLayers;
  readonly propsAtlas: PropTextureSet;
  readonly target: MountTarget;
}): void {
  const { prop, layers, propsAtlas, target } = input;
  const pine = prop.kind === PropKind.PineTree;
  target.ysortSprites.push(addPropSprite(layers.ysort, pine ? propsAtlas.pineTrunk : propsAtlas.oakTrunk, prop));
  const crown = addPropSprite(layers.canopy, pine ? propsAtlas.pineCanopy : propsAtlas.oakCanopy, {
    x: prop.x, y: prop.y - 0.38, elevation: prop.elevation,
  });
  target.canopySprites.push({ sprite: crown, wx: prop.x, wy: prop.y });
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
  target.grassSprites.push({ sprite: addPropSprite(parent, list[prop.variant % list.length]!, prop), wx: prop.x, wy: prop.y });
}

export function mountChunkProp(input: {
  readonly prop: ChunkProp;
  readonly layers: WorldLayers;
  readonly propsAtlas: PropTextureSet;
  readonly target: MountTarget;
}): void {
  const { prop, layers, propsAtlas, target } = input;
  const caster = shadowCasterForProp(prop);
  if (caster) target.casters.push(caster);
  if (prop.kind === PropKind.TallGrass || prop.kind === PropKind.Wildflower) { mountFoliageProp(input); return; }
  if (isTreeProp(prop.kind)) { mountTreeProp(input); return; }
  const sprite = addPropSprite(layers.ysort, propTextureFor(prop, propsAtlas), prop);
  target.ysortSprites.push(sprite);
  if (prop.kind === PropKind.Campfire || prop.kind === PropKind.Torch) {
    target.animatedProps.push({ sprite, kind: prop.kind, phase: prop.variant });
  }
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

function updateGrassRustle(grass: { sprite: Sprite; wx: number; wy: number }, players: readonly PlayerSnapshot[]): void {
  const rustled = players.some((p) => Math.hypot(p.x - grass.wx, p.y - grass.wy) < 0.85);
  grass.sprite.scale.x += ((rustled ? 1.18 : 1) - grass.sprite.scale.x) * 0.22;
}

export function animateChunkPropsAndFoliage(input: {
  readonly chunk: MountedChunk;
  readonly players: readonly PlayerSnapshot[];
  readonly propsAtlas: PropTextureSet;
  readonly timeSec: number;
}): void {
  for (const anim of input.chunk.animatedProps) animateFireSprite(anim, input.propsAtlas, input.timeSec);
  for (const canopy of input.chunk.canopySprites) updateCanopyAlpha(canopy, input.players);
  for (const grass of input.chunk.grassSprites) updateGrassRustle(grass, input.players);
}
