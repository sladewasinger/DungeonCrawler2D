/** Authoritative overworld wildlife spawner, POI guards, and ecology step coordinator. */
import {
  AI_TUNING, GroundKind, MELEE_FEEL_TUNING, WorldChunkCache, getPoiGuardRoster, hashUnit2d, isInSanctuary, worldToChunkCoord,
  type ChunkPoi, type GoreStyle, type GroundLootSnapshot, type WeaponArchetype, type WorldChestSnapshot, type WorldEntitySnapshot, type WorldEvent,
} from "@dc2d/engine";
import type { CombatPlayerRef } from "../combatActions.js";
import { stepWildlifeEntity } from "./creatureAi.js";
import { hasSpiderCover, isScavengeLootId, type CombatPlayerCandidate, type EcologyFoodSource, type StrikePlayerFn } from "./creatureBehaviors.js";
import { CREATURE_SPECS, ST_DEAD, ST_INVESTIGATE, createWildlifeEntity, type WildlifeEntity, type WildlifeKind } from "./creatureSpecs.js";
import {
  UNAWARE_STATES, applyBackstabEvent, applyDamageToCreature, collectScavengeFoods, computeSectorStrike,
  findClearGuardSpot, isSectorTargetHit, serializeEntitySnapshot,
} from "./ecologyHelpers.js";
import { factionOfKind, isCreatureAggro, type CombatTarget } from "./factionTargeting.js";
import { LootManager } from "./lootManager.js";
import { ScentTrail } from "./scentTrail.js";
import { rallyWolfPack } from "./wolfPackAi.js";

const KIND_SLIME: WildlifeKind = "slime";

export class WorldEcology {
  readonly list: WildlifeEntity[] = [];
  readonly loot: LootManager;
  private readonly spawnedChunks = new Set<string>();
  private readonly scent = new ScentTrail();
  private activePlayers: readonly CombatPlayerCandidate[] = [];
  private nextId = 1;

  constructor(private readonly cache: WorldChunkCache) {
    this.loot = new LootManager(cache);
  }

