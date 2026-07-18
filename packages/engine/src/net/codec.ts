import { clientMessageSchema, type ClientMessage } from "./client.js";
import { serverMessageSchema, type ServerMessage } from "./server.js";

/** Encode/decode wire messages as JSON, validating every inbound message against its zod schema. */

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
