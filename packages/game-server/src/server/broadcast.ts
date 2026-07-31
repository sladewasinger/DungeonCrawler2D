import type { FloorRegistry } from "../floors/floorRegistry.js";
import type { GameSim } from "../sim/core/index.js";
import type { PreparedSnapshotDelivery } from "../sim/snapshots/snapshots.js";
import { sendServerMessage } from "./telemetry/measuredSend.js";
import type { SocketMap } from "./types.js";
import type { ServerNetworkDiagnostics } from "./telemetry/networkDiagnostics.js";
import type { AdminController } from "./admin/controller.js";
import type { AdminStateSubscriptions } from "./admin/observer/adminStateSubscriptions.js";
import { expireInactiveGameplayConnections } from "./connection/activity/gameplayInactivity.js";
import type { SpectatorSubscriptions } from "./spectator/spectatorSubscriptions.js";

export interface BroadcastContext {
  floors: FloorRegistry;
  sandbox: GameSim;
  sockets: SocketMap;
  diagnostics: ServerNetworkDiagnostics | undefined;
  admin?: AdminController;
  adminSubscriptions?: AdminStateSubscriptions;
  spectatorSubscriptions?: SpectatorSubscriptions;
  gameplayIdleTimeoutMs?: number;
}

export interface SnapshotDeliveryContext {
  snapshots: Map<string, PreparedSnapshotDelivery>;
  sockets: SocketMap;
  diagnostics: ServerNetworkDiagnostics | undefined;
}

/** The 20Hz tick: step the dungeon floor registry + sandbox, apply any
 * floor transfers to socket routing, and ship snapshots out. */

export function broadcastTick(input: BroadcastContext): void {
  const { floors, sandbox, sockets, diagnostics, admin, adminSubscriptions, spectatorSubscriptions, gameplayIdleTimeoutMs } = input;
  expireInactiveGameplayConnections({
    sockets,
    diagnostics,
    now: Date.now(),
    ...(gameplayIdleTimeoutMs ? { timeoutMs: gameplayIdleTimeoutMs } : {}),
  });
  const { snapshots, moved } = floors.stepAllPreparedReplicated();
  for (const { playerId, sim } of moved) {
    const entry = sockets.get(playerId);
    if (entry) entry.sim = sim;
  }
  spectatorSubscriptions?.prepare();
  deliverWorldSnapshots({ snapshots, sockets, diagnostics, spectatorSubscriptions });
  const sandboxSnapshots = sandbox.stepPreparedReplicated();
  deliverWorldSnapshots({
    snapshots: sandboxSnapshots,
    sockets,
    diagnostics,
    spectatorSubscriptions,
  });
  spectatorSubscriptions?.refresh();
  if (admin && adminSubscriptions) adminSubscriptions.broadcast(admin, diagnostics);
}

function deliverWorldSnapshots(input: SnapshotDeliveryContext & {
  readonly spectatorSubscriptions: SpectatorSubscriptions | undefined;
}): void {
  deliverSnapshots(input);
  input.spectatorSubscriptions?.deliver(input.snapshots);
}

export function deliverSnapshots({ snapshots, sockets, diagnostics }: SnapshotDeliveryContext): void {
  for (const [id, delivery] of snapshots) {
    const socket = sockets.get(id)?.ws;
    if (!socket) continue;
    if (sendServerMessage({ socket, playerId: id, message: delivery.snapshot, diagnostics })) delivery.commit();
  }
}
