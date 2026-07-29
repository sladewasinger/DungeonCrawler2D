import type { FloorRegistry } from "../floors/floorRegistry.js";
import type { GameSim } from "../sim/core/index.js";
import type { PreparedSnapshotDelivery } from "../sim/snapshots/snapshots.js";
import { sendServerMessage } from "./telemetry/measuredSend.js";
import type { SocketMap } from "./types.js";
import type { ServerNetworkDiagnostics } from "./telemetry/networkDiagnostics.js";

export interface BroadcastContext {
  floors: FloorRegistry;
  sandbox: GameSim;
  sockets: SocketMap;
  diagnostics: ServerNetworkDiagnostics | undefined;
}

export interface SnapshotDeliveryContext {
  snapshots: Map<string, PreparedSnapshotDelivery>;
  sockets: SocketMap;
  diagnostics: ServerNetworkDiagnostics | undefined;
}

/** The 20Hz tick: step the dungeon floor registry + sandbox, apply any
 * floor transfers to socket routing, and ship snapshots out. */

export function broadcastTick({ floors, sandbox, sockets, diagnostics }: BroadcastContext): void {
  const { snapshots, moved } = floors.stepAllPreparedReplicated();
  for (const { playerId, sim } of moved) {
    const entry = sockets.get(playerId);
    if (entry) entry.sim = sim;
  }
  deliverSnapshots({ snapshots, sockets, diagnostics });
  deliverSnapshots({ snapshots: sandbox.stepPreparedReplicated(), sockets, diagnostics });
}

export function deliverSnapshots({ snapshots, sockets, diagnostics }: SnapshotDeliveryContext): void {
  for (const [id, delivery] of snapshots) {
    const socket = sockets.get(id)?.ws;
    if (!socket) continue;
    if (sendServerMessage({ socket, playerId: id, message: delivery.snapshot, diagnostics })) delivery.commit();
  }
}
