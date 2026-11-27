/** Pure decal color, surface, animation, and static feature helpers for GoreDecalManager. */
import { GroundKind, type GoreSubstance, type PlayerSnapshot, type WorldChunkCache, type WorldEntitySnapshot } from "@dc2d/engine";
import type { Sprite, Texture } from "pixi.js";
import { GORE_TUNING } from "../combatVisualTuning.js";
import type { PlannedParticleKind, StaticFeatureKind } from "./gorePatterns.js";
import { getGoreTextures } from "./goreTextures.js";

export const pickGoreItem = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;

export function initialDropScale(kind: PlannedParticleKind, scale: number): number {
  if (kind === "arc") return scale * 0.58;
  return kind === "chunk" ? scale * 0.85 : scale * 0.72;
}

export function buildGoreFootActors(players: readonly PlayerSnapshot[], entities: readonly WorldEntitySnapshot[]) {
  return [
    ...players.map((p) => ({ id: p.id, x: p.x, y: p.y, elevation: p.elevation, jumpZ: p.jumpZ, inWater: p.inWater, alive: (p.respawnTimer ?? 0) <= 0 })),
    ...entities.map((e) => ({ id: e.id, x: e.x, y: e.y, elevation: e.elevation, jumpZ: e.jumpZ, alive: !e.corpse && e.hp > 0 })),
  ];
}

export type TileSampler = Pick<WorldChunkCache, "tileAt">;

export interface GoreDecal {
  readonly sprite: Sprite;
  age: number;
  readonly ttl: number;
  readonly baseAlpha: number;
  readonly freshColor: number;
  readonly driedColor: number;
  readonly solid: boolean;
  readonly baseScale: number;
  readonly growFrom: number;
  readonly growTo: number;
  readonly growDuration: number;
  readonly driftVx: number;
  readonly driftVy: number;
}

function lerpRgb(c0: number, c1: number, t: number): number {
  const k = Math.max(0, Math.min(1, t));
  const r = Math.round(((c0 >> 16) & 0xff) * (1 - k) + ((c1 >> 16) & 0xff) * k);
  const g = Math.round(((c0 >> 8) & 0xff) * (1 - k) + ((c1 >> 8) & 0xff) * k);
  const b = Math.round((c0 & 0xff) * (1 - k) + (c1 & 0xff) * k);
  return (r << 16) | (g << 8) | b;
}

export function pickGoreColors(substance: GoreSubstance): { readonly fresh: number; readonly dried: number; readonly solid: boolean } {
  const pal = GORE_TUNING.palettes[substance];
  const fi = Math.floor(Math.random() * pal.fresh.length);
  const di = Math.floor(Math.random() * pal.dried.length);
  return { fresh: pal.fresh[fi] ?? pal.fresh[0]!, dried: pal.dried[di] ?? pal.dried[0]!, solid: pal.solid };
}

export function isWaterTile(cache: TileSampler | undefined, tileX: number, tileY: number): boolean {
  if (!cache) return false;
  const g = cache.tileAt(Math.floor(tileX), Math.floor(tileY)).ground;
  return g === GroundKind.ShallowWater || g === GroundKind.DeepWater;
}

export function stepSingleDecal(dc: GoreDecal, dt: number): boolean {
  dc.age += dt;
  if (dc.age >= dc.ttl) { dc.sprite.destroy(); return false; }
  if (dc.driftVx !== 0 || dc.driftVy !== 0) {
    dc.sprite.position.x += dc.driftVx * dt;
    dc.sprite.position.y += dc.driftVy * dt;
  }
  if (dc.growDuration > 0) {
    const gt = Math.min(1, dc.age / dc.growDuration);
    const eased = 1 - Math.pow(1 - gt, 2.2);
    dc.sprite.scale.set(dc.baseScale * (dc.growFrom + (dc.growTo - dc.growFrom) * eased));
  }
  if (!dc.solid) dc.sprite.tint = lerpRgb(dc.freshColor, dc.driedColor, dc.age / GORE_TUNING.dryDurationSec);
  const fadeStart = Math.max(0, dc.ttl - GORE_TUNING.decalFadeSec);
  dc.sprite.alpha = dc.age > fadeStart ? dc.baseAlpha * (1 - (dc.age - fadeStart) / Math.max(0.1, dc.ttl - fadeStart)) : dc.baseAlpha;
  return true;
}

export function resolveFeatureSpec(kind: StaticFeatureKind): {
  readonly tex: Texture; readonly baseScale: number; readonly growFrom: number; readonly growTo: number;
  readonly growDur: number; readonly trackPuddle: boolean; readonly tintOverride?: number;
} {
  const tex = getGoreTextures();
  if (kind === "groundCrack") {
    return { tex: tex.crack, baseScale: 0.78, growFrom: 0.85, growTo: 1, growDur: 0.08, trackPuddle: false, tintOverride: 0x1c1917 };
  }
  if (kind === "goopPuddle") {
    return { tex: tex.goopPuddles[Math.floor(Math.random() * tex.goopPuddles.length)]!, baseScale: 0.62, growFrom: 0.42, growTo: 1.18, growDur: 1.4, trackPuddle: true };
  }
  if (kind === "bonePile") return { tex: tex.bonePile, baseScale: 0.72, growFrom: 1, growTo: 1, growDur: 0, trackPuddle: false };
  if (kind === "rubblePile") return { tex: tex.rubblePile, baseScale: 0.76, growFrom: 1, growTo: 1, growDur: 0, trackPuddle: false };
  return { tex: tex.pools[Math.floor(Math.random() * tex.pools.length)]!, baseScale: 0.62, growFrom: 0.32, growTo: 1.15, growDur: 2.2, trackPuddle: true };
}
