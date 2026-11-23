/** Authoritative overworld wildlife spawner, POI guards, and ecology step coordinator. */
import {
  AI_TUNING, BLEED_DURATION_SEC, GroundKind, WorldChunkCache, findTilePath, getPoiGuardRoster, hashUnit2d, isInSanctuary, isWithinSector, worldToChunkCoord,
  type ChunkPoi, type GoreStyle, type GoreSubstance, type GroundLootSnapshot, type WorldChestSnapshot, type WorldEntitySnapshot, type WorldEvent,
} from "@dc2d/engine";
import type { CombatPlayerRef } from "../combatActions.js";
import { stepWildlifeEntity } from "./creatureAi.js";
import { applyKnockbackImpulse, clearNavPath, isClearSpot } from "./creatureNavigation.js";
import { hasSpiderCover, isScavengeLootId, type CombatPlayerCandidate, type EcologyFoodSource, type StrikePlayerFn } from "./creatureBehaviors.js";
import { CREATURE_SPECS, ST_ALERT, ST_DEAD, ST_RETURN, createWildlifeEntity, type CreatureArchetypeSpec, type WildlifeEntity, type WildlifeKind } from "./creatureSpecs.js";
import { LootManager } from "./lootManager.js";
import { ScentTrail } from "./scentTrail.js";

const KIND_SLIME: WildlifeKind = "slime";
const BLEED_SUBSTANCES = new Set<GoreSubstance>(["blood", "slime", "ichor"]);

function applyWildlifeBleed(e: WildlifeEntity, substance: GoreSubstance, goreStyle: GoreStyle): void {
  if (!BLEED_SUBSTANCES.has(substance)) return;
  if (goreStyle === "drip") { e.bleedTimer = BLEED_DURATION_SEC; return; }
  if (e.hp <= e.maxHp * 0.5) e.bleedTimer = Math.max(e.bleedTimer, BLEED_DURATION_SEC * 0.85);
}

function resolveWildlifeGore(opts: {
  readonly e: WildlifeEntity; readonly spec: CreatureArchetypeSpec;
  readonly fatal: boolean; readonly goreStyle: GoreStyle; readonly comboStep?: number | undefined;
}): GoreStyle {
  if (!opts.fatal) return opts.goreStyle;
  if (opts.e.kind === KIND_SLIME) return "explode-away";
  return opts.comboStep === 3 ? "chunk-spray" : opts.spec.fatalStyle;
}

function isGuardSpotOpen(cache: WorldChunkCache, poi: ChunkPoi, pt: { readonly x: number; readonly y: number }): boolean {
  if (cache.tileAt(pt.x, pt.y).elevation !== poi.elevation || !isClearSpot(cache, { x: pt.x, y: pt.y, pad: 0.38 })) return false;
  return findTilePath({ cache, startX: pt.x, startY: pt.y, goalX: poi.centerX, goalY: poi.centerY + poi.radiusY - 0.4, maxRadiusTiles: 12 }).reachedGoal;
}

function findClearGuardSpot(cache: WorldChunkCache, poi: ChunkPoi, raw: { readonly x: number; readonly y: number }): { readonly x: number; readonly y: number } {
  const yardY = poi.centerY + 0.6;
  for (const pull of [0, 0.28, 0.55, 0.8]) {
    const pt = { x: raw.x + (poi.centerX - raw.x) * pull, y: raw.y + (yardY - raw.y) * pull };
    if (isGuardSpotOpen(cache, poi, pt)) return pt;
  }
  const fallback = { x: poi.centerX, y: poi.centerY + Math.min(1.8, Math.max(0.8, poi.radiusY - 0.8)) };
  return isClearSpot(cache, { ...fallback, pad: 0.34 }) ? fallback : { x: poi.centerX, y: poi.centerY + 1.8 };
}

export class WorldEcology {
  readonly list: WildlifeEntity[] = [];
  private readonly loot: LootManager;
  private readonly spawnedChunks = new Set<string>();
  private readonly scent = new ScentTrail();
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

