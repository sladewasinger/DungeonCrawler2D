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

export class CampStructureManager {
  private readonly structures = new Map<string, PlacedStructureRecord>();
  private readonly bedsByOwner = new Map<string, SavedBedBinding>();
  private nextId = 1;

  placeStructure(opts: {
    readonly player: CombatPlayerRef; readonly playerName: string; readonly itemId: string;
    readonly x: number; readonly y: number; readonly cache: WorldChunkCache; readonly loot: LootManager;
    readonly events: WorldEvent[];
  }): PlacedStructureRecord | null {
    const def = getItemDef(opts.itemId);
    const kind = def?.placeStructure;
    if (!kind) return null;
    const valid = canPlaceStructure({
      cache: opts.cache, x: opts.x, y: opts.y,
      playerX: opts.player.x, playerY: opts.player.y, playerElev: opts.player.elevation, kind,
    });
    if (!valid || !consumeItemFromSlots(opts.player.inventory.slots, opts.itemId, 1)) return null;
    const rec: PlacedStructureRecord = {
      id: `struct-${this.nextId++}`, kind, itemId: opts.itemId, x: opts.x, y: opts.y,
      elevation: opts.player.elevation, ownerName: normalizeOwnerKey(opts.playerName),
    };
    this.registerStructure(rec, opts.cache, opts.loot);
    opts.events.push({ kind: "placeStructure", x: rec.x, y: rec.y, actorId: opts.player.id });
    if (kind === "bed") this.bindBedRecord({ player: opts.player, playerName: opts.playerName, rec, events: opts.events });
    return rec;
  }

  private registerStructure(rec: PlacedStructureRecord, cache: WorldChunkCache, loot: LootManager): void {
    this.structures.set(rec.id, rec);
    cache.addPlacedStructure(rec);
    if (rec.kind === "wood-chest") {
      loot.registerCustomChest({ id: rec.id, x: rec.x, y: rec.y, elevation: rec.elevation });
    }
  }

  private bindBedRecord(opts: {
    readonly player: CombatPlayerRef; readonly playerName: string; readonly rec: PlacedStructureRecord; readonly events: WorldEvent[];
  }): void {
    const ownerKey = normalizeOwnerKey(opts.playerName);
    this.bedsByOwner.set(ownerKey, { ownerKey, structureId: opts.rec.id, x: opts.rec.x, y: opts.rec.y, elevation: opts.rec.elevation });
    opts.events.push({ kind: "bedSet", x: opts.rec.x, y: opts.rec.y, actorId: opts.player.id });
  }

  private matchesBedTarget(s: PlacedStructureRecord, structureId: string | undefined): boolean {
    if (s.kind !== "bed") return false;
    return !structureId || s.id === structureId;
  }

  bindNearestBed(opts: {
    readonly player: CombatPlayerRef; readonly playerName: string;
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
    this.bindBedRecord({ player: opts.player, playerName: opts.playerName, rec: best, events: opts.events });
    return true;
  }

  respawnPointFor(playerName: string): { readonly x: number; readonly y: number; readonly elevation: number } | null {
    const bound = this.bedsByOwner.get(normalizeOwnerKey(playerName));
    if (!bound || !this.structures.has(bound.structureId)) return null;
    return { x: bound.x, y: bound.y, elevation: bound.elevation };
  }

  hasBedFor(playerName: string): boolean {
    return this.respawnPointFor(playerName) !== null;
  }

  exportState(): { readonly structures: readonly PlacedStructureRecord[]; readonly beds: readonly SavedBedBinding[] } {
    return { structures: Array.from(this.structures.values()), beds: Array.from(this.bedsByOwner.values()) };
  }

  importState(opts: {
    readonly structures: readonly PlacedStructureRecord[]; readonly beds: readonly SavedBedBinding[];
    readonly cache: WorldChunkCache; readonly loot: LootManager;
  }): void {
    this.structures.clear();
    this.bedsByOwner.clear();
    let maxNum = 0;
    for (const s of opts.structures) {
      this.registerStructure(s, opts.cache, opts.loot);
      const parsed = Number(s.id.replace("struct-", ""));
      if (Number.isFinite(parsed) && parsed > maxNum) maxNum = parsed;
    }
    this.nextId = maxNum + 1;
    for (const b of opts.beds) {
      if (this.structures.has(b.structureId)) this.bedsByOwner.set(b.ownerKey, b);
    }
  }
}
