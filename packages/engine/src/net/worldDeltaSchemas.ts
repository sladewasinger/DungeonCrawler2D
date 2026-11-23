/** Zod wire schemas for Phase 8 persistent world deltas and camp structure placement requests. */
import { z } from "zod";
import { STRUCTURE_KINDS } from "../survival/campBuilding.js";
import type { PropKind } from "../world/types.js";

const RUNTIME_PROP_KINDS = [
  "oak-tree", "pine-tree", "bush", "tall-grass", "boulder", "wildflower", "campfire", "torch",
  "stump", "palisade", "tent", "ruin-pillar", "copper-vein", "iron-vein", "workbench", "bed", "wood-chest",
] as const;

const PropKindSchema = z.enum(RUNTIME_PROP_KINDS) as unknown as z.ZodType<PropKind>;

export const DepletedPropSchema = z.object({
  propId: z.string().min(1),
  replacementKind: PropKindSchema.nullable(),
  regrowAtSec: z.number(),
});

export const PlacedStructureSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(STRUCTURE_KINDS),
  itemId: z.string().min(1),
  x: z.number(),
  y: z.number(),
  elevation: z.number(),
  ownerName: z.string().min(1),
});

export const WorldDeltaSnapshotSchema = z.object({
  depleted: z.array(DepletedPropSchema).readonly(),
  structures: z.array(PlacedStructureSchema).readonly(),
});

export const ClientPlaceStructureSchema = z.object({
  t: z.literal("placeStructure"),
  itemId: z.string().min(1).max(32),
  x: z.number(),
  y: z.number(),
  seq: z.number().int().nonnegative().optional(),
});

export const ClientSetRespawnBedSchema = z.object({
  t: z.literal("setRespawnBed"),
  structureId: z.string().min(1).max(64),
  seq: z.number().int().nonnegative().optional(),
});

export const ClientPickupLootSchema = z.object({
  t: z.literal("pickupLoot"),
  lootId: z.string().min(1).max(64).optional(),
  seq: z.number().int().nonnegative().optional(),
});
