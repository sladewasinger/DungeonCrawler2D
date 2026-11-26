/** Multi-zone coordinator routing players and simulation ticks across overworld, hubs, and dungeon floors. */
import type { SimPlayer } from "../survival/worldPersistenceSync.js";
import { ZoneInstance, type ZoneDescriptor } from "./zoneInstance.js";

export const OVERWORLD_ZONE_ID = "overworld";

export class ZoneManager {
  private readonly zones = new Map<string, ZoneInstance>();
  private readonly playerZoneIds = new Map<string, string>();
  readonly defaultZone: ZoneInstance;

  constructor(opts: { readonly worldSeed: number; readonly maxCachedChunks?: number | undefined }) {
    this.defaultZone = this.ensureZone({
      zoneId: OVERWORLD_ZONE_ID,
      kind: "overworld",
      floor: 1,
      seed: opts.worldSeed,
      maxCachedChunks: opts.maxCachedChunks,
    });
  }

  ensureZone(desc: ZoneDescriptor): ZoneInstance {
    const existing = this.zones.get(desc.zoneId);
    if (existing) return existing;
    const created = new ZoneInstance(desc);
    this.zones.set(desc.zoneId, created);
    return created;
  }

  getZone(zoneId: string): ZoneInstance | undefined {
    return this.zones.get(zoneId);
  }

  zoneForPlayer(playerId: string): ZoneInstance {
    const zoneId = this.playerZoneIds.get(playerId) ?? OVERWORLD_ZONE_ID;
    return this.zones.get(zoneId) ?? this.defaultZone;
  }

  zoneIdForPlayer(playerId: string): string {
    return this.playerZoneIds.get(playerId) ?? OVERWORLD_ZONE_ID;
  }

  assignPlayer(player: SimPlayer, zoneId = OVERWORLD_ZONE_ID): ZoneInstance {
    const target = this.zones.get(zoneId) ?? this.defaultZone;
    const prevId = this.playerZoneIds.get(player.id);
    if (prevId && prevId !== target.zoneId) this.zones.get(prevId)?.detachPlayer(player.id);
    this.playerZoneIds.set(player.id, target.zoneId);
    target.attachPlayer(player);
    return target;
  }

  transferPlayer(opts: {
    readonly player: SimPlayer;
    readonly targetZoneId: string;
    readonly spawnPos?: { readonly x: number; readonly y: number; readonly elevation?: number } | undefined;
  }): ZoneInstance {
    const next = this.assignPlayer(opts.player, opts.targetZoneId);
    if (opts.spawnPos) {
      opts.player.x = opts.spawnPos.x;
      opts.player.y = opts.spawnPos.y;
      opts.player.elevation = opts.spawnPos.elevation ?? next.cache.tileAt(Math.floor(opts.spawnPos.x), Math.floor(opts.spawnPos.y)).elevation;
    }
    return next;
  }

  removePlayer(playerId: string): void {
    const zoneId = this.playerZoneIds.get(playerId);
    if (zoneId) this.zones.get(zoneId)?.detachPlayer(playerId);
    else this.defaultZone.detachPlayer(playerId);
    this.playerZoneIds.delete(playerId);
  }

  stepActiveZones(opts: { readonly dtSeconds: number; readonly dayPhase: number; readonly worldClockSec: number }): boolean {
    let anyDirty = false;
    for (const zone of this.zones.values()) {
      if (zone.zoneId !== OVERWORLD_ZONE_ID && zone.players.size === 0) continue;
      if (zone.step(opts)) anyDirty = true;
    }
    return anyDirty;
  }

  listZones(): readonly ZoneInstance[] {
    return Array.from(this.zones.values());
  }
}
