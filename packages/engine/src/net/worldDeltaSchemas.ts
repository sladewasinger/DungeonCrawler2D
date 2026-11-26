/** Zod wire schemas for Phase 8 persistent world deltas and camp structure placement requests. */
import { PROP_KIND_VALUES } from "@dc2d/contracts";
import { z } from "zod";
import { STRUCTURE_KINDS } from "../survival/campBuilding.js";

const PropKindSchema = z.enum(PROP_KIND_VALUES);

export const DepletedPropSchema = z.object({
  propId: z.string().min(1),
  replacementKind: PropKindSchema.nullable(),
  regrowAtSec: z.number(),
  cx: z.number().int().optional(),
  cy: z.number().int().optional(),
});

export const PlacedStructureSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(STRUCTURE_KINDS),
  itemId: z.string().min(1),
  x: z.number(),
  y: z.number(),
  elevation: z.number(),
  ownerName: z.string().min(1),
  rotation: z.number().int().min(0).max(3).optional(),
  hp: z.number().optional(),
});

export const WorldDeltaSnapshotSchema = z.object({
  depleted: z.array(DepletedPropSchema).readonly(),
  structures: z.array(PlacedStructureSchema).readonly(),
  litBraziers: z.array(z.string().min(1)).readonly().optional(),
});

const WorldCoordSchema = z.number().finite().min(-1_000_000).max(1_000_000);
const DeltaSeqSchema = z.number().int().nonnegative().max(2_147_483_647).optional();

export const ClientPlaceStructureSchema = z.object({
  t: z.literal("placeStructure"),
  itemId: z.string().min(1).max(32),
  x: WorldCoordSchema,
  y: WorldCoordSchema,
  rotation: z.number().int().min(0).max(3).optional(),
  seq: DeltaSeqSchema,
});

export const ClientDismantleStructureSchema = z.object({
  t: z.literal("dismantleStructure"),
  structureId: z.string().min(1).max(64),
  seq: DeltaSeqSchema,
});

export const ClientSetRespawnBedSchema = z.object({
  t: z.literal("setRespawnBed"),
  structureId: z.string().min(1).max(64),
  seq: DeltaSeqSchema,
});

export const ClientPickupLootSchema = z.object({
  t: z.literal("pickupLoot"),
  lootId: z.string().min(1).max(64).optional(),
  seq: DeltaSeqSchema,
});
