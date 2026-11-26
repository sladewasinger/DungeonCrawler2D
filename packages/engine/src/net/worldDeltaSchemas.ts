/** Zod wire schemas for Phase 8 persistent world deltas and camp structure placement requests. */
import { z } from "zod";
import { STRUCTURE_KINDS } from "../survival/campBuilding.js";
import type { PropKind } from "../world/types.js";

const RUNTIME_PROP_KINDS = [
  "oak-tree", "pine-tree", "birch-tree", "maple-tree", "dead-tree", "giant-mushroom", "bog-reed", "cursed-crystal",
  "bush", "tall-grass", "boulder", "wildflower", "campfire", "torch",
  "stump", "palisade", "tent", "ruin-pillar", "copper-vein", "iron-vein", "workbench", "bed", "wood-chest",
  "shrine-altar", "waystone", "gravestone", "broken-cart", "great-stump", "sunken-boat", "lore-sign",
  "bone-totem", "runic-forge", "cursed-obelisk", "brazier-unlit", "brazier-lit", "hermit-hut", "fairy-ring",
] as const;

const PropKindSchema = z.enum(RUNTIME_PROP_KINDS) as unknown as z.ZodType<PropKind>;

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
