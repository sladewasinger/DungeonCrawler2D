/** WebSocket connection, lifecycle, and snapshot helper utilities for WorldClient. */
import {
  DEFAULT_APPEARANCE, MAX_CHAT_LENGTH, STEALTH_TUNING, ServerMessageSchema,
  type ChatEntry, type ClientMessage, type GroundLootSnapshot, type InventorySnapshot, type PlayerSnapshot,
  type ProjectileSnapshot, type ServerMessage, type WorldChestSnapshot, type WorldChunkCache,
  type WorldEntitySnapshot, type WorldEvent, type WorldWebSnapshot,
} from "@dc2d/engine";
import { IDLE_GATE, resolvePendingGate, type PendingGate } from "../actionGate.js";
import { heldItemForInventory, makeLocalChatEcho, reconcileInventorySnapshot, tickLocalBubbleState } from "../clientInventory.js";
import type { LocalSwingTracker } from "../localSwingTracker.js";
import type { RemotePlayerSmoother } from "../remoteInterp.js";
import { applyLocalAtmosphere, buildInputMessage, mergeStreamEvents, shouldSendInputFrame, type InputSendState, type StepInputFrame } from "../worldClientHelpers.js";
import { normalizeDirection, predictLocalPlayerMove, reconcilePredictedPlayer } from "../worldPrediction.js";

export interface ClientGates {
  inv: PendingGate; chest: PendingGate; torch: PendingGate; day: PendingGate; appearance: PendingGate;
}

export const createIdleGates = (): ClientGates => ({
  inv: IDLE_GATE, chest: IDLE_GATE, torch: IDLE_GATE, day: IDLE_GATE, appearance: IDLE_GATE,
});

export interface ServerSnapshotTarget {
  gates: ClientGates;
  dayPhase: number;
  dayPaused: boolean;
  selfAdmin: boolean;
  inventory: InventorySnapshot;
  localPlayer: PlayerSnapshot;
  remotePlayers: PlayerSnapshot[];
  readonly localPlayerId: string;
  readonly localBowDrawing: boolean;
  readonly remoteSmoother: RemotePlayerSmoother;
  projectiles: readonly ProjectileSnapshot[];
  entities: readonly WorldEntitySnapshot[];
  groundLoot: readonly GroundLootSnapshot[];
  webs: WorldWebSnapshot | undefined;
  chests: readonly WorldChestSnapshot[];
  readonly cache: WorldChunkCache;
  queuedEvents: WorldEvent[];
  readonly queuedChat: ChatEntry[];
  readonly swing: LocalSwingTracker;
}

function reconcilePlayersWithGates(opts: {
  readonly t: ServerSnapshotTarget;
  readonly players: readonly PlayerSnapshot[];
  readonly serverAck: number;
  readonly nowMs: number;
}): void {
  const { t, players, serverAck, nowMs } = opts;
  t.remotePlayers = [...players];
  t.remoteSmoother.setTargets(players, t.localPlayerId);
  const torchRes = resolvePendingGate(t.gates.torch, { serverAck, nowMs });
  const appRes = resolvePendingGate(t.gates.appearance, { serverAck, nowMs });
  t.gates.torch = torchRes.nextGate; t.gates.appearance = appRes.nextGate;
  const me = players.find((p) => p.id === t.localPlayerId);
  if (me) t.localPlayer = reconcilePredictedPlayer(t.localPlayer, me, { preserveTorch: !torchRes.accept, preserveAppearance: !appRes.accept, localBowDrawing: t.localBowDrawing });
}

function applyChestAndDeltas(opts: {
  readonly t: ServerSnapshotTarget;
  readonly msg: Extract<ServerMessage, { t: "snapshot" }>;
  readonly serverAck: number;
  readonly nowMs: number;
}): void {
  const { t, msg, serverAck, nowMs } = opts;
  const chestRes = resolvePendingGate(t.gates.chest, { serverAck, nowMs });
  t.gates.chest = chestRes.nextGate;
  if (chestRes.accept && msg.chests) t.chests = msg.chests;
  if (msg.worldDeltas) t.cache.applyWorldDeltaSnapshot(msg.worldDeltas);
  if (msg.chatMessages?.length) t.queuedChat.push(...msg.chatMessages);
}

