/** Player combat state, timer decay, consumables, respawn, and incoming-hit delegation. */
import {
  COMBAT_TUNING, MAX_PLAYER_HP, MAX_PLAYER_STAMINA, SANCTUARY_CENTER, STAMINA_REGEN_PER_SEC,
  type PlayerInventoryState, type WorldEvent,
} from "@dc2d/engine";
import { resolveBlockMode } from "@dc2d/content";
import { resolvePlayerGear, useConsumableByItemId } from "./combat/gearEffects.js";
import type { BufferedCombatAction, PendingMeleeSwing } from "./combat/meleeTimeline.js";
import { clearPlayerCombatOnFatal } from "./combat/playerCombatHits.js";
import { stepBurnTarget, stepPoisonTarget } from "./combat/statusEffects.js";

export { applyIncomingPlayerHit, resolveDummyStrikeOnPlayer, resolveMeleeHits, type IncomingHit } from "./combat/playerCombatHits.js";

export interface PlayerCombatState {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  comboStep: number;
  comboResetTimer: number;
  swingTimer: number;
  swingDuration: number;
  heavyCharge: number;
  bowCharge: number;
  blocking: boolean;
  blockElapsed: number;
  dodgeTimer: number;
  dodgeCooldown: number;
  dodgeDirX: number;
  dodgeDirY: number;
  invulnTimer: number;
  staggerTimer: number;
  bleedTimer: number;
  burnTimer: number;
  burnTickAcc: number;
  poisonTimer: number;
  poisonTickAcc: number;
  poisonLocked: boolean;
  webSlowTimer: number;
  webStick: number;
  webStuckSec: number;
  cocoonProgress: number;
  cocoonHp: number;
  cocoonBurning: boolean;
  parried: boolean;
  hitTimer: number;
  respawnTimer: number;
  actionCooldown: number;
  pebbleCooldown: number;
  wellFedTimer: number;
  restedTimer: number;
  hearthWarmSec: number;
  buffKind: "swiftness" | "vigor" | "shadow" | null;
  buffTimer: number;
  godMode: boolean;
  pendingSwing: PendingMeleeSwing | null;
  bufferedAction: BufferedCombatAction | null;
}

export interface CombatPlayerRef {
  readonly id: string;
  x: number;
  y: number;
  elevation: number;
  facingX: number;
  facingY: number;
  aimX: number;
  aimY: number;
  selectedHotbar: number;
  moving?: boolean;
  sprinting?: boolean;
  crouching?: boolean;
  stealthVis?: number;
  inCover?: boolean;
  noiseRadius?: number;
  visibility?: number;
  inWater?: boolean;
  inDeepWater?: boolean;
  inventory: PlayerInventoryState;
  readonly combat: PlayerCombatState;
}

export function createCombatState(): PlayerCombatState {
  return {
    hp: MAX_PLAYER_HP, maxHp: MAX_PLAYER_HP, stamina: MAX_PLAYER_STAMINA, maxStamina: MAX_PLAYER_STAMINA,
    comboStep: 0, comboResetTimer: 0, swingTimer: 0, swingDuration: 0.26, heavyCharge: 0, bowCharge: 0,
    blocking: false, blockElapsed: 0, dodgeTimer: 0, dodgeCooldown: 0, dodgeDirX: 0, dodgeDirY: 1,
    invulnTimer: 0, staggerTimer: 0, bleedTimer: 0, burnTimer: 0, burnTickAcc: 0,
    poisonTimer: 0, poisonTickAcc: 0, poisonLocked: false, webSlowTimer: 0,
    webStick: 0, webStuckSec: 0, cocoonProgress: 0, cocoonHp: 0, cocoonBurning: false, parried: false,
    hitTimer: 0, respawnTimer: 0, actionCooldown: 0, pebbleCooldown: 0, wellFedTimer: 0, restedTimer: 0, hearthWarmSec: 0,
    buffKind: null, buffTimer: 0,
    godMode: false, pendingSwing: null, bufferedAction: null,
  };
}

