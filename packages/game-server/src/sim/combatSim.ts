/** Authoritative world combat coordinator: melee combos, dodge, bow projectiles, and dummies. */
import { getItemDef } from "@dc2d/content";
import {
  BOW_MAX_CHARGE_SEC, COMBAT_TUNING, DODGE_COOLDOWN_SEC, DODGE_DURATION_SEC,
  DODGE_IFRAME_SEC, DODGE_STAMINA_COST, PARRY_STAGGER_SEC, STEALTH_TUNING, WorldChunkCache,
  consumeItemFromSlots, evaluateBowShot, isInSanctuary, resolveWeaponArchetype, resolveWeaponAttackStep,
  type GoreStyle, type WorldEvent,
} from "@dc2d/engine";
import {
  applyIncomingPlayerHit, forceRespawnPlayer, resolveDummyStrikeOnPlayer,
  resolveMeleeHits, stepCombatTimers, stepPlayerRespawn, tryHealConsumable, type CombatPlayerRef,
} from "./combatActions.js";
import {
  createTrainingDummies, serializeDummies, stepTrainingDummies, type SimEntity,
} from "./dummySim.js";
import { CREATURE_SPECS } from "./wildlife/creatureSpecs.js";
import { serializeProjectiles, stepProjectileList, type SimProjectile } from "./wildlife/projectileSim.js";
import { WorldEcology } from "./wildlife/worldEcology.js";

export interface CombatStepRequest {
  readonly player: CombatPlayerRef;
  readonly players: Map<string, CombatPlayerRef>;
  readonly input: CombatInputFlags;
  readonly dt: number;
}

export interface CombatInputFlags {
  readonly moveX: number;
  readonly moveY: number;
  readonly dodgeDirX?: number | undefined;
  readonly dodgeDirY?: number | undefined;
  readonly attackQueued: boolean;
  readonly bowDrawing: boolean;
  readonly bowReleaseQueued: boolean;
  readonly blockHeld: boolean;
  readonly dodgeQueued: boolean;
  readonly throwPebble?: boolean | undefined;
  readonly interactQueued?: boolean;
}

export class CombatWorld {
  readonly dummies: SimEntity[];
  readonly ecology: WorldEcology;
  private readonly projectiles: SimProjectile[] = [];
  private events: WorldEvent[] = [];
  private nextProjId = 1;

  constructor(private readonly cache: WorldChunkCache) {
    this.dummies = createTrainingDummies(cache);
    this.ecology = new WorldEcology(cache);
  }

  stepPlayerAction(req: CombatStepRequest): void {
    const { player: p, players, input, dt } = req;
    if (stepPlayerRespawn(p, this.events, dt)) return;
    stepCombatTimers(p, input.blockHeld, dt);
    if (p.combat.staggerTimer > 0) { p.combat.bowCharge = 0; return; }
    if (input.interactQueued) this.ecology.openChest(p, undefined, this.events);
    if (input.dodgeQueued && !p.inDeepWater) this.startInputDodge(p, input);
    if (input.throwPebble) this.throwPebble(p, false);
    this.stepOffense({ p, players, input, dt });
  }

  private startInputDodge(p: CombatPlayerRef, input: CombatInputFlags): void {
    const hasDir = input.dodgeDirX !== undefined && input.dodgeDirY !== undefined;
    this.tryStartDodge(p, hasDir ? input.dodgeDirX! : input.moveX, hasDir ? input.dodgeDirY! : input.moveY);
  }

  respawnPlayerNow(p: CombatPlayerRef): void {
    forceRespawnPlayer(p, this.events);
  }

  private stepOffense(opts: {
    readonly p: CombatPlayerRef; readonly players: Map<string, CombatPlayerRef>; readonly input: CombatInputFlags; readonly dt: number;
  }): void {
    const { p, players, input, dt } = opts;
    const heldId = p.inventory.slots[p.selectedHotbar]?.itemId ?? null;
    if (heldId === "bow") { this.stepBowAction(p, input, dt); return; }
    p.combat.bowCharge = 0;
    if (!input.attackQueued) return;
    if (this.tryItemAction(p, heldId)) return;
    this.tryMeleeSwing(p, heldId, players);
  }

