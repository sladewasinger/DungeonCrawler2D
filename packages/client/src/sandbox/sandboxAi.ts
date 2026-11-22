/** Local client-side sandbox entity lineup, pose preview, and non-jitter combat AI. */
import type { AiState, EntityKind, GoreSubstance, WorldEntitySnapshot, WorldEvent } from "@dc2d/engine";

export type SandboxPose = "idle" | "walk" | "windup" | "corpse";
export type SandboxFacing = "auto" | "south" | "east" | "west" | "north";

export interface SandboxActor {
  readonly homeX: number;
  readonly homeY: number;
  readonly temporary: boolean;
  awake: boolean;
  windupSec: number;
  chargeSec: number;
  cooldownSec: number;
  chargeDx: number;
  chargeDy: number;
  snap: WorldEntitySnapshot;
}

interface LineupSpec {
  readonly kind: EntityKind;
  readonly label: string;
  readonly maxHp: number;
  readonly substance: GoreSubstance;
}

export const SANDBOX_LINEUP_Y = 22.4;
export const SANDBOX_LINEUP_X0 = 4.5;
export const SANDBOX_LINEUP_DX = 3.1;

export const LINEUP_SPECS: readonly LineupSpec[] = [
  { kind: "wolf", label: "Wolf", maxHp: 65, substance: "blood" },
  { kind: "bear", label: "Bear", maxHp: 140, substance: "blood" },
  { kind: "spider", label: "Spider", maxHp: 55, substance: "ichor" },
  { kind: "boar", label: "Boar", maxHp: 85, substance: "blood" },
  { kind: "slime", label: "Slime", maxHp: 45, substance: "slime" },
  { kind: "goblin", label: "Goblin", maxHp: 60, substance: "blood" },
  { kind: "orc", label: "Orc", maxHp: 120, substance: "blood" },
  { kind: "skeleton", label: "Skeleton", maxHp: 75, substance: "bone" },
  { kind: "golem", label: "Golem", maxHp: 220, substance: "bone" },
  { kind: "dummy", label: "Dummy", maxHp: 100, substance: "straw" },
  { kind: "slime-dummy", label: "Slime Dummy", maxHp: 100, substance: "slime" },
  { kind: "spar-dummy", label: "Spar Dummy", maxHp: 120, substance: "straw" },
];

export function isDummyKind(kind: EntityKind): boolean {
  return kind === "dummy" || kind === "slime-dummy" || kind === "spar-dummy";
}

function makeActor(opts: { readonly id: string; readonly spec: LineupSpec; readonly x: number; readonly y: number; readonly temporary: boolean }): SandboxActor {
  return {
    homeX: opts.x, homeY: opts.y, temporary: opts.temporary, awake: opts.temporary,
    windupSec: 0, chargeSec: 0, cooldownSec: 0, chargeDx: 0, chargeDy: 1,
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

function resolveFrozenAiState(pose: SandboxPose): AiState {
  if (pose === "walk") return "patrol";
  return pose === "windup" ? "charge" : "idle";
}

function resolveFrozenFacing(facing: SandboxFacing, timeSec: number): { readonly facingX: number; readonly facingY: number } {
  if (facing === "east") return { facingX: 1, facingY: 0 };
  if (facing === "west") return { facingX: -1, facingY: 0 };
  if (facing === "north") return { facingX: 0, facingY: -1 };
  if (facing === "south") return { facingX: 0, facingY: 1 };
  const dirs: readonly (readonly [number, number])[] = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  const pair = dirs[Math.floor(timeSec / 1.8) % dirs.length]!;
  return { facingX: pair[0], facingY: pair[1] };
}

function applyFrozenPose(actor: SandboxActor, opts: {
  readonly pose: SandboxPose;
  readonly facing: SandboxFacing;
  readonly timeSec: number;
}): void {
  const s = actor.snap;
  if (opts.pose === "corpse") {
    actor.snap = { ...s, x: actor.homeX, y: actor.homeY, hp: 0, corpse: true, aiState: "dead", telegraphProgress: 0 };
    return;
  }
  const { facingX, facingY } = resolveFrozenFacing(opts.facing, opts.timeSec);
  actor.snap = {
    ...s, x: actor.homeX, y: actor.homeY, hp: s.maxHp, corpse: false,
    facingX, facingY, aiState: resolveFrozenAiState(opts.pose), telegraphProgress: opts.pose === "windup" ? 0.78 : 0,
  };
}

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
  const spd = 6.2;
  const s = actor.snap;
  actor.snap = {
    ...s, x: Math.max(2, Math.min(94, s.x + actor.chargeDx * spd * dt)),
    y: Math.max(2, Math.min(30, s.y + actor.chargeDy * spd * dt)),
    aiState: "charge", telegraphProgress: 0,
  };
  if (actor.chargeSec === 0) actor.cooldownSec = 1.15;
  return true;
}

function triggerLiveStrike(opts: {
  readonly actor: SandboxActor; readonly nx: number; readonly ny: number; readonly dist: number;
  readonly stopDist: number; readonly onHitPlayer: () => WorldEvent | null; readonly events: WorldEvent[];
}): void {
  const { actor, nx, ny, dist, stopDist, onHitPlayer, events } = opts;
  if (actor.snap.kind === "boar" && dist > 1.7) {
    actor.chargeDx = nx; actor.chargeDy = ny; actor.chargeSec = 0.52;
    return;
  }
  if (dist <= stopDist + 0.55) {
    const ev = onHitPlayer();
    if (ev) events.push(ev);
  }
  actor.cooldownSec = 1.05;
}

function advanceLiveChase(opts: {
  readonly actor: SandboxActor; readonly allActors: readonly SandboxActor[];
  readonly nx: number; readonly ny: number; readonly dist: number; readonly stopDist: number; readonly dt: number;
}): void {
  const { actor, allActors, nx, ny, dist, stopDist, dt } = opts;
  const s = actor.snap;
  const sep = separationVector(actor, allActors);
  const baseSpd = s.kind === "wolf" ? 3.2 : s.kind === "golem" ? 1.9 : 2.5;
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
  actor.snap = { ...actor.snap, facingX: nx, facingY: ny, aiState: "charge", telegraphProgress: Math.min(1, 1 - actor.windupSec / 0.55) };
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
  const inBoarRange = s.kind === "boar" && dist >= 1.9 && dist <= 6.2;
  if (actor.cooldownSec > 0 || (dist > stopDist + 0.35 && !inBoarRange)) return false;
  actor.windupSec = 0.55;
  actor.snap = { ...s, facingX: nx, facingY: ny, aiState: "charge", telegraphProgress: 0.1 };
  return true;
}

function stepLiveActor(opts: {
  readonly actor: SandboxActor; readonly allActors: readonly SandboxActor[];
  readonly px: number; readonly py: number; readonly dt: number;
  readonly onHitPlayer: () => WorldEvent | null; readonly events: WorldEvent[];
}): void {
  const { actor, allActors, px, py, dt, onHitPlayer, events } = opts;
  const s = actor.snap;
  if (s.hp <= 0 || stepActorDash(actor, dt)) return;
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