function decayCombatTimers(c: PlayerCombatState, dt: number): void {
  if (!c.pendingSwing) c.swingTimer = Math.max(0, c.swingTimer - dt);
  c.comboResetTimer = Math.max(0, c.comboResetTimer - dt);
  if (c.comboResetTimer === 0 && !c.pendingSwing) c.comboStep = 0;
  c.dodgeTimer = Math.max(0, c.dodgeTimer - dt);
  c.dodgeCooldown = Math.max(0, c.dodgeCooldown - dt);
  c.invulnTimer = Math.max(0, c.invulnTimer - dt);
  c.staggerTimer = Math.max(0, c.staggerTimer - dt);
  if (c.staggerTimer === 0) c.parried = false;
  c.bleedTimer = Math.max(0, c.bleedTimer - dt);
  c.webSlowTimer = Math.max(0, c.webSlowTimer - dt);
  c.hitTimer = Math.max(0, c.hitTimer - dt);
  c.actionCooldown = Math.max(0, c.actionCooldown - dt);
  c.pebbleCooldown = Math.max(0, c.pebbleCooldown - dt);
  if (c.buffTimer > 0) {
    c.buffTimer = Math.max(0, c.buffTimer - dt);
    if (c.buffTimer === 0) c.buffKind = null;
  }
}

function isBlockReady(c: PlayerCombatState): boolean {
  const swingAllows = c.swingTimer <= 0 || Boolean(c.pendingSwing?.shieldPoke);
  return c.dodgeTimer <= 0 && swingAllows && c.staggerTimer <= 0 && c.bowCharge <= 0;
}

function stepDeepWaterStamina(p: CombatPlayerRef, dt: number): void {
  const c = p.combat;
  if (p.moving) {
    c.stamina = Math.max(0, c.stamina - COMBAT_TUNING.swim.staminaDrainPerSec * dt);
    return;
  }
  c.stamina = Math.min(c.maxStamina, c.stamina + COMBAT_TUNING.swim.idleTreadRegenPerSec * dt);
}

const canBlockNow = (p: CombatPlayerRef, blockHeld: boolean): boolean => {
  const heldId = p.inventory.slots[p.selectedHotbar]?.itemId;
  return !p.inDeepWater && blockHeld && resolveBlockMode(heldId, p.inventory.armor.offhand) !== "none" && isBlockReady(p.combat);
};

export function stepPlayerBurnTimer(p: CombatPlayerRef, dt: number, events: WorldEvent[]): void {
  const c = p.combat;
  if (c.burnTimer <= 0 || c.respawnTimer > 0) return;
  const wrap = {
    get hp() { return c.hp; },
    get maxHp() { return c.maxHp; },
    get burnTimer() { return c.burnTimer; },
    set burnTimer(v: number) { c.burnTimer = v; },
    get burnTickAcc() { return c.burnTickAcc; },
    set burnTickAcc(v: number) { c.burnTickAcc = v; },
    inWater: p.inWater, inDeepWater: p.inDeepWater,
  };
  stepBurnTarget({
    target: wrap, dt, x: p.x, y: p.y, targetId: p.id, events,
    onTickDamage: (dmg) => { if (c.godMode) return; c.hp = Math.max(0, c.hp - dmg); if (c.hp <= 0) clearPlayerCombatOnFatal(p); },
  });
}

export function stepPlayerPoisonTimer(p: CombatPlayerRef, dt: number, events: WorldEvent[]): void {
  const c = p.combat;
  if ((c.poisonTimer <= 0 && !c.poisonLocked) || c.respawnTimer > 0) return;
  const wrap = {
    get hp() { return c.hp; },
    get poisonTimer() { return c.poisonTimer; },
    set poisonTimer(v: number) { c.poisonTimer = v; },
    get poisonTickAcc() { return c.poisonTickAcc; },
    set poisonTickAcc(v: number) { c.poisonTickAcc = v; },
    get poisonLocked() { return c.poisonLocked; },
    set poisonLocked(v: boolean) { c.poisonLocked = v; },
  };
  stepPoisonTarget({
    target: wrap, dt, x: p.x, y: p.y, targetId: p.id, events,
    onTickDamage: (dmg) => { if (c.godMode) return; c.hp = Math.max(0, c.hp - dmg); if (c.hp <= 0) clearPlayerCombatOnFatal(p); },
  });
}

