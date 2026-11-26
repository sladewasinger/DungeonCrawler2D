/** Authoritative Valheim-lite camp structure placement, chests, and custom bed respawn registry. */
import { getItemDef } from "@dc2d/content";
import {
  WorldChunkCache, canPlaceStructure, consumeItemFromSlots,
  type PlacedStructureRecord, type WorldEvent,
} from "@dc2d/engine";
import type { CombatPlayerRef } from "../combatActions.js";
import type { LootManager } from "../wildlife/lootManager.js";

export interface SavedBedBinding {
  readonly ownerKey: string;
  readonly structureId: string;
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
}

export const normalizeOwnerKey = (name: string): string => name.trim().toLowerCase() || "traveler";

const MAX_STRUCTURES_PER_OWNER = 64;
const BED_WARD_RADIUS = 4;

export class CampStructureManager {
  private readonly structures = new Map<string, PlacedStructureRecord>();
  private readonly ownerAccountIds = new Map<string, string>();
  private readonly bedsByOwner = new Map<string, SavedBedBinding>();
  private nextId = 1;

  private ownerKeyOf(s: PlacedStructureRecord): string {
    return this.ownerAccountIds.get(s.id) ?? s.ownerName;
  }

  private countStructuresForOwner(ownerKey: string): number {
    let total = 0;
    for (const s of this.structures.values()) {
      if (this.ownerKeyOf(s) === ownerKey) total += 1;
    }
    return total;
  }

  private nearForeignBed(opts: { readonly x: number; readonly y: number; readonly ownerKey: string }): boolean {
    for (const s of this.structures.values()) {
      if (s.kind !== "bed" || this.ownerKeyOf(s) === opts.ownerKey) continue;
      if (Math.hypot(opts.x - s.x, opts.y - s.y) <= BED_WARD_RADIUS) return true;
    }
    return false;
  }

  private canAcceptPlacement(opts: {
    readonly player: CombatPlayerRef; readonly x: number; readonly y: number; readonly cache: WorldChunkCache;
    readonly ownerKey: string; readonly kind: PlacedStructureRecord["kind"]; readonly itemId: string;
  }): boolean {
    if (this.countStructuresForOwner(opts.ownerKey) >= MAX_STRUCTURES_PER_OWNER) return false;
    if (this.nearForeignBed({ x: opts.x, y: opts.y, ownerKey: opts.ownerKey })) return false;
    const valid = canPlaceStructure({
      cache: opts.cache, x: opts.x, y: opts.y,
      playerX: opts.player.x, playerY: opts.player.y, playerElev: opts.player.elevation, kind: opts.kind,
    });
    return valid && consumeItemFromSlots(opts.player.inventory.slots, opts.itemId, 1);
  }

  placeStructure(opts: {
    readonly player: CombatPlayerRef; readonly playerName: string; readonly accountId?: string | undefined; readonly itemId: string;
    readonly x: number; readonly y: number; readonly cache: WorldChunkCache; readonly loot: LootManager;
    readonly events: WorldEvent[];
  }): PlacedStructureRecord | null {
    const kind = getItemDef(opts.itemId)?.placeStructure;
    const ownerKey = opts.accountId ?? normalizeOwnerKey(opts.playerName);
    if (!kind || !this.canAcceptPlacement({ ...opts, ownerKey, kind })) return null;
    const rec: PlacedStructureRecord = {
      id: `struct-${this.nextId++}`, kind, itemId: opts.itemId, x: opts.x, y: opts.y,
      elevation: opts.player.elevation, ownerName: normalizeOwnerKey(opts.playerName),
    };
    this.registerStructure({ rec, cache: opts.cache, loot: opts.loot, ownerKey });
    opts.events.push({ kind: "placeStructure", x: rec.x, y: rec.y, actorId: opts.player.id });
    if (kind === "bed") this.bindBedRecord({ player: opts.player, ownerKey, rec, events: opts.events });
    return rec;
  }

