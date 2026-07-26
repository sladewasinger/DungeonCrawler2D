import type { WebSocket } from "ws";
import type { SocketMap } from "./types.js";

export function currentSocketOwnsPlayer(
  sockets: SocketMap,
  playerId: string,
  ws: WebSocket,
): boolean {
  return sockets.get(playerId)?.ws === ws;
}
