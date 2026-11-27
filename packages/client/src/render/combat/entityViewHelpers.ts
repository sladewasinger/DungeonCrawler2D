/** Pure helper functions and lazy sub-asset builders for EntityView. */
import { JUMP_VISUAL_PX_PER_TILE, TILE_PX, type PlayerSnapshot, type WorldEntitySnapshot } from "@dc2d/engine";
import { Graphics, Sprite } from "pixi.js";
import { getLoadedSpriteAsset, type LoadedSpriteAnimations } from "../textures/spriteManifest.js";
import type { WaterlineMetrics } from "../world/player/playerPoseHelpers.js";
import { canShowBackstabReticle } from "./aiStateIndicators.js";
import { drawCreatureBody } from "./creatureDrawers.js";

export type WorldEntityKind = WorldEntitySnapshot["kind"];

export const KIND_SLIME_DUMMY: WorldEntityKind = "slime-dummy";
export const KIND_SLIME: WorldEntityKind = "slime";
export const PILE_CORPSE_KINDS = new Set<WorldEntityKind>(["golem", "skeleton"]);
const CORPSE_GROUND_Z_OFFSET = -500_000;

export function isCorpseState(snap: WorldEntitySnapshot): boolean {
  return Boolean(snap.corpse) || snap.hp <= 0;
}

export function resolveEntityZIndex(snap: WorldEntitySnapshot, dead: boolean): number {
  if (!dead) return Math.round(snap.y * TILE_PX) + snap.elevation * 2;
  if (snap.elevation === 0) return CORPSE_GROUND_Z_OFFSET + Math.round(snap.y * TILE_PX);
  return Math.floor(snap.y) * TILE_PX + snap.elevation + 0.5;
}

export function resolveBodyTint(snap: WorldEntitySnapshot, timeSec: number): number {
  if (isCorpseState(snap)) return 0xcbd5e1;
  if (snap.hitTimer > 0) return 0xfca5a5;
  if (snap.burning) return Math.floor(timeSec * 12) % 2 === 0 ? 0xfdba74 : 0xfed7aa;
  if (snap.staggerTimer > 0) return 0xfef08a;
  return 0xffffff;
}

export function resolveFallbackBodyY(opts: {
  readonly snap: WorldEntitySnapshot; readonly moving: boolean; readonly timeSec: number; readonly dead: boolean;
}): number {
  if (opts.dead) return 0;
  const bounce = opts.moving ? -Math.abs(Math.sin(opts.timeSec * 12 + opts.snap.x)) * 1.4 : 0;
  return bounce - (opts.snap.jumpZ ?? 0) * JUMP_VISUAL_PX_PER_TILE;
}

export function createEntityBody(kind: WorldEntityKind): {
  readonly body: Sprite | Graphics;
  readonly baseScale: number;
  readonly hpTopY: number;
  readonly shadowRx: number;
  readonly visualH: number;
  readonly animations: LoadedSpriteAnimations | null;
} {
  const asset = getLoadedSpriteAsset(kind);
  if (asset) {
    const sprite = new Sprite(asset.texture);
    sprite.anchor.set(asset.anchorX, asset.anchorY);
    sprite.scale.set(asset.scale);
    const visualW = (asset.contentWidth ?? asset.width) * asset.scale;
    const visualH = (asset.contentHeight ?? asset.height) * asset.scale;
    return {
      body: sprite, baseScale: asset.scale, hpTopY: -Math.round(visualH) - 4,
      shadowRx: Math.max(6, Math.round(visualW * 0.36)), visualH, animations: asset.loadedAnimations ?? null,
    };
  }
  const gfx = new Graphics();
  drawCreatureBody(kind, gfx);
  return { body: gfx, baseScale: 1, hpTopY: -27, shadowRx: 7, visualH: 22, animations: null };
}

export function buildEntityWaterMetrics(shadowRx: number, visualH: number): WaterlineMetrics {
  const halfW = Math.max(7.5, shadowRx + 2.0);
  return {
    cutY: -Math.max(5.5, Math.min(9.5, Math.round(visualH * 0.28))),
    halfW,
    bowPx: Math.max(2.0, Math.min(3.2, halfW * 0.28)),
  };
}

export function shouldActivateIndicator(snap: WorldEntitySnapshot, dead: boolean, localPlayer?: PlayerSnapshot): boolean {
  if (dead) return false;
  if (snap.telegraphProgress > 0 || (snap.aiState ?? "idle") !== "idle") return true;
  if ([snap.spottedPop, snap.stunned, snap.howling, snap.bluffing, snap.parried, snap.sniffing].some(Boolean)) return true;
  return canShowBackstabReticle(snap, localPlayer);
}
