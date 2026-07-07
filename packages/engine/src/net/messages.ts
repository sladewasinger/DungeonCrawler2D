import { z } from "zod";

/**
 * The wire protocol, shared by client and server. JSON-encoded for
 * now (binary is a v0.9 optimization). The server zod-validates every
 * inbound message — the client is untrusted input, doubly so in PvP.
 */

const axis = z.union([z.literal(-1), z.literal(0), z.literal(1)]);

// ── client → server ────────────────────────────────────────────────

export const clientHelloSchema = z.object({
  type: z.literal("hello"),
  protocol: z.number().int(),
  name: z.string().min(1).max(16),
  /** Present when attempting to resume a recent session. */
  resumeToken: z.string().max(64).optional(),
});

export const clientInputSchema = z.object({
  type: z.literal("input"),
  /** Monotonic per-client sequence number, echoed back for reconciliation. */
  seq: z.number().int().nonnegative(),
  moveX: axis,
  moveY: axis,
  jump: z.boolean(),
});

export const clientPingSchema = z.object({
  type: z.literal("ping"),
  t: z.number(),
});

export const clientMessageSchema = z.discriminatedUnion("type", [
  clientHelloSchema,
  clientInputSchema,
  clientPingSchema,
]);

export type ClientHello = z.infer<typeof clientHelloSchema>;
export type ClientInput = z.infer<typeof clientInputSchema>;
export type ClientPing = z.infer<typeof clientPingSchema>;
export type ClientMessage = z.infer<typeof clientMessageSchema>;

// ── server → client ────────────────────────────────────────────────

export const bodySnapshotSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  zVel: z.number(),
  grounded: z.boolean(),
});

export const peerSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

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
  /** Last input seq the server has applied for this client. */
  lastSeq: z.number().int(),
  self: bodySnapshotSchema,
  /** Everyone inside this client's area of interest. */
  others: z.array(peerSnapshotSchema),
  /** Ids that left the area of interest since the last snapshot. */
  left: z.array(z.string()),
});

export const serverPongSchema = z.object({
  type: z.literal("pong"),
  t: z.number(),
});

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
export type PeerSnapshot = z.infer<typeof peerSnapshotSchema>;

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
