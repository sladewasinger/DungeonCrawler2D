/** Authoritative world combat coordinator: 3-phase melee, heavy hold, dodge cancel, bow, and dummies. */
import { getItemDef, isMeleeItem } from "@dc2d/content";
import {
  COMBAT_TUNING, DODGE_COOLDOWN_SEC, DODGE_DURATION_SEC, DODGE_IFRAME_SEC, DODGE_STAMINA_COST,
  MELEE_FEEL_TUNING, STEALTH_TUNING, WorldChunkCache,
  consumeItemFromSlots, type DropItemRequest, type WorldEvent,
} from "@dc2d/engine";
import {
  forceRespawnPlayer, resolveDummyStrikeOnPlayer,
  stepCombatTimers, stepPlayerBurnTimer, stepPlayerPoisonTimer, stepPlayerRespawn, tryHealConsumable,
  type CombatPlayerRef, type RespawnSpot,
} from "./combatActions.js";
import { applyAdminAction, type AdminActionRequest } from "./combat/adminActions.js";
import {
  applyCreatureStrikeToPlayer, buildPlayerCombatExtras, clearSwingOnCancel, clearSwingOnStagger,
  computePlayerMoveMultiplier, runSwingActivePass, spawnChargedBowArrow, startTrackedMeleeSwing,
} from "./combat/combatSimHelpers.js";
import {
  advanceHeavyCharge, canDodgeCancelSwing, shouldHoldHeavyWindup, swingOverlapsActive,
} from "./combat/meleeTimeline.js";
import { createTrainingDummies, serializeDummies, stepTrainingDummies, type SimEntity } from "./dummySim.js";
import { takeDroppedPlayerItem } from "./playerInventory.js";
import { CampStructureManager } from "./survival/campStructures.js";
import { ResourceHarvester } from "./survival/resourceHarvester.js";
import { WorldWebNetwork } from "./webs/webNetwork.js";
import { stepPlayerWebAndCocoonTimers } from "./webs/webCocoon.js";
import { type WildlifeEntity } from "./wildlife/creatureSpecs.js";
import {
  createPebbleProjectile, createWebProjectile, serializeProjectiles, stepProjectileList, type SimProjectile,
} from "./wildlife/projectileSim.js";
import { WorldEcology } from "./wildlife/worldEcology.js";

export { buildPlayerCombatExtras as playerCombatExtras };

export interface CombatStepRequest {
  readonly player: CombatPlayerRef & { attackFlashTimer?: number };
  readonly players: Map<string, CombatPlayerRef>;
  readonly playerName?: string | undefined;
  readonly respawnPos?: RespawnSpot | null | undefined;
  readonly input: CombatInputFlags;
  readonly dt: number;
}

export interface CombatInputFlags {
  readonly moveX: number; readonly moveY: number;
  readonly dodgeDirX?: number | undefined; readonly dodgeDirY?: number | undefined;
  readonly attackQueued: boolean; readonly attackHold?: boolean | undefined;
  readonly bowDrawing: boolean; readonly bowReleaseQueued: boolean;
  readonly blockHeld: boolean; readonly dodgeQueued: boolean;
  readonly throwPebble?: boolean | undefined; readonly interactQueued?: boolean;
}

const isTrappedOrDrowning = (p: CombatPlayerRef): boolean =>
  p.inDeepWater || p.combat.cocoonProgress > 0 || p.combat.webStick >= MELEE_FEEL_TUNING.webStuckThreshold;

export class CombatWorld {
  readonly dummies: SimEntity[];
  readonly ecology: WorldEcology;
  readonly harvester = new ResourceHarvester();
  readonly structures = new CampStructureManager();
  readonly webs = new WorldWebNetwork();
  private readonly projectiles: SimProjectile[] = [];
  private events: WorldEvent[] = [];
  private nextProjId = 1;
  private simTimeSec = 0;

  constructor(private readonly cache: WorldChunkCache) {
    this.dummies = createTrainingDummies(cache);
    this.ecology = new WorldEcology(cache);
  }

