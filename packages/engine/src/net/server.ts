import { z } from "zod";
import {
  areaTileSchema,
  entitySnapshotSchema,
  miniBossArenaGateSnapshotSchema,
  partySnapshotSchema,
  safeRoomDoorSnapshotSchema,
  selfSnapshotSchema,
} from "./schemas/snapshotSchemas.js";
import { defeatedMiniBossArenaWindowSchema } from "./miniBossArenaLandmarks.js";
import { gameEventSchema } from "./serverEvents.js";
import {
  adminAuthResultSchema,
  adminCommandResultSchema,
  adminObserverStateSchema,
  adminStateSchema,
} from "./wire/admin.js";
import {
  spectatorRosterSchema,
  spectatorWelcomeSchema,
} from "./wire/spectator.js";

export { gameEventSchema, type GameEvent } from "./serverEvents.js";
export { defeatedMiniBossArenaSnapshotSchema, defeatedMiniBossArenaWindowSchema } from "./miniBossArenaLandmarks.js";
export type { DefeatedMiniBossArenaSnapshot, DefeatedMiniBossArenaWindow } from "./miniBossArenaLandmarks.js";
export {
  activeStatusSnapshotSchema,
  bodySnapshotSchema,
  enemyAnimationStateSchema,
  entitySnapshotSchema,
  petBehaviorSchema,
  selfSnapshotSchema,
} from "./schemas/snapshotSchemas.js";
export {
  areaTileSchema,
  miniBossArenaGateSnapshotSchema,
  partySnapshotSchema,
  safeRoomDoorSnapshotSchema,
} from "./schemas/snapshotSchemas.js";
export type {
  ActiveStatusSnapshot,
  EnemyAnimationState,
  EntitySnapshot,
  PetBehavior,
} from "./schemas/snapshotSchemas.js";
export type {
  AreaTileUpdate,
  MiniBossArenaGateSnapshot,
  SafeRoomDoorSnapshot,
} from "./schemas/snapshotSchemas.js";

const level = z.enum(["dungeon", "sandbox"]);

export const invStackSchema = z.object({ item: z.string(), qty: z.number().int() });
export type InvStack = z.infer<typeof invStackSchema>;
export const invSlotSchema = invStackSchema.nullable();
export type InvSlot = z.infer<typeof invSlotSchema>;

export const serverWelcomeSchema = z.object({
  type: z.literal("welcome"),
  protocol: z.number().int(),
  playerId: z.string(),
  resumeToken: z.string(),
  seedInputText: z.string(),
  worldSeed: z.number().int(),
  floor: z.number().int(),
  level,
  worldFeatures: z.object({ voidTerrain: z.boolean() }),
  tickRate: z.number().int(),
  spawn: z.object({ x: z.number(), y: z.number(), z: z.number() }),
});

export const serverSnapshotSchema = z.object({
  type: z.literal("snapshot"),
  tick: z.number().int(),
  lastSeq: z.number().int(),
  lastProjectedServerTick: z.number().int(),
  self: selfSnapshotSchema,
  /** Unlimited inventory: one stack per item def. */
  inventory: z.array(invStackSchema),
  /** Hotbar bindings: item def per quick-use slot (qty lives in inventory). */
  hotbar: z.array(z.string().nullable()),
  /** Equipped weapon def (melee swings use it), null = fists. */
  weapon: z.string().nullable(),
  party: partySnapshotSchema,
  entities: z.array(entitySnapshotSchema),
  left: z.array(z.string()),
  events: z.array(gameEventSchema),
  areas: z.array(areaTileSchema),
  roomDoors: z.array(safeRoomDoorSnapshotSchema).optional(),
  miniBossArenaGates: z.array(miniBossArenaGateSnapshotSchema).optional(),
  defeatedMiniBossArenaWindow: defeatedMiniBossArenaWindowSchema.optional(),
});

export const entitySnapshotRevisionSchema = entitySnapshotSchema.extend({
  revision: z.number().int().nonnegative(),
});
export const entitySnapshotReferenceSchema = z.object({
  id: z.string(),
  revision: z.number().int().nonnegative(),
  unchanged: z.literal(true),
});
export const entitySnapshotDeltaEntrySchema = z.union([
  entitySnapshotRevisionSchema,
  entitySnapshotReferenceSchema,
]);

export const serverSnapshotDeltaSchema = z.object({
  type: z.literal("snapshotDelta"),
  tick: z.number().int(),
  /** Previous successfully sent delta tick; null identifies a complete baseline. */
  baseTick: z.number().int().nullable(),
  baseline: z.boolean(),
  lastSeq: z.number().int(),
  lastProjectedServerTick: z.number().int(),
  self: selfSnapshotSchema,
  inventoryRevision: z.number().int().nonnegative(),
  inventory: z.array(invStackSchema).optional(),
  hotbarRevision: z.number().int().nonnegative(),
  hotbar: z.array(z.string().nullable()).optional(),
  weapon: z.string().nullable(),
  party: partySnapshotSchema,
  entities: z.array(entitySnapshotDeltaEntrySchema),
  left: z.array(z.string()),
  events: z.array(gameEventSchema),
  areas: z.array(areaTileSchema),
  roomDoors: z.array(safeRoomDoorSnapshotSchema).optional(),
  miniBossArenaGates: z.array(miniBossArenaGateSnapshotSchema).optional(),
  defeatedMiniBossArenaWindow: defeatedMiniBossArenaWindowSchema.optional(),
});

export const serverPongSchema = z.object({ type: z.literal("pong"), t: z.number() });
export const serverErrorSchema = z.object({
  type: z.literal("error"),
  code: z.string(),
  message: z.string(),
});

export const serverMessageSchema = z.discriminatedUnion("type", [
  serverWelcomeSchema,
  serverSnapshotSchema,
  serverSnapshotDeltaSchema,
  serverPongSchema,
  serverErrorSchema,
  spectatorWelcomeSchema,
  spectatorRosterSchema,
  adminAuthResultSchema,
  adminStateSchema,
  adminObserverStateSchema,
  adminCommandResultSchema,
]);

export type ServerWelcome = z.infer<typeof serverWelcomeSchema>;
export type ServerSnapshot = z.infer<typeof serverSnapshotSchema>;
export type EntitySnapshotRevision = z.infer<typeof entitySnapshotRevisionSchema>;
export type EntitySnapshotReference = z.infer<typeof entitySnapshotReferenceSchema>;
export type EntitySnapshotDeltaEntry = z.infer<typeof entitySnapshotDeltaEntrySchema>;
export type ServerSnapshotDelta = z.infer<typeof serverSnapshotDeltaSchema>;
export type ServerStateSnapshot = ServerSnapshot | ServerSnapshotDelta;
export type ServerMessage = z.infer<typeof serverMessageSchema>;
