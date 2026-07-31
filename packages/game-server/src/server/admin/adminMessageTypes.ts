import type { ClientMessage } from "@dc2d/engine";

export type AdminInboundMessage = Extract<
  ClientMessage,
  { type: "adminAuth" | "adminResume" | "adminLogout" | "adminCommand" }
>;

export function isAdminMessage(message: ClientMessage): message is AdminInboundMessage {
  return message.type === "adminAuth" || message.type === "adminResume" ||
    message.type === "adminLogout" || message.type === "adminCommand";
}
