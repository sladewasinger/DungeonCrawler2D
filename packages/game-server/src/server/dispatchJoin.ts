import { LEVEL, type ClientHello } from "@dc2d/engine";
import type { WebSocket } from "ws";
import type { FloorRegistry } from "../floors/floorRegistry.js";
import type { GameSim } from "../sim/core/index.js";
import { startGameplayActivity } from "./connection/activity/gameplayInactivity.js";
import { recordConnectionJoined } from "./connection/connectionLifecycle.js";
import type { ServerConnectionMessageContext } from "./connection/connectionContext.js";
import type { ConnState } from "./types.js";
import { sendWelcome } from "./welcome.js";

export function addJoinedPlayer(sim: GameSim, msg: ClientHello): ReturnType<GameSim["addPlayer"]> {
  return sim.addPlayer({
    name: msg.name, clientId: msg.clientId, resumeToken: msg.resumeToken,
    skin: msg.skin, clientMetadata: msg.clientMetadata,
  });
}

export async function resolveJoinSim(
  msg: ClientHello,
  simulations: { readonly floors: FloorRegistry; readonly sandbox: GameSim; readonly combatSandbox: GameSim },
): Promise<GameSim> {
  if (msg.level === LEVEL.Sandbox) return simulations.sandbox;
  if (msg.level === LEVEL.CombatSandbox) return simulations.combatSandbox;
  if (msg.resumeToken) {
    const resumed = simulations.floors.findByToken(msg.resumeToken);
    if (resumed) return resumed;
  }
  return simulations.floors.prepareJoinSim(msg.clientId);
}

export function registerJoinedConnection(input: {
  readonly context: ServerConnectionMessageContext; readonly msg: ClientHello;
  readonly sim: GameSim; readonly join: ReturnType<GameSim["addPlayer"]>;
}): void {
  const { context, msg, sim, join } = input;
  const { ws, conn, sockets } = context;
  context.adminSessions.unbind(ws); conn.playerId = join.playerId; startGameplayActivity(conn);
  conn.adminSession = null;
  const previous = sockets.get(join.playerId);
  sockets.set(join.playerId, { ws, sim, conn });
  closePreviousSocket(previous, ws);
  recordConnectionJoined({
    events: context.operationalEvents, conn, playerId: join.playerId,
    level: msg.level, resumed: join.resumed,
  });
}

export function sendJoinWelcome(input: {
  readonly context: ServerConnectionMessageContext; readonly msg: ClientHello;
  readonly sim: GameSim; readonly join: ReturnType<GameSim["addPlayer"]>; readonly inputText: string;
}): void {
  const { context, msg, sim, join, inputText } = input;
  const finiteFloorArtifact = msg.level === LEVEL.Dungeon
    ? context.floors.finiteFloorArtifact(sim.world.floor) : undefined;
  sendWelcome({
    ws: context.ws, join, level: msg.level, seedInputText: inputText, worldSeed: context.worldSeed,
    worldFeatures: sim.world.features,
    ...(sim.world.floorIdentity ? { generation: sim.world.floorIdentity } : {}),
    ...(finiteFloorArtifact ? { finiteFloorArtifact } : {}), diagnostics: context.diagnostics,
  });
}

function closePreviousSocket(previous: { ws: WebSocket; conn?: ConnState } | undefined, current: WebSocket): void {
  if (!previous || previous.ws === current) return;
  if (previous.conn) previous.conn.terminationReason = "resumed_elsewhere";
  previous.ws.close(1000, "resumed elsewhere");
}