  private registerStructure(opts: {
    readonly rec: PlacedStructureRecord; readonly cache: WorldChunkCache; readonly loot: LootManager; readonly ownerKey?: string | undefined;
  }): void {
    const { rec, cache, loot, ownerKey } = opts;
    this.structures.set(rec.id, rec);
    if (ownerKey) this.ownerAccountIds.set(rec.id, ownerKey);
    cache.addPlacedStructure(rec);
    if (rec.kind === "wood-chest") loot.registerCustomChest({ id: rec.id, x: rec.x, y: rec.y, elevation: rec.elevation });
  }

  private bindBedRecord(opts: {
    readonly player: CombatPlayerRef; readonly ownerKey: string; readonly rec: PlacedStructureRecord; readonly events: WorldEvent[];
  }): void {
    this.bedsByOwner.set(opts.ownerKey, { ownerKey: opts.ownerKey, structureId: opts.rec.id, x: opts.rec.x, y: opts.rec.y, elevation: opts.rec.elevation });
    opts.events.push({ kind: "bedSet", x: opts.rec.x, y: opts.rec.y, actorId: opts.player.id });
  }

  private matchesBedTarget(s: PlacedStructureRecord, structureId: string | undefined): boolean {
    if (s.kind !== "bed") return false;
    return !structureId || s.id === structureId;
  }

  bindNearestBed(opts: {
    readonly player: CombatPlayerRef; readonly playerName: string; readonly accountId?: string | undefined;
    readonly structureId?: string | undefined; readonly events: WorldEvent[];
  }): boolean {
    let best: PlacedStructureRecord | null = null;
    let bestDist = 2.6;
    for (const s of this.structures.values()) {
      if (!this.matchesBedTarget(s, opts.structureId)) continue;
      const d = Math.hypot(s.x - opts.player.x, s.y - opts.player.y);
      if (d <= bestDist) { bestDist = d; best = s; }
    }
    if (!best) return false;
    const ownerKey = opts.accountId ?? normalizeOwnerKey(opts.playerName);
    this.bindBedRecord({ player: opts.player, ownerKey, rec: best, events: opts.events });
    return true;
  }

  respawnPointFor(ownerOrName: string): { readonly x: number; readonly y: number; readonly elevation: number } | null {
    const bound = this.bedsByOwner.get(ownerOrName) ?? this.bedsByOwner.get(normalizeOwnerKey(ownerOrName));
    if (!bound || !this.structures.has(bound.structureId)) return null;
    return { x: bound.x, y: bound.y, elevation: bound.elevation };
  }

  hasBedFor(ownerOrName: string): boolean {
    return this.respawnPointFor(ownerOrName) !== null;
  }

  exportState(): { readonly structures: readonly PlacedStructureRecord[]; readonly beds: readonly SavedBedBinding[] } {
    return { structures: Array.from(this.structures.values()), beds: Array.from(this.bedsByOwner.values()) };
  }

  importState(opts: {
    readonly structures: readonly PlacedStructureRecord[]; readonly beds: readonly SavedBedBinding[];
    readonly cache: WorldChunkCache; readonly loot: LootManager;
  }): void {
    this.structures.clear();
    this.ownerAccountIds.clear();
    this.bedsByOwner.clear();
    let maxNum = 0;
    for (const s of opts.structures) {
      this.registerStructure({ rec: s, cache: opts.cache, loot: opts.loot });
      const parsed = Number(s.id.replace("struct-", ""));
      if (Number.isFinite(parsed) && parsed > maxNum) maxNum = parsed;
    }
    this.nextId = maxNum + 1;
    for (const b of opts.beds) {
      if (this.structures.has(b.structureId)) {
        this.bedsByOwner.set(b.ownerKey, b);
        this.ownerAccountIds.set(b.structureId, b.ownerKey);
      }
    }
  }
}
