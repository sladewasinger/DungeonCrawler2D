/** Player incoming hit mitigation, Shield Guard Break, Parry/Riposte, and melee dummy/PvP sector hits. */
import { getItemDef, resolveBlockMode } from "@dc2d/content";
import {
  BLEED_DURATION_SEC, HIT_IFRAME_SEC, MELEE_FEEL_TUNING, PARRY_STAGGER_SEC, PARRY_WINDOW_SEC,
  attackHitboxHitsHurtbox, buildPlayerAttackHitbox, computeArmorDefense, computeMitigatedDamage,
  entityHurtbox, isInSanctuary, isSharpWeapon, isWithinSector, playerHurtbox,
  type EllipseHurtbox, type GoreStyle, type WeaponArchetype, type WorldChunkCache, type WorldEvent,
} from "@dc2d/engine";
import type { CombatPlayerRef } from "../combatActions.js";
import { damageDummy, type SimEntity } from "../dummySim.js";
import type { WorldWebNetwork } from "../webs/webNetwork.js";
import { tryCutOrIgniteCocoon } from "../webs/webCocoon.js";
import { igniteBurnable, inflictPoison } from "./statusEffects.js";

export interface IncomingHit {
  readonly target: CombatPlayerRef;
  readonly attackerOrigin: { readonly x: number; readonly y: number };
  readonly attackerId: string;
  readonly rawDamage: number;
  readonly goreStyle: GoreStyle;
  readonly comboStep?: number | undefined;
  readonly sweepDir?: number | undefined;
  readonly attackerIsPlayer: boolean;
  readonly events: WorldEvent[];
  readonly ignites?: boolean | undefined;
  readonly heavy?: boolean | undefined;
  readonly weaponArchetype?: WeaponArchetype | undefined;
  readonly hitstopSec?: number | undefined;
  readonly shakePx?: number | undefined;
  readonly appliesPoison?: boolean | undefined;
  readonly webs?: WorldWebNetwork | undefined;
  readonly onParry?: () => void;
  readonly onBlockedOrParried?: () => void;
}

function isBlockedFromFront(target: CombatPlayerRef, attackerOrigin: { readonly x: number; readonly y: number }): boolean {
  return target.combat.blocking && isWithinSector({
    origin: target, dir: { x: target.facingX, y: target.facingY },
    target: attackerOrigin, range: 12, halfArcRad: 1.05,
  });
}

function applyGuardBreak(opts: { readonly hit: IncomingHit; readonly blockedDmg: number }): void {
  const { target, events, attackerId } = opts.hit;
  target.combat.blocking = false;
  target.combat.blockElapsed = 0;
  target.combat.staggerTimer = Math.max(target.combat.staggerTimer, MELEE_FEEL_TUNING.guardBreakStaggerSec);
  target.combat.hp = Math.max(1, target.combat.hp - opts.blockedDmg);
  events.push({
    kind: "guardBreak", x: target.x, y: target.y, value: opts.blockedDmg,
    actorId: target.id, targetId: attackerId,
    hitstopSec: MELEE_FEEL_TUNING.guardBreakHitstopSec, shakePx: MELEE_FEEL_TUNING.guardBreakShakePx,
  });
}

function triggerTimedParry(hit: IncomingHit): void {
  const { target, events } = hit;
  hit.onParry?.();
  events.push({
    kind: "parry", x: target.x, y: target.y, actorId: target.id, targetId: hit.attackerId,
    hitstopSec: MELEE_FEEL_TUNING.parryHitstopSec, shakePx: MELEE_FEEL_TUNING.parryShakePx,
  });
  hit.onBlockedOrParried?.();
}

function applyRegularOrBrokenBlock(hit: IncomingHit, blockedDmg: number): void {
  const { target, events } = hit;
  if (target.combat.stamina <= 0 || hit.heavy) {
    applyGuardBreak({ hit, blockedDmg });
    return;
  }
  target.combat.hp = Math.max(1, target.combat.hp - blockedDmg);
  events.push({ kind: "block", x: target.x, y: target.y, value: blockedDmg, actorId: target.id, targetId: hit.attackerId });
}

function blockParamsForTarget(target: CombatPlayerRef): { readonly parryWin: number; readonly mit: number; readonly stamMult: number } {
  const heldId = target.inventory.slots[target.selectedHotbar]?.itemId;
  if (resolveBlockMode(heldId, target.inventory.armor.offhand) === "twoHanded") {
    return {
      parryWin: PARRY_WINDOW_SEC * MELEE_FEEL_TUNING.twoHandParryWindowMult,
      mit: MELEE_FEEL_TUNING.twoHandBlockMitigation,
      stamMult: MELEE_FEEL_TUNING.twoHandBlockStaminaMult,
    };
  }
  return { parryWin: PARRY_WINDOW_SEC, mit: getItemDef(target.inventory.armor.offhand ?? "")?.blockMitigation ?? 0.75, stamMult: 1 };
}

