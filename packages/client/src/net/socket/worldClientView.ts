/** Client snapshot assembly and welcome/delta state helpers extracted from WorldClientSocket. */
import {
  WorldChunkCache,
  type ChatEntry, type ClientMessage, type DiscoveryStateSnapshot, type GroundLootSnapshot, type InventorySnapshot,
  type PlayerSnapshot, type ProjectileSnapshot, type ServerMessage, type WorldChestSnapshot,
  type WorldEntitySnapshot, type WorldEvent, type WorldWebSnapshot,
} from "@dc2d/engine";
import type { ClientHubState } from "../hubClientBridge.js";

const MODE_SERVER = "server";
import type { LocalSwingTracker } from "../localSwingTracker.js";
import type { RemotePlayerSmoother } from "../remoteInterp.js";
import { nextReconnectDelayMs, resetDisconnectedPlayer, type ConnectionMode, type InputSendState, type StepInputFrame, type WorldViewState } from "../worldClientHelpers.js";
import { applyChestTakeAll, applyChestTransfer } from "../clientInventory.js";
import {
  applyServerSnapshotMessage, attachWorldWebSocket, buildPlayersForSnapshot, createIdleGates, mutateChestEntry,
  resolvedAppearance, sendClientHello, stepWorldClientInput, type ClientGates, type ServerSnapshotTarget, type StepLoopMutable,
} from "./worldClientSocket.js";

