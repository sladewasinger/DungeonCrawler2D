import type { ClientMessage } from "@dc2d/engine";
import type { SocketMap } from "../types.js";

const NON_ACTION_TYPES = new Set<ClientMessage["type"]>([
  "hello", "ping", "respawn", "networkProfile", "snapshotResync",
  "spectatorHello", "spectatorCommand", "adminAuth", "adminResume",
  "adminLogout", "adminCommand",
]);

export function routeAuthenticatedMessage(
  msg: ClientMessage,
  playerId: string,
  sockets: SocketMap,
): boolean {
  const entry = sockets.get(playerId);
  if (!entry) return false;
  if (msg.type === "networkProfile") {
    entry.sim.configureNetworkProfile(playerId, msg.profile);
    return false;
  }
  if (msg.type === "snapshotResync") {
    entry.sim.requestSnapshotBaseline(playerId);
    return false;
  }
  if (msg.type === "input") return entry.sim.handleInput(playerId, msg);
  if (isActionMessage(msg)) return entry.sim.queueAction(playerId, msg);
  return false;
}

function isActionMessage(msg: ClientMessage): msg is Exclude<ClientMessage,
  { type: "hello" } | { type: "ping" } | { type: "respawn" } |
  { type: "networkProfile" } | { type: "snapshotResync" } |
  { type: "spectatorHello" } | { type: "spectatorCommand" } |
  { type: "adminAuth" } | { type: "adminResume" } |
  { type: "adminLogout" } | { type: "adminCommand" }
> {
  return !NON_ACTION_TYPES.has(msg.type);
}
