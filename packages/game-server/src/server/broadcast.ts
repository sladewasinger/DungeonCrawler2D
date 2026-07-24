import type { FloorRegistry } from "../floorRegistry.js";
import type { GameSim } from "../sim/index.js";
import type { PreparedSnapshotDelivery } from "../sim/snapshots.js";
import { sendServerMessage } from "./measuredSend.js";
import type { SocketMap } from "./types.js";
import type { ServerNetworkDiagnostics } from "./networkDiagnostics.js";

/** The 20Hz tick: step the dungeon floor registry + sandbox, apply any
 * floor transfers to socket routing, and ship snapshots out. */

export function broadcastTick(
  floors: FloorRegistry,
  sandbox: GameSim,
  sockets: SocketMap,
  diagnostics?: ServerNetworkDiagnostics,
): void {
  const { snapshots, moved } = floors.stepAllPreparedReplicated();
  for (const { playerId, sim } of moved) {
    const entry = sockets.get(playerId);
    if (entry) entry.sim = sim;
  }
  deliverSnapshots(snapshots, sockets, diagnostics);
  deliverSnapshots(sandbox.stepPreparedReplicated(), sockets, diagnostics);
}

export function deliverSnapshots(
  snapshots: Map<string, PreparedSnapshotDelivery>,
  sockets: SocketMap,
  diagnostics?: ServerNetworkDiagnostics,
): void {
  for (const [id, delivery] of snapshots) {
    const socket = sockets.get(id)?.ws;
    if (!socket) continue;
    if (sendServerMessage(socket, id, delivery.snapshot, diagnostics)) delivery.commit();
  }
}