export function buildClientViewSnapshot(opts: {
  readonly mode: ConnectionMode; readonly reconnectAttempt: number;
  readonly dayPhase: number; readonly dayPaused: boolean; readonly cache: WorldChunkCache;
  readonly remotePlayers: readonly PlayerSnapshot[]; readonly localPlayer: PlayerSnapshot;
  readonly localPlayerId: string; readonly inventory: InventorySnapshot; readonly swing: LocalSwingTracker;
  readonly smoother: RemotePlayerSmoother; readonly projectiles: readonly ProjectileSnapshot[];
  readonly entities: readonly WorldEntitySnapshot[]; readonly chests: readonly WorldChestSnapshot[];
  readonly groundLoot: readonly GroundLootSnapshot[]; readonly webs: WorldWebSnapshot | undefined;
  readonly events: readonly WorldEvent[]; readonly chatMessages: readonly ChatEntry[];
  readonly discovery: DiscoveryStateSnapshot | undefined; readonly hub: ClientHubState;
  readonly selfAdmin: boolean; readonly pingMs: number | null;
}): WorldViewState {
  const players = buildPlayersForSnapshot({
    isServer: opts.mode === MODE_SERVER, remotePlayers: opts.remotePlayers, localPlayer: opts.localPlayer,
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
    gold: opts.hub.gold, fog: opts.hub.fog, fogVersion: opts.hub.fogVersion,
    stash: opts.hub.stash, bounties: opts.hub.bounties, quests: opts.hub.quests,
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

export type TimerSlotKey = "connect" | "reconnect" | "probe";

export function clearManagedTimer(timers: Record<TimerSlotKey, number | null>, key: TimerSlotKey): void {
  const id = timers[key];
  if (id === null) return;
  window.clearTimeout(id);
  timers[key] = null;
}

export function clearAllManagedTimers(timers: Record<TimerSlotKey, number | null>): void {
  clearManagedTimer(timers, "connect");
  clearManagedTimer(timers, "reconnect");
  clearManagedTimer(timers, "probe");
}

export function runClientChestTransfer(opts: {
  readonly chests: readonly WorldChestSnapshot[];
  readonly inv: InventorySnapshot;
  readonly req: { readonly chestId: string; readonly from: "chest" | "inv"; readonly fromSlot: number; readonly to: "chest" | "inv"; readonly toSlot: number; readonly quick?: boolean | undefined };
}) {
  const next = mutateChestEntry(opts.chests, opts.req.chestId, (chest) => applyChestTransfer({ inv: opts.inv, chest, ...opts.req }));
  const rejectedQuick = Boolean(next && !next.changed && opts.req.quick && opts.req.from === "chest");
  return { next, rejectedQuick };
}

export function runClientChestTakeAll(chests: readonly WorldChestSnapshot[], chestId: string, inv: InventorySnapshot) {
  const next = mutateChestEntry(chests, chestId, (chest) => applyChestTakeAll({ inv, chest }));
  return { next, blocked: Boolean(next && !next.changed) };
}

export function scheduleClientReconnect(opts: {
  readonly timers: Record<TimerSlotKey, number | null>;
  readonly retry: boolean;
  readonly attempt: number;
  readonly onConnect: () => void;
}): number {
  if (!opts.retry || opts.timers.reconnect !== null) return opts.attempt;
  opts.timers.reconnect = window.setTimeout(() => { opts.timers.reconnect = null; opts.onConnect(); }, nextReconnectDelayMs(opts.attempt));
  return opts.attempt + 1;
}

export function openManagedClientSocket(opts: {
  readonly url: string;
  readonly isCurrent: (ws: WebSocket) => boolean;
  readonly getHelloCtx: () => { readonly player: PlayerSnapshot; readonly auth: { readonly accountId: string; readonly resumeToken: string } | null };
  readonly onMessage: (raw: string) => void;
  readonly onDrop: () => void;
  readonly onHandshakeTimeout: (ws: WebSocket) => void;
  readonly timers: Record<TimerSlotKey, number | null>;
  readonly timeoutMs: number;
}): WebSocket | null {
  const ws = attachWorldWebSocket({
    url: opts.url,
    isCurrent: opts.isCurrent,
    onOpen: () => { const ctx = opts.getHelloCtx(); sendClientHello(ws, ctx.player, ctx.auth); },
    onMessage: opts.onMessage,
    onDrop: opts.onDrop,
  });
  if (!ws) return null;
  opts.timers.connect = window.setTimeout(() => opts.onHandshakeTimeout(ws), opts.timeoutMs);
  return ws;
}

import type { OfflineWorldController, OfflineStateSlice } from "../offline/offlineWorldController.js";

export function scheduleClientResumeProbe(opts: {
  readonly timers: Record<TimerSlotKey, number | null>;
  readonly sendPing: (sentAt: number) => void;
  readonly isStale: (sentAt: number) => boolean;
  readonly onStale: () => void;
  readonly probeMs: number;
}): void {
  const sentAt = performance.now();
  opts.sendPing(sentAt);
  clearManagedTimer(opts.timers, "probe");
  opts.timers.probe = window.setTimeout(() => {
    opts.timers.probe = null;
    if (opts.isStale(sentAt)) opts.onStale();
  }, opts.probeMs);
}

export function runStepWorldClientFrame(opts: {
  readonly state: StepLoopMutable;
  readonly mode: ConnectionMode;
  readonly offlineOnly: boolean;
  readonly cache: WorldChunkCache;
  readonly dayPhase: number;
  readonly inventory: InventorySnapshot;
  readonly swing: LocalSwingTracker;
  readonly smoother: RemotePlayerSmoother;
  readonly queuedEvents: WorldEvent[];
  readonly send: (msg: ClientMessage) => void;
  readonly input: StepInputFrame;
  readonly offline: OfflineWorldController;
  readonly offlineSlice: () => OfflineStateSlice;
}): { readonly player: PlayerSnapshot; readonly inventory: InventorySnapshot } {
  const isServer = opts.mode === MODE_SERVER;
  stepWorldClientInput({
    state: opts.state, isServer, offlinePlayable: opts.offlineOnly, cache: opts.cache, dayPhase: opts.dayPhase,
    inventory: opts.inventory, swing: opts.swing, smoother: opts.smoother, queuedEvents: opts.queuedEvents, send: opts.send,
  }, opts.input);
  if (!isServer) return opts.offline.step(opts.offlineSlice(), opts.input.dt);
  return { player: opts.state.player, inventory: opts.inventory };
}

export interface StreamResetOut {
  readonly entities: readonly WorldEntitySnapshot[];
  readonly projectiles: readonly ProjectileSnapshot[];
  readonly webs: WorldWebSnapshot | undefined;
  readonly localBowDrawing: boolean;
  readonly selfAdmin: boolean;
  readonly pingMs: null;
  readonly pingTimerSec: 0;
  readonly sendState: InputSendState;
  readonly localPlayer: PlayerSnapshot;
}

export function buildDisconnectedStreamReset(localPlayer: PlayerSnapshot, resetId: boolean, sendState: InputSendState): StreamResetOut {
  return {
    entities: [], projectiles: [], webs: undefined, localBowDrawing: false, selfAdmin: false,
    pingMs: null, pingTimerSec: 0, sendState, localPlayer: resetDisconnectedPlayer(localPlayer, resetId),
  };
}

export function dispatchSnapshotToTarget(target: ServerSnapshotTarget, msg: Extract<ServerMessage, { t: "snapshot" }>): ServerSnapshotTarget {
  applyServerSnapshotMessage(target, msg);
  return target;
}

function sendServerStructureMsg(
  send: (msg: ClientMessage) => void,
  req: Parameters<typeof applyClientStructureAction>[0]["req"],
  seq: number,
): void {
  if (req.kind === "place") {
    send({ t: "placeStructure", itemId: req.itemId, x: req.x, y: req.y, rotation: req.rotation, seq });
    return;
  }
  send(req.kind === "dismantle"
    ? { t: "dismantleStructure", structureId: req.structureId, seq }
    : { t: "setRespawnBed", structureId: req.structureId, seq });
}

export function applyClientStructureAction(opts: {
  readonly mode: ConnectionMode;
  readonly req: { readonly kind: "place"; readonly itemId: string; readonly x: number; readonly y: number; readonly rotation?: number | undefined }
    | { readonly kind: "dismantle" | "bed"; readonly structureId: string };
  readonly seq: number;
  readonly send: (msg: ClientMessage) => void;
  readonly offline: OfflineWorldController;
  readonly slice: () => OfflineStateSlice;
  readonly onResult: (res: { readonly player: PlayerSnapshot; readonly inv?: InventorySnapshot; readonly chests?: readonly WorldChestSnapshot[] }) => void;
}): void {
  const { mode, req, seq, send, offline, slice, onResult } = opts;
  if (mode === MODE_SERVER) { sendServerStructureMsg(send, req, seq); return; }
  if (req.kind === "place") {
    const res = offline.place(slice(), req);
    if (res) onResult({ player: res.player, inv: res.inventory, chests: res.chests });
    return;
  }
  if (req.kind === "dismantle") {
    const res = offline.dismantle(slice(), req.structureId);
    onResult({ player: res.player, inv: res.inventory, chests: res.chests });
    return;
  }
  const p = offline.bindBed(slice(), req.structureId);
  if (p) onResult({ player: p });
}