  stepPlayerAction(req: CombatStepRequest): void {
    const { player: p, players, input, dt } = req;
    const playerName = req.playerName ?? p.id;
    if (stepPlayerRespawn(p, this.events, { dt, spot: req.respawnPos })) return;
    stepCombatTimers(p, input.blockHeld, dt);
    stepPlayerBurnTimer(p, dt, this.events);
    stepPlayerPoisonTimer(p, dt, this.events);
    stepPlayerWebAndCocoonTimers({ p, dt, events: this.events, webs: this.webs });
    if (p.combat.staggerTimer > 0) { clearSwingOnStagger(p); return; }
    if (input.interactQueued) this.handleInteract(p, playerName);
    this.handleDodgeOrBuffer(p, input);
    if (input.throwPebble) this.throwPebble(p, false);
    this.stepActiveSwingTimeline({ p, players, input, dt });
    this.stepOffense({ p, input, dt, playerName });
  }

  private handleInteract(p: CombatPlayerRef, playerName: string): void {
    if (this.ecology.openChest(p, undefined, this.events)) return;
    if (this.ecology.pickupManualLoot(p, undefined, this.events)) return;
    this.structures.bindNearestBed({ player: p, playerName, events: this.events });
  }

  pickupLoot(p: CombatPlayerRef, lootId?: string): boolean { return this.ecology.pickupManualLoot(p, lootId, this.events); }

  dropPlayerItem(p: CombatPlayerRef, req: DropItemRequest): boolean {
    if (req.source === "chest") {
      if (!req.chestId || req.slotIndex === undefined) return false;
      return this.ecology.loot.dropFromChest(p, { chestId: req.chestId, slotIndex: req.slotIndex, count: req.count });
    }
    const res = takeDroppedPlayerItem(p.inventory, req);
    if (!res) return false;
    p.inventory = res.nextState;
    this.ecology.loot.spawnPlayerDrop(p, res.item);
    return true;
  }

  private handleDodgeOrBuffer(p: CombatPlayerRef, input: CombatInputFlags): void {
    if (!input.dodgeQueued || isTrappedOrDrowning(p)) return;
    const c = p.combat;
    if (c.pendingSwing && canDodgeCancelSwing(c.pendingSwing)) {
      clearSwingOnCancel(p);
      this.startInputDodge(p, input);
      return;
    }
    if (c.swingTimer > 0 || c.pendingSwing) {
      c.bufferedAction = { kind: "dodge", expiresSec: this.simTimeSec + MELEE_FEEL_TUNING.inputBufferSec, dodgeDirX: input.dodgeDirX, dodgeDirY: input.dodgeDirY };
      return;
    }
    this.startInputDodge(p, input);
  }

  private startInputDodge(p: CombatPlayerRef, input: Pick<CombatInputFlags, "moveX" | "moveY" | "dodgeDirX" | "dodgeDirY">): void {
    const hasDir = input.dodgeDirX !== undefined && input.dodgeDirY !== undefined;
    this.tryStartDodge(p, hasDir ? input.dodgeDirX! : input.moveX, hasDir ? input.dodgeDirY! : input.moveY);
  }

  respawnPlayerNow(p: CombatPlayerRef, spot?: RespawnSpot | null): void { forceRespawnPlayer(p, this.events, spot); }
  placeStructure(opts: { readonly player: CombatPlayerRef; readonly playerName: string; readonly itemId: string; readonly x: number; readonly y: number }): boolean {
    return Boolean(this.structures.placeStructure({ ...opts, cache: this.cache, loot: this.ecology.loot, events: this.events }));
  }
  setRespawnBed(opts: { readonly player: CombatPlayerRef; readonly playerName: string; readonly structureId: string }): boolean {
    return this.structures.bindNearestBed({ ...opts, events: this.events });
  }

  private stepActiveSwingTimeline(opts: {
    readonly p: CombatPlayerRef; readonly players: Map<string, CombatPlayerRef>; readonly input: CombatInputFlags; readonly dt: number;
  }): void {
    const { p, players, input, dt } = opts;
    const c = p.combat;
    const sw = c.pendingSwing;
    if (!sw) { this.flushBufferedAction(p, input); return; }
    if (shouldHoldHeavyWindup(sw, Boolean(input.attackHold), dt)) {
      advanceHeavyCharge({ state: c, swing: sw, dt, pos: p, events: this.events });
      return;
    }
    const prev = sw.elapsedSec;
    sw.elapsedSec = Math.min(sw.durationSec, prev + dt);
    c.swingTimer = Math.max(0, sw.durationSec - sw.elapsedSec);
    if (swingOverlapsActive({ swing: sw, prevElapsed: prev, nextElapsed: sw.elapsedSec })) {
      runSwingActivePass({ cache: this.cache, p, players, dummies: this.dummies, ecology: this.ecology, harvester: this.harvester, webs: this.webs, sw, timeSec: this.simTimeSec, events: this.events });
    }
    if (sw.elapsedSec >= sw.durationSec - 1e-6) {
      c.pendingSwing = null; c.swingTimer = 0; c.heavyCharge = 0;
      this.flushBufferedAction(p, input);
    }
  }

