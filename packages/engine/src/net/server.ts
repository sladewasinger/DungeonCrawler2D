import { z } from "zod";

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

export const selfSnapshotSchema = bodySnapshotSchema.extend({
  hp: z.number(),
  maxHp: z.number(),
  /** Active status ids (HUD icons / tint). */
  fx: z.array(z.string()),
  downed: z.boolean().optional(),
});

export const entitySnapshotSchema = z.object({
  id: z.string(),
  kind: z.enum(["player", "enemy", "item", "projectile", "torch"]),
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
  anim: enemyAnimationStateSchema.optional(),
  aimX: z.number().min(-1).max(1).optional(),
  aimY: z.number().min(-1).max(1).optional(),
  faceX: z.number().min(-1).max(1).optional(),
  faceY: z.number().min(-1).max(1).optional(),
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
    channel: z.enum(["party", "local", "global", "dm", "system"]),
    from: z.string(),
    name: z.string(),
    text: z.string(),
    /** The other party's display name — set on "dm" so either side can render
     * tabs/threads and resolve /r without guessing who "the other end" was. */
    target: z.string().optional(),
  }),
  z.object({ t: z.literal("toast"), msg: z.string() }),
  z.object({ t: z.literal("invite"), from: z.string(), name: z.string() }),
  z.object({ t: z.literal("teleported") }),
  z.object({
    t: z.literal("stash"),
    slots: z.array(z.object({ item: z.string(), qty: z.number().int() })),
  }),
  /** Full mutual-contact list, sent after any fistbump-created contact and
   * on join — online resolved live, offline falls back to last-known name. */
  z.object({
    t: z.literal("contactsUpdated"),
    contacts: z.array(z.object({ name: z.string(), online: z.boolean() })),
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
  level,
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