function resolveBlockedHit(hit: IncomingHit): void {
  const { target } = hit;
  const bp = blockParamsForTarget(target);
  if (target.combat.blockElapsed <= bp.parryWin && !hit.heavy) { triggerTimedParry(hit); return; }
  const baseDrain = hit.heavy ? 22 : Math.max(8, Math.round(hit.rawDamage * 0.6));
  if (!target.combat.godMode) target.combat.stamina = Math.max(0, target.combat.stamina - Math.round(baseDrain * bp.stamMult));
  const def = computeArmorDefense(target.inventory.armor, getItemDef);
  const blockedDmg = target.combat.godMode ? 0 : Math.max(1, Math.round(computeMitigatedDamage(hit.rawDamage, def) * (1 - bp.mit)));
  applyRegularOrBrokenBlock(hit, blockedDmg);
  hit.onBlockedOrParried?.();
}

function shouldIgnoreIncomingHit(hit: IncomingHit): boolean {
  if (hit.target.combat.invulnTimer > 0 || hit.target.combat.respawnTimer > 0) return true;
  if (!hit.attackerIsPlayer) return false;
  return isInSanctuary(hit.attackerOrigin.x, hit.attackerOrigin.y) || isInSanctuary(hit.target.x, hit.target.y);
}

function applyPlayerRiposteAndBurn(hit: IncomingHit, dmg: number): number {
  const { target, events } = hit;
  let out = dmg;
  if (hit.attackerIsPlayer && target.combat.parried && target.combat.staggerTimer > 0) {
    out = Math.round(out * MELEE_FEEL_TUNING.riposteDamageMult);
    target.combat.parried = false;
    events.push({
      kind: "riposte", x: target.x, y: target.y, value: out,
      actorId: hit.attackerId, targetId: target.id, hitstopSec: MELEE_FEEL_TUNING.parryHitstopSec, shakePx: 3.0,
    });
  }
  if (hit.ignites) {
    const burnWrap = {
      get hp() { return target.combat.hp; },
      get maxHp() { return target.combat.maxHp; },
      get burnTimer() { return target.combat.burnTimer; },
      set burnTimer(v: number) { target.combat.burnTimer = v; },
      get burnTickAcc() { return target.combat.burnTickAcc; },
      set burnTickAcc(v: number) { target.combat.burnTickAcc = v; },
      inWater: target.inWater, inDeepWater: target.inDeepWater,
    };
    igniteBurnable({ target: burnWrap, x: target.x, y: target.y, targetId: target.id, events });
  }
  return out;
}

function buildPlayerHitEvent(hit: IncomingHit, dmg: number, fatal: boolean): WorldEvent {
  const { target, attackerOrigin } = hit;
  const dx = target.x - attackerOrigin.x;
  const dy = target.y - attackerOrigin.y;
  const mag = Math.max(0.01, Math.hypot(dx, dy));
  return {
    kind: "hit", x: target.x, y: target.y, dirX: dx / mag, dirY: dy / mag, value: dmg,
    actorId: hit.attackerId, targetId: target.id, comboStep: hit.comboStep, sweepDir: hit.sweepDir,
    goreStyle: fatal ? "explode-away" : hit.goreStyle, substance: "blood", fatal,
    ...(hit.heavy ? { heavy: true } : {}),
    ...(hit.weaponArchetype ? { weaponArchetype: hit.weaponArchetype } : {}),
    ...(hit.hitstopSec !== undefined ? { hitstopSec: hit.hitstopSec } : {}),
    ...(hit.shakePx !== undefined ? { shakePx: hit.shakePx } : {}),
  };
}

export function clearPlayerCombatOnFatal(target: CombatPlayerRef): void {
  const c = target.combat;
  c.respawnTimer = 1.65;
  c.blocking = false; c.bowCharge = 0; c.swingTimer = 0; c.dodgeTimer = 0;
  c.pendingSwing = null; c.bufferedAction = null; c.heavyCharge = 0;
  c.burnTimer = 0; c.burnTickAcc = 0; c.poisonTimer = 0; c.poisonTickAcc = 0;
  c.poisonLocked = false; c.webSlowTimer = 0; c.webStick = 0; c.webStuckSec = 0;
  c.cocoonProgress = 0; c.cocoonHp = 0; c.cocoonBurning = false; c.parried = false;
}

function tryRescueCocoonTarget(hit: IncomingHit): boolean {
  if (!hit.attackerIsPlayer || hit.target.combat.cocoonProgress <= 0) return false;
  return tryCutOrIgniteCocoon({
    target: hit.target, sharp: isSharpWeapon(hit.weaponArchetype), ignites: Boolean(hit.ignites),
    damage: hit.rawDamage, actorId: hit.attackerId, events: hit.events, webs: hit.webs,
  }).handled;
}

