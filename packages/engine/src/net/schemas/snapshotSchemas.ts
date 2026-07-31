import { z } from "zod";
import { PLAYER_SKINS } from "../../entities/playerAppearance.js";
import { adminMapEntitySchema } from "../wire/admin.js";

export const enemyAnimationStateSchema = z.enum([
  "idle", "walk", "windup", "spit", "recover", "attack",
]);
export type EnemyAnimationState = z.infer<typeof enemyAnimationStateSchema>;

export const petBehaviorSchema = z.enum(["idle", "toot", "tail_chase"]);
export type PetBehavior = z.infer<typeof petBehaviorSchema>;

export const bodySnapshotSchema = z.object({
  x: z.number(), y: z.number(), z: z.number(), zVel: z.number(),
  grounded: z.boolean(), coyoteTime: z.number().nonnegative(),
  jumpBuffer: z.number().nonnegative(), jumpHeld: z.boolean(),
  kx: z.number(), ky: z.number(),
});

export const activeStatusSnapshotSchema = z.object({
  id: z.string(),
  remainingSeconds: z.number().nonnegative().nullable(),
  durationSeconds: z.number().positive().nullable(),
  stacks: z.number().int().positive().optional(),
});
export type ActiveStatusSnapshot = z.infer<typeof activeStatusSnapshotSchema>;

export const selfSnapshotSchema = bodySnapshotSchema.extend({
  hp: z.number(), maxHp: z.number(),
  movementSpeed: z.number().nonnegative().optional(),
  stamina: z.number().nonnegative().optional(),
  maxStamina: z.number().positive().optional(), blocking: z.boolean().optional(),
  staminaRecoveryDelaySeconds: z.number().nonnegative().optional(),
  staminaExhausted: z.boolean().optional(),
  healthRegenerationDelaySeconds: z.number().nonnegative().optional(),
  fx: z.array(z.string()), statusEffects: z.array(activeStatusSnapshotSchema).optional(),
  downed: z.boolean().optional(), downedUntilTick: z.number().int().nullable().optional(),
  reviveProgress: z.number().min(0).max(1).optional(), reviverName: z.string().optional(),
  respawnAtTick: z.number().int().nullable().optional(), xp: z.number().int().nonnegative().optional(),
  level: z.number().int().positive().optional(), xpForNext: z.number().int().nonnegative().optional(),
  floor: z.number().int().positive().optional(), deepestFloor: z.number().int().positive().optional(),
  admin: z.boolean().optional(), adminDebug: z.object({
    hurtboxes: z.boolean(), attacks: z.boolean(), guards: z.boolean(),
    lineOfSight: z.boolean(), behavior: z.boolean(), search: z.boolean(), navigation: z.boolean(),
  }).strict().optional(),
  adminDebugEntities: z.array(adminMapEntitySchema).max(2048).optional(),
  faceX: z.number().min(-1).max(1).optional(),
  faceY: z.number().min(-1).max(1).optional(),
  attacking: z.boolean().optional(),
  spectatorLoadout: z.object({
    inventory: z.array(z.object({ item: z.string(), qty: z.number().int() })),
    hotbar: z.array(z.string().nullable()),
  }).strict().optional(),
});

export const entitySnapshotSchema = z.object({
  id: z.string(),
  kind: z.enum(["player", "enemy", "pet", "item", "projectile", "torch"]),
  defId: z.string().optional(), name: z.string().optional(), skin: z.enum(PLAYER_SKINS).optional(),
  x: z.number(), y: z.number(), z: z.number(), hp: z.number().optional(), maxHp: z.number().optional(),
  fx: z.array(z.string()).optional(), qty: z.number().optional(), admin: z.boolean().optional(), downed: z.boolean().optional(),
  reviveProgress: z.number().min(0).max(1).optional(), disconnected: z.boolean().optional(),
  anim: enemyAnimationStateSchema.optional(), petOwnerName: z.string().optional(),
  petBehavior: petBehaviorSchema.optional(), petBehaviorEvent: z.number().int().nonnegative().optional(),
  aimX: z.number().min(-1).max(1).optional(), aimY: z.number().min(-1).max(1).optional(),
  faceX: z.number().min(-1).max(1).optional(), faceY: z.number().min(-1).max(1).optional(),
  weapon: z.string().nullable().optional(), blocking: z.boolean().optional(), air: z.literal(true).optional(),
  vx: z.number().optional(), vy: z.number().optional(), vz: z.number().optional(),
  state: z.enum(["flying", "placed"]).optional(), expiresAtTick: z.number().int().optional(),
  lootOwnerName: z.string().optional(), lootKillerId: z.string().optional(),
  lootKillerName: z.string().optional(), lootUnlockAtTick: z.number().int().optional(),
});
export type EntitySnapshot = z.infer<typeof entitySnapshotSchema>;

export const partySnapshotSchema = z.object({
  id: z.string(),
  leaderId: z.string(),
  /** Members incl. off-AOI position pings — they're your people. */
  members: z.array(z.object({
    id: z.string(), name: z.string(), x: z.number(), y: z.number(),
    hp: z.number(), maxHp: z.number(), downed: z.boolean(),
    disconnected: z.boolean().optional(),
    /** Epic 11 core: teammate's level (party-frame badge, client TBD). */
    level: z.number().int().positive().optional(),
  })),
}).nullable();

export const areaTileSchema = z.object({
  x: z.number().int(), y: z.number().int(), defId: z.string().nullable(),
  /** Ordered active layers; omitted for legacy single-layer tiles. */
  layers: z.array(z.string()).min(2).max(3).optional(),
});
export type AreaTileUpdate = z.infer<typeof areaTileSchema>;

export const safeRoomDoorSnapshotSchema = z.object({
  x: z.number().int(), y: z.number().int(),
  tile: z.union([z.literal(3), z.literal(4)]),
  featureFace: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  featureHeight: z.number(), ownerId: z.string(), label: z.string().optional(),
});
export type SafeRoomDoorSnapshot = z.infer<typeof safeRoomDoorSnapshotSchema>;

export const miniBossArenaGateSnapshotSchema = z.object({
  x: z.number().int(), y: z.number().int(),
});
export type MiniBossArenaGateSnapshot = z.infer<typeof miniBossArenaGateSnapshotSchema>;
