/** Local client-side sandbox entity lineup, pose preview, and non-jitter combat AI. */
import type { WorldEntitySnapshot, WorldEvent } from "@dc2d/engine";
import {
  LINEUP_SPECS, SANDBOX_LINEUP_DX, SANDBOX_LINEUP_X0, SANDBOX_LINEUP_Y,
  applyFrozenPose, isDummyKind,
  type LineupSpec, type SandboxFacing, type SandboxPose,
} from "./sandboxPoses.js";

export { LINEUP_SPECS, SANDBOX_LINEUP_DX, SANDBOX_LINEUP_X0, SANDBOX_LINEUP_Y, isDummyKind };
export type { SandboxFacing, SandboxPose };

export interface SandboxActor {
  readonly homeX: number;
  readonly homeY: number;
  readonly temporary: boolean;
  awake: boolean;
  windupSec: number;
  chargeSec: number;
  recoverSec: number;
  cooldownSec: number;
  chargeDx: number;
  chargeDy: number;
  snap: WorldEntitySnapshot;
}

function makeActor(opts: { readonly id: string; readonly spec: LineupSpec; readonly x: number; readonly y: number; readonly temporary: boolean }): SandboxActor {
  return {
    homeX: opts.x, homeY: opts.y, temporary: opts.temporary, awake: opts.temporary,
    windupSec: 0, chargeSec: 0, recoverSec: 0, cooldownSec: 0, chargeDx: 0, chargeDy: 1,
    snap: {
      id: opts.id, kind: opts.spec.kind, substance: opts.spec.substance,
      x: opts.x, y: opts.y, elevation: 0, hp: opts.spec.maxHp, maxHp: opts.spec.maxHp,
      hitTimer: 0, facingX: 1, facingY: 1, aiState: "idle",
      staggerTimer: 0, bleedTimer: 0, telegraphProgress: 0, corpse: false,
    },
  };
}

export function createLineupActors(): SandboxActor[] {
  return LINEUP_SPECS.map((spec, idx) =>
    makeActor({ id: `sbx-${spec.kind}-${idx}`, spec, x: SANDBOX_LINEUP_X0 + idx * SANDBOX_LINEUP_DX, y: SANDBOX_LINEUP_Y, temporary: false }),
  );
}

export function createWolfPackActors(px: number, py: number, seq: number): SandboxActor[] {
  const wolfSpec = LINEUP_SPECS[0]!;
  const offsets: readonly (readonly [number, number])[] = [[-2.4, -3.6], [0, -4.4], [2.4, -3.6]];
  return offsets.map(([ox, oy], i) => makeActor({ id: `sbx-pack-${seq}-${i}`, spec: wolfSpec, x: px + ox, y: py + oy, temporary: true }));
}

const BOAR_BRAKE_SEC = 0.3;
const BOAR_PAUSE_SEC = 0.85;
const BOAR_RECOVER_SEC = BOAR_BRAKE_SEC + BOAR_PAUSE_SEC;

function separationVector(actor: SandboxActor, allActors: readonly SandboxActor[]): { readonly x: number; readonly y: number } {
  let sx = 0; let sy = 0;
  for (const other of allActors) {
    if (other.snap.id === actor.snap.id || other.snap.hp <= 0) continue;
    const dx = actor.snap.x - other.snap.x;
    const dy = actor.snap.y - other.snap.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.001 && d < 1.15) { sx += (dx / d) * (1.15 - d); sy += (dy / d) * (1.15 - d); }
  }
  return { x: sx, y: sy };
}

function stepActorDash(actor: SandboxActor, dt: number): boolean {
  if (actor.chargeSec <= 0) return false;
  actor.chargeSec = Math.max(0, actor.chargeSec - dt);
  const spd = 7.4;
  const s = actor.snap;
  const done = actor.chargeSec === 0;
  actor.snap = {
    ...s, x: Math.max(2, Math.min(94, s.x + actor.chargeDx * spd * dt)),
    y: Math.max(2, Math.min(30, s.y + actor.chargeDy * spd * dt)),
    facingX: actor.chargeDx, facingY: actor.chargeDy,
    aiState: done ? "idle" : "charge", telegraphProgress: 0,
  };
  if (done) { actor.recoverSec = BOAR_RECOVER_SEC; actor.cooldownSec = 1.45; }
  return true;
}

function stepActorRecovery(actor: SandboxActor, dt: number): boolean {
  if (actor.recoverSec <= 0) return false;
  actor.recoverSec = Math.max(0, actor.recoverSec - dt);
  const braking = actor.recoverSec > BOAR_PAUSE_SEC;
  const slideSpd = braking ? 7.4 * 0.45 * ((actor.recoverSec - BOAR_PAUSE_SEC) / BOAR_BRAKE_SEC) : 0;
  const s = actor.snap;
  actor.snap = {
    ...s, x: Math.max(2, Math.min(94, s.x + actor.chargeDx * slideSpd * dt)),
    y: Math.max(2, Math.min(30, s.y + actor.chargeDy * slideSpd * dt)),
    facingX: actor.chargeDx, facingY: actor.chargeDy, aiState: "idle", telegraphProgress: 0,
  };
  return true;
}

function triggerLiveStrike(opts: {
  readonly actor: SandboxActor; readonly nx: number; readonly ny: number; readonly dist: number;
  readonly stopDist: number; readonly onHitPlayer: () => WorldEvent | null; readonly events: WorldEvent[];
}): void {
  const { actor, nx, ny, dist, stopDist, onHitPlayer, events } = opts;
  if (actor.snap.kind === "boar" && dist > 1.7) {
    actor.chargeDx = nx; actor.chargeDy = ny; actor.chargeSec = 1.55;
    return;
  }
  if (dist <= stopDist + 0.55) {
    const ev = onHitPlayer();
    if (ev) events.push(ev);
  }
  actor.cooldownSec = 1.05;
}

