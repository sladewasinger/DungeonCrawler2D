/** Server-side POI interactions: Shrine blessings, Ancient Waystones, Lore Signs, and Brazier Vaults. */
import { resolveItemInstance } from "@dc2d/content";
import {
  getPoiCatalogEntry, isInSanctuary, isWithinSector,
  type ChunkPoi, type WorldChunkCache, type WorldEvent,
} from "@dc2d/engine";
import type { CombatPlayerRef } from "../combatActions.js";
import type { LootManager } from "../wildlife/lootManager.js";
import type { DiscoveryTracker } from "./discoveryTracker.js";

const SHRINE_COOLDOWN_SEC = 120;

const SHRINE_LABELS: Readonly<Record<"swiftness" | "vigor" | "shadow", { readonly title: string; readonly sub: string }>> = {
  swiftness: { title: "Wind Shrine Blessing", sub: "+22% Move Speed & +12 Stamina/s for 180s" },
  vigor: { title: "Vigor Wellspring Blessing", sub: "Restored HP & +25 Max HP for 240s" },
  shadow: { title: "Shadow Altar Blessing", sub: "-35% Visibility & +40% Backstab for 180s" },
};

export function itemCanIgniteBrazier(itemId: string | null | undefined, prefixId?: string | null): boolean {
  if (!itemId) return false;
  if (itemId === "torch") return true;
  const resolved = resolveItemInstance(itemId, prefixId);
  return resolved.perks.some((pk) => pk.kind === "burn");
}

export function isFriendlyOrSpawnSanctuary(cache: WorldChunkCache, x: number, y: number): boolean {
  if (isInSanctuary(x, y)) return true;
  return cache.poisNear(x, y).some((poi) => Boolean(poi.isSanctuary) && Math.hypot(x - poi.centerX, y - poi.centerY) <= Math.max(poi.radiusX, poi.radiusY) + 1.5);
}

export function tryExecutePlayerDodge(opts: {
  readonly p: CombatPlayerRef; readonly moveX: number; readonly moveY: number;
  readonly cost: number; readonly durSec: number; readonly iframeSec: number; readonly cdSec: number;
  readonly events: WorldEvent[];
}): void {
  const c = opts.p.combat;
  if (c.dodgeCooldown > 0 || c.dodgeTimer > 0 || (!c.godMode && c.stamina < opts.cost)) return;
  if (!c.godMode) c.stamina -= opts.cost;
  c.dodgeTimer = opts.durSec; c.invulnTimer = opts.iframeSec; c.dodgeCooldown = opts.cdSec;
  c.bowCharge = 0; c.blocking = false;
  const mag = Math.hypot(opts.moveX, opts.moveY);
  c.dodgeDirX = mag > 0.05 ? opts.moveX / mag : opts.p.facingX;
  c.dodgeDirY = mag > 0.05 ? opts.moveY / mag : opts.p.facingY;
  opts.events.push({ kind: "dodge", x: opts.p.x, y: opts.p.y, dirX: c.dodgeDirX, dirY: c.dodgeDirY, actorId: opts.p.id });
}

export class PoiInteractionManager {
  private readonly shrineCooldowns = new Map<string, number>();

  private igniteBrazier(opts: {
    readonly poi: ChunkPoi; readonly brazier: { readonly id: string; readonly x: number; readonly y: number };
    readonly actorId: string; readonly cache: WorldChunkCache; readonly loot: LootManager; readonly events: WorldEvent[];
  }): boolean {
    if (opts.cache.isBrazierLit(opts.brazier.id)) return false;
    opts.cache.lightBrazier(opts.brazier.id, { x: opts.brazier.x, y: opts.brazier.y });
    opts.events.push({ kind: "chestOpen", x: opts.brazier.x, y: opts.brazier.y, actorId: opts.actorId });
    const list = opts.poi.brazierPositions ?? [];
    const allLit = list.length > 0 && list.every((b) => opts.cache.isBrazierLit(b.id));
    if (allLit) {
      opts.loot.unlockVaultChest(opts.poi.id);
      const meta = getPoiCatalogEntry(opts.poi.kind);
      opts.events.push({
        kind: "vaultUnlock", x: opts.poi.chestX, y: opts.poi.chestY, actorId: opts.actorId,
        label: `${meta.displayName} Unsealed!`, subtitle: "The sealed treasure chest has unlocked", poiCategory: "puzzle",
      });
    }
    return true;
  }

  private pruneExpiredCooldowns(simTimeSec: number): void {
    if (this.shrineCooldowns.size <= 64) return;
    for (const [k, t] of this.shrineCooldowns) if (t <= simTimeSec) this.shrineCooldowns.delete(k);
  }

