import {
  PROTOCOL_VERSION,
  type ClientMessage,
} from "@dc2d/engine";
import type { ServerConnectionMessageContext } from "../connection/connectionContext.js";
import { sendServerMessage } from "../telemetry/measuredSend.js";

export function dispatchSpectatorMessage(
  message: ClientMessage,
  context: ServerConnectionMessageContext,
): boolean {
  const subscriptions = context.spectatorSubscriptions;
  if (!subscriptions) return false;
  if (message.type === "spectatorHello") {
    if (message.protocol !== PROTOCOL_VERSION) return rejectProtocol(context);
    subscriptions.start(context.ws, context.conn, message);
    return true;
  }
  if (!subscriptions.has(context.ws)) return false;
  if (message.type === "ping") {
    sendServerMessage({
      socket: context.ws,
      playerId: null,
      message: { type: "pong", t: message.t },
      diagnostics: context.diagnostics,
    });
    return true;
  }
  if (message.type === "spectatorCommand") subscriptions.command(context.ws, message);
  return true;
}

function rejectProtocol(context: ServerConnectionMessageContext): true {
  context.conn.terminationReason = "protocol_mismatch";
  context.ws.close(1002, "protocol mismatch");
  return true;
}
