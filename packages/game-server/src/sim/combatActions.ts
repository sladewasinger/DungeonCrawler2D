/** Player combat state, shield parry/block resolution, melee combo hits, and heals. */
import { getItemDef } from "@dc2d/content";
import {
  BLEED_DURATION_SEC, MAX_PLAYER_HP, MAX_PLAYER_STAMINA, PARRY_STAGGER_SEC, PARRY_WINDOW_SEC,
  SANCTUARY_CENTER, STAMINA_REGEN_PER_SEC, comboMultiplier, computeArmorDefense,
  computeMitigatedDamage, consumeItemFromSlots, isInSanctuary, isWithinSector,
  type GoreStyle, type PlayerInventoryState, type WorldEvent,
} from "@dc2d/engine";
import { damageDummy, type SimEntity } from "./dummySim.js";

export interface PlayerCombatState {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  comboStep: number;
  comboResetTimer: number;
  swingTimer: number;
  swingDuration: number;
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
  hitTimer: number;
  respawnTimer: number;
  actionCooldown: number;
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
  inventory: PlayerInventoryState;
  readonly combat: PlayerCombatState;
}

export function createCombatState(): PlayerCombatState {
  return {
    hp: MAX_PLAYER_HP, maxHp: MAX_PLAYER_HP, stamina: MAX_PLAYER_STAMINA, maxStamina: MAX_PLAYER_STAMINA,
    comboStep: 0, comboResetTimer: 0, swingTimer: 0, swingDuration: 0.26, bowCharge: 0,
    blocking: false, blockElapsed: 0, dodgeTimer: 0, dodgeCooldown: 0, dodgeDirX: 0, dodgeDirY: 1,
    invulnTimer: 0, staggerTimer: 0, bleedTimer: 0, hitTimer: 0, respawnTimer: 0, actionCooldown: 0,
  };
}

function decayCombatTimers(c: PlayerCombatState, dt: number): void {
  c.swingTimer = Math.max(0, c.swingTimer - dt);
  c.comboResetTimer = Math.max(0, c.comboResetTimer - dt);
  if (c.comboResetTimer === 0) c.comboStep = 0;
  c.dodgeTimer = Math.max(0, c.dodgeTimer - dt);
  c.dodgeCooldown = Math.max(0, c.dodgeCooldown - dt);
  c.invulnTimer = Math.max(0, c.invulnTimer - dt);
  c.staggerTimer = Math.max(0, c.staggerTimer - dt);
  c.bleedTimer = Math.max(0, c.bleedTimer - dt);
  c.hitTimer = Math.max(0, c.hitTimer - dt);
  c.actionCooldown = Math.max(0, c.actionCooldown - dt);
}

function isBlockReady(c: PlayerCombatState): boolean {
  return c.dodgeTimer <= 0 && c.swingTimer <= 0 && c.staggerTimer <= 0 && c.bowCharge <= 0;
}

export function stepCombatTimers(p: CombatPlayerRef, blockHeld: boolean, dt: number): void {
  const c = p.combat;
  decayCombatTimers(c, dt);
  c.blocking = blockHeld && Boolean(p.inventory.armor.offhand) && isBlockReady(c);
  c.blockElapsed = c.blocking ? c.blockElapsed + dt : 0;
  if (c.swingTimer > 0 || c.dodgeTimer > 0) return;
  const rate = c.blocking ? STAMINA_REGEN_PER_SEC * 0.45 : STAMINA_REGEN_PER_SEC;
  c.stamina = Math.min(c.maxStamina, c.stamina + rate * dt);
}

export function tryHealConsumable(p: CombatPlayerRef, itemId: string, events: WorldEvent[]): boolean {
  const heal = getItemDef(itemId)?.healHp;
  if (!heal || p.combat.hp >= p.combat.maxHp || p.combat.actionCooldown > 0 || p.combat.respawnTimer > 0) return false;
  if (!consumeItemFromSlots(p.inventory.slots, itemId, 1)) return false;
  p.combat.hp = Math.min(p.combat.maxHp, p.combat.hp + heal);
  p.combat.actionCooldown = 0.45;
  events.push({ kind: "heal", x: p.x, y: p.y, value: heal, actorId: p.id });
  return true;
}

export function stepPlayerRespawn(target: CombatPlayerRef, events: WorldEvent[], dt: number): boolean {
  if (target.combat.respawnTimer <= 0) return false;
  target.combat.respawnTimer = Math.max(0, target.combat.respawnTimer - dt);
  if (target.combat.respawnTimer === 0) respawnAtSanctuary(target, events);
  return true;
}

function isBlockedFromFront(target: CombatPlayerRef, attackerOrigin: { readonly x: number; readonly y: number }): boolean {
  return target.combat.blocking && isWithinSector({
    origin: target, dir: { x: target.facingX, y: target.facingY },
    target: attackerOrigin, range: 12, halfArcRad: 1.05,
  });
}

function respawnAtSanctuary(target: CombatPlayerRef, events: WorldEvent[]): void {
  target.x = SANCTUARY_CENTER.x;
  target.y = SANCTUARY_CENTER.y;
  target.elevation = 0;
  target.combat.hp = target.combat.maxHp;
  target.combat.stamina = target.combat.maxStamina;
  target.combat.bleedTimer = 0;
  target.combat.staggerTimer = 0;
  target.combat.hitTimer = 0;
  target.combat.respawnTimer = 0;
  target.combat.invulnTimer = 2.0;
  target.combat.bowCharge = 0;
  target.combat.blocking = false;
  events.push({ kind: "respawn", x: target.x, y: target.y, actorId: target.id });
}

