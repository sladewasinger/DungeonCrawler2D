/** Mobile auto-aim helpers: 100-degree melee target cone and <=5-degree velocity-lead bow assist. */
import type { PlayerSnapshot, WorldEntitySnapshot } from "@dc2d/engine";

interface TrackedVelocity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  atMs: number;
}

const MELEE_CONE_COS = Math.cos((50 * Math.PI) / 180);
const MELEE_AUTO_RANGE = 3.8;
const BOW_ASSIST_CONE_RAD = (9 * Math.PI) / 180;
const BOW_MAX_STEER_RAD = (5 * Math.PI) / 180;
const BOW_ASSIST_MIN_DIST = 1.0;
const BOW_ASSIST_MAX_DIST = 15.0;

export function isTouchViewport(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.matchMedia?.("(hover: none), (pointer: coarse)")?.matches || (navigator.maxTouchPoints ?? 0) > 0,
  );
}

export class EntityVelocityTracker {
  private readonly samples = new Map<string, TrackedVelocity>();

  update(entities: readonly WorldEntitySnapshot[], nowMs: number): void {
    const seen = new Set<string>();
    for (const e of entities) {
      seen.add(e.id);
      this.recordSample(e, nowMs);
    }
    for (const id of this.samples.keys()) {
      if (!seen.has(id)) this.samples.delete(id);
    }
  }

  velocityOf(id: string): { readonly vx: number; readonly vy: number } {
    const s = this.samples.get(id);
    return s ? { vx: s.vx, vy: s.vy } : { vx: 0, vy: 0 };
  }

  private recordSample(e: WorldEntitySnapshot, nowMs: number): void {
    const prev = this.samples.get(e.id);
    if (!prev) {
      this.samples.set(e.id, { x: e.x, y: e.y, vx: 0, vy: 0, atMs: nowMs });
      return;
    }
    const dt = (nowMs - prev.atMs) / 1000;
    if (dt < 0.012) return;
    const rawVx = Math.max(-12, Math.min(12, (e.x - prev.x) / dt));
    const rawVy = Math.max(-12, Math.min(12, (e.y - prev.y) / dt));
    prev.vx = prev.vx * 0.55 + rawVx * 0.45;
    prev.vy = prev.vy * 0.55 + rawVy * 0.45;
    prev.x = e.x;
    prev.y = e.y;
    prev.atMs = nowMs;
  }
}

export function resolveMobileMeleeAutoAim(opts: {
  readonly local: PlayerSnapshot;
  readonly entities: readonly WorldEntitySnapshot[];
  readonly facing: { readonly x: number; readonly y: number };
}): { readonly x: number; readonly y: number } | undefined {
  const fMag = Math.max(0.01, Math.hypot(opts.facing.x, opts.facing.y));
  const fx = opts.facing.x / fMag;
  const fy = opts.facing.y / fMag;
  let bestDist = MELEE_AUTO_RANGE;
  let bestDir: { readonly x: number; readonly y: number } | undefined;
  for (const e of opts.entities) {
    if (e.corpse || e.hp <= 0) continue;
    const dx = e.x - opts.local.x;
    const dy = e.y - opts.local.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.12 || d > bestDist) continue;
    const ux = dx / d;
    const uy = dy / d;
    if (ux * fx + uy * fy < MELEE_CONE_COS) continue;
    bestDist = d;
    bestDir = { x: ux, y: uy };
  }
  return bestDir;
}

function steerTowardTarget(opts: {
  readonly ax: number; readonly ay: number; readonly ux: number; readonly uy: number; readonly ang: number;
}): { readonly x: number; readonly y: number } {
  const { ax, ay, ux, uy, ang } = opts;
  if (ang <= BOW_MAX_STEER_RAD) return { x: ux, y: uy };
  const t = BOW_MAX_STEER_RAD / ang;
  const rx = ax + (ux - ax) * t;
  const ry = ay + (uy - ay) * t;
  const mag = Math.max(0.01, Math.hypot(rx, ry));
  return { x: rx / mag, y: ry / mag };
}

function scoreBowLeadCandidate(opts: {
  readonly e: WorldEntitySnapshot; readonly local: PlayerSnapshot;
  readonly ax: number; readonly ay: number; readonly tracker: EntityVelocityTracker; readonly speed: number;
}): { readonly ang: number; readonly dir: { readonly x: number; readonly y: number } } | null {
  const { e, local, ax, ay, tracker, speed } = opts;
  if (e.corpse || e.hp <= 0) return null;
  const dist = Math.hypot(e.x - local.x, e.y - local.y);
  if (dist < BOW_ASSIST_MIN_DIST || dist > BOW_ASSIST_MAX_DIST) return null;
  const v = tracker.velocityOf(e.id);
  const tFlight = Math.min(0.55, dist / speed);
  const lx = e.x + v.vx * tFlight - local.x;
  const ly = e.y + v.vy * tFlight - local.y;
  const ld = Math.hypot(lx, ly);
  if (ld < 0.1) return null;
  const ux = lx / ld;
  const uy = ly / ld;
  const ang = Math.acos(Math.max(-1, Math.min(1, ux * ax + uy * ay)));
  return ang <= BOW_ASSIST_CONE_RAD ? { ang, dir: steerTowardTarget({ ax, ay, ux, uy, ang }) } : null;
}

export function resolveMobileBowAutoAim(opts: {
  readonly aim: { readonly x: number; readonly y: number };
  readonly local: PlayerSnapshot;
  readonly entities: readonly WorldEntitySnapshot[];
  readonly tracker: EntityVelocityTracker;
  readonly arrowSpeed?: number;
}): { readonly x: number; readonly y: number } {
  const speed = Math.max(8, opts.arrowSpeed ?? 17);
  const aMag = Math.max(0.01, Math.hypot(opts.aim.x, opts.aim.y));
  const ax = opts.aim.x / aMag;
  const ay = opts.aim.y / aMag;
  let bestAng = BOW_ASSIST_CONE_RAD;
  let bestDir = { x: ax, y: ay };
  for (const e of opts.entities) {
    const hit = scoreBowLeadCandidate({ e, local: opts.local, ax, ay, tracker: opts.tracker, speed });
    if (hit && hit.ang <= bestAng) { bestAng = hit.ang; bestDir = hit.dir; }
  }
  return bestDir;
}