function applyStreamEntities(opts: {
  readonly t: ServerSnapshotTarget;
  readonly msg: Extract<ServerMessage, { t: "snapshot" }>;
  readonly serverAck: number;
  readonly nowMs: number;
}): void {
  const { t, msg } = opts;
  t.projectiles = msg.projectiles ?? []; t.entities = msg.entities ?? [];
  t.groundLoot = msg.groundLoot ?? []; t.webs = msg.webs;
  applyChestAndDeltas(opts);
  t.queuedEvents = mergeStreamEvents({ current: t.queuedEvents, incoming: msg.events, stripLocalSwing: t.swing.hasPendingServerSwing(), localId: t.localPlayerId, clearPending: () => t.swing.clearPendingServerSwing() });
}

export function applyServerSnapshotMessage(t: ServerSnapshotTarget, msg: Extract<ServerMessage, { t: "snapshot" }>): void {
  const nowMs = performance.now();
  const serverAck = msg.actionAckSeq ?? msg.selfInventory?.ackSeq ?? 0;
  const dayRes = resolvePendingGate(t.gates.day, { serverAck, nowMs });
  t.gates.day = dayRes.nextGate;
  if (dayRes.accept) { t.dayPhase = msg.dayPhase; t.dayPaused = msg.dayPaused; }
  t.selfAdmin = Boolean(msg.selfAdmin);
  if (msg.selfInventory) {
    const rec = reconcileInventorySnapshot({ current: t.inventory, incoming: { ...msg.selfInventory, ackSeq: serverAck }, pendingSeq: t.gates.inv.pendingSeq, elapsedMs: nowMs - t.gates.inv.atMs });
    t.inventory = rec.inventory;
    if (rec.clearedPending) t.gates.inv = IDLE_GATE;
  }
  reconcilePlayersWithGates({ t, players: msg.players, serverAck, nowMs });
  applyStreamEntities({ t, msg, serverAck, nowMs });
}

export function buildPlayersForSnapshot(opts: {
  readonly isServer: boolean;
  readonly remotePlayers: readonly PlayerSnapshot[];
  readonly localPlayer: PlayerSnapshot;
  readonly localPlayerId: string;
  readonly inventory: InventorySnapshot;
  readonly swing: LocalSwingTracker;
  readonly smoother: RemotePlayerSmoother;
}): PlayerSnapshot[] {
  const localWithGear: PlayerSnapshot = {
    ...opts.localPlayer, heldItem: heldItemForInventory(opts.inventory), armor: opts.inventory.armor, ...opts.swing.snapshotOverride(),
  };
  return opts.isServer ? opts.remotePlayers.map((p) => (p.id === opts.localPlayerId ? localWithGear : opts.smoother.resolve(p))) : [localWithGear];
}

export function buildLocalChatDispatch(opts: {
  readonly rawText: string; readonly shout: boolean; readonly durationSec: number; readonly player: PlayerSnapshot;
}): { readonly clean: string; readonly echo: { readonly player: PlayerSnapshot; readonly entry: ChatEntry } } | null {
  const clean = opts.rawText.replace(/[\r\n\t]/g, " ").trim().slice(0, MAX_CHAT_LENGTH);
  if (!clean) return null;
  return { clean, echo: makeLocalChatEcho({ player: opts.player, text: clean, shout: opts.shout, durationSec: opts.durationSec }) };
}

export const resolvedAppearance = (p: PlayerSnapshot) => p.appearance ?? DEFAULT_APPEARANCE;

export interface StepLoopMutable {
  player: PlayerSnapshot; attackFlashTimer: number; bubbleTimer: number; pingTimerSec: number; seq: number; sendState: InputSendState; bowDrawing: boolean;
}

export interface StepLoopContext {
  readonly state: StepLoopMutable; readonly isServer: boolean; readonly cache: WorldChunkCache; readonly dayPhase: number;
  readonly inventory: InventorySnapshot; readonly swing: LocalSwingTracker; readonly smoother: RemotePlayerSmoother;
  readonly queuedEvents: WorldEvent[]; readonly send: (msg: ClientMessage) => void;
}

