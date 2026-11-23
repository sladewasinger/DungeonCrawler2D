/** Chunk-keyed world delta overlay composing depleted resources and placed camp structures. */
import { PropKind, chunkKey, worldToChunkCoord, type ChunkProp, type PointLightSpec, type WorldChunk } from "../world/types.js";
import { structureToChunkProp, structureToPointLight, type PlacedStructureRecord } from "./campBuilding.js";

export interface DepletedPropDelta {
  readonly propId: string;
  readonly replacementKind: PropKind | null;
  readonly regrowAtSec: number;
}

export interface WorldDeltaSnapshot {
  readonly depleted: readonly DepletedPropDelta[];
  readonly structures: readonly PlacedStructureRecord[];
}

function keyFromPropIdOrPos(propId: string, x?: number, y?: number): string | null {
  if (x !== undefined && y !== undefined) return chunkKey(worldToChunkCoord(Math.floor(x)), worldToChunkCoord(Math.floor(y)));
  const colon = propId.indexOf(":");
  if (colon < 0) return null;
  const parts = propId.slice(colon + 1).split(",");
  const px = Number(parts[0]);
  const py = Number(parts[1]);
  if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
  return chunkKey(worldToChunkCoord(Math.floor(px / 10)), worldToChunkCoord(Math.floor(py / 10)));
}

function bumpKey(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export class WorldDeltaOverlay {
  private readonly depleted = new Map<string, DepletedPropDelta>();
  private readonly structures = new Map<string, PlacedStructureRecord>();
  private readonly structureChunks = new Map<string, PlacedStructureRecord[]>();
  private readonly chunkRevs = new Map<string, number>();
  revision = 0;

  chunkRevision(cx: number, cy: number): number {
    return this.chunkRevs.get(chunkKey(cx, cy)) ?? 0;
  }

  private mapPropWithDelta(prop: ChunkProp, outProps: ChunkProp[]): void {
    const delta = this.depleted.get(prop.id);
    if (!delta) { outProps.push(prop); return; }
    if (delta.replacementKind !== null) {
      outProps.push({ ...prop, kind: delta.replacementKind, radius: 0.3, blocksMovement: true });
    }
  }

  private appendStructuresToChunk(localStructs: readonly PlacedStructureRecord[], props: ChunkProp[], lights: PointLightSpec[]): void {
    for (const s of localStructs) {
      props.push(structureToChunkProp(s));
      const light = structureToPointLight(s);
      if (light) lights.push(light);
    }
  }

  applyChunkDeltas(base: WorldChunk): WorldChunk {
    const localStructs = this.structureChunks.get(chunkKey(base.cx, base.cy)) ?? [];
    const hasDepletedHit = this.depleted.size > 0 && base.props.some((p) => this.depleted.has(p.id));
    if (!hasDepletedHit && localStructs.length === 0) return base;

    const props: ChunkProp[] = [];
    for (const prop of base.props) this.mapPropWithDelta(prop, props);
    const lights: PointLightSpec[] = [...base.lights];
    this.appendStructuresToChunk(localStructs, props, lights);
    return { ...base, props, lights };
  }

  setDepletedProp(delta: DepletedPropDelta): string | null {
    this.depleted.set(delta.propId, delta);
    this.revision += 1;
    const key = keyFromPropIdOrPos(delta.propId);
    if (key) bumpKey(this.chunkRevs, key);
    return key;
  }

  restoreProp(propId: string): string | null {
    if (!this.depleted.delete(propId)) return null;
    this.revision += 1;
    const key = keyFromPropIdOrPos(propId);
    if (key) bumpKey(this.chunkRevs, key);
    return key;
  }

  addStructure(rec: PlacedStructureRecord): string {
    this.structures.set(rec.id, rec);
    const key = chunkKey(worldToChunkCoord(Math.floor(rec.x)), worldToChunkCoord(Math.floor(rec.y)));
    const bucket = this.structureChunks.get(key) ?? [];
    bucket.push(rec);
    this.structureChunks.set(key, bucket);
    this.revision += 1;
    bumpKey(this.chunkRevs, key);
    return key;
  }

  removeStructure(id: string): string | null {
    const existing = this.structures.get(id);
    if (!existing) return null;
    this.structures.delete(id);
    const key = chunkKey(worldToChunkCoord(Math.floor(existing.x)), worldToChunkCoord(Math.floor(existing.y)));
    const bucket = this.structureChunks.get(key);
    if (bucket) {
      this.structureChunks.set(key, bucket.filter((s) => s.id !== id));
    }
    this.revision += 1;
    bumpKey(this.chunkRevs, key);
    return key;
  }

  private collectExistingDirtyChunks(dirty: Set<string>): void {
    for (const p of this.depleted.keys()) {
      const k = keyFromPropIdOrPos(p);
      if (k) dirty.add(k);
    }
    for (const k of this.structureChunks.keys()) dirty.add(k);
  }

  replaceFromSnapshot(snap: WorldDeltaSnapshot): readonly string[] {
    const dirty = new Set<string>();
    this.collectExistingDirtyChunks(dirty);
    this.depleted.clear();
    this.structures.clear();
    this.structureChunks.clear();
    for (const d of snap.depleted) {
      this.depleted.set(d.propId, d);
      const k = keyFromPropIdOrPos(d.propId);
      if (k) dirty.add(k);
    }
    for (const s of snap.structures) dirty.add(this.addStructureWithoutRev(s));
    this.revision += 1;
    for (const k of dirty) bumpKey(this.chunkRevs, k);
    return Array.from(dirty);
  }

  private addStructureWithoutRev(rec: PlacedStructureRecord): string {
    this.structures.set(rec.id, rec);
    const key = chunkKey(worldToChunkCoord(Math.floor(rec.x)), worldToChunkCoord(Math.floor(rec.y)));
    const bucket = this.structureChunks.get(key) ?? [];
    bucket.push(rec);
    this.structureChunks.set(key, bucket);
    return key;
  }

  toSnapshot(): WorldDeltaSnapshot {
    return { depleted: Array.from(this.depleted.values()), structures: Array.from(this.structures.values()) };
  }

  allStructures(): readonly PlacedStructureRecord[] {
    return Array.from(this.structures.values());
  }
}