  spawnEntity(opts: {
    readonly kind: WildlifeKind; readonly x: number; readonly y: number;
    readonly homeRadius: number; readonly poiId: string | null; readonly packId: string | null; readonly packSlot: number;
  }): WildlifeEntity {
    const elev = this.cache.tileAt(Math.floor(opts.x), Math.floor(opts.y)).elevation;
    const e = createWildlifeEntity({ id: `mob-${this.nextId++}`, elevation: elev, ...opts });
    this.list.push(e);
    return e;
  }

  damageEntity(opts: {
    readonly entity: WildlifeEntity; readonly damage: number; readonly dirX: number; readonly dirY: number;
    readonly goreStyle: GoreStyle; readonly comboStep?: number | undefined; readonly sweepDir?: number | undefined;
    readonly actorId: string; readonly events: WorldEvent[];
  }): boolean {
    const e = opts.entity;
    if (e.corpse || e.hp <= 0) return false;
    const spec = CREATURE_SPECS[e.kind];
    e.hp = Math.max(0, e.hp - opts.damage);
    e.hitTimer = 0.24;
    e.alertedTimer = 6.0;
    e.provokedTimer = 5.0;
    if (e.aiState === ST_RETURN) { e.aiState = ST_ALERT; clearNavPath(e); }
    e.lastKnownX = e.x - opts.dirX * 1.5;
    e.lastKnownY = e.y - opts.dirY * 1.5;
    this.alertAllies(e);
    const fatal = e.hp <= 0;
    if (!fatal) {
      applyKnockbackImpulse(e, { dirX: opts.dirX, dirY: opts.dirY, force: opts.damage >= 22 ? 8.0 : 6.4 });
      e.staggerTimer = Math.max(e.staggerTimer, Math.max(0.03, 0.13 * (1 - spec.knockbackResist * 0.75)));
      applyWildlifeBleed(e, spec.substance, opts.goreStyle);
    }
    const goreStyle = resolveWildlifeGore({ e, spec, fatal, goreStyle: opts.goreStyle, comboStep: opts.comboStep });
    opts.events.push({
      kind: "hit", x: e.x, y: e.y, dirX: opts.dirX, dirY: opts.dirY, value: opts.damage,
      actorId: opts.actorId, targetId: e.id, comboStep: opts.comboStep, sweepDir: opts.sweepDir,
      goreStyle, substance: spec.substance, fatal,
    });
    if (fatal) this.finalizeDeath(e);
    return true;
  }

  private alertAllies(source: WildlifeEntity): void {
    for (const other of this.list) {
      if (other.corpse || other.id === source.id) continue;
      const sameGroup = (source.packId && other.packId === source.packId) || (source.poiId && other.poiId === source.poiId);
      if (sameGroup) {
        other.alertedTimer = 6.0;
        other.lastKnownX = source.lastKnownX;
        other.lastKnownY = source.lastKnownY;
      }
    }
  }

  private finalizeDeath(e: WildlifeEntity): void {
    e.corpse = true;
    e.aiState = ST_DEAD;
    e.telegraphTimer = 0;
    e.corpseTimer = e.kind === KIND_SLIME ? 0.35 : AI_TUNING.corpseDurationSec;
    CREATURE_SPECS[e.kind].lootDrops.forEach((drop, idx) => {
      const span = drop.max - drop.min + 1;
      const count = drop.min + Math.floor(Math.random() * span);
      if (count <= 0) return;
      const ang = idx * 2.1 + Math.random();
      this.loot.spawnLoot({ itemId: drop.itemId, count, x: e.x, y: e.y, vx: Math.cos(ang) * 1.8, vy: Math.sin(ang) * 1.8 });
    });
  }

  openChest(player: CombatPlayerRef, chestId: string | undefined, events: WorldEvent[]): string | null {
    return this.loot.openChest(player, chestId, events);
  }

  transferChest(player: CombatPlayerRef, req: Parameters<LootManager["transferChest"]>[1]): boolean {
    return this.loot.transferChest(player, req);
  }

  takeAllChest(player: CombatPlayerRef, chestId: string, events: WorldEvent[]): number {
    return this.loot.takeAllChest(player, chestId, events);
  }

