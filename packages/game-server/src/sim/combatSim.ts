/** Authoritative world combat coordinator: melee combos, dodge, bow projectiles, and dummies. */
import { getItemDef } from "@dc2d/content";
import {
  BOW_MAX_CHARGE_SEC, COMBAT_TUNING, COMBO_SWING_SEC, COMBO_WINDOW_SEC, DODGE_COOLDOWN_SEC, DODGE_DURATION_SEC,
  DODGE_IFRAME_SEC, DODGE_STAMINA_COST, WorldChunkCache,
  consumeItemFromSlots, evaluateBowShot, isInSanctuary,
  type GoreStyle, type ProjectileSnapshot, type WorldEntitySnapshot, type WorldEvent,
} from "@dc2d/engine";
import {
  applyIncomingPlayerHit, comboMultFor, finisherGore, resolveDummyStrikeOnPlayer,
  resolveMeleeHits, stepCombatTimers, tryHealConsumable, type CombatPlayerRef,
} from "./combatActions.js";
import {
  createTrainingDummies, damageDummy, serializeDummies, stepTrainingDummies, type SimEntity,
} from "./dummySim.js";

export interface CombatStepRequest {
  readonly player: CombatPlayerRef;
  readonly players: Map<string, CombatPlayerRef>;
  readonly input: CombatInputFlags;
  readonly dt: number;
}

export interface CombatInputFlags {
  readonly moveX: number;
  readonly moveY: number;
  readonly attackQueued: boolean;
  readonly bowDrawing: boolean;
  readonly bowReleaseQueued: boolean;
  readonly blockHeld: boolean;
  readonly dodgeQueued: boolean;
}

interface SimProjectile {
  readonly id: string;
  readonly ownerId: string;
  readonly originX: number;
  readonly originY: number;
  x: number;
  y: number;
  readonly vx: number;
  readonly vy: number;
  readonly elevation: number;
  readonly charge: number;
  readonly damage: number;
  ttl: number;
}

export class CombatWorld {
  readonly dummies: SimEntity[];
  private readonly projectiles: SimProjectile[] = [];
  private events: WorldEvent[] = [];
  private nextProjId = 1;

  constructor(private readonly cache: WorldChunkCache) {
    this.dummies = createTrainingDummies(cache);
  }

  stepPlayerAction(req: CombatStepRequest): void {
    const { player: p, players, input, dt } = req;
    stepCombatTimers(p, input.blockHeld, dt);
    if (p.combat.staggerTimer > 0) { p.combat.bowCharge = 0; return; }
    if (input.dodgeQueued) this.tryStartDodge(p, input.moveX, input.moveY);
    this.stepOffense({ p, players, input, dt });
  }

  private stepOffense(opts: {
    readonly p: CombatPlayerRef; readonly players: Map<string, CombatPlayerRef>; readonly input: CombatInputFlags; readonly dt: number;
  }): void {
    const { p, players, input, dt } = opts;
    const heldId = p.inventory.slots[p.selectedHotbar]?.itemId ?? null;
    if (heldId === "bow") { this.stepBowAction(p, input, dt); return; }
    p.combat.bowCharge = 0;
    if (!input.attackQueued) return;
    if (heldId && tryHealConsumable(p, heldId, this.events)) return;
    this.tryMeleeSwing(p, heldId, players);
  }

  stepWorld(players: Map<string, CombatPlayerRef>, dt: number): void {
    const targets = Array.from(players.values());
    stepTrainingDummies({
      dummies: this.dummies, dt, players: targets, events: this.events,
      onStrike: (entity, target, dmg) => {
        const hitPlayer = players.get(target.id);
        if (hitPlayer) resolveDummyStrikeOnPlayer({ entity, target: hitPlayer, damage: dmg, events: this.events });
      },
    });
    this.stepProjectiles(players, dt);
  }

  moveMultiplier(p: CombatPlayerRef): number {
    const m = COMBAT_TUNING.movementMults;
    if (p.combat.dodgeTimer > 0) return m.dodge;
    if (p.combat.swingTimer > 0) return m.swing;
    if (p.combat.blocking) return m.block;
    if (p.combat.bowCharge > 0) return m.bowDraw;
    return 1;
  }

  snapshots(): { readonly projectiles: ProjectileSnapshot[]; readonly entities: WorldEntitySnapshot[] } {
    return {
      entities: serializeDummies(this.dummies),
      projectiles: this.projectiles.map((pr) => ({
        id: pr.id, ownerId: pr.ownerId, kind: "arrow",
        x: pr.x, y: pr.y, vx: pr.vx, vy: pr.vy, elevation: pr.elevation, charge: pr.charge, element: "none",
      })),
    };
  }

