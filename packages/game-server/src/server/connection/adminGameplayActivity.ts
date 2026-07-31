import type { ClientMessage } from "@dc2d/engine";
import { startGameplayActivity } from "./activity/gameplayInactivity.js";
import type { ServerConnectionMessageContext } from "./connectionContext.js";

/** Admin commands are deliberate gameplay actions, not transport heartbeats. */
export function recordLiveAdminActivity(
  msg: ClientMessage,
  context: ServerConnectionMessageContext,
  now = Date.now(),
): void {
  const playerId = context.conn.playerId;
  if (msg.type !== "adminCommand" || !playerId) return;
  const entry = context.sockets.get(playerId);
  if (entry?.ws !== context.ws) return;
  if (!context.conn.adminSession && !entry.sim.admin.isActiveAdmin(playerId)) return;
  startGameplayActivity(context.conn, now);
}