  private tryItemAction(p: CombatPlayerRef, heldId: string | null): boolean {
    if (!heldId) return false;
    if (heldId === "stone") return this.throwPebble(p, true);
    return tryHealConsumable(p, heldId, this.events);
  }

  private throwPebble(p: CombatPlayerRef, consumeStone: boolean): boolean {
    if (p.combat.pebbleCooldown > 0) return false;
    if (consumeStone && !consumeItemFromSlots(p.inventory.slots, "stone", 1)) return false;
    p.combat.pebbleCooldown = STEALTH_TUNING.pebbleCooldownSec;
    let tx = p.x; let ty = p.y;
    for (let i = 1; i <= 10; i++) {
      const nx = p.x + p.aimX * (STEALTH_TUNING.pebbleRangeTiles * i / 10);
      const ny = p.y + p.aimY * (STEALTH_TUNING.pebbleRangeTiles * i / 10);
      if (this.cache.tileAt(Math.floor(nx), Math.floor(ny)).elevation > p.elevation) break;
      tx = nx; ty = ny;
    }
    this.events.push({ kind: "distract", x: tx, y: ty, actorId: p.id });
    this.ecology.emitNoise({ x: tx, y: ty, radius: STEALTH_TUNING.pebbleNoiseRadiusTiles, sourceId: p.id });
    return true;
  }

  stepWorld(opts: { readonly players: Map<string, CombatPlayerRef>; readonly dt: number; readonly dayPhase: number; readonly timeSec: number }): void {
    const { players, dt, dayPhase, timeSec } = opts;
    const targets = Array.from(players.values());
    stepTrainingDummies({
      dummies: this.dummies, dt, players: targets, events: this.events,
      onStrike: (entity, target, dmg) => {
        const hitPlayer = players.get(target.id);
        if (hitPlayer) resolveDummyStrikeOnPlayer({ entity, target: hitPlayer, damage: dmg, events: this.events });
      },
    });
    this.ecology.step({
      dt, timeSec, dayPhase,
      players: targets.filter((p) => p.combat.respawnTimer <= 0).map((p) => Object.assign(p, { moving: Boolean(p.moving) })),
      events: this.events,
      onStrike: (entity, target) => {
        const hitPlayer = players.get(target.id);
        if (!hitPlayer) return;
        const spec = CREATURE_SPECS[entity.kind];
        applyIncomingPlayerHit({
          target: hitPlayer, attackerOrigin: entity, attackerId: entity.id, rawDamage: spec.damage,
          goreStyle: spec.goreStyle, attackerIsPlayer: false, events: this.events,
          onParry: () => { entity.staggerTimer = PARRY_STAGGER_SEC; entity.telegraphTimer = 0; },
        });
      },
    });
    stepProjectileList({ cache: this.cache, projectiles: this.projectiles, dummies: this.dummies, ecology: this.ecology, players, events: this.events, dt });
  }

  moveMultiplier(p: CombatPlayerRef): number {
    return baseActionMult(p) * waterMoveMult(p) * (p.crouching ? STEALTH_TUNING.crouchSpeedMult : 1);
  }

  pushEvent(ev: WorldEvent): void { this.events.push(ev); }
  snapshots() {
    const eco = this.ecology.snapshots();
    return { entities: [...serializeDummies(this.dummies), ...eco.entities], projectiles: serializeProjectiles(this.projectiles), chests: eco.chests, groundLoot: eco.groundLoot };
  }
  drainEvents(): WorldEvent[] { const out = this.events; this.events = []; return out; }
  debugSpawnNearPlayer(p: CombatPlayerRef, kind: Parameters<WorldEcology["debugSpawnNearPlayer"]>[1], count = 1): void { this.ecology.debugSpawnNearPlayer(p, kind, count); }
  handleChestRequest(p: CombatPlayerRef, req:
    | { readonly t: "openChest"; readonly chestId: string }
    | { readonly t: "chestTransfer"; readonly chestId: string; readonly from: "chest" | "inv"; readonly fromSlot: number; readonly to: "chest" | "inv"; readonly toSlot: number; readonly quick?: boolean | undefined }
    | { readonly t: "chestTakeAll"; readonly chestId: string },
  ): void {
    if (req.t === "openChest") this.ecology.openChest(p, req.chestId, this.events);
    else if (req.t === "chestTransfer") this.ecology.transferChest(p, req);
    else this.ecology.takeAllChest(p, req.chestId, this.events);
  }

