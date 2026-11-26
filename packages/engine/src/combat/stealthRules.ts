/** Pure stealth exposure, cover, light-level visibility, noise radius, and backstab geometry. */
import { clamp } from "../math/noise.js";
import { sampleDayNight } from "../time/dayNight.js";
import type { WorldChunkCache } from "../world/collision.js";
import { PropKind, type ChunkProp } from "../world/types.js";
import type { Vec2Like } from "./combatRules.js";

export const STEALTH_TUNING = {
  crouchSpeedMult: 0.56,
  bushCoverRadiusTiles: 1.25,
  canopyShadeRadiusTiles: 1.65,
  backstabDamageMult: 2.25,
  ambushBowDamageMult: 1.65,
  pebbleRangeTiles: 4.5,
  pebbleCooldownSec: 1.8,
  pebbleNoiseRadiusTiles: 8.5,
  stoneThrowRangeTiles: 7.0,
  stoneThrowNoiseRadiusTiles: 12.0,
  stoneThrowDamage: 4,
  sprintNoiseRadiusTiles: 6.5,
  combatNoiseRadiusTiles: 9.5,
  spottedPopDurationSec: 1.0,
  attackFlashSec: 0.6,
  attackFlashLightBoost: 0.28,
} as const;

export interface StealthExposure {
  readonly visibility: number;
  readonly lightLevel: number;
  readonly inCover: boolean;
  readonly inShade: boolean;
  readonly noiseRadius: number;
}

export interface StealthQuery {
  readonly cache: WorldChunkCache;
  readonly x: number;
  readonly y: number;
  readonly dayPhase: number;
  readonly torchLit: boolean;
  readonly crouching: boolean;
  readonly moving: boolean;
  readonly sprinting: boolean;
  readonly inWater?: boolean | undefined;
  readonly attackFlash?: boolean | undefined;
}

const COVER_PROPS = new Set<PropKind>([PropKind.Bush, PropKind.TallGrass, PropKind.BogReed]);
const CANOPY_PROPS = new Set<PropKind>([PropKind.OakTree, PropKind.PineTree, PropKind.BirchTree, PropKind.MapleTree, PropKind.GiantMushroom]);
const WARM_GLOW_PROPS = new Set<PropKind>([PropKind.BrazierLit, PropKind.RunicForge, PropKind.Waystone, PropKind.ShrineAltar, PropKind.CursedObelisk]);

function propLightContrib(prop: ChunkProp, x: number, y: number): number {
  const isFire = prop.kind === PropKind.Campfire;
  const isWarmGlow = WARM_GLOW_PROPS.has(prop.kind);
  if (!isFire && prop.kind !== PropKind.Torch && !isWarmGlow) return 0;
  const maxR = isFire ? 6.5 : 4.2;
  const dist = Math.hypot(prop.x - x, prop.y - y);
  if (dist > maxR) return 0;
  return (1 - dist / maxR) * (isFire ? 0.55 : isWarmGlow ? 0.45 : 0.4);
}

function scanNearbyProps(props: readonly ChunkProp[], x: number, y: number): { readonly inCover: boolean; readonly inShade: boolean; readonly propLight: number } {
  let inCover = false;
  let inShade = false;
  let propLight = 0;
  for (const p of props) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (COVER_PROPS.has(p.kind) && d <= STEALTH_TUNING.bushCoverRadiusTiles) inCover = true;
    if (CANOPY_PROPS.has(p.kind) && d <= STEALTH_TUNING.canopyShadeRadiusTiles) inShade = true;
    propLight = Math.max(propLight, propLightContrib(p, x, y));
  }
  return { inCover, inShade, propLight };
}

function computeNoiseRadius(opts: { readonly moving: boolean; readonly crouching: boolean; readonly sprinting: boolean; readonly inWater?: boolean | undefined }): number {
  if (!opts.moving) return 0.4;
  const waterMult = opts.inWater ? 1.45 : 1.0;
  if (opts.crouching) return (opts.inWater ? 1.15 : 0.75) * waterMult;
  return (opts.sprinting ? STEALTH_TUNING.sprintNoiseRadiusTiles : 3.0) * waterMult;
}

function applyStealthModifiers(baseVis: number, q: StealthQuery, inCover: boolean): number {
  let vis = baseVis;
  if (q.crouching) vis *= inCover ? 0.42 : 0.68;
  else if (inCover) vis *= 0.76;
  if (q.sprinting) return vis + 0.16;
  return q.moving && !q.crouching ? vis + 0.08 : vis;
}

export function sampleStealthExposure(q: StealthQuery): StealthExposure {
  const { inCover, inShade, propLight } = scanNearbyProps(q.cache.propsNear(q.x, q.y), q.x, q.y);
  const rawAmbient = 1 - sampleDayNight(q.dayPhase).nightFactor * 0.82;
  const ambient = inShade ? Math.max(0.36, rawAmbient - 0.18) : rawAmbient;
  const attackBoost = q.attackFlash ? STEALTH_TUNING.attackFlashLightBoost : 0;
  const lightLevel = clamp(ambient + (q.torchLit ? 0.55 : 0) + propLight + attackBoost, 0.14, 1.0);
  const visibility = clamp(applyStealthModifiers(Math.max(0.24, lightLevel), q, inCover), 0.12, 1.0);
  return { visibility, lightLevel, inCover, inShade, noiseRadius: computeNoiseRadius(q) };
}

export function isBackstabAngle(opts: {
  readonly attacker: Vec2Like;
  readonly target: Vec2Like;
  readonly targetFacing: Vec2Like;
}): boolean {
  const ax = opts.attacker.x - opts.target.x;
  const ay = opts.attacker.y - opts.target.y;
  const aMag = Math.hypot(ax, ay);
  const fMag = Math.hypot(opts.targetFacing.x, opts.targetFacing.y);
  if (aMag < 0.01 || fMag < 0.01) return false;
  const dot = (ax * opts.targetFacing.x + ay * opts.targetFacing.y) / (aMag * fMag);
  return dot < -0.2;
}