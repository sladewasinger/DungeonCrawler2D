/** Pure stealth exposure, cover, light-level visibility, noise radius, and backstab geometry. */
import { clamp } from "../math/noise.js";
import { sampleDayNight } from "../time/dayNight.js";
import type { WorldChunkCache } from "../world/collision.js";
import { PropKind, type ChunkProp } from "../world/types.js";
import type { Vec2Like } from "./combatRules.js";

export const STEALTH_TUNING = {
  crouchSpeedMult: 0.56,
  bushCoverRadiusTiles: 1.25,
  backstabDamageMult: 2.25,
  pebbleRangeTiles: 4.5,
  pebbleCooldownSec: 1.6,
  pebbleNoiseRadiusTiles: 9.0,
  sprintNoiseRadiusTiles: 6.5,
  combatNoiseRadiusTiles: 9.5,
  spottedPopDurationSec: 0.85,
} as const;

export interface StealthExposure {
  readonly visibility: number;
  readonly lightLevel: number;
  readonly inCover: boolean;
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
}

const COVER_PROPS = new Set<PropKind>([PropKind.Bush, PropKind.TallGrass]);

function propLightContrib(prop: ChunkProp, x: number, y: number): number {
  const isFire = prop.kind === PropKind.Campfire;
  if (!isFire && prop.kind !== PropKind.Torch) return 0;
  const maxR = isFire ? 6.5 : 4.2;
  const dist = Math.hypot(prop.x - x, prop.y - y);
  if (dist > maxR) return 0;
  return (1 - dist / maxR) * (isFire ? 0.55 : 0.4);
}

function scanNearbyProps(props: readonly ChunkProp[], x: number, y: number): { readonly inCover: boolean; readonly propLight: number } {
  let inCover = false;
  let propLight = 0;
  for (const p of props) {
    if (COVER_PROPS.has(p.kind) && Math.hypot(p.x - x, p.y - y) <= STEALTH_TUNING.bushCoverRadiusTiles) inCover = true;
    propLight = Math.max(propLight, propLightContrib(p, x, y));
  }
  return { inCover, propLight };
}

function computeNoiseRadius(opts: { readonly moving: boolean; readonly crouching: boolean; readonly sprinting: boolean }): number {
  if (!opts.moving) return 0.5;
  if (opts.crouching) return 0.75;
  return opts.sprinting ? STEALTH_TUNING.sprintNoiseRadiusTiles : 3.0;
}

function applyStealthModifiers(baseVis: number, q: StealthQuery, inCover: boolean): number {
  let vis = baseVis;
  if (q.crouching) vis *= inCover ? 0.42 : 0.68;
  else if (inCover) vis *= 0.76;
  if (q.sprinting) return vis + 0.16;
  return q.moving && !q.crouching ? vis + 0.08 : vis;
}

export function sampleStealthExposure(q: StealthQuery): StealthExposure {
  const { inCover, propLight } = scanNearbyProps(q.cache.propsNear(q.x, q.y), q.x, q.y);
  const ambient = 1 - sampleDayNight(q.dayPhase).nightFactor * 0.82;
  const lightLevel = clamp(ambient + (q.torchLit ? 0.55 : 0) + propLight, 0.14, 1.0);
  const visibility = clamp(applyStealthModifiers(Math.max(0.24, lightLevel), q, inCover), 0.12, 1.0);
  return { visibility, lightLevel, inCover, noiseRadius: computeNoiseRadius(q) };
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