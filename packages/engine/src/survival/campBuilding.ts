/** Pure camp structure definitions, prop/light converters, and placement validity rules. */
import type { WorldChunkCache } from "../world/collision.js";
import { GroundKind, PropKind, type ChunkProp, type PointLightSpec } from "../world/types.js";

export const STRUCTURE_KINDS = ["campfire", "torch", "wood-chest", "workbench", "bed", "palisade"] as const;
export type StructureKind = (typeof STRUCTURE_KINDS)[number];

export interface PlacedStructureRecord {
  readonly id: string;
  readonly kind: StructureKind;
  readonly itemId: string;
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
  readonly ownerName: string;
}

export interface StructureSpec {
  readonly kind: StructureKind;
  readonly propKind: PropKind;
  readonly radius: number;
  readonly blocksMovement: boolean;
  readonly lightColor?: number | undefined;
  readonly lightRadiusPx?: number | undefined;
  readonly lightIntensity?: number | undefined;
}

export const STRUCTURE_SPECS: Readonly<Record<StructureKind, StructureSpec>> = {
  campfire: { kind: "campfire", propKind: PropKind.Campfire, radius: 0.72, blocksMovement: true, lightColor: 0xff9a3c, lightRadiusPx: 230, lightIntensity: 1.25 },
  torch: { kind: "torch", propKind: PropKind.Torch, radius: 0.2, blocksMovement: false, lightColor: 0xffb357, lightRadiusPx: 145, lightIntensity: 0.92 },
  "wood-chest": { kind: "wood-chest", propKind: PropKind.WoodChest, radius: 0.45, blocksMovement: true },
  workbench: { kind: "workbench", propKind: PropKind.Workbench, radius: 0.56, blocksMovement: true },
  bed: { kind: "bed", propKind: PropKind.Bed, radius: 0.46, blocksMovement: true },
  palisade: { kind: "palisade", propKind: PropKind.Palisade, radius: 0.48, blocksMovement: true },
};

export function structureToChunkProp(rec: PlacedStructureRecord): ChunkProp {
  const spec = STRUCTURE_SPECS[rec.kind];
  return {
    id: rec.id, kind: spec.propKind, x: rec.x, y: rec.y, variant: 0,
    elevation: rec.elevation, radius: spec.radius, blocksMovement: spec.blocksMovement,
  };
}

export function structureToPointLight(rec: PlacedStructureRecord): PointLightSpec | null {
  const spec = STRUCTURE_SPECS[rec.kind];
  if (spec.lightColor === undefined || spec.lightRadiusPx === undefined || spec.lightIntensity === undefined) return null;
  return {
    id: `light:${rec.id}`, kind: rec.kind === "campfire" ? "campfire" : "torch",
    x: rec.x, y: rec.y, color: spec.lightColor, radiusPx: spec.lightRadiusPx, intensity: spec.lightIntensity,
  };
}

export function canPlaceStructure(opts: {
  readonly cache: WorldChunkCache; readonly x: number; readonly y: number;
  readonly playerX: number; readonly playerY: number; readonly playerElev: number; readonly kind: StructureKind;
}): boolean {
  const dist = Math.hypot(opts.x - opts.playerX, opts.y - opts.playerY);
  if (dist < 0.8 || dist > 3.6) return false;
  const tile = opts.cache.tileAt(Math.floor(opts.x), Math.floor(opts.y));
  if (tile.ground === GroundKind.DeepWater || tile.ground === GroundKind.ShallowWater || tile.elevation !== opts.playerElev) return false;
  const spec = STRUCTURE_SPECS[opts.kind];
  for (const obs of opts.cache.blockingObstaclesNear(opts.x, opts.y)) {
    if (Math.hypot(obs.x - opts.x, obs.y - opts.y) < obs.radius + spec.radius + 0.08) return false;
  }
  return true;
}
