import { z } from "zod";

/** Zod schemas and types for client→server wire messages (intents, never asserted outcomes). */

// Analog movement magnitude: was literal(-1|0|1) only (keyboard's discrete
// axes); widened additively to any finite value in [-1, 1] so an analog
// source (touch stick) can send fractional magnitude for a walk-to-run
// ramp. Every value the old literal union accepted still parses, so this
// is a superset — no protocol bump. Speedhack overshoot (e.g. moveX: 50)
// still fails validation, same as before.
const axis = z.number().min(-1).max(1);
const slot = z.number().int().min(0).max(8);
const level = z.enum(["dungeon", "sandbox"]);

export const clientHelloSchema = z.object({
  type: z.literal("hello"),
  protocol: z.number().int(),
  name: z.string().min(1).max(16),
  /** Persistent anonymous identity (stash/slot ownership). */
  clientId: z.string().min(4).max(64),
  level: level.default("dungeon"),
  resumeToken: z.string().max(64).optional(),
  /** Epic 7.14 (The Descent): requested starting floor for a FRESH join
   * only — a resumed session always reattaches to whichever floor its
   * slot was already on, ignoring this field. Server clamps to
   * [1, FLOOR_CAP]; absent = floor 1. */
  floor: z.number().int().positive().optional(),
});

export const clientInputSchema = z.object({
  type: z.literal("input"),
  seq: z.number().int().nonnegative(),
  moveX: axis,
  moveY: axis,
  faceX: axis.optional(),
  faceY: axis.optional(),
  jump: z.boolean(),
  /** Hold-to-run intent (Epic 7.12); absent from older clients defaults to walking. */
  run: z.boolean().default(false),
});

export const clientAttackSchema = z.object({
  type: z.literal("attack"),
  dirX: z.number().min(-1).max(1),
  dirY: z.number().min(-1).max(1),
});

export const clientUseSlotSchema = z.object({
  type: z.literal("useSlot"),
  /** Hotbar slot: uses the item def bound there, consuming from inventory. */
  slot,
  /** Present = throw at this tile (if throwable); absent = consume. */
  targetX: z.number().optional(),
  targetY: z.number().optional(),
});

export const clientPickupSchema = z.object({ type: z.literal("pickup") });
/** Drop a whole stack from the unlimited inventory, by item def. */
export const clientDropSchema = z.object({ type: z.literal("drop"), item: z.string().max(64) });
/** Bind an owned item def to a hotbar slot (null clears the binding). */
export const clientAssignSchema = z.object({
  type: z.literal("assign"),
  slot,
  item: z.string().max(64).nullable(),
});
/** Equip an owned weapon def into the character slot (null unequips). */
export const clientEquipSchema = z.object({
  type: z.literal("equip"),
  item: z.string().max(64).nullable(),
});
/** Throw the equipped torch stack toward an aim direction (not a clicked tile) —
 * server clamps/normalizes the vector and rejects it if no torch is carried. */
export const clientThrowTorchSchema = z.object({
  type: z.literal("throwTorch"),
  dirX: z.number(),
  dirY: z.number(),
});

export const clientInteractSchema = z.object({ type: z.literal("interact") });
/** Epic 7.14 (The Descent): valid within interact range of a stairway —
 * near a StairwayDown mouth descends, near a StairwayUp mouth ascends.
 * Server resolves direction from proximity; the client sends the same
 * intent either way. */
export const clientDescendSchema = z.object({ type: z.literal("descend") });
export const clientCraftSchema = z.object({ type: z.literal("craft"), recipe: z.string().max(64) });

export const clientStashSchema = z.object({
  type: z.literal("stash"),
  op: z.enum(["put", "take"]),
  index: z.number().int().min(0).max(63),
});

export const clientPartySchema = z.object({
  type: z.literal("party"),
  op: z.enum(["invite", "accept", "leave"]),
  target: z.string().max(32).optional(),
});

/** target is required for channel "dm" — enforced by the parser/sim, not the
 * wire schema itself (discriminatedUnion members must stay plain objects). */
export const clientChatSchema = z.object({
  type: z.literal("chat"),
  channel: z.enum(["party", "local", "global", "dm"]),
  text: z.string().min(1).max(200),
  /** Recipient display name — required for "dm", ignored otherwise. */
  target: z.string().min(1).max(32).optional(),
});

/** Hold-F contact gesture: valid only in close proximity; server tracks the 10s pending offer. */
export const clientFistbumpSchema = z.object({
  type: z.literal("fistbump"),
  targetId: z.string().max(64),
});

/** /who: server replies with nearby + online counts and names as a system chat line. */
export const clientWhoSchema = z.object({ type: z.literal("who") });

export const clientPingSchema = z.object({ type: z.literal("ping"), t: z.number() });
export const clientSuicideSchema = z.object({ type: z.literal("suicide") });

/**
 * Dev-harness commands (god mode, teleport). The SERVER gates these on
 * its debugCommands option — off, they're dropped like any other
 * malformed intent. Never enabled on a production shard.
 */
export const clientDebugSchema = z.object({
  type: z.literal("debug"),
  op: z.enum(["teleport", "god"]),
  x: z.number().optional(),
  y: z.number().optional(),
  on: z.boolean().optional(),
});

export const clientMessageSchema = z.discriminatedUnion("type", [
  clientHelloSchema,
  clientInputSchema,
  clientAttackSchema,
  clientUseSlotSchema,
  clientThrowTorchSchema,
  clientPickupSchema,
  clientDropSchema,
  clientAssignSchema,
  clientEquipSchema,
  clientInteractSchema,
  clientDescendSchema,
  clientCraftSchema,
  clientStashSchema,
  clientPartySchema,
  clientChatSchema,
  clientFistbumpSchema,
  clientWhoSchema,
  clientPingSchema,
  clientSuicideSchema,
  clientDebugSchema,
]);

export type ClientHello = z.infer<typeof clientHelloSchema>;
export type ClientInput = z.infer<typeof clientInputSchema>;
export type ClientMessage = z.infer<typeof clientMessageSchema>;