export interface IncomingHit {
  readonly target: CombatPlayerRef;
  readonly attackerOrigin: { readonly x: number; readonly y: number };
  readonly attackerId: string;
  readonly rawDamage: number;
  readonly goreStyle: GoreStyle;
  readonly attackerIsPlayer: boolean;
  readonly events: WorldEvent[];
  readonly onParry?: () => void;
}

function resolveBlockedHit(hit: IncomingHit): void {
  const { target, events } = hit;
  if (target.combat.blockElapsed <= PARRY_WINDOW_SEC) {
    hit.onParry?.();
    events.push({ kind: "parry", x: target.x, y: target.y, actorId: target.id, targetId: hit.attackerId });
    return;
  }
  const offhandId = target.inventory.armor.offhand ?? "";
  const mit = getItemDef(offhandId)?.blockMitigation ?? 0.75;
  target.combat.stamina = Math.max(0, target.combat.stamina - 10);
  const def = computeArmorDefense(target.inventory.armor, getItemDef);
  const blockedDmg = Math.max(1, Math.round(computeMitigatedDamage(hit.rawDamage, def) * (1 - mit)));
  target.combat.hp = Math.max(1, target.combat.hp - blockedDmg);
  events.push({ kind: "block", x: target.x, y: target.y, value: blockedDmg, actorId: target.id, targetId: hit.attackerId });
}

function shouldIgnoreIncomingHit(hit: IncomingHit): boolean {
  if (hit.target.combat.invulnTimer > 0 || hit.target.combat.respawnTimer > 0) return true;
  if (!hit.attackerIsPlayer) return false;
  return isInSanctuary(hit.attackerOrigin.x, hit.attackerOrigin.y) || isInSanctuary(hit.target.x, hit.target.y);
}

export function applyIncomingPlayerHit(hit: IncomingHit): void {
  const { target, attackerOrigin, events } = hit;
  if (shouldIgnoreIncomingHit(hit)) return;
  if (isBlockedFromFront(target, attackerOrigin)) { resolveBlockedHit(hit); return; }

  const dmg = computeMitigatedDamage(hit.rawDamage, computeArmorDefense(target.inventory.armor, getItemDef));
  target.combat.hp = Math.max(0, target.combat.hp - dmg);
  target.combat.hitTimer = 0.28;
  if (hit.goreStyle === "drip") target.combat.bleedTimer = BLEED_DURATION_SEC;
  const fatal = target.combat.hp <= 0;
  const dx = target.x - attackerOrigin.x;
  const dy = target.y - attackerOrigin.y;
  const mag = Math.max(0.01, Math.hypot(dx, dy));
  events.push({
    kind: "hit", x: target.x, y: target.y, dirX: dx / mag, dirY: dy / mag, value: dmg,
    actorId: hit.attackerId, targetId: target.id, goreStyle: fatal ? "explode-away" : hit.goreStyle, substance: "blood", fatal,
  });
  if (fatal) {
    target.combat.respawnTimer = 1.65;
    target.combat.blocking = false;
    target.combat.bowCharge = 0;
    target.combat.swingTimer = 0;
    target.combat.dodgeTimer = 0;
  }
}

interface MeleePassInput {
  readonly attacker: CombatPlayerRef;
  readonly players: Iterable<CombatPlayerRef>;
  readonly dummies: readonly SimEntity[];
  readonly rawDamage: number;
  readonly range: number;
  readonly halfArcRad: number;
  readonly goreStyle: GoreStyle;
  readonly events: WorldEvent[];
}

function hitDummyTargets(input: MeleePassInput, dir: { readonly x: number; readonly y: number }): void {
  for (const entity of input.dummies) {
    if (entity.respawnTimer > 0) continue;
    if (!isWithinSector({ origin: input.attacker, dir, target: entity, range: input.range, halfArcRad: input.halfArcRad })) continue;
    damageDummy({ entity, damage: input.rawDamage, dirX: dir.x, dirY: dir.y, goreStyle: input.goreStyle, actorId: input.attacker.id, events: input.events });
  }
}

function hitPlayerTargets(input: MeleePassInput, dir: { readonly x: number; readonly y: number }): void {
  for (const other of input.players) {
    if (other.id === input.attacker.id) continue;
    if (!isWithinSector({ origin: input.attacker, dir, target: other, range: input.range, halfArcRad: input.halfArcRad })) continue;
    applyIncomingPlayerHit({
      target: other, attackerOrigin: input.attacker, attackerId: input.attacker.id,
      rawDamage: input.rawDamage, goreStyle: input.goreStyle, attackerIsPlayer: true, events: input.events,
      onParry: () => { input.attacker.combat.staggerTimer = PARRY_STAGGER_SEC; },
    });
  }
}

export function resolveMeleeHits(input: MeleePassInput): void {
  const dir = { x: input.attacker.aimX, y: input.attacker.aimY };
  hitDummyTargets(input, dir);
  hitPlayerTargets(input, dir);
}

export function resolveDummyStrikeOnPlayer(opts: {
  readonly entity: SimEntity; readonly target: CombatPlayerRef; readonly damage: number; readonly events: WorldEvent[];
}): void {
  const { entity, target, damage, events } = opts;
  applyIncomingPlayerHit({
    target, attackerOrigin: entity, attackerId: entity.id, rawDamage: damage,
    goreStyle: "splatter", attackerIsPlayer: false, events,
    onParry: () => { entity.staggerTimer = PARRY_STAGGER_SEC; entity.telegraphTimer = 0; },
  });
}

export function finisherGore(base: GoreStyle, step: number): GoreStyle {
  return step === 3 && base === "splatter" ? "chunk-spray" : base;
}

export function comboMultFor(step: number): number {
  return comboMultiplier(step);
}
