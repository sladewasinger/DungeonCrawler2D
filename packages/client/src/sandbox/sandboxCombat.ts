/** Pure local player movement, jump arc, melee sector cleave, and projectile step helpers for SandboxSim. */
import {
  COMBO_DAMAGE_MULT, COMBO_SWING_SEC, COMBO_WINDOW_SEC, DODGE_DURATION_SEC,
  DODGE_SPEED_MULT, JUMP_GRAVITY_TILES_PER_SEC2, MAX_PLAYER_HP, MAX_PLAYER_STAMINA,
  STAMINA_REGEN_PER_SEC, clamp, evaluateBowShot, isWithinSector, resolveMovement,
  type PlayerSnapshot, type ProjectileSnapshot, type WorldChunkCache, type WorldEvent,
} from "@dc2d/engine";
import { isDummyKind, type SandboxActor } from "./sandboxAi.js";

export interface SandboxProjectile {
  readonly snap: ProjectileSnapshot;
  readonly ttlSec: number;
}

export interface PlayerMoveTimers {
  dodgeTimer: number;
  swingTimer: number;
  comboResetTimer: number;
  bowChargeSec: number;
}

export interface SandboxPlayerInput {
  readonly dt: number;
  readonly move: { readonly x: number; readonly y: number };
  readonly aim: { readonly x: number; readonly y: number };
  readonly attack: boolean;
  readonly block: boolean;
  readonly dodge: boolean;
  readonly jump: boolean;
  readonly bowDraw: boolean;
  readonly bowRelease: boolean;
}

function advanceJump(opts: { readonly z: number; readonly vz: number; readonly pressed: boolean; readonly dt: number }): { readonly jumpZ: number; readonly jumpVz: number } {
  const { z, vz, pressed, dt } = opts;
  let nextVz = pressed && z <= 0.001 ? 4.6 : vz;
  if (z <= 0 && nextVz <= 0) return { jumpZ: 0, jumpVz: 0 };
  const nextZ = Math.max(0, z + nextVz * dt);
  nextVz = nextZ > 0 ? nextVz - JUMP_GRAVITY_TILES_PER_SEC2 * dt : 0;
  return { jumpZ: nextZ, jumpVz: nextVz };
}

function resolveFacingAxis(opts: { readonly aim: number; readonly move: number; readonly moving: boolean; readonly prev: number }): number {
  if (Math.abs(opts.aim) > 0.05) return opts.aim;
  return opts.moving ? opts.move : opts.prev;
}

function tickPlayerTimers(timers: PlayerMoveTimers, dodge: boolean, dt: number): void {
  if (dodge && timers.dodgeTimer <= 0) timers.dodgeTimer = DODGE_DURATION_SEC;
  timers.dodgeTimer = Math.max(0, timers.dodgeTimer - dt);
  timers.swingTimer = Math.max(0, timers.swingTimer - dt);
  timers.comboResetTimer = Math.max(0, timers.comboResetTimer - dt);
}

function normalizedMove(move: { readonly x: number; readonly y: number }): { readonly nx: number; readonly ny: number; readonly moving: boolean } {
  const len = Math.hypot(move.x, move.y);
  return len > 0.05 ? { nx: move.x / len, ny: move.y / len, moving: true } : { nx: 0, ny: 0, moving: false };
}

export function advanceSandboxPlayer(opts: {
  readonly player: PlayerSnapshot; readonly cache: WorldChunkCache; readonly timers: PlayerMoveTimers; readonly input: SandboxPlayerInput;
}): PlayerSnapshot {
  const { player, cache, timers, input } = opts;
  tickPlayerTimers(timers, input.dodge, input.dt);
  const { nx, ny, moving } = normalizedMove(input.move);
  const speed = 5.8 * (timers.dodgeTimer > 0 ? DODGE_SPEED_MULT : 1);
  const jump = advanceJump({ z: player.jumpZ ?? 0, vz: player.jumpVz ?? 0, pressed: input.jump, dt: input.dt });
  const moved = resolveMovement({
    cache, x: player.x, y: player.y, dx: nx * speed * input.dt, dy: ny * speed * input.dt,
    radius: 0.28, elevation: player.elevation, airborne: jump.jumpZ > 0.05,
  });
  const swingProgress = timers.swingTimer > 0 ? 1 - timers.swingTimer / COMBO_SWING_SEC : 0;
  return {
    ...player,
    x: clamp(moved.x, 2, 94),
    y: clamp(moved.y, 2, 30),
    elevation: moved.elevation,
    inWater: moved.inWater,
    jumpZ: jump.jumpZ, jumpVz: jump.jumpVz, moving,
    blocking: input.block, dodging: timers.dodgeTimer > 0,
    facingX: resolveFacingAxis({ aim: input.aim.x, move: nx, moving, prev: player.facingX }),
    facingY: resolveFacingAxis({ aim: input.aim.y, move: ny, moving, prev: player.facingY }),
    aimX: input.aim.x, aimY: input.aim.y, swingProgress,
    comboStep: timers.comboResetTimer > 0 ? player.comboStep : 0,
    stamina: clamp((player.stamina ?? MAX_PLAYER_STAMINA) + STAMINA_REGEN_PER_SEC * input.dt, 0, MAX_PLAYER_STAMINA),
  };
}