  ensureAroundPlayers(players: readonly CombatPlayerCandidate[]): void {
    for (const p of players) {
      const pcx = Math.floor(p.x / 32);
      const pcy = Math.floor(p.y / 32);
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) this.spawnChunkIfNew(pcx + ox, pcy + oy);
      }
    }
  }

  private spawnChunkIfNew(cx: number, cy: number): void {
    const key = `${cx},${cy}`;
    if (this.spawnedChunks.has(key)) return;
    this.spawnedChunks.add(key);
    const chunk = this.cache.getChunk(cx, cy);
    for (const poi of chunk.pois) this.spawnPoiEncounter(poi);
    if (key !== "0,0") this.spawnChunkWildlife(cx, cy);
  }

  private spawnPoiEncounter(poi: ChunkPoi): void {
    this.loot.registerPoiChest(poi);
    const guards = getPoiGuardRoster(poi.layout);
    const rx = Math.max(1.8, poi.radiusX - 1.2);
    const ry = Math.max(1.8, poi.radiusY - 1.0);
    guards.forEach((kind, idx) => {
      const angle = (idx / guards.length) * Math.PI * 2;
      const ring = 0.55 + (idx % 2) * 0.35;
      const pos = findClearGuardSpot(this.cache, poi, {
        x: poi.centerX + Math.cos(angle) * rx * ring, y: poi.centerY + Math.sin(angle) * ry * ring,
      });
      this.spawnEntity({
        kind, x: pos.x, y: pos.y,
        homeRadius: Math.max(8, Math.max(poi.radiusX, poi.radiusY) + 5), poiId: poi.id, packId: poi.id, packSlot: idx,
      });
    });
  }

  private isValidWildlifeSpawn(wx: number, wy: number): boolean {
    if (isInSanctuary(wx, wy)) return false;
    const ground = this.cache.tileAt(Math.floor(wx), Math.floor(wy)).ground;
    return ground !== GroundKind.DeepWater && ground !== GroundKind.ShallowWater;
  }

  private pickSpawnKind(pick: WildlifeKind, wx: number, wy: number): WildlifeKind {
    return pick === "spider" && !hasSpiderCover(this.cache, wx, wy) ? "boar" : pick;
  }

  private spawnChunkWildlife(cx: number, cy: number): void {
    if (this.list.filter((e) => !e.corpse).length >= AI_TUNING.maxActiveWildlife) return;
    const kinds: readonly WildlifeKind[] = ["wolf", "boar", "bear", "spider", KIND_SLIME];
    const baseSeed = this.cache.worldSeed + cx * 73 + cy * 179;
    const rawPick = kinds[Math.floor(hashUnit2d(baseSeed, cx, cy) * kinds.length)] ?? "wolf";
    const wx = cx * 32 + 10 + hashUnit2d(baseSeed + 7, cx, cy) * 14;
    const wy = cy * 32 + 10 + hashUnit2d(baseSeed + 19, cx, cy) * 14;
    if (!this.isValidWildlifeSpawn(wx, wy)) return;
    const chosen = this.pickSpawnKind(rawPick, wx, wy);
    const count = chosen === "wolf" ? 3 : 1;
    const packId = chosen === "wolf" ? `pack:${cx},${cy}` : null;
    for (let i = 0; i < count; i++) {
      this.spawnEntity({ kind: chosen, x: wx + i * 0.85, y: wy + (i % 2) * 0.7, homeRadius: 11, poiId: null, packId, packSlot: i });
    }
  }

  spawnEntity(opts: { readonly kind: WildlifeKind; readonly x: number; readonly y: number; readonly homeRadius: number; readonly poiId: string | null; readonly packId: string | null; readonly packSlot: number }): WildlifeEntity {
    const elev = this.cache.tileAt(Math.floor(opts.x), Math.floor(opts.y)).elevation;
    const e = createWildlifeEntity({ id: `mob-${this.nextId++}`, elevation: elev, ...opts });
    this.list.push(e);
    return e;
  }

  private propagateHitAlerts(e: WildlifeEntity, silentFatal: boolean, events: WorldEvent[]): void {
    if (silentFatal) return;
    this.alertAllies(e);
    if (e.kind === "wolf") rallyWolfPack({ source: e, entities: this.list, events });
  }

  damageEntity(opts: {
    readonly entity: WildlifeEntity; readonly damage: number; readonly dirX: number; readonly dirY: number;
    readonly goreStyle: GoreStyle; readonly comboStep?: number | undefined; readonly sweepDir?: number | undefined;
    readonly actorId: string; readonly events: WorldEvent[]; readonly silentKill?: boolean;
    readonly players?: readonly CombatPlayerCandidate[] | undefined;
    readonly ignites?: boolean | undefined; readonly heavy?: boolean | undefined; readonly weaponArchetype?: WeaponArchetype | undefined;
    readonly hitstopSec?: number | undefined; readonly shakePx?: number | undefined; readonly knockbackMult?: number | undefined;
  }): boolean {
    const e = opts.entity;
    if (e.corpse || e.hp <= 0) return false;
    const { fatal } = applyDamageToCreature({ ...opts, list: this.list, players: opts.players ?? this.activePlayers });
    this.propagateHitAlerts(e, fatal && Boolean(opts.silentKill), opts.events);
    if (fatal) this.finalizeDeath(e);
    return true;
  }

  private shouldIgnoreNoise(e: WildlifeEntity, sourceId: string | undefined): boolean {
    return e.corpse || e.hp <= 0 || e.id === sourceId || isCreatureAggro(e) || e.provokedTimer > 0;
  }

  emitNoise(opts: { readonly x: number; readonly y: number; readonly radius: number; readonly sourceId?: string }): void {
    for (const e of this.list) {
      if (this.shouldIgnoreNoise(e, opts.sourceId) || !UNAWARE_STATES.has(e.aiState)) continue;
      if (Math.hypot(e.x - opts.x, e.y - opts.y) > opts.radius) continue;
      e.lastKnownX = opts.x; e.lastKnownY = opts.y; e.investigateTimer = 5.5; e.aiState = ST_INVESTIGATE;
    }
  }

  private isAllyMatch(source: WildlifeEntity, o: WildlifeEntity, myFaction: ReturnType<typeof factionOfKind>): boolean {
    if (o.corpse || o.id === source.id) return false;
    if ((source.packId && o.packId === source.packId) || (source.poiId && o.poiId === source.poiId)) return true;
    return factionOfKind(o.kind) === myFaction && Math.hypot(o.x - source.x, o.y - source.y) <= 9.0;
  }

  private alertAllies(source: WildlifeEntity): void {
    const myFaction = factionOfKind(source.kind);
    for (const o of this.list) {
      if (!this.isAllyMatch(source, o, myFaction)) continue;
      o.alertedTimer = 6.0; o.suspicion = 1.0;
      o.targetPlayerId = source.targetPlayerId; o.targetKind = source.targetKind;
      o.lastKnownX = source.lastKnownX; o.lastKnownY = source.lastKnownY;
      o.investigateTimer = Math.max(o.investigateTimer, 6.0);
    }
  }

  private finalizeDeath(e: WildlifeEntity): void {
    e.corpse = true; e.aiState = ST_DEAD; e.telegraphTimer = 0;
    e.targetPlayerId = null; e.targetKind = null; e.suspicion = 0;
    e.corpseTimer = e.kind === KIND_SLIME ? 0.35 : AI_TUNING.corpseDurationSec;
    CREATURE_SPECS[e.kind].lootDrops.forEach((drop, idx) => {
      const count = drop.min + Math.floor(Math.random() * (drop.max - drop.min + 1));
      if (count <= 0) return;
      const ang = idx * 2.1 + Math.random();
      this.loot.spawnLoot({ itemId: drop.itemId, count, x: e.x, y: e.y, vx: Math.cos(ang) * 1.8, vy: Math.sin(ang) * 1.8 });
    });
    if (e.embeddedArrows > 0) {
      this.loot.spawnLoot({ itemId: "arrow", count: e.embeddedArrows, x: e.x, y: e.y, vx: 0.7, vy: -0.7, manualPickup: true, angle: 0.35 });
      e.embeddedArrows = 0;
    }
  }

  spawnRecoverableArrow(opts: { readonly x: number; readonly y: number; readonly angle?: number | undefined; readonly stuck?: boolean | undefined }): void {
    this.loot.spawnLoot({ itemId: "arrow", count: 1, x: opts.x, y: opts.y, vx: 0, vy: 0, manualPickup: true, angle: opts.angle, stuck: opts.stuck });
  }
  pickupManualLoot(p: CombatPlayerRef, lootId: string | undefined, ev: WorldEvent[]): boolean { return this.loot.pickupManualLoot(p, lootId, ev); }
  openChest(p: CombatPlayerRef, cid: string | undefined, ev: WorldEvent[]): string | null { return this.loot.openChest(p, cid, ev); }
  transferChest(p: CombatPlayerRef, req: Parameters<LootManager["transferChest"]>[1]): boolean { return this.loot.transferChest(p, req); }
  takeAllChest(p: CombatPlayerRef, cid: string, ev: WorldEvent[]): number { return this.loot.takeAllChest(p, cid, ev); }

  debugSpawnNearPlayer(player: { readonly x: number; readonly y: number; readonly facingX: number; readonly facingY: number }, kind: WildlifeKind, count = 1): void {
    const mag = Math.max(0.01, Math.hypot(player.facingX, player.facingY));
    const nx = player.facingX / mag; const ny = player.facingY / mag;
    const packId = count > 1 ? `dbg-${this.nextId}` : null;
    for (let i = 0; i < Math.min(10, Math.max(1, count)); i++) {
      const s = this.spawnEntity({ kind, x: player.x + nx * 4 + (i - (count - 1) * 0.5) * 1.1, y: player.y + ny * 4 + (i % 2) * 0.6, homeRadius: 16, poiId: null, packId, packSlot: i });
      s.facingX = -nx; s.facingY = -ny;
    }
  }

  hitSector(opts: {
    readonly attacker: CombatPlayerRef; readonly dir: { readonly x: number; readonly y: number };
    readonly damage: number; readonly range: number; readonly halfArcRad: number;
    readonly goreStyle: GoreStyle; readonly comboStep?: number | undefined; readonly sweepDir?: number | undefined;
    readonly backstabMult?: number | undefined; readonly armorCrushMult?: number | undefined;
    readonly ignites?: boolean | undefined; readonly heavy?: boolean | undefined; readonly weaponArchetype?: WeaponArchetype | undefined;
    readonly hitstopSec?: number | undefined; readonly shakePx?: number | undefined; readonly knockbackMult?: number | undefined;
    readonly hitTargetIds?: Set<string> | undefined; readonly impactCenter?: { readonly x: number; readonly y: number } | undefined;
    readonly slamAoeRadius?: number | undefined; readonly events: WorldEvent[];
  }): void {
    for (const e of this.list) {
      if (!isSectorTargetHit({ e, ...opts })) continue;
      opts.hitTargetIds?.add(e.id);
      const { damage, sneakHit } = computeSectorStrike(opts.attacker, e, { baseDmg: opts.damage, backstabMult: opts.backstabMult, armorCrushMult: opts.armorCrushMult });
      applyBackstabEvent({ e, attackerId: opts.attacker.id, damage, sneakHit, events: opts.events });
      this.damageEntity({ ...opts, entity: e, damage, dirX: opts.dir.x, dirY: opts.dir.y, actorId: opts.attacker.id, silentKill: sneakHit, hitstopSec: sneakHit ? MELEE_FEEL_TUNING.backstabHitstopSec : opts.hitstopSec, shakePx: sneakHit ? MELEE_FEEL_TUNING.backstabShakePx : opts.shakePx });
    }
  }

  private pruneDistantEntities(players: readonly CombatPlayerCandidate[]): void {
    if (players.length === 0) return;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i]!;
      if (players.some((p) => Math.hypot(p.x - e.x, p.y - e.y) <= 96)) continue;
      this.list.splice(i, 1);
      this.spawnedChunks.delete(`${worldToChunkCoord(Math.floor(e.homeX))},${worldToChunkCoord(Math.floor(e.homeY))}`);
    }
  }

  private consumeFoodSource(food: EcologyFoodSource): void {
    if (food.lootId) {
      const idx = this.loot.groundLoot.findIndex((g) => g.id === food.lootId);
      if (idx >= 0) this.loot.groundLoot.splice(idx, 1);
      return;
    }
    const ent = food.entityId ? this.list.find((m) => m.id === food.entityId) : undefined;
    if (ent) ent.corpseTimer = Math.min(ent.corpseTimer, 0.2);
  }

  private resolveEntityHit(opts: {
    readonly att: WildlifeEntity; readonly target: CombatTarget; readonly events: WorldEvent[]; readonly onPlayerStrike: StrikePlayerFn;
  }): void {
    const { att, target, events, onPlayerStrike } = opts;
    if (target.targetKind === "entity" && target.entityRef) {
      const spec = CREATURE_SPECS[att.kind];
      const mag = Math.max(0.01, Math.hypot(target.x - att.x, target.y - att.y));
      this.damageEntity({
        entity: target.entityRef, damage: spec.damage, dirX: (target.x - att.x) / mag,
        dirY: (target.y - att.y) / mag, goreStyle: spec.goreStyle, actorId: att.id, events,
      });
      return;
    }
    onPlayerStrike(att, target);
  }

  step(opts: {
    readonly dt: number; readonly timeSec: number; readonly dayPhase: number;
    readonly players: readonly (CombatPlayerRef & { readonly moving: boolean })[];
    readonly events: WorldEvent[]; readonly onStrike: StrikePlayerFn;
    readonly spawnWeb?: ((spider: WildlifeEntity, target: CombatTarget) => void) | undefined;
  }): void {
    this.activePlayers = opts.players;
    this.pruneDistantEntities(opts.players);
    this.ensureAroundPlayers(opts.players);
    this.scent.step(opts.dt);
    this.scent.samplePlayers(opts.players.map((p) => ({ id: p.id, x: p.x, y: p.y, moving: p.moving, bleedTimer: p.combat.bleedTimer })));
    const foods = collectScavengeFoods(this.list, this.loot.groundLoot, isScavengeLootId);
    const onConsumeFood = (food: EcologyFoodSource) => this.consumeFoodSource(food);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const keep = stepWildlifeEntity({
        cache: this.cache, e: this.list[i]!, allEntities: this.list, players: opts.players, foods,
        onConsumeFood, scent: this.scent, events: opts.events, timeSec: opts.timeSec, dayPhase: opts.dayPhase, dt: opts.dt,
        onStrike: (att, target) => this.resolveEntityHit({ att, target, events: opts.events, onPlayerStrike: opts.onStrike }),
        onBurnKill: (ent) => this.finalizeDeath(ent), spawnWeb: opts.spawnWeb,
      });
      if (!keep) this.list.splice(i, 1);
    }
    this.loot.step(opts.players, opts.events, opts.dt);
  }

  snapshots(): { readonly entities: WorldEntitySnapshot[]; readonly chests: WorldChestSnapshot[]; readonly groundLoot: GroundLootSnapshot[] } {
    return { entities: this.list.map(serializeEntitySnapshot), ...this.loot.snapshot() };
  }
}