function stepServerPrediction(ctx: StepLoopContext, input: StepInputFrame): void {
  const { state } = ctx;
  const heldId = heldItemForInventory(ctx.inventory);
  const moveDir = normalizeDirection(input.move, true) ?? { x: 0, y: 0 };
  const normAim = normalizeDirection(input.aim, false);
  state.bowDrawing = Boolean(input.bowDraw) && heldId === "bow";
  ctx.smoother.step(input.dt);
  const preEvCount = ctx.queuedEvents.length;
  ctx.swing.step({ dt: input.dt, attack: Boolean(input.attack), attackHold: Boolean(input.attackHold), dodge: Boolean(input.dodge), heldId, player: state.player, normAim, isServer: true, events: ctx.queuedEvents });
  if (ctx.queuedEvents.length > preEvCount || input.bowRelease) state.attackFlashTimer = STEALTH_TUNING.attackFlashSec;
  const sendCheck = shouldSendInputFrame({ prev: state.sendState, nowMs: performance.now(), moveDir, normAim, input });
  if (sendCheck.send) { state.sendState = sendCheck.next; ctx.send(buildInputMessage({ seq: ++state.seq, moveDir, normAim, input })); }
  const nextPlayer = { ...state.player, heldItem: heldId, swingProgress: ctx.swing.activeProgress(state.player.swingProgress) };
  state.player = predictLocalPlayerMove({ cache: ctx.cache, player: nextPlayer, nx: moveDir.x, ny: moveDir.y, dt: input.dt, aim: normAim, jump: input.jump, crouch: input.crouch, bowDraw: state.bowDrawing });
}

export function stepWorldClientInput(ctx: StepLoopContext, input: StepInputFrame): void {
  const { state } = ctx;
  if (ctx.isServer) stepServerPrediction(ctx, input);
  state.attackFlashTimer = Math.max(0, state.attackFlashTimer - input.dt);
  if (!ctx.isServer) {
    const res = tickLocalBubbleState(state.player, state.bubbleTimer, input.dt);
    state.player = res.player; state.bubbleTimer = res.timerSec;
  } else {
    state.pingTimerSec += input.dt;
    if (state.pingTimerSec >= 1.0) { state.pingTimerSec = 0; ctx.send({ t: "ping", t0: performance.now() }); }
  }
  const attackFlash = Boolean(state.player.attackFlash) || state.attackFlashTimer > 0;
  state.player = applyLocalAtmosphere({ cache: ctx.cache, player: state.player, dayPhase: ctx.dayPhase, attackFlash, isServer: ctx.isServer });
}

export function mutateChestEntry(
  chests: readonly WorldChestSnapshot[],
  chestId: string,
  mutate: (chest: WorldChestSnapshot) => { readonly inv: InventorySnapshot; readonly chest: WorldChestSnapshot },
): { readonly inv: InventorySnapshot; readonly chests: readonly WorldChestSnapshot[] } | null {
  const chest = chests.find((c) => c.id === chestId);
  if (!chest) return null;
  const next = mutate(chest);
  return { inv: next.inv, chests: chests.map((c) => (c.id === chestId ? next.chest : c)) };
}

export function parseServerMessage(raw: string): ServerMessage | null {
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return null; }
  const parsed = ServerMessageSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

export function attachWorldWebSocket(opts: {
  readonly url: string; readonly isCurrent: (ws: WebSocket) => boolean;
  readonly onOpen: () => void; readonly onMessage: (raw: string) => void; readonly onDrop: () => void;
}): WebSocket | null {
  try {
    const ws = new WebSocket(opts.url);
    ws.addEventListener("open", () => { if (opts.isCurrent(ws)) opts.onOpen(); });
    ws.addEventListener("message", (ev) => { if (opts.isCurrent(ws)) opts.onMessage(String(ev.data)); });
    ws.addEventListener("close", () => { if (opts.isCurrent(ws)) opts.onDrop(); });
    ws.addEventListener("error", () => { if (opts.isCurrent(ws)) opts.onDrop(); });
    return ws;
  } catch { opts.onDrop(); return null; }
}
