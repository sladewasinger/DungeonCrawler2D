import type { ClientMessage } from "@dc2d/engine";

export type AdminInboundMessage = Extract<
  ClientMessage,
  { type: "adminAuth" | "adminResume" | "adminCommand" }
>;

export function isAdminMessage(message: ClientMessage): message is AdminInboundMessage {
  return message.type === "adminAuth" || message.type === "adminResume" || message.type === "adminCommand";
}