const CHASE_SPEEDS: Readonly<Record<string, number>> = { spider: 3.4, wolf: 3.2, golem: 1.9 };

function advanceLiveChase(opts: {
  readonly actor: SandboxActor; readonly allActors: readonly SandboxActor[];
  readonly nx: number; readonly ny: number; readonly dist: number; readonly stopDist: number; readonly dt: number;
}): void {
  const { actor, allActors, nx, ny, dist, stopDist, dt } = opts;
  const s = actor.snap;
  const sep = separationVector(actor, allActors);
  const baseSpd = CHASE_SPEEDS[s.kind] ?? 2.5;
  const chaseSpd = dist > stopDist ? baseSpd : 0;
  const vx = nx * chaseSpd + sep.x * 2.4;
  const vy = ny * chaseSpd + sep.y * 2.4;
  actor.snap = {
    ...s, x: Math.max(2, Math.min(94, s.x + vx * dt)), y: Math.max(2, Math.min(30, s.y + vy * dt)),
    facingX: nx, facingY: ny, aiState: chaseSpd > 0 ? "chase" : "idle", telegraphProgress: 0,
  };
}

function advanceWindupPhase(opts: {
  readonly actor: SandboxActor; readonly nx: number; readonly ny: number; readonly dist: number;
  readonly stopDist: number; readonly dt: number; readonly onHitPlayer: () => WorldEvent | null; readonly events: WorldEvent[];
}): boolean {
  const { actor, nx, ny, dist, stopDist, dt, onHitPlayer, events } = opts;
  if (actor.windupSec <= 0) return false;
  actor.windupSec = Math.max(0, actor.windupSec - dt);
  const aiState = actor.snap.kind === "boar" ? "charge" : "idle";
  actor.snap = { ...actor.snap, facingX: nx, facingY: ny, aiState, telegraphProgress: Math.min(1, 1 - actor.windupSec / 0.55) };
  if (actor.windupSec === 0) triggerLiveStrike({ actor, nx, ny, dist, stopDist, onHitPlayer, events });
  return true;
}

function unitDir(dx: number, dy: number, dist: number): { readonly x: number; readonly y: number } {
  return dist > 0.01 ? { x: dx / dist, y: dy / dist } : { x: 0, y: 1 };
}

function tryStartWindup(opts: {
  readonly actor: SandboxActor; readonly nx: number; readonly ny: number; readonly dist: number; readonly stopDist: number;
}): boolean {
  const { actor, nx, ny, dist, stopDist } = opts;
  const s = actor.snap;
  const inBoarRange = s.kind === "boar" && dist >= 1.9 && dist <= 11.5;
  if (actor.cooldownSec > 0 || (dist > stopDist + 0.35 && !inBoarRange)) return false;
  actor.windupSec = 0.55;
  actor.snap = { ...s, facingX: nx, facingY: ny, aiState: s.kind === "boar" ? "charge" : "idle", telegraphProgress: 0.1 };
  return true;
}

function stepLiveActor(opts: {
  readonly actor: SandboxActor; readonly allActors: readonly SandboxActor[];
  readonly px: number; readonly py: number; readonly dt: number;
  readonly onHitPlayer: () => WorldEvent | null; readonly events: WorldEvent[];
}): void {
  const { actor, allActors, px, py, dt, onHitPlayer, events } = opts;
  const s = actor.snap;
  if (s.hp <= 0 || stepActorDash(actor, dt) || stepActorRecovery(actor, dt)) return;
  const dx = px - s.x;
  const dy = py - s.y;
  const dist = Math.hypot(dx, dy);
  const { x: nx, y: ny } = unitDir(dx, dy, dist);
  const stopDist = s.kind === "golem" ? 1.55 : 1.18;
  if (advanceWindupPhase({ actor, nx, ny, dist, stopDist, dt, onHitPlayer, events })) return;
  if (tryStartWindup({ actor, nx, ny, dist, stopDist })) return;
  advanceLiveChase({ actor, allActors, nx, ny, dist, stopDist, dt });
}

export function stepSandboxActors(opts: {
  readonly actors: SandboxActor[];
  readonly player: { readonly x: number; readonly y: number };
  readonly pose: SandboxPose;
  readonly facing: SandboxFacing;
  readonly aiLive: boolean;
  readonly dt: number;
  readonly timeSec: number;
  readonly onHitPlayer: () => WorldEvent | null;
}): WorldEvent[] {
  const events: WorldEvent[] = [];
  for (const actor of opts.actors) {
    actor.snap = {
      ...actor.snap,
      hitTimer: Math.max(0, actor.snap.hitTimer - opts.dt),
      staggerTimer: Math.max(0, actor.snap.staggerTimer - opts.dt),
    };
    actor.cooldownSec = Math.max(0, actor.cooldownSec - opts.dt);
    const active = !isDummyKind(actor.snap.kind) && (opts.aiLive || actor.awake);
    if (active) {
      stepLiveActor({ actor, allActors: opts.actors, px: opts.player.x, py: opts.player.y, dt: opts.dt, onHitPlayer: opts.onHitPlayer, events });
    } else {
      applyFrozenPose(actor, { pose: opts.pose, facing: opts.facing, timeSec: opts.timeSec });
    }
  }
  return events;
}
