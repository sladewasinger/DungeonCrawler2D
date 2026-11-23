/** Pure local player movement, jump arc, melee sector cleave, and projectile step helpers for SandboxSim. */
import { getItemDef } from "@dc2d/content";
import {
  BLEED_DURATION_SEC, COMBO_DAMAGE_MULT, COMBO_SWING_SEC, COMBO_WINDOW_SEC, DODGE_DURATION_SEC,
  DODGE_IFRAME_SEC, DODGE_SPEED_MULT, HIT_IFRAME_SEC, JUMP_GRAVITY_TILES_PER_SEC2, MAX_PLAYER_HP, MAX_PLAYER_STAMINA,
  STAMINA_REGEN_PER_SEC, clamp, evaluateBowShot, isWithinSector, resolveMovement,
  type GoreStyle, type GoreSubstance, type PlayerSnapshot, type ProjectileSnapshot, type WorldChunkCache, type WorldEvent,
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
  invulnTimer: number;
}

const STYLE_DRIP: GoreStyle = "drip";
const STYLE_CHUNK: GoreStyle = "chunk-spray";
const STYLE_SPLATTER: GoreStyle = "splatter";
const BLEED_SUBSTANCES = new Set<GoreSubstance>(["blood", "slime", "ichor"]);

export interface SandboxPlayerInput {
  readonly dt: number;
  readonly move: { readonly x: number; readonly y: number };
  readonly aim?: { readonly x: number; readonly y: number } | undefined;
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

function resolveSandboxFacing(opts: {
  readonly aim?: { readonly x: number; readonly y: number } | undefined;
  readonly nx: number; readonly ny: number; readonly moving: boolean; readonly player: PlayerSnapshot;
}): { readonly facingX: number; readonly facingY: number; readonly aimX: number; readonly aimY: number } {
  if (opts.aim && Math.hypot(opts.aim.x, opts.aim.y) > 0.05) {
    return { facingX: opts.aim.x, facingY: opts.aim.y, aimX: opts.aim.x, aimY: opts.aim.y };
  }
  if (opts.moving) return { facingX: opts.nx, facingY: opts.ny, aimX: opts.nx, aimY: opts.ny };
  return {
    facingX: opts.player.facingX, facingY: opts.player.facingY,
    aimX: opts.player.aimX ?? opts.player.facingX, aimY: opts.player.aimY ?? opts.player.facingY,
  };
}

function tickPlayerTimers(timers: PlayerMoveTimers, dodge: boolean, dt: number): void {
  if (dodge && timers.dodgeTimer <= 0) {
    timers.dodgeTimer = DODGE_DURATION_SEC;
    timers.invulnTimer = Math.max(timers.invulnTimer, DODGE_IFRAME_SEC);
  }
  timers.dodgeTimer = Math.max(0, timers.dodgeTimer - dt);
  timers.swingTimer = Math.max(0, timers.swingTimer - dt);
  timers.comboResetTimer = Math.max(0, timers.comboResetTimer - dt);
  timers.invulnTimer = Math.max(0, timers.invulnTimer - dt);
}

function normalizedMove(move: { readonly x: number; readonly y: number }): {
  readonly nx: number; readonly ny: number; readonly mag: number; readonly moving: boolean;
} {
  const rawMag = Math.hypot(move.x, move.y);
  if (rawMag <= 0.05) return { nx: 0, ny: 0, mag: 0, moving: false };
  return { nx: move.x / rawMag, ny: move.y / rawMag, mag: Math.min(1, rawMag), moving: true };
}

function isSandboxSprinting(opts: {
  readonly moving: boolean; readonly mag: number; readonly inWater: boolean;
  readonly block: boolean; readonly timers: PlayerMoveTimers; readonly bowCharge: number;
}): boolean {
  return opts.moving && opts.mag > 0.82 && !opts.inWater && !opts.block
    && opts.timers.dodgeTimer <= 0 && opts.timers.swingTimer <= 0 && opts.bowCharge <= 0.05;
}

export function advanceSandboxPlayer(opts: {
  readonly player: PlayerSnapshot; readonly cache: WorldChunkCache; readonly timers: PlayerMoveTimers; readonly input: SandboxPlayerInput;
}): PlayerSnapshot {
  const { player, cache, timers, input } = opts;
  tickPlayerTimers(timers, input.dodge, input.dt);
  const { nx, ny, mag, moving } = normalizedMove(input.move);
  const baseSpeed = 5.8 * (timers.dodgeTimer > 0 ? DODGE_SPEED_MULT : mag);
  const jump = advanceJump({ z: player.jumpZ ?? 0, vz: player.jumpVz ?? 0, pressed: input.jump, dt: input.dt });
  const moved = resolveMovement({
    cache, x: player.x, y: player.y, dx: nx * baseSpeed * input.dt, dy: ny * baseSpeed * input.dt,
    radius: 0.28, elevation: player.elevation, airborne: jump.jumpZ > 0.05,
  });
  const swingProgress = timers.swingTimer > 0 ? 1 - timers.swingTimer / COMBO_SWING_SEC : 0;
  const facing = resolveSandboxFacing({ aim: input.aim, nx, ny, moving, player });
  const sprinting = isSandboxSprinting({ moving, mag, inWater: moved.inWater, block: input.block, timers, bowCharge: player.bowCharge ?? 0 });
  return {
    ...player,
    x: clamp(moved.x, 2, 94),
    y: clamp(moved.y, 2, 30),
    elevation: moved.elevation,
    inWater: moved.inWater,
    jumpZ: jump.jumpZ, jumpVz: jump.jumpVz, moving, sprinting,
    blocking: input.block, dodging: timers.dodgeTimer > 0, invulnTimer: timers.invulnTimer,
    ...facing, swingProgress,
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
    const aim = input.aim ?? { x: player.facingX, y: player.facingY };
    const shot = evaluateBowShot(timers.bowChargeSec);
    projectiles.push({
      ttlSec: 1.5,
      snap: { id: nextProjId(), ownerId: player.id, kind: "arrow", x: player.x, y: player.y, elevation: 0, vx: aim.x * shot.speedTilesPerSec, vy: aim.y * shot.speedTilesPerSec, charge: shot.ratio },
    });
    events.push({ kind: "arrowFire", actorId: player.id, x: player.x, y: player.y });
  }
  timers.bowChargeSec = 0;
  return { ...player, bowCharge: 0 };
}

function resolveActorGoreStyle(opts: { readonly actor: SandboxActor; readonly goreStyle: GoreStyle; readonly dead: boolean; readonly comboStep?: number | undefined }): GoreStyle {
  if (!opts.dead) return opts.goreStyle;
  if (opts.actor.snap.substance === "slime") return "explode-away";
  return opts.comboStep === 3 ? STYLE_CHUNK : opts.goreStyle;
}

function nextActorBleedTimer(opts: { readonly actor: SandboxActor; readonly nextHp: number; readonly goreStyle: GoreStyle }): number {
  if (opts.nextHp <= 0 || !BLEED_SUBSTANCES.has(opts.actor.snap.substance)) return 0;
  if (opts.goreStyle === STYLE_DRIP) return BLEED_DURATION_SEC;
  return opts.nextHp <= opts.actor.snap.maxHp * 0.5 ? Math.max(opts.actor.snap.bleedTimer, BLEED_DURATION_SEC * 0.85) : opts.actor.snap.bleedTimer;
}

export function applyActorDamage(opts: {
  readonly actor: SandboxActor; readonly dmg: number; readonly attackerId: string;
  readonly dirX: number; readonly dirY: number; readonly goreStyle?: GoreStyle;
  readonly comboStep?: number | undefined; readonly sweepDir?: number | undefined;
}): WorldEvent {
  const { actor, dmg, attackerId, dirX, dirY } = opts;
  const baseStyle = opts.goreStyle ?? STYLE_SPLATTER;
  const nextHp = isDummyKind(actor.snap.kind) ? actor.snap.maxHp : Math.max(0, actor.snap.hp - dmg);
  const dead = nextHp <= 0;
  const bleedTimer = nextActorBleedTimer({ actor, nextHp, goreStyle: baseStyle });
  actor.snap = { ...actor.snap, hp: nextHp, corpse: dead, hitTimer: 0.22, bleedTimer, aiState: dead ? "dead" : actor.snap.aiState };
  return {
    kind: "hit", actorId: attackerId, targetId: actor.snap.id, x: actor.snap.x, y: actor.snap.y,
    dirX, dirY, value: dmg, comboStep: opts.comboStep, sweepDir: opts.sweepDir,
    goreStyle: resolveActorGoreStyle({ actor, goreStyle: baseStyle, dead, comboStep: opts.comboStep }),
    substance: actor.snap.substance, fatal: dead, entityKind: actor.snap.kind,
  };
}

function cleaveActors(opts: {
  readonly player: PlayerSnapshot; readonly aim: { readonly x: number; readonly y: number };
  readonly actors: SandboxActor[]; readonly dmg: number; readonly goreStyle: GoreStyle;
  readonly comboStep: number; readonly sweepDir: number; readonly events: WorldEvent[];
}): void {
  for (const actor of opts.actors) {
    if (actor.snap.hp <= 0) continue;
    if (!isWithinSector({ origin: opts.player, dir: opts.aim, target: actor.snap, range: 2.35, halfArcRad: 1.05 })) continue;
    opts.events.push(applyActorDamage({
      actor, dmg: opts.dmg, attackerId: opts.player.id, dirX: opts.aim.x, dirY: opts.aim.y,
      goreStyle: opts.goreStyle, comboStep: opts.comboStep, sweepDir: opts.sweepDir,
    }));
  }
}

function resolveMeleeGore(heldItem: string | null | undefined, step: number): GoreStyle {
  const base = (heldItem ? getItemDef(heldItem)?.goreStyle : undefined) ?? STYLE_SPLATTER;
  return step === 3 && (base === STYLE_SPLATTER || base === "thin-streak") ? STYLE_CHUNK : base;
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
  const aim = input.aim ?? { x: player.facingX, y: player.facingY };
  const step = ((player.comboStep ?? 0) % 3) + 1;
  timers.swingTimer = COMBO_SWING_SEC;
  timers.comboResetTimer = COMBO_WINDOW_SEC;
  events.push({ kind: "swing", actorId: player.id, x: player.x, y: player.y, dirX: aim.x, dirY: aim.y, comboStep: step });
  cleaveActors({
    player, aim, actors, dmg: Math.round(24 * (COMBO_DAMAGE_MULT[step - 1] ?? 1)),
    goreStyle: resolveMeleeGore(player.heldItem, step), comboStep: step, sweepDir: step === 2 ? -1 : 1, events,
  });
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
      ev.push(applyActorDamage({ actor: hit, dmg, attackerId: pr.snap.ownerId, dirX: pr.snap.vx, dirY: pr.snap.vy, goreStyle: STYLE_DRIP }));
      continue;
    }
    nextProjectiles.push({ ttlSec, snap: { ...pr.snap, x: nx, y: ny } });
  }
  return { nextProjectiles, events: ev };
}

export function applySandboxPlayerHit(player: PlayerSnapshot, timers: PlayerMoveTimers, amount: number): {
  readonly nextPlayer: PlayerSnapshot;
  readonly event: WorldEvent;
} | null {
  if (timers.invulnTimer > 0) return null;
  const blocked = Boolean(player.blocking);
  const dmg = blocked ? Math.max(1, Math.round(amount * 0.25)) : amount;
  if (!blocked) timers.invulnTimer = HIT_IFRAME_SEC;
  const nextHp = Math.max(15, (player.hp ?? MAX_PLAYER_HP) - dmg);
  return {
    nextPlayer: { ...player, hp: nextHp, invulnTimer: timers.invulnTimer },
    event: { kind: blocked ? "block" : "hit", targetId: player.id, x: player.x, y: player.y, value: dmg, goreStyle: STYLE_SPLATTER, substance: "blood" },
  };
}
