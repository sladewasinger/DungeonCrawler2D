import { z } from "zod";
import { PLAYER_SKINS } from "../entities/playerAppearance.js";
import { gameEventSchema } from "./serverEvents.js";

export { gameEventSchema, type GameEvent } from "./serverEvents.js";

/** Zod schemas and types for server→client wire messages (authoritative snapshots and events). */

const level = z.enum(["dungeon", "sandbox"]);
export const enemyAnimationStateSchema = z.enum(["idle", "walk", "windup", "spit", "recover", "attack"]);
export type EnemyAnimationState = z.infer<typeof enemyAnimationStateSchema>;

export const bodySnapshotSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  zVel: z.number(),
  grounded: z.boolean(),
  coyoteTime: z.number().nonnegative(),
  jumpBuffer: z.number().nonnegative(),
  jumpHeld: z.boolean(),
  kx: z.number(),
  ky: z.number(),
});

export const activeStatusSnapshotSchema = z.object({
  id: z.string(),
  /** Authoritative seconds remaining; null denotes an indefinite status. */
  remainingSeconds: z.number().nonnegative().nullable(),
  /** Authored total duration; null denotes an indefinite status. */
  durationSeconds: z.number().positive().nullable(),
});
export type ActiveStatusSnapshot = z.infer<typeof activeStatusSnapshotSchema>;

export const selfSnapshotSchema = bodySnapshotSchema.extend({
  hp: z.number(),
  maxHp: z.number(),
  stamina: z.number().nonnegative().optional(),
  maxStamina: z.number().positive().optional(),
  blocking: z.boolean().optional(),
  staminaRecoveryDelaySeconds: z.number().nonnegative().optional(),
  staminaExhausted: z.boolean().optional(),
  healthRegenerationDelaySeconds: z.number().nonnegative().optional(),
  /** Active status ids (HUD icons / tint). */
  fx: z.array(z.string()),
  /** Timed status state for authoritative HUD progress; additive for rolling clients. */
  statusEffects: z.array(activeStatusSnapshotSchema).optional(),
  downed: z.boolean().optional(),
  downedUntilTick: z.number().int().nullable().optional(),
  reviveProgress: z.number().min(0).max(1).optional(),
  reviverName: z.string().optional(),
  /** Authoritative automatic-respawn deadline; null while alive. */
  respawnAtTick: z.number().int().nullable().optional(),
  /** Epic 11 core (character levels), pulled forward into Epic 7.13 —
   * current XP, character level, and XP still needed for the next level.
   * Additive/optional: protocol 14+ (ASSUMPTION #90, docs/ASSUMPTIONS.md). */
  xp: z.number().int().nonnegative().optional(),
  level: z.number().int().positive().optional(),
  xpForNext: z.number().int().nonnegative().optional(),
  /** Epic 7.14 (The Descent) — current floor and the deepest floor this
   * clientId has ever reached. Additive/optional: protocol 15+. */
  floor: z.number().int().positive().optional(),
  deepestFloor: z.number().int().positive().optional(),
});

export const entitySnapshotSchema = z.object({
  id: z.string(),
  kind: z.enum(["player", "enemy", "pet", "item", "projectile", "torch"]),
  defId: z.string().optional(),
  name: z.string().optional(),
  skin: z.enum(PLAYER_SKINS).optional(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  hp: z.number().optional(),
  maxHp: z.number().optional(),
  fx: z.array(z.string()).optional(),
  qty: z.number().optional(),
  downed: z.boolean().optional(),
  /** Public AOI-scoped revive hold state for rendering the progress ring over a downed crawler. */
  reviveProgress: z.number().min(0).max(1).optional(),
  disconnected: z.boolean().optional(),
  anim: enemyAnimationStateSchema.optional(),
  /** Pet owner display name, present only after a pet has been claimed. */
  petOwnerName: z.string().optional(),
  aimX: z.number().min(-1).max(1).optional(),
  aimY: z.number().min(-1).max(1).optional(),
  faceX: z.number().min(-1).max(1).optional(),
  faceY: z.number().min(-1).max(1).optional(),
  weapon: z.string().nullable().optional(),
  blocking: z.boolean().optional(),
  /** Present iff airborne — grounded entities render planted on their
   * shadow (interpolating z across height steps must not read as a hop). */
  air: z.literal(true).optional(),
  /** Velocity (kind === "torch", state "flying") — mirrors the flight
   * arc so observers can render the same trajectory from snapshots. */
  vx: z.number().optional(),
  vy: z.number().optional(),
  vz: z.number().optional(),
  /** Flight/placement state (kind === "torch"). */
  state: z.enum(["flying", "placed"]).optional(),
  /** Tick a placed torch despawns (kind === "torch", state "placed"). */
  expiresAtTick: z.number().int().optional(),
  lootOwnerName: z.string().optional(),
  lootKillerId: z.string().optional(),
  lootKillerName: z.string().optional(),
  lootUnlockAtTick: z.number().int().optional(),
});
export type EntitySnapshot = z.infer<typeof entitySnapshotSchema>;

/** One inventory stack: the unlimited inventory holds one per item def. */
export const invStackSchema = z.object({ item: z.string(), qty: z.number().int() });
export type InvStack = z.infer<typeof invStackSchema>;
/** Stash slots may be empty (the stash keeps its fixed-capacity model). */
export const invSlotSchema = invStackSchema.nullable();
export type InvSlot = z.infer<typeof invSlotSchema>;

export const partySnapshotSchema = z
  .object({
    id: z.string(),
    leaderId: z.string(),
    /** Members incl. off-AOI position pings — they're your people. hp/downed
     * (Epic 7.12) let a party frame show a teammate's status even off-AOI,
     * where entitySnapshot's own hp/downed never reaches this client. */
    members: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        x: z.number(),
        y: z.number(),
        hp: z.number(),
        maxHp: z.number(),
        downed: z.boolean(),
        disconnected: z.boolean().optional(),
        /** Epic 11 core: teammate's level (party-frame badge, client TBD).
         * Additive/optional: protocol 14+ (ASSUMPTION #90). */
        level: z.number().int().positive().optional(),
      }),
    ),
  })
  .nullable();

export const areaTileSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  defId: z.string().nullable(),
});
export type AreaTileUpdate = z.infer<typeof areaTileSchema>;

export const safeRoomDoorSnapshotSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  tile: z.union([z.literal(3), z.literal(4)]),
  ownerId: z.string(),
  label: z.string().optional(),
});
export type SafeRoomDoorSnapshot = z.infer<typeof safeRoomDoorSnapshotSchema>;

export const serverWelcomeSchema = z.object({
  type: z.literal("welcome"),
  protocol: z.number().int(),
  playerId: z.string(),
  resumeToken: z.string(),
  worldSeed: z.number().int(),
  floor: z.number().int(),
  level,
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

/** Negotiated snapshot form: reliable ordered deltas with explicit recovery metadata. */
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
]);

export type ServerWelcome = z.infer<typeof serverWelcomeSchema>;
export type ServerSnapshot = z.infer<typeof serverSnapshotSchema>;
export type EntitySnapshotRevision = z.infer<typeof entitySnapshotRevisionSchema>;
export type EntitySnapshotReference = z.infer<typeof entitySnapshotReferenceSchema>;
export type EntitySnapshotDeltaEntry = z.infer<typeof entitySnapshotDeltaEntrySchema>;
export type ServerSnapshotDelta = z.infer<typeof serverSnapshotDeltaSchema>;
export type ServerStateSnapshot = ServerSnapshot | ServerSnapshotDelta;
export type ServerMessage = z.infer<typeof serverMessageSchema>;