  private tryStartDodge(p: CombatPlayerRef, moveX: number, moveY: number): void {
    const c = p.combat;
    if (c.dodgeCooldown > 0 || c.dodgeTimer > 0 || c.stamina < DODGE_STAMINA_COST) return;
    c.stamina -= DODGE_STAMINA_COST;
    c.dodgeTimer = DODGE_DURATION_SEC;
    c.invulnTimer = DODGE_IFRAME_SEC;
    c.dodgeCooldown = DODGE_COOLDOWN_SEC;
    c.bowCharge = 0;
    c.blocking = false;
    const mag = Math.hypot(moveX, moveY);
    c.dodgeDirX = mag > 0.05 ? moveX / mag : p.facingX;
    c.dodgeDirY = mag > 0.05 ? moveY / mag : p.facingY;
    this.events.push({ kind: "dodge", x: p.x, y: p.y, dirX: c.dodgeDirX, dirY: c.dodgeDirY, actorId: p.id });
  }

  private stepBowAction(p: CombatPlayerRef, input: CombatInputFlags, dt: number): void {
    const c = p.combat;
    if (c.dodgeTimer > 0 || c.actionCooldown > 0) return;
    if (input.bowDrawing) { c.bowCharge = Math.min(BOW_MAX_CHARGE_SEC, c.bowCharge + dt); return; }
    const shouldFire = input.bowReleaseQueued || c.bowCharge > 0;
    if (!shouldFire) return;
    const chargeSec = c.bowCharge;
    c.bowCharge = 0;
    this.fireArrow(p, chargeSec);
  }

  private fireArrow(p: CombatPlayerRef, chargeSec: number): void {
    const c = p.combat;
    if (c.stamina < 10 || !consumeItemFromSlots(p.inventory.slots, "arrow", 1)) return;
    c.stamina -= 10;
    c.actionCooldown = 0.25;
    const shot = evaluateBowShot(chargeSec);
    const dmg = Math.round((getItemDef("bow")?.damage ?? 22) * shot.damageMult);
    this.projectiles.push({
      id: `p${this.nextProjId++}`, ownerId: p.id, originX: p.x, originY: p.y,
      x: p.x + p.aimX * 0.45, y: p.y + p.aimY * 0.45,
      vx: p.aimX * shot.speedTilesPerSec, vy: p.aimY * shot.speedTilesPerSec,
      elevation: p.elevation, charge: shot.ratio, damage: dmg, ttl: 0.95,
    });
    this.events.push({ kind: "arrowFire", x: p.x, y: p.y, dirX: p.aimX, dirY: p.aimY, actorId: p.id, value: shot.ratio });
    this.ecology.emitNoise({ x: p.x, y: p.y, radius: STEALTH_TUNING.combatNoiseRadiusTiles, sourceId: p.id });
  }