  private tryConsumeDodgeBuffer(p: CombatPlayerRef, input: CombatInputFlags): boolean {
    const buf = p.combat.bufferedAction;
    if (!buf || buf.kind !== "dodge" || p.inDeepWater || p.combat.dodgeCooldown > 0) return false;
    p.combat.bufferedAction = null;
    this.startInputDodge(p, { moveX: input.moveX, moveY: input.moveY, dodgeDirX: buf.dodgeDirX, dodgeDirY: buf.dodgeDirY });
    return true;
  }

  private tryConsumeAttackBuffer(p: CombatPlayerRef): void {
    const heldId = p.inventory.slots[p.selectedHotbar]?.itemId ?? null;
    if (!isMeleeItem(heldId) || heldId === "bow") { p.combat.bufferedAction = null; return; }
    if (startTrackedMeleeSwing({ p, heldId, events: this.events })) p.combat.bufferedAction = null;
  }

  private flushBufferedAction(p: CombatPlayerRef, input: CombatInputFlags): void {
    const buf = p.combat.bufferedAction;
    if (!buf) return;
    if (this.simTimeSec > buf.expiresSec) { p.combat.bufferedAction = null; return; }
    if (!this.tryConsumeDodgeBuffer(p, input) && buf.kind === "attack") this.tryConsumeAttackBuffer(p);
  }

  private stepOffense(opts: {
    readonly p: CombatPlayerRef & { attackFlashTimer?: number }; readonly input: CombatInputFlags; readonly dt: number; readonly playerName: string;
  }): void {
    const { p, input, dt, playerName } = opts;
    const heldId = p.inventory.slots[p.selectedHotbar]?.itemId ?? null;
    if (heldId === "bow") { this.stepBowAction(p, input, dt); return; }
    p.combat.bowCharge = 0;
    if (!input.attackQueued || this.tryItemAction(p, heldId, playerName) || !isMeleeItem(heldId)) return;
    if (startTrackedMeleeSwing({ p, heldId, events: this.events })) return;
    p.combat.bufferedAction = { kind: "attack", expiresSec: this.simTimeSec + MELEE_FEEL_TUNING.inputBufferSec };
  }

  private tryItemAction(p: CombatPlayerRef, heldId: string | null, playerName: string): boolean {
    if (!heldId) return false;
    if (heldId === "stone") return this.throwPebble(p, true);
    if (getItemDef(heldId)?.placeStructure) return this.placeStructure({ player: p, playerName, itemId: heldId, x: p.x + p.aimX * 1.5, y: p.y + p.aimY * 1.5 });
    return tryHealConsumable(p, heldId, this.events);
  }

  private throwPebble(p: CombatPlayerRef, consumeStone: boolean): boolean {
    if (p.combat.pebbleCooldown > 0 || (consumeStone && !consumeItemFromSlots(p.inventory.slots, "stone", 1))) return false;
    p.combat.pebbleCooldown = STEALTH_TUNING.pebbleCooldownSec;
    this.projectiles.push(createPebbleProjectile({ id: `p${this.nextProjId++}`, p, cache: this.cache, consumeStone }));
    return true;
  }

  stepWorld(opts: { readonly players: Map<string, CombatPlayerRef>; readonly dt: number; readonly dayPhase: number; readonly timeSec: number }): void {
    const { players, dt, dayPhase, timeSec } = opts;
    this.simTimeSec = timeSec;
    this.harvester.stepRegrowth(timeSec, this.cache);
    const targets = Array.from(players.values());
    stepTrainingDummies({
      dummies: this.dummies, dt, players: targets, events: this.events,
      onStrike: (entity, target, dmg) => {
        const hitPlayer = players.get(target.id);
        if (hitPlayer) resolveDummyStrikeOnPlayer({ entity, target: hitPlayer, damage: dmg, events: this.events });
      },
    });
    this.webs.step({ cache: this.cache, players: targets, dt });
    this.ecology.step({
      dt, timeSec, dayPhase,
      players: targets.filter((p) => p.combat.respawnTimer <= 0).map((p) => Object.assign(p, { moving: Boolean(p.moving) })),
      events: this.events,
      onStrike: (entity, target) => this.handleCreatureStrike(players, entity, target.id),
      spawnWeb: (spider, target) => this.projectiles.push(createWebProjectile({ id: `p${this.nextProjId++}`, spider, targetX: target.x, targetY: target.y })),
    });
    stepProjectileList({ cache: this.cache, projectiles: this.projectiles, dummies: this.dummies, ecology: this.ecology, players, events: this.events, webs: this.webs, dt });
  }

