/** Per-player POI discovery tracking and Ancient Waystone landmark beacon reveal logic. */
import {
  getPoiCatalogEntry, type ChunkPoi, type DiscoveryStateSnapshot, type RevealedBeacon, type WorldChunkCache, type WorldEvent,
} from "@dc2d/engine";

interface PlayerDiscoveryRecord {
  readonly poiIds: Set<string>;
  readonly poiKinds: Set<string>;
  readonly beacons: Map<string, RevealedBeacon>;
}

const WAYSTONE_SCAN_CHUNKS = 5;
const WAYSTONE_MAX_DIST_TILES = 160;
const WAYSTONE_REVEAL_LIMIT = 3;

export class DiscoveryTracker {
  private readonly records = new Map<string, PlayerDiscoveryRecord>();

  private ensureRecord(playerId: string): PlayerDiscoveryRecord {
    let rec = this.records.get(playerId);
    if (!rec) {
      rec = { poiIds: new Set<string>(), poiKinds: new Set<string>(), beacons: new Map<string, RevealedBeacon>() };
      this.records.set(playerId, rec);
    }
    return rec;
  }

  removePlayer(playerId: string): void {
    this.records.delete(playerId);
  }

  hydratePlayer(playerId: string, snap?: DiscoveryStateSnapshot | undefined): void {
    const rec = this.ensureRecord(playerId);
    rec.poiIds.clear(); rec.poiKinds.clear(); rec.beacons.clear();
    if (!snap) return;
    for (const id of snap.discoveredPoiIds) rec.poiIds.add(id);
    for (const k of snap.discoveredPoiKinds) rec.poiKinds.add(k);
    for (const b of snap.revealedBeacons) rec.beacons.set(b.id, b);
  }

  snapshotFor(playerId: string): DiscoveryStateSnapshot {
    const rec = this.records.get(playerId);
    if (!rec) return { discoveredPoiIds: [], discoveredPoiKinds: [], revealedBeacons: [] };
    return {
      discoveredPoiIds: Array.from(rec.poiIds),
      discoveredPoiKinds: Array.from(rec.poiKinds),
      revealedBeacons: Array.from(rec.beacons.values()),
    };
  }

  trackNearbyPois(opts: {
    readonly playerId: string;
    readonly x: number;
    readonly y: number;
    readonly cache: WorldChunkCache;
    readonly events: WorldEvent[];
  }): boolean {
    const rec = this.ensureRecord(opts.playerId);
    let discoveredAny = false;
    for (const poi of opts.cache.poisNear(opts.x, opts.y)) {
      if (rec.poiIds.has(poi.id)) continue;
      const triggerR = Math.max(poi.radiusX, poi.radiusY) + 4.5;
      if (Math.hypot(opts.x - poi.centerX, opts.y - poi.centerY) > triggerR) continue;
      rec.poiIds.add(poi.id);
      rec.poiKinds.add(poi.kind);
      rec.beacons.delete(poi.id);
      const meta = getPoiCatalogEntry(poi.kind);
      opts.events.push({
        kind: "poiDiscover", x: poi.centerX, y: poi.centerY, actorId: opts.playerId,
        label: meta.displayName, subtitle: meta.flavor, poiCategory: meta.category,
      });
      discoveredAny = true;
    }
    return discoveredAny;
  }

  attuneWaystone(opts: {
    readonly playerId: string;
    readonly waystone: ChunkPoi;
    readonly cache: WorldChunkCache;
    readonly events: WorldEvent[];
  }): number {
    const rec = this.ensureRecord(opts.playerId);
    const candidates: { readonly poi: ChunkPoi; readonly dist: number }[] = [];
    for (let oy = -WAYSTONE_SCAN_CHUNKS; oy <= WAYSTONE_SCAN_CHUNKS; oy++) {
      for (let ox = -WAYSTONE_SCAN_CHUNKS; ox <= WAYSTONE_SCAN_CHUNKS; ox++) {
        this.collectChunkCandidates({ chunk: opts.cache.getChunk(opts.waystone.cx + ox, opts.waystone.cy + oy).pois, rec, waystone: opts.waystone, out: candidates });
      }
    }
    candidates.sort((a, b) => a.dist - b.dist);
    const picked = candidates.slice(0, WAYSTONE_REVEAL_LIMIT);
    for (const c of picked) rec.beacons.set(c.poi.id, { id: c.poi.id, kind: c.poi.kind, x: c.poi.centerX, y: c.poi.centerY });
    const subtitle = picked.length > 0 ? `Revealed ${picked.length} nearby landmarks on [M] Map` : "No unmarked landmarks nearby";
    opts.events.push({
      kind: "waystoneAttune", x: opts.waystone.centerX, y: opts.waystone.centerY, actorId: opts.playerId,
      value: picked.length, label: "Ancient Waystone Attuned", subtitle, poiCategory: "shrine",
    });
    return picked.length;
  }

  private collectChunkCandidates(opts: {
    readonly chunk: readonly ChunkPoi[]; readonly rec: PlayerDiscoveryRecord;
    readonly waystone: ChunkPoi; readonly out: { readonly poi: ChunkPoi; readonly dist: number }[];
  }): void {
    for (const poi of opts.chunk) {
      if (poi.id === opts.waystone.id || opts.rec.poiIds.has(poi.id) || opts.rec.beacons.has(poi.id)) continue;
      const dist = Math.hypot(poi.centerX - opts.waystone.centerX, poi.centerY - opts.waystone.centerY);
      if (dist <= WAYSTONE_MAX_DIST_TILES) opts.out.push({ poi, dist });
    }
  }
}
