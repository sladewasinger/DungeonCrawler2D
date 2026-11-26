/** Per-session Fog-of-War delta streaming, Stash/Bounty/Quest sync, and Hub message routing. */
import type { ClientMessage } from "@dc2d/engine";
import type { WorldSim } from "../sim/worldSim.js";
import type { ClientSession } from "./wsSession.js";

function resolveSessionHubState(sim: WorldSim, session: ClientSession) {
  const p = sim.getPlayer(session.playerId);
  if (!p || p.hubRev === session.lastHubRev) return {};
  session.lastHubRev = p.hubRev;
  const hubState = sim.hubs.exportAccountExtras(p.accountId);
  return { selfStash: hubState.stashSlots, selfBounties: hubState.bounties, selfQuests: hubState.quests };
}

export function buildHubSnapshotExtras(sim: WorldSim, session: ClientSession) {
  const selfFogDelta = session.hasInitialFogSent
    ? sim.drainFogDeltas(session.playerId)
    : sim.fullFogDeltas(session.playerId);
  session.hasInitialFogSent = true;
  return {
    ...(selfFogDelta.length > 0 ? { selfFogDelta } : {}),
    ...resolveSessionHubState(sim, session),
  };
}

export function buildHubMessageHandlers(ctx: {
  readonly msg: ClientMessage; readonly session: ClientSession; readonly sim: WorldSim;
}) {
  const { msg, session, sim } = ctx;
  const pid = session.playerId;
  return {
    interactNpc: () => msg.t === "interactNpc" && sim.handleHubMessage(pid, msg),
    merchantBuy: () => msg.t === "merchantBuy" && sim.handleHubMessage(pid, msg),
    merchantSell: () => msg.t === "merchantSell" && sim.handleHubMessage(pid, msg),
    blacksmithReforge: () => msg.t === "blacksmithReforge" && sim.handleHubMessage(pid, msg),
    blacksmithUpgrade: () => msg.t === "blacksmithUpgrade" && sim.handleHubMessage(pid, msg),
    bountyAccept: () => msg.t === "bountyAccept" && sim.handleHubMessage(pid, msg),
    bountyClaim: () => msg.t === "bountyClaim" && sim.handleHubMessage(pid, msg),
    questAccept: () => msg.t === "questAccept" && sim.handleHubMessage(pid, msg),
    questClaim: () => msg.t === "questClaim" && sim.handleHubMessage(pid, msg),
    stashTransfer: () => msg.t === "stashTransfer" && sim.handleHubMessage(pid, msg),
    stashQuickMove: () => msg.t === "stashQuickMove" && sim.handleHubMessage(pid, msg),
    stashTakeAll: () => msg.t === "stashTakeAll" && sim.handleHubMessage(pid, msg),
  } as const;
}