  private handleCreatureStrike(players: Map<string, CombatPlayerRef>, entity: WildlifeEntity, targetId: string): void {
    applyCreatureStrikeToPlayer({ hitPlayer: players.get(targetId), entity, events: this.events });
  }

  moveMultiplier(p: CombatPlayerRef): number { return computePlayerMoveMultiplier(p); }
  pushEvent(ev: WorldEvent): void { this.events.push(ev); }
  snapshots() {
    const eco = this.ecology.snapshots(); const webs = this.webs.snapshot();
    return { entities: [...serializeDummies(this.dummies), ...eco.entities], projectiles: serializeProjectiles(this.projectiles), chests: eco.chests, groundLoot: eco.groundLoot, ...(webs ? { webs } : {}) };
  }
  drainEvents(): WorldEvent[] { const out = this.events; this.events = []; return out; }
  debugSpawnNearPlayer(p: CombatPlayerRef, kind: Parameters<WorldEcology["debugSpawnNearPlayer"]>[1], count = 1): void { this.ecology.debugSpawnNearPlayer(p, kind, count); }
  handleAdminAction(p: CombatPlayerRef, req: AdminActionRequest): boolean { return applyAdminAction({ player: p, webs: this.webs, events: this.events, req }); }
  handleChestRequest(p: CombatPlayerRef, req: { readonly t: "openChest" | "chestTransfer" | "chestTakeAll"; readonly chestId: string; readonly from?: "chest" | "inv"; readonly fromSlot?: number; readonly to?: "chest" | "inv"; readonly toSlot?: number; readonly quick?: boolean | undefined }): void {
    if (req.t === "openChest") this.ecology.openChest(p, req.chestId, this.events);
    else if (req.t === "chestTransfer") this.ecology.transferChest(p, req as Parameters<WorldEcology["transferChest"]>[1]);
    else this.ecology.takeAllChest(p, req.chestId, this.events);
  }

  private tryStartDodge(p: CombatPlayerRef, moveX: number, moveY: number): void {
    const c = p.combat;
    if (c.dodgeCooldown > 0 || c.dodgeTimer > 0 || (!c.godMode && c.stamina < DODGE_STAMINA_COST)) return;
    if (!c.godMode) c.stamina -= DODGE_STAMINA_COST;
    c.dodgeTimer = DODGE_DURATION_SEC; c.invulnTimer = DODGE_IFRAME_SEC; c.dodgeCooldown = DODGE_COOLDOWN_SEC;
    c.bowCharge = 0; c.blocking = false;
    const mag = Math.hypot(moveX, moveY);
    c.dodgeDirX = mag > 0.05 ? moveX / mag : p.facingX;
    c.dodgeDirY = mag > 0.05 ? moveY / mag : p.facingY;
    this.events.push({ kind: "dodge", x: p.x, y: p.y, dirX: c.dodgeDirX, dirY: c.dodgeDirY, actorId: p.id });
  }

  private stepBowAction(p: CombatPlayerRef & { attackFlashTimer?: number }, input: CombatInputFlags, dt: number): void {
    const c = p.combat;
    if (c.dodgeTimer > 0 || c.actionCooldown > 0) return;
    if (input.bowDrawing) { c.bowCharge = Math.min(COMBAT_TUNING.bow.maxChargeSec, c.bowCharge + dt); return; }
    if (!input.bowReleaseQueued && c.bowCharge <= 0) return;
    const chargeSec = c.bowCharge; c.bowCharge = 0;
    this.fireArrow(p, chargeSec);
  }

  private fireArrow(p: CombatPlayerRef & { attackFlashTimer?: number }, chargeSec: number): void {
    if ((!p.combat.godMode && p.combat.stamina < 10) || !consumeItemFromSlots(p.inventory.slots, "arrow", 1)) return;
    spawnChargedBowArrow({ p, chargeSec, projId: `p${this.nextProjId++}`, projectiles: this.projectiles, ecology: this.ecology, events: this.events });
  }
}