export function advanceSandboxBow(opts: {
  readonly player: PlayerSnapshot;
  readonly timers: PlayerMoveTimers;
  readonly input: SandboxPlayerInput;
  readonly nextProjId: () => string;
  readonly projectiles: SandboxProjectile[];
  readonly events: WorldEvent[];
}): PlayerSnapshot {
  const { player, timers, input, nextProjId, projectiles, events } = opts;
  if (player.heldItem === "bow" && input.bowDraw) {
    timers.bowChargeSec = Math.min(0.85, timers.bowChargeSec + input.dt);
    return { ...player, bowCharge: timers.bowChargeSec / 0.85 };
  }
  if (input.bowRelease && timers.bowChargeSec > 0.05) {
    const shot = evaluateBowShot(timers.bowChargeSec);
    projectiles.push({
      ttlSec: 1.5,
      snap: { id: nextProjId(), ownerId: player.id, kind: "arrow", x: player.x, y: player.y, elevation: 0, vx: input.aim.x * shot.speedTilesPerSec, vy: input.aim.y * shot.speedTilesPerSec, charge: shot.ratio },
    });
    events.push({ kind: "arrowFire", actorId: player.id, x: player.x, y: player.y });
  }
  timers.bowChargeSec = 0;
  return { ...player, bowCharge: 0 };
}

export function applyActorDamage(opts: {
  readonly actor: SandboxActor; readonly dmg: number; readonly attackerId: string;
  readonly dirX: number; readonly dirY: number;
}): WorldEvent {
  const { actor, dmg, attackerId, dirX, dirY } = opts;
  const nextHp = isDummyKind(actor.snap.kind) ? actor.snap.maxHp : Math.max(0, actor.snap.hp - dmg);
  const dead = nextHp <= 0;
  actor.snap = { ...actor.snap, hp: nextHp, corpse: dead, hitTimer: 0.22, aiState: dead ? "dead" : actor.snap.aiState };
  return {
    kind: "hit", actorId: attackerId, targetId: actor.snap.id, x: actor.snap.x, y: actor.snap.y,
    dirX, dirY, value: dmg, goreStyle: dead ? "chunk-spray" : "splatter", substance: actor.snap.substance,
  };
}

function cleaveActors(opts: {
  readonly player: PlayerSnapshot; readonly aim: { readonly x: number; readonly y: number };
  readonly actors: SandboxActor[]; readonly dmg: number; readonly events: WorldEvent[];
}): void {
  for (const actor of opts.actors) {
    if (actor.snap.hp <= 0) continue;
    if (!isWithinSector({ origin: opts.player, dir: opts.aim, target: actor.snap, range: 2.35, halfArcRad: 1.05 })) continue;
    opts.events.push(applyActorDamage({ actor, dmg: opts.dmg, attackerId: opts.player.id, dirX: opts.aim.x, dirY: opts.aim.y }));
  }
}

export function advanceSandboxMelee(opts: {
  readonly player: PlayerSnapshot;
  readonly timers: PlayerMoveTimers;
  readonly input: SandboxPlayerInput;
  readonly actors: SandboxActor[];
  readonly events: WorldEvent[];
}): PlayerSnapshot {
  const { player, timers, input, actors, events } = opts;
  if (!input.attack || player.heldItem === "bow" || timers.swingTimer > 0) return player;
  const step = ((player.comboStep ?? 0) % 3) + 1;
  timers.swingTimer = COMBO_SWING_SEC;
  timers.comboResetTimer = COMBO_WINDOW_SEC;
  events.push({ kind: "swing", actorId: player.id, x: player.x, y: player.y, dirX: input.aim.x, dirY: input.aim.y, comboStep: step });
  cleaveActors({ player, aim: input.aim, actors, dmg: Math.round(24 * (COMBO_DAMAGE_MULT[step - 1] ?? 1)), events });
  return { ...player, comboStep: step, swingProgress: 0.02 };
}

export function stepSandboxProjectiles(projectiles: SandboxProjectile[], actors: SandboxActor[], dt: number): {
  readonly nextProjectiles: SandboxProjectile[];
  readonly events: WorldEvent[];
} {
  const ev: WorldEvent[] = [];
  const nextProjectiles: SandboxProjectile[] = [];
  for (const pr of projectiles) {
    const ttlSec = pr.ttlSec - dt;
    if (ttlSec <= 0) continue;
    const nx = pr.snap.x + pr.snap.vx * dt;
    const ny = pr.snap.y + pr.snap.vy * dt;
    const hit = actors.find((a) => a.snap.hp > 0 && Math.hypot(a.snap.x - nx, a.snap.y - ny) < 0.7);
    if (hit) {
      const dmg = Math.round(18 + pr.snap.charge * 18);
      ev.push(applyActorDamage({ actor: hit, dmg, attackerId: pr.snap.ownerId, dirX: pr.snap.vx, dirY: pr.snap.vy }));
      continue;
    }
    nextProjectiles.push({ ttlSec, snap: { ...pr.snap, x: nx, y: ny } });
  }
  return { nextProjectiles, events: ev };
}

export function applySandboxPlayerHit(player: PlayerSnapshot, amount: number): {
  readonly nextPlayer: PlayerSnapshot;
  readonly event: WorldEvent;
} {
  const blocked = Boolean(player.blocking);
  const dmg = blocked ? Math.max(1, Math.round(amount * 0.25)) : amount;
  const nextHp = Math.max(15, (player.hp ?? MAX_PLAYER_HP) - dmg);
  return {
    nextPlayer: { ...player, hp: nextHp },
    event: { kind: blocked ? "block" : "hit", targetId: player.id, x: player.x, y: player.y, value: dmg, goreStyle: "splatter", substance: "blood" },
  };
}