export function applyIncomingPlayerHit(hit: IncomingHit): void {
  const { target, events } = hit;
  if (tryRescueCocoonTarget(hit) || shouldIgnoreIncomingHit(hit)) return;
  if (isBlockedFromFront(target, hit.attackerOrigin)) { resolveBlockedHit(hit); return; }
  const mitigated = computeMitigatedDamage(hit.rawDamage, computeArmorDefense(target.inventory.armor, getItemDef));
  const rawPost = applyPlayerRiposteAndBurn(hit, mitigated);
  const dmg = target.combat.godMode ? 0 : rawPost;
  target.combat.hp = Math.max(0, target.combat.hp - dmg);
  target.combat.hitTimer = 0.28;
  if (hit.goreStyle === "drip") target.combat.bleedTimer = BLEED_DURATION_SEC;
  if (hit.appliesPoison) inflictPoison(target.combat);
  const fatal = target.combat.hp <= 0;
  events.push(buildPlayerHitEvent(hit, dmg, fatal));
  if (fatal) clearPlayerCombatOnFatal(target);
  else target.combat.invulnTimer = Math.max(target.combat.invulnTimer, HIT_IFRAME_SEC);
}

export interface MeleePassInput {
  readonly cache?: WorldChunkCache | undefined;
  readonly attacker: CombatPlayerRef;
  readonly players: Iterable<CombatPlayerRef>;
  readonly dummies: readonly SimEntity[];
  readonly rawDamage: number;
  readonly range: number;
  readonly halfArcRad: number;
  readonly goreStyle: GoreStyle;
  readonly comboStep?: number | undefined;
  readonly sweepDir?: number | undefined;
  readonly ignites?: boolean | undefined;
  readonly heavy?: boolean | undefined;
  readonly weaponArchetype?: WeaponArchetype | undefined;
  readonly hitstopSec?: number | undefined;
  readonly shakePx?: number | undefined;
  readonly hitTargetIds?: Set<string> | undefined;
  readonly impactCenter?: { readonly x: number; readonly y: number } | undefined;
  readonly slamAoeRadius?: number | undefined;
  readonly webs?: WorldWebNetwork | undefined;
  readonly events: WorldEvent[];
}

function hitsMeleeOrSlam(
  input: MeleePassInput,
  box: EllipseHurtbox,
  dir: { readonly x: number; readonly y: number },
): boolean {
  return attackHitboxHitsHurtbox(buildPlayerAttackHitbox({
    cache: input.cache, x: input.attacker.x, y: input.attacker.y, elevation: input.attacker.elevation,
    dir, range: input.range, halfArcRad: input.halfArcRad,
    impactCenter: input.impactCenter, slamAoeRadius: input.slamAoeRadius,
  }), box);
}

function hitDummyTargets(input: MeleePassInput, dir: { readonly x: number; readonly y: number }): void {
  for (const entity of input.dummies) {
    if (entity.respawnTimer > 0 || input.hitTargetIds?.has(entity.id)) continue;
    if (!hitsMeleeOrSlam(input, entityHurtbox(entity, entity.kind, input.cache), dir)) continue;
    input.hitTargetIds?.add(entity.id);
    damageDummy({
      entity, damage: input.rawDamage, dirX: dir.x, dirY: dir.y, goreStyle: input.goreStyle,
      comboStep: input.comboStep, sweepDir: input.sweepDir, actorId: input.attacker.id, events: input.events,
      ignites: input.ignites, heavy: input.heavy, weaponArchetype: input.weaponArchetype,
      hitstopSec: input.hitstopSec, shakePx: input.shakePx,
    });
  }
}

function hitPlayerTargets(input: MeleePassInput, dir: { readonly x: number; readonly y: number }): void {
  for (const other of input.players) {
    if (other.id === input.attacker.id || input.hitTargetIds?.has(other.id)) continue;
    if (!hitsMeleeOrSlam(input, playerHurtbox(other, input.cache), dir)) continue;
    input.hitTargetIds?.add(other.id);
    applyIncomingPlayerHit({
      target: other, attackerOrigin: input.attacker, attackerId: input.attacker.id,
      rawDamage: input.rawDamage, goreStyle: input.goreStyle, comboStep: input.comboStep, sweepDir: input.sweepDir,
      attackerIsPlayer: true, events: input.events, ignites: input.ignites, heavy: input.heavy,
      weaponArchetype: input.weaponArchetype, hitstopSec: input.hitstopSec, shakePx: input.shakePx,
      webs: input.webs,
      onParry: () => { input.attacker.combat.staggerTimer = PARRY_STAGGER_SEC; input.attacker.combat.parried = true; },
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
    onParry: () => { entity.staggerTimer = PARRY_STAGGER_SEC; entity.parried = true; entity.telegraphTimer = 0; entity.strikeTimer = 0; },
  });
}
