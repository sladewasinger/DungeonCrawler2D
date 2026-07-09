import { z } from "zod";

/**
 * Wire protocol v2, shared by client and server. JSON-encoded (binary
 * is a v0.9 optimization). The server zod-validates every inbound
 * message — the client is untrusted input, doubly so in PvP. Clients
 * send INTENTS; the server replies with what actually happened.
 */

const axis = z.union([z.literal(-1), z.literal(0), z.literal(1)]);
const slot = z.number().int().min(0).max(8);

// ── client → server ────────────────────────────────────────────────

export const clientHelloSchema = z.object({
  type: z.literal("hello"),
  protocol: z.number().int(),
  name: z.string().min(1).max(16),
  /** Persistent anonymous identity (stash/slot ownership). */
  clientId: z.string().min(4).max(64),
  resumeToken: z.string().max(64).optional(),
});

export const clientInputSchema = z.object({
  type: z.literal("input"),
  seq: z.number().int().nonnegative(),
  moveX: axis,
  moveY: axis,
  jump: z.boolean(),
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
export const clientInteractSchema = z.object({ type: z.literal("interact") });
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

export const clientChatSchema = z.object({
  type: z.literal("chat"),
  channel: z.enum(["party", "local"]),
  text: z.string().min(1).max(200),
});

export const clientPingSchema = z.object({ type: z.literal("ping"), t: z.number() });

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
  clientPickupSchema,
  clientDropSchema,
  clientAssignSchema,
  clientEquipSchema,
  clientInteractSchema,
  clientCraftSchema,
  clientStashSchema,
  clientPartySchema,
  clientChatSchema,
  clientPingSchema,
  clientDebugSchema,
]);

export type ClientHello = z.infer<typeof clientHelloSchema>;
export type ClientInput = z.infer<typeof clientInputSchema>;
export type ClientMessage = z.infer<typeof clientMessageSchema>;

// ── server → client ────────────────────────────────────────────────

export const bodySnapshotSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  zVel: z.number(),
  grounded: z.boolean(),
  kx: z.number(),
  ky: z.number(),
});

export const selfSnapshotSchema = bodySnapshotSchema.extend({
  hp: z.number(),
  maxHp: z.number(),
  /** Active status ids (HUD icons / tint). */
  fx: z.array(z.string()),
  downed: z.boolean().optional(),
});

export const entitySnapshotSchema = z.object({
  id: z.string(),
  kind: z.enum(["player", "enemy", "item", "projectile"]),
  defId: z.string().optional(),
  name: z.string().optional(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  hp: z.number().optional(),
  maxHp: z.number().optional(),
  fx: z.array(z.string()).optional(),
  qty: z.number().optional(),
  downed: z.boolean().optional(),
  /** Present iff airborne — grounded entities render planted on their
   * shadow (interpolating z across height steps must not read as a hop). */
  air: z.literal(true).optional(),
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
    /** Members incl. off-AOI position pings — they're your people. */
    members: z.array(
      z.object({ id: z.string(), name: z.string(), x: z.number(), y: z.number() }),
    ),
  })
  .nullable();

export const gameEventSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("hit"), id: z.string(), amount: z.number() }),
  z.object({ t: z.literal("death"), id: z.string() }),
  z.object({ t: z.literal("status"), id: z.string(), status: z.string(), on: z.boolean() }),
  z.object({
    t: z.literal("chat"),
    channel: z.enum(["party", "local", "system"]),
    from: z.string(),
    name: z.string(),
    text: z.string(),
  }),
  z.object({ t: z.literal("toast"), msg: z.string() }),
  z.object({ t: z.literal("invite"), from: z.string(), name: z.string() }),
  z.object({ t: z.literal("teleported") }),
  z.object({
    t: z.literal("stash"),
    slots: z.array(z.object({ item: z.string(), qty: z.number().int() })),
  }),
]);
export type GameEvent = z.infer<typeof gameEventSchema>;

export const areaTileSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  defId: z.string().nullable(),
});
export type AreaTileUpdate = z.infer<typeof areaTileSchema>;

export const serverWelcomeSchema = z.object({
  type: z.literal("welcome"),
  protocol: z.number().int(),
  playerId: z.string(),
  resumeToken: z.string(),
  worldSeed: z.number().int(),
  floor: z.number().int(),
  tickRate: z.number().int(),
  spawn: z.object({ x: z.number(), y: z.number(), z: z.number() }),
});

export const serverSnapshotSchema = z.object({
  type: z.literal("snapshot"),
  tick: z.number().int(),
  lastSeq: z.number().int(),
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
  serverPongSchema,
  serverErrorSchema,
]);

export type ServerWelcome = z.infer<typeof serverWelcomeSchema>;
export type ServerSnapshot = z.infer<typeof serverSnapshotSchema>;
export type ServerMessage = z.infer<typeof serverMessageSchema>;

// ── encode / decode ────────────────────────────────────────────────

export function encodeMessage(msg: ClientMessage | ServerMessage): string {
  return JSON.stringify(msg);
}

export function decodeClientMessage(raw: string): ClientMessage | null {
  try {
    const parsed = clientMessageSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function decodeServerMessage(raw: string): ServerMessage | null {
  try {
    const parsed = serverMessageSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