  private tryMeleeSwing(p: CombatPlayerRef, heldId: string | null, players: Map<string, CombatPlayerRef>): void {
    const c = p.combat;
    const stats = meleeStatsFor(heldId);
    if (c.swingTimer > 0 || c.dodgeTimer > 0 || c.actionCooldown > 0 || c.stamina < stats.cost) return;
    const { stepIndex, moveset, spec } = resolveWeaponAttackStep({
      archetype: stats.archetype, currentStep: c.comboStep, comboActive: c.comboResetTimer > 0,
    });
    c.stamina -= stats.cost;
    c.comboStep = stepIndex;
    c.comboResetTimer = moveset.comboWindowSec;
    c.swingTimer = spec.swingDurationSec;
    c.swingDuration = spec.swingDurationSec;
    c.blocking = false;
    c.actionCooldown = spec.swingDurationSec * spec.cooldownRatio;
    const rawDamage = Math.round(stats.damage * spec.damageMult);
    const range = stats.range * spec.rangeMult;
    const halfArcRad = stats.halfArc * spec.arcMult;
    const goreStyle = spec.goreOverride ?? stats.gore;
    this.events.push({
      kind: "swing", x: p.x, y: p.y, dirX: p.aimX, dirY: p.aimY,
      actorId: p.id, comboStep: c.comboStep, weaponArchetype: stats.archetype,
    });
    this.ecology.emitNoise({ x: p.x, y: p.y, radius: p.crouching ? 2.2 : STEALTH_TUNING.combatNoiseRadiusTiles, sourceId: p.id });
    resolveMeleeHits({
      attacker: p, players: players.values(), dummies: this.dummies, rawDamage,
      range, halfArcRad, goreStyle, comboStep: c.comboStep, sweepDir: spec.sweepDir, events: this.events,
    });
    this.ecology.hitSector({
      attacker: p, dir: { x: p.aimX, y: p.aimY }, damage: rawDamage,
      range, halfArcRad, goreStyle, comboStep: c.comboStep, sweepDir: spec.sweepDir,
      backstabMult: moveset.backstabMult, events: this.events,
    });
  }
}

export function playerCombatExtras(p: CombatPlayerRef) {
  const c = p.combat;
  return {
    hp: c.hp, maxHp: c.maxHp, stamina: Math.round(c.stamina), maxStamina: c.maxStamina,
    comboStep: c.comboStep,
    swingProgress: c.swingTimer > 0 ? Math.min(1, 1 - c.swingTimer / c.swingDuration) : 0,
    bowCharge: Math.min(1, c.bowCharge / BOW_MAX_CHARGE_SEC),
    blocking: c.blocking, dodging: c.dodgeTimer > 0, invulnTimer: c.invulnTimer, staggerTimer: c.staggerTimer,
    bleedTimer: c.bleedTimer, hitTimer: c.hitTimer, respawnTimer: c.respawnTimer, inSanctuary: isInSanctuary(p.x, p.y),
  };
}

const DEFAULT_MELEE_STATS = { cost: 8, damage: 10, range: 1.5, halfArc: 0.75, gore: "splatter" as GoreStyle };

function waterMoveMult(p: CombatPlayerRef): number {
  const m = COMBAT_TUNING.movementMults;
  if (p.inDeepWater) return p.combat.stamina <= 1 ? m.exhaustedSwim : m.deepWater;
  return p.inWater ? m.shallowWater : 1;
}

function baseActionMult(p: CombatPlayerRef): number {
  const m = COMBAT_TUNING.movementMults;
  if (p.combat.dodgeTimer > 0) return m.dodge;
  if (p.combat.swingTimer > 0) return m.swing;
  if (p.combat.blocking) return m.block;
  return p.combat.bowCharge > 0 ? m.bowDraw : 1;
}

function pickDefStats(def: NonNullable<ReturnType<typeof getItemDef>>, archetype: ReturnType<typeof resolveWeaponArchetype>) {
  const d = DEFAULT_MELEE_STATS;
  return { archetype, cost: def.staminaCost ?? d.cost, damage: def.damage ?? d.damage, range: def.range ?? d.range, halfArc: (def.arcRad ?? 1.5) * 0.5, gore: def.goreStyle ?? d.gore };
}

function meleeStatsFor(heldId: string | null) {
  const def = heldId ? getItemDef(heldId) : undefined;
  if (!def) return { ...DEFAULT_MELEE_STATS, archetype: resolveWeaponArchetype(heldId) };
  return pickDefStats(def, resolveWeaponArchetype(heldId, def.weaponArchetype));
}
