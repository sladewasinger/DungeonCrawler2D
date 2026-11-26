/** Chunk-keyed world delta overlay composing depleted resources and placed camp structures. */
import { PropKind, chunkKey, worldToChunkCoord, type ChunkProp, type PointLightSpec, type WorldChunk } from "../world/types.js";
import { structureToChunkProp, structureToPointLight, type PlacedStructureRecord } from "./campBuilding.js";

export interface DepletedPropDelta {
  readonly propId: string;
  readonly replacementKind: PropKind | null;
  readonly regrowAtSec: number;
  readonly cx?: number | undefined;
  readonly cy?: number | undefined;
}

export interface WorldDeltaSnapshot {
  readonly depleted: readonly DepletedPropDelta[];
  readonly structures: readonly PlacedStructureRecord[];
  readonly litBraziers?: readonly string[] | undefined;
}

function parseChunkCoordToken(part: string): string | null {
  if (!part.includes(",")) return null;
  const [cxStr, cyStr] = part.split(",");
  const cx = Number(cxStr);
  const cy = Number(cyStr);
  return Number.isFinite(cx) && Number.isFinite(cy) ? chunkKey(cx, cy) : null;
}

function keyFromBrazierId(brazierId: string, x?: number, y?: number): string | null {
  if (x !== undefined && y !== undefined) return chunkKey(worldToChunkCoord(Math.floor(x)), worldToChunkCoord(Math.floor(y)));
  for (const part of brazierId.split(":").slice(1)) {
    const parsed = parseChunkCoordToken(part);
    if (parsed) return parsed;
  }
  return null;
}

function keyFromPropIdOrPos(propId: string, delta?: { readonly cx?: number | undefined; readonly cy?: number | undefined }): string | null {
  if (delta?.cx !== undefined && delta?.cy !== undefined) return chunkKey(delta.cx, delta.cy);
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
  private readonly propIdToChunkKey = new Map<string, string>();
  private readonly structures = new Map<string, PlacedStructureRecord>();
  private readonly structureChunks = new Map<string, PlacedStructureRecord[]>();
  private readonly litBraziers = new Set<string>();
  private readonly chunkRevs = new Map<string, number>();
  revision = 0;

  chunkRevision(cx: number, cy: number): number {
    return this.chunkRevs.get(chunkKey(cx, cy)) ?? 0;
  }

  private mapPropWithDelta(prop: ChunkProp, outProps: ChunkProp[], lights: PointLightSpec[]): void {
    if (prop.kind === PropKind.BrazierUnlit && this.litBraziers.has(prop.id)) {
      outProps.push({ ...prop, kind: PropKind.BrazierLit });
      lights.push({ id: `${prop.id}-light`, kind: "torch", x: prop.x, y: prop.y, color: 0xffb357, radiusPx: 185, intensity: 1.15 });
      return;
    }
    const delta = this.depleted.get(prop.id);
    if (!delta) { outProps.push(prop); return; }
    if (delta.replacementKind === prop.kind) {
      outProps.push({ ...prop, depleted: true });
      return;
    }
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
    const hasLitBrazier = this.litBraziers.size > 0 && base.props.some((p) => p.kind === PropKind.BrazierUnlit && this.litBraziers.has(p.id));
    if (!hasDepletedHit && !hasLitBrazier && localStructs.length === 0) return base;

    const props: ChunkProp[] = [];
    const lights: PointLightSpec[] = [...base.lights];
    for (const prop of base.props) this.mapPropWithDelta(prop, props, lights);
    this.appendStructuresToChunk(localStructs, props, lights);
    return { ...base, props, lights };
  }

  lightBrazier(brazierId: string, pos?: { readonly x: number; readonly y: number }): string | null {
    if (this.litBraziers.has(brazierId)) return null;
    this.litBraziers.add(brazierId);
    this.revision += 1;
    const key = keyFromBrazierId(brazierId, pos?.x, pos?.y);
    if (key) bumpKey(this.chunkRevs, key);
    return key;
  }

  isBrazierLit(brazierId: string): boolean {
    return this.litBraziers.has(brazierId);
  }

  setDepletedProp(delta: DepletedPropDelta): string | null {
    this.depleted.set(delta.propId, delta);
    this.revision += 1;
    const key = keyFromPropIdOrPos(delta.propId, delta);
    if (key) {
      this.propIdToChunkKey.set(delta.propId, key);
      bumpKey(this.chunkRevs, key);
    }
    return key;
  }

  restoreProp(propId: string): string | null {
    const prev = this.depleted.get(propId);
    const mappedKey = this.propIdToChunkKey.get(propId);
    this.propIdToChunkKey.delete(propId);
    if (!this.depleted.delete(propId)) return null;
    this.revision += 1;
    const key = mappedKey ?? keyFromPropIdOrPos(propId, prev);
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

  private rememberDepletedChunk(d: DepletedPropDelta): string | null {
    const k = this.propIdToChunkKey.get(d.propId) ?? keyFromPropIdOrPos(d.propId, d);
    if (k) this.propIdToChunkKey.set(d.propId, k);
    return k;
  }

  private collectChunkFingerprints(): Map<string, string> {
    const sigs = new Map<string, string[]>();
    const add = (key: string | null, token: string): void => {
      if (!key) return;
      const list = sigs.get(key) ?? [];
      list.push(token);
      sigs.set(key, list);
    };
    for (const d of this.depleted.values()) add(this.rememberDepletedChunk(d), `d:${d.propId}:${d.replacementKind ?? "null"}`);
    for (const [k, list] of this.structureChunks) for (const s of list) add(k, `s:${s.id}:${s.x},${s.y}`);
    for (const id of this.litBraziers) add(keyFromBrazierId(id), `b:${id}`);
    const out = new Map<string, string>();
    for (const [k, list] of sigs) out.set(k, list.sort().join("|"));
    return out;
  }

  replaceFromSnapshot(snap: WorldDeltaSnapshot): readonly string[] {
    const before = this.collectChunkFingerprints();
    this.depleted.clear();
    this.propIdToChunkKey.clear();
    this.structures.clear();
    this.structureChunks.clear();
    this.litBraziers.clear();
    for (const d of snap.depleted) {
      this.depleted.set(d.propId, d);
      this.rememberDepletedChunk(d);
    }
    for (const b of snap.litBraziers ?? []) this.litBraziers.add(b);
    for (const s of snap.structures) this.addStructureWithoutRev(s);
    const after = this.collectChunkFingerprints();
    const dirty: string[] = [];
    for (const k of new Set([...before.keys(), ...after.keys()])) {
      if (before.get(k) === after.get(k)) continue;
      bumpKey(this.chunkRevs, k);
      dirty.push(k);
    }
    this.revision += 1;
    return dirty;
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
    const braziers = Array.from(this.litBraziers);
    return {
      depleted: Array.from(this.depleted.values()),
      structures: Array.from(this.structures.values()),
      ...(braziers.length > 0 ? { litBraziers: braziers } : {}),
    };
  }

  allStructures(): readonly PlacedStructureRecord[] {
    return Array.from(this.structures.values());
  }
}
