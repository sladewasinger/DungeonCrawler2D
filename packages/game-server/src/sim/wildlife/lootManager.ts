/** Authoritative treasure chest interactions, burst physics, and magnetic loot pickup. */
import { maxStackForItem } from "@dc2d/content";
import {
  AI_TUNING, WorldChunkCache, insertIntoSlots,
  type ChunkPoi, type GroundLootSnapshot, type WorldChestSnapshot, type WorldEvent,
} from "@dc2d/engine";
import type { CombatPlayerRef } from "../combatActions.js";
import { ITEM_ARROW, ITEM_BANDAGE, ITEM_COOKED_MEAT, ITEM_FLINT, ITEM_RAW_MEAT, ITEM_STONE, ITEM_TORCH } from "./creatureSpecs.js";

interface GroundLootItem {
  readonly id: string;
  readonly itemId: string;
  readonly count: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  readonly elevation: number;
  ageSec: number;
}

const BANDIT_CAMP_POI = "bandit-camp" as const;

export class LootManager {
  readonly chests = new Map<string, WorldChestSnapshot>();
  readonly groundLoot: GroundLootItem[] = [];
  private nextId = 1;

  constructor(private readonly cache: WorldChunkCache) {}

  registerPoiChest(poi: ChunkPoi): void {
    if (this.chests.has(poi.id)) return;
    this.chests.set(poi.id, {
      id: poi.id, poiKind: poi.kind, x: poi.chestX, y: poi.chestY, elevation: poi.elevation, opened: false,
    });
  }

  spawnLoot(opts: { readonly itemId: string; readonly count: number; readonly x: number; readonly y: number; readonly vx: number; readonly vy: number }): void {
    this.groundLoot.push({
      id: `loot-${this.nextId++}`, itemId: opts.itemId, count: opts.count, x: opts.x, y: opts.y, vx: opts.vx, vy: opts.vy,
      elevation: this.cache.tileAt(Math.floor(opts.x), Math.floor(opts.y)).elevation, ageSec: 0,
    });
  }

  tryInteractChest(player: CombatPlayerRef, events: WorldEvent[]): boolean {
    let best: WorldChestSnapshot | null = null;
    let bestDist: number = AI_TUNING.chestInteractRadiusTiles;
    for (const c of this.chests.values()) {
      if (c.opened) continue;
      const d = Math.hypot(c.x - player.x, c.y - player.y);
      if (d <= bestDist) { bestDist = d; best = c; }
    }
    if (!best) return false;
    this.chests.set(best.id, { ...best, opened: true });
    events.push({ kind: "chestOpen", x: best.x, y: best.y, actorId: player.id });
    const items = best.poiKind === BANDIT_CAMP_POI
      ? [[ITEM_COOKED_MEAT, 2], [ITEM_ARROW, 8], [ITEM_BANDAGE, 2], [ITEM_TORCH, 2]] as const
      : [[ITEM_BANDAGE, 3], [ITEM_FLINT, 3], [ITEM_STONE, 4], [ITEM_RAW_MEAT, 2]] as const;
    items.forEach(([itemId, count], i) => {
      const a = (i / items.length) * Math.PI * 2 + 0.4;
      this.spawnLoot({ itemId, count, x: best.x, y: best.y, vx: Math.cos(a) * 2.6, vy: Math.sin(a) * 2.6 });
    });
    return true;
  }

  step(players: readonly CombatPlayerRef[], events: WorldEvent[], dt: number): void {
    for (let i = this.groundLoot.length - 1; i >= 0; i--) {
      const g = this.groundLoot[i]!;
      g.ageSec += dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.vx *= Math.max(0, 1 - dt * 6);
      g.vy *= Math.max(0, 1 - dt * 6);
      if (g.ageSec >= 0.25 && this.pullOrCollectLoot({ g, players, events, dt })) this.groundLoot.splice(i, 1);
    }
  }

  private findClosestMagnetPlayer(g: GroundLootItem, players: readonly CombatPlayerRef[]): { readonly p: CombatPlayerRef; readonly dist: number } | null {
    let p: CombatPlayerRef | null = null;
    let dist: number = AI_TUNING.lootMagnetRadiusTiles;
    for (const cand of players) {
      const d = Math.hypot(cand.x - g.x, cand.y - g.y);
      if (d < dist) { dist = d; p = cand; }
    }
    return p ? { p, dist } : null;
  }

  private pullOrCollectLoot(opts: { readonly g: GroundLootItem; readonly players: readonly CombatPlayerRef[]; readonly events: WorldEvent[]; readonly dt: number }): boolean {
    const match = this.findClosestMagnetPlayer(opts.g, opts.players);
    if (!match) return false;
    if (match.dist <= AI_TUNING.lootPickupRadiusTiles) {
      const added = insertIntoSlots(match.p.inventory.slots, { itemId: opts.g.itemId, count: opts.g.count }, maxStackForItem);
      if (added > 0) opts.events.push({ kind: "loot", x: opts.g.x, y: opts.g.y, actorId: match.p.id, value: added });
      return added >= opts.g.count;
    }
    const pull = Math.min(match.dist, 5.4 * opts.dt);
    opts.g.x += ((match.p.x - opts.g.x) / match.dist) * pull;
    opts.g.y += ((match.p.y - opts.g.y) / match.dist) * pull;
    return false;
  }

  snapshot(): { readonly chests: WorldChestSnapshot[]; readonly groundLoot: GroundLootSnapshot[] } {
    return {
      chests: Array.from(this.chests.values()),
      groundLoot: this.groundLoot.map((g) => ({
        id: g.id, itemId: g.itemId, count: g.count, x: g.x, y: g.y, elevation: g.elevation, ageSec: g.ageSec,
      })),
    };
  }
}
