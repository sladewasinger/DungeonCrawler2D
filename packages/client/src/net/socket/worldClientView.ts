/** Client snapshot assembly and welcome/delta state helpers extracted from WorldClientSocket. */
import {
  WorldChunkCache,
  type ChatEntry, type DiscoveryStateSnapshot, type GroundLootSnapshot, type InventorySnapshot,
  type PlayerSnapshot, type ProjectileSnapshot, type ServerMessage, type WorldChestSnapshot,
  type WorldEntitySnapshot, type WorldEvent, type WorldWebSnapshot,
} from "@dc2d/engine";
import type { LocalSwingTracker } from "../localSwingTracker.js";
import type { RemotePlayerSmoother } from "../remoteInterp.js";
import type { ConnectionMode, WorldViewState } from "../worldClientHelpers.js";
import { buildPlayersForSnapshot, createIdleGates, resolvedAppearance, type ClientGates } from "./worldClientSocket.js";

export function buildClientViewSnapshot(opts: {
  readonly mode: ConnectionMode; readonly reconnectAttempt: number;
  readonly dayPhase: number; readonly dayPaused: boolean; readonly cache: WorldChunkCache;
  readonly remotePlayers: readonly PlayerSnapshot[]; readonly localPlayer: PlayerSnapshot;
  readonly localPlayerId: string; readonly inventory: InventorySnapshot; readonly swing: LocalSwingTracker;
  readonly smoother: RemotePlayerSmoother; readonly projectiles: readonly ProjectileSnapshot[];
  readonly entities: readonly WorldEntitySnapshot[]; readonly chests: readonly WorldChestSnapshot[];
  readonly groundLoot: readonly GroundLootSnapshot[]; readonly webs: WorldWebSnapshot | undefined;
  readonly events: readonly WorldEvent[]; readonly chatMessages: readonly ChatEntry[];
  readonly discovery: DiscoveryStateSnapshot | undefined; readonly selfAdmin: boolean; readonly pingMs: number | null;
}): WorldViewState {
  const players = buildPlayersForSnapshot({
    isServer: opts.mode === "server", remotePlayers: opts.remotePlayers, localPlayer: opts.localPlayer,
    localPlayerId: opts.localPlayerId, inventory: opts.inventory, swing: opts.swing, smoother: opts.smoother,
  });
  return {
    mode: opts.mode, reconnectAttempt: opts.reconnectAttempt, dayPhase: opts.dayPhase, dayPaused: opts.dayPaused,
    cache: opts.cache, players, localPlayerId: opts.localPlayerId, inventory: opts.inventory,
    localName: opts.localPlayer.name, localAppearance: resolvedAppearance(opts.localPlayer),
    projectiles: opts.projectiles, entities: opts.entities, chests: opts.chests, groundLoot: opts.groundLoot,
    webs: opts.webs, events: opts.events,
    ...(opts.chatMessages.length > 0 ? { chatMessages: opts.chatMessages } : {}),
    ...(opts.discovery ? { discovery: opts.discovery } : {}),
    selfAdmin: opts.selfAdmin, pingMs: opts.pingMs,
  };
}

export function applyWelcomeState(opts: {
  readonly msg: Extract<ServerMessage, { t: "welcome" }>;
  readonly localPlayer: PlayerSnapshot;
  readonly saveToken: (auth: { readonly accountId: string; readonly resumeToken: string }) => void;
}): {
  readonly playerId: string; readonly localPlayer: PlayerSnapshot; readonly gates: ClientGates;
  readonly cache: WorldChunkCache; readonly dayPhase: number; readonly dayPaused: boolean;
} {
  const { msg, localPlayer, saveToken } = opts;
  if (msg.accountId && msg.resumeToken) saveToken({ accountId: msg.accountId, resumeToken: msg.resumeToken });
  return {
    playerId: msg.playerId, localPlayer: { ...localPlayer, id: msg.playerId }, gates: createIdleGates(),
    cache: new WorldChunkCache(msg.worldSeed), dayPhase: msg.dayPhase, dayPaused: msg.dayPaused,
  };
}