  debugSpawnNearPlayer(player: { readonly x: number; readonly y: number; readonly facingX: number; readonly facingY: number }, kind: WildlifeKind, count = 1): void {
    const mag = Math.max(0.01, Math.hypot(player.facingX, player.facingY));
    const nx = player.facingX / mag;
    const ny = player.facingY / mag;
    const packId = count > 1 ? `dbg-${this.nextId}` : null;
    for (let i = 0; i < Math.min(5, Math.max(1, count)); i++) {
      const spawned = this.spawnEntity({ kind, x: player.x + nx * 4.0 + (i - (count - 1) * 0.5) * 1.1, y: player.y + ny * 4.0 + (i % 2) * 0.6, homeRadius: 16, poiId: null, packId, packSlot: i });
      spawned.facingX = -nx;
      spawned.facingY = -ny;
    }
  }

  hitSector(opts: {
    readonly attacker: CombatPlayerRef; readonly dir: { readonly x: number; readonly y: number };
    readonly damage: number; readonly range: number; readonly halfArcRad: number;
    readonly goreStyle: GoreStyle; readonly comboStep?: number | undefined; readonly sweepDir?: number | undefined;
    readonly events: WorldEvent[];
  }): void {
    for (const e of this.list) {
      if (e.corpse || e.hp <= 0) continue;
      if (!isWithinSector({ origin: opts.attacker, dir: opts.dir, target: e, range: opts.range, halfArcRad: opts.halfArcRad })) continue;
      this.damageEntity({
        entity: e, damage: opts.damage, dirX: opts.dir.x, dirY: opts.dir.y, goreStyle: opts.goreStyle,
        comboStep: opts.comboStep, sweepDir: opts.sweepDir, actorId: opts.attacker.id, events: opts.events,
      });
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

  step(opts: {
    readonly dt: number; readonly timeSec: number; readonly dayPhase: number;
    readonly players: readonly (CombatPlayerRef & { readonly moving: boolean })[];
    readonly events: WorldEvent[]; readonly onStrike: StrikePlayerFn;
  }): void {
    this.pruneDistantEntities(opts.players);
    this.ensureAroundPlayers(opts.players);
    this.scent.step(opts.dt);
    this.scent.samplePlayers(opts.players.map((p) => ({ id: p.id, x: p.x, y: p.y, moving: p.moving, bleedTimer: p.combat.bleedTimer })));
    const foods: EcologyFoodSource[] = [
      ...this.list.filter((m) => m.corpse).map((m) => ({ x: m.x, y: m.y })),
      ...this.loot.groundLoot.filter((g) => isScavengeLootId(g.itemId)).map((g) => ({ x: g.x, y: g.y, isMeatLoot: true })),
    ];
    for (let i = this.list.length - 1; i >= 0; i--) {
      const keep = stepWildlifeEntity({
        cache: this.cache, e: this.list[i]!, allEntities: this.list, players: opts.players,
        foods, scent: this.scent, events: opts.events, timeSec: opts.timeSec, dayPhase: opts.dayPhase,
        dt: opts.dt, onStrike: opts.onStrike,
      });
      if (!keep) this.list.splice(i, 1);
    }
    this.loot.step(opts.players, opts.events, opts.dt);
  }

  snapshots(): { readonly entities: WorldEntitySnapshot[]; readonly chests: WorldChestSnapshot[]; readonly groundLoot: GroundLootSnapshot[] } {
    return {
      entities: this.list.map((e) => ({
        id: e.id, kind: e.kind, substance: e.substance, x: e.x, y: e.y, elevation: e.elevation, jumpZ: e.jumpZ,
        facingX: e.facingX, facingY: e.facingY, hp: e.hp, maxHp: e.maxHp, hitTimer: e.hitTimer,
        staggerTimer: e.staggerTimer, bleedTimer: e.bleedTimer, aiState: e.aiState, corpse: e.corpse,
        telegraphProgress: e.telegraphTimer > 0 ? Math.min(1, 1 - e.telegraphTimer / Math.max(0.05, e.windupDuration)) : 0,
      })),
      ...this.loot.snapshot(),
    };
  }
}