  drainEvents(): WorldEvent[] {
    const out = this.events;
    this.events = [];
    return out;
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
  }

  private tryMeleeSwing(p: CombatPlayerRef, heldId: string | null, players: Map<string, CombatPlayerRef>): void {
    const c = p.combat;
    const stats = meleeStatsFor(heldId);
    if (c.swingTimer > 0 || c.dodgeTimer > 0 || c.actionCooldown > 0 || c.stamina < stats.cost) return;
    c.stamina -= stats.cost;
    c.comboStep = c.comboResetTimer > 0 ? (c.comboStep % 3) + 1 : 1;
    c.comboResetTimer = COMBO_WINDOW_SEC;
    c.swingTimer = COMBO_SWING_SEC;
    c.swingDuration = COMBO_SWING_SEC;
    c.blocking = false;
    c.actionCooldown = COMBO_SWING_SEC * 0.88;
    const rawDamage = Math.round(stats.damage * comboMultFor(c.comboStep));
    this.events.push({ kind: "swing", x: p.x, y: p.y, dirX: p.aimX, dirY: p.aimY, actorId: p.id, comboStep: c.comboStep });
    resolveMeleeHits({
      attacker: p, players: players.values(), dummies: this.dummies, rawDamage,
      range: stats.range, halfArcRad: stats.halfArc,
      goreStyle: finisherGore(stats.gore, c.comboStep), events: this.events,
    });
  }

  private stepProjectiles(players: Map<string, CombatPlayerRef>, dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i]!;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.ttl -= dt;
      const blocked = this.cache.tileAt(Math.floor(pr.x), Math.floor(pr.y)).elevation > pr.elevation;
      if (blocked || pr.ttl <= 0 || this.hitProjectileTarget(pr, players)) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  private hitProjectileDummy(pr: SimProjectile, dx: number, dy: number): boolean {
    for (const d of this.dummies) {
      if (d.respawnTimer <= 0 && Math.hypot(pr.x - d.x, pr.y - d.y) <= 0.48) {
        return damageDummy({ entity: d, damage: pr.damage, dirX: dx, dirY: dy, goreStyle: "drip", actorId: pr.ownerId, events: this.events });
      }
    }
    return false;
  }

  private hitProjectilePlayer(pr: SimProjectile, players: Map<string, CombatPlayerRef>): boolean {
    for (const p of players.values()) {
      if (p.id === pr.ownerId || Math.hypot(pr.x - p.x, pr.y - p.y) > 0.42) continue;
      if (isInSanctuary(pr.originX, pr.originY) || isInSanctuary(p.x, p.y)) return true;
      applyIncomingPlayerHit({
        target: p, attackerOrigin: { x: pr.originX, y: pr.originY }, attackerId: pr.ownerId,
        rawDamage: pr.damage, goreStyle: "drip", attackerIsPlayer: true, events: this.events,
      });
      return true;
    }
    return false;
  }

  private hitProjectileTarget(pr: SimProjectile, players: Map<string, CombatPlayerRef>): boolean {
    const spd = Math.max(0.01, Math.hypot(pr.vx, pr.vy));
    return this.hitProjectileDummy(pr, pr.vx / spd, pr.vy / spd) || this.hitProjectilePlayer(pr, players);
  }
}

export function playerCombatExtras(p: CombatPlayerRef) {
  const c = p.combat;
  return {
    hp: c.hp, maxHp: c.maxHp, stamina: Math.round(c.stamina), maxStamina: c.maxStamina,
    comboStep: c.comboStep,
    swingProgress: c.swingTimer > 0 ? Math.min(1, 1 - c.swingTimer / c.swingDuration) : 0,
    bowCharge: Math.min(1, c.bowCharge / BOW_MAX_CHARGE_SEC),
    blocking: c.blocking, dodging: c.dodgeTimer > 0, staggerTimer: c.staggerTimer,
    bleedTimer: c.bleedTimer, inSanctuary: isInSanctuary(p.x, p.y),
  };
}

const DEFAULT_MELEE_STATS = { cost: 8, damage: 10, range: 1.5, halfArc: 0.75, gore: "splatter" as GoreStyle };

function meleeStatsFor(heldId: string | null) {
  const def = heldId ? getItemDef(heldId) : undefined;
  if (!def) return DEFAULT_MELEE_STATS;
  return {
    cost: def.staminaCost ?? 8,
    damage: def.damage ?? 10,
    range: def.range ?? 1.5,
    halfArc: (def.arcRad ?? 1.5) * 0.5,
    gore: def.goreStyle ?? ("splatter" as GoreStyle),
  };
}