  private activateShrine(opts: {
    readonly player: CombatPlayerRef; readonly poi: ChunkPoi; readonly simTimeSec: number; readonly events: WorldEvent[];
  }): boolean {
    const kind = opts.poi.shrineKind;
    if (!kind || kind === "waystone") return false;
    this.pruneExpiredCooldowns(opts.simTimeSec);
    const key = `${opts.player.accountId ?? opts.player.id}:${opts.poi.id}`;
    if (opts.simTimeSec < (this.shrineCooldowns.get(key) ?? 0)) return false;
    this.shrineCooldowns.set(key, opts.simTimeSec + SHRINE_COOLDOWN_SEC);
    if (kind === "vigor") opts.player.combat.hp = opts.player.combat.maxHp;
    opts.player.combat.buffKind = kind;
    opts.player.combat.buffTimer = kind === "vigor" ? 240 : 180;
    const copy = SHRINE_LABELS[kind];
    opts.events.push({
      kind: "shrineActivate", x: opts.poi.centerX, y: opts.poi.centerY, actorId: opts.player.id,
      label: copy.title, subtitle: copy.sub, poiCategory: "shrine",
    });
    return true;
  }

  private tryInteractBraziers(opts: {
    readonly player: CombatPlayerRef; readonly poi: ChunkPoi;
    readonly cache: WorldChunkCache; readonly loot: LootManager; readonly events: WorldEvent[];
  }): boolean {
    const slot = opts.player.inventory.slots[opts.player.selectedHotbar];
    if (!itemCanIgniteBrazier(slot?.itemId, slot?.prefixId)) return false;
    for (const b of opts.poi.brazierPositions ?? []) {
      if (opts.cache.isBrazierLit(b.id)) continue;
      if (Math.hypot(opts.player.x - b.x, opts.player.y - b.y) <= 2.4) {
        return this.igniteBrazier({ poi: opts.poi, brazier: b, actorId: opts.player.id, cache: opts.cache, loot: opts.loot, events: opts.events });
      }
    }
    return false;
  }

  private tryInteractSinglePoi(opts: {
    readonly player: CombatPlayerRef; readonly poi: ChunkPoi; readonly cache: WorldChunkCache;
    readonly loot: LootManager; readonly discovery: DiscoveryTracker; readonly simTimeSec: number; readonly events: WorldEvent[];
  }): boolean {
    const { player, poi, cache, loot, discovery, simTimeSec, events } = opts;
    if (this.tryInteractBraziers({ player, poi, cache, loot, events })) return true;
    if (Math.hypot(player.x - poi.centerX, player.y - poi.centerY) > 3.1) return false;
    if (poi.shrineKind === "waystone") {
      discovery.attuneWaystone({ playerId: player.id, waystone: poi, cache, events });
      return true;
    }
    if (poi.shrineKind && this.activateShrine({ player, poi, simTimeSec, events })) return true;
    if (!poi.loreText) return false;
    const meta = getPoiCatalogEntry(poi.kind);
    events.push({ kind: "loreRead", x: poi.centerX, y: poi.centerY, actorId: player.id, label: meta.displayName, subtitle: poi.loreText, poiCategory: meta.category });
    return true;
  }

  interactWithPoi(opts: {
    readonly player: CombatPlayerRef; readonly cache: WorldChunkCache; readonly loot: LootManager;
    readonly discovery: DiscoveryTracker; readonly simTimeSec: number; readonly events: WorldEvent[];
  }): boolean {
    return opts.cache.poisNear(opts.player.x, opts.player.y).some((poi) => this.tryInteractSinglePoi({ ...opts, poi }));
  }

  private hitPoiBraziers(opts: {
    readonly attacker: CombatPlayerRef; readonly poi: ChunkPoi;
    readonly cache: WorldChunkCache; readonly loot: LootManager; readonly events: WorldEvent[];
  }): boolean {
    let hitAny = false;
    for (const b of opts.poi.brazierPositions ?? []) {
      if (opts.cache.isBrazierLit(b.id)) continue;
      const ok = isWithinSector({ origin: opts.attacker, dir: { x: opts.attacker.aimX, y: opts.attacker.aimY }, target: b, range: 2.5, halfArcRad: 1.2 });
      if (ok && this.igniteBrazier({ poi: opts.poi, brazier: b, actorId: opts.attacker.id, cache: opts.cache, loot: opts.loot, events: opts.events })) {
        hitAny = true;
      }
    }
    return hitAny;
  }

  hitBraziersInSector(opts: {
    readonly attacker: CombatPlayerRef; readonly heldItemId: string | null; readonly prefixId?: string | null | undefined;
    readonly cache: WorldChunkCache; readonly loot: LootManager; readonly events: WorldEvent[];
  }): boolean {
    if (!itemCanIgniteBrazier(opts.heldItemId, opts.prefixId)) return false;
    let hitAny = false;
    for (const poi of opts.cache.poisNear(opts.attacker.x, opts.attacker.y)) {
      if (this.hitPoiBraziers({ ...opts, poi })) hitAny = true;
    }
    return hitAny;
  }
}
