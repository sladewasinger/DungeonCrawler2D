import type { ClientMessage } from "@dc2d/engine";
import type { SocketMap } from "./types.js";

export function routeAuthenticatedMessage(
  msg: ClientMessage,
  playerId: string,
  sockets: SocketMap,
): void {
  const entry = sockets.get(playerId);
  if (!entry) return;
  if (msg.type === "networkProfile") {
    return entry.sim.configureNetworkProfile(playerId, msg.profile);
  }
  if (msg.type === "snapshotResync") return entry.sim.requestSnapshotBaseline(playerId);
  if (msg.type === "input") return entry.sim.handleInput(playerId, msg);
  if (isActionMessage(msg)) entry.sim.queueAction(playerId, msg);
}

function isActionMessage(msg: ClientMessage): msg is Exclude<ClientMessage,
  { type: "hello" } | { type: "ping" } | { type: "respawn" } |
  { type: "networkProfile" } | { type: "snapshotResync" }
> {
  return msg.type !== "hello" && msg.type !== "ping" && msg.type !== "respawn" &&
    msg.type !== "networkProfile" && msg.type !== "snapshotResync";
}
