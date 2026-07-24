import { encodeMessage, type ServerStateSnapshot } from "@dc2d/engine";
import { WebSocket } from "ws";
import type { FloorRegistry } from "../floorRegistry.js";
import type { GameSim } from "../sim/index.js";
import type { SocketMap } from "./types.js";

/** The 20Hz tick: step the dungeon floor registry + sandbox, apply any
 * floor transfers to socket routing, and ship snapshots out. */

export function broadcastTick(floors: FloorRegistry, sandbox: GameSim, sockets: SocketMap): void {
  const { snapshots, moved } = floors.stepAllReplicated();
  for (const { playerId, sim } of moved) {
    const entry = sockets.get(playerId);
    if (entry) entry.sim = sim;
  }
  sendSnapshots(snapshots, sockets);
  sendSnapshots(sandbox.stepReplicated(), sockets);
}

function sendSnapshots(snapshots: Map<string, ServerStateSnapshot>, sockets: SocketMap): void {
  for (const [id, snapshot] of snapshots) {
    const socket = sockets.get(id)?.ws;
    if (socket?.readyState === WebSocket.OPEN) socket.send(encodeMessage(snapshot));
  }
}