function syncGearAndVigorVitals(p: CombatPlayerRef): number {
  const c = p.combat;
  const gear = resolvePlayerGear(p);
  const vigorBonus = c.buffTimer > 0 && c.buffKind === "vigor" ? 25 : 0;
  c.maxHp = MAX_PLAYER_HP + gear.maxHpBonus + vigorBonus;
  c.maxStamina = MAX_PLAYER_STAMINA + gear.maxStaminaBonus;
  c.hp = Math.min(c.hp, c.maxHp);
  c.stamina = Math.min(c.stamina, c.maxStamina);
  return gear.staminaRegenBonus;
}

function computeStaminaRegenRate(p: CombatPlayerRef, gearStamRegen: number): number {
  const c = p.combat;
  const swiftBonus = c.buffTimer > 0 && c.buffKind === "swiftness" ? 12 : 0;
  const baseRate = STAMINA_REGEN_PER_SEC + gearStamRegen + swiftBonus;
  return c.blocking ? baseRate * 0.45 : baseRate;
}

function stepVitalsRegen(p: CombatPlayerRef, gearStamRegen: number, dt: number): void {
  const c = p.combat;
  if (c.buffTimer > 0 && c.buffKind === "vigor" && c.respawnTimer <= 0) {
    c.hp = Math.min(c.maxHp, c.hp + 1.5 * dt);
  }
  if (c.swingTimer > 0 || c.dodgeTimer > 0) return;
  if (p.inDeepWater) { stepDeepWaterStamina(p, dt); return; }
  c.stamina = Math.min(c.maxStamina, c.stamina + computeStaminaRegenRate(p, gearStamRegen) * dt);
}

export function stepCombatTimers(p: CombatPlayerRef, blockHeld: boolean, dt: number): void {
  const c = p.combat;
  const gearStamRegen = syncGearAndVigorVitals(p);
  decayCombatTimers(c, dt);
  c.blocking = canBlockNow(p, blockHeld);
  c.blockElapsed = c.blocking ? c.blockElapsed + dt : 0;
  if (c.godMode) { c.hp = c.maxHp; c.stamina = c.maxStamina; return; }
  stepVitalsRegen(p, gearStamRegen, dt);
}

export interface RespawnSpot {
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
}

export function tryHealConsumable(p: CombatPlayerRef, itemId: string, events: WorldEvent[]): boolean {
  return useConsumableByItemId(p, itemId, events);
}

export function stepPlayerRespawn(target: CombatPlayerRef, events: WorldEvent[], opts: { readonly dt: number; readonly spot?: RespawnSpot | null | undefined }): boolean {
  if (target.combat.respawnTimer <= 0) return false;
  target.combat.respawnTimer = Math.max(0, target.combat.respawnTimer - opts.dt);
  if (target.combat.respawnTimer === 0) respawnAtPoint(target, events, opts.spot);
  return true;
}

export function forceRespawnPlayer(target: CombatPlayerRef, events: WorldEvent[], spot?: RespawnSpot | null): void {
  respawnAtPoint(target, events, spot);
}

function respawnAtPoint(target: CombatPlayerRef, events: WorldEvent[], spot?: RespawnSpot | null): void {
  const dest = spot ?? { x: SANCTUARY_CENTER.x, y: SANCTUARY_CENTER.y, elevation: 0 };
  const c = target.combat;
  target.x = dest.x; target.y = dest.y; target.elevation = dest.elevation;
  c.hp = c.maxHp; c.stamina = c.maxStamina; c.bleedTimer = 0; c.burnTimer = 0;
  c.burnTickAcc = 0; c.poisonTimer = 0; c.poisonTickAcc = 0; c.poisonLocked = false;
  c.webSlowTimer = 0; c.webStick = 0; c.webStuckSec = 0; c.cocoonProgress = 0;
  c.cocoonHp = 0; c.cocoonBurning = false; c.parried = false; c.staggerTimer = 0;
  c.hitTimer = 0; c.respawnTimer = 0;
  c.invulnTimer = 2.0; c.bowCharge = 0; c.blocking = false; c.heavyCharge = 0;
  c.pendingSwing = null; c.bufferedAction = null;
  events.push({ kind: "respawn", x: target.x, y: target.y, actorId: target.id });
}